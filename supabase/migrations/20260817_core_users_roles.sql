-- ============================================================================
-- Rolvium — Core: roles, users, permissions helpers, RLS
-- ============================================================================
-- Data model
--   roles  — one row per role. `permissions` JSONB:
--              { "modules": ["campaigns", ...], "admin": { "manage_users": true, ... } }
--            The 'admin' role is system-locked and bypasses every check.
--   users  — profile row 1:1 with auth.users (same id). Holds name, avatar,
--            role_id (FK roles), active flag. Created automatically by a
--            trigger on auth.users INSERT so a signup / admin-created user
--            always has a profile.
--
-- Access pattern (drives the RLS below)
--   roles : every authenticated user can READ (the UI needs the role list and
--           its own permissions); only has_permission('manage_roles') can WRITE.
--   users : every authenticated user can READ (member lists at the table);
--           a user can UPDATE its own row but NOT role_id/active/email;
--           has_permission('manage_users') can UPDATE anyone; INSERT/DELETE
--           happen only via the trigger / service role (API).
--
-- Never `TO anon`. Every table has RLS + explicit policies.
-- ============================================================================

BEGIN;

-- ── 1. roles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_system   boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{"modules": [], "admin": {}}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_name_format CHECK (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT roles_permissions_shape CHECK (
    jsonb_typeof(permissions -> 'modules') = 'array'
    AND jsonb_typeof(permissions -> 'admin') = 'object'
  )
);

INSERT INTO public.roles (name, description, is_system, permissions) VALUES
  ('admin',       'Full access. Cannot be edited or deleted.',              true,  '{"modules": [], "admin": {"manage_users": true, "manage_roles": true, "manage_settings": true}}'),
  ('game_master', 'Runs games: creates campaigns and sessions.',            true,  '{"modules": [], "admin": {}}'),
  ('player',      'Default role. Joins campaigns and plays characters.',    true,  '{"modules": [], "admin": {}}')
ON CONFLICT (name) DO NOTHING;

-- ── 2. users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  avatar_url  text,
  role_id     uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_id_idx ON public.users(role_id);
CREATE INDEX IF NOT EXISTS users_email_idx   ON public.users(lower(email));

-- ── 3. updated_at trigger (shared helper) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_touch_updated_at ON public.roles;
CREATE TRIGGER roles_touch_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS users_touch_updated_at ON public.users;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 4. Permission helpers (SECURITY DEFINER so RLS can call them) ───────────
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid() AND u.active
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_name() = 'admin', false)
$$;

-- has_permission('manage_users') → admin OR role.permissions.admin.manage_users = true
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR COALESCE((
    SELECT (r.permissions -> 'admin' ->> perm)::boolean
    FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND u.active
  ), false)
$$;

-- has_module('campaigns') → admin OR 'campaigns' ∈ role.permissions.modules
CREATE OR REPLACE FUNCTION public.has_module(module_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR COALESCE((
    SELECT r.permissions -> 'modules' ? module_id
    FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND u.active
  ), false)
$$;

REVOKE ALL ON FUNCTION public.current_role_name() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_module(text) FROM anon;

-- ── 5. Auto-create profile on signup ────────────────────────────────────────
-- Name comes from raw_user_meta_data.name (set by the API on admin-created
-- users, or by the signup form); falls back to the email local part.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role uuid;
  wanted_role  uuid;
BEGIN
  SELECT id INTO default_role FROM public.roles WHERE name = 'player';
  IF NEW.raw_user_meta_data ? 'role_id' THEN
    SELECT id INTO wanted_role FROM public.roles WHERE id = (NEW.raw_user_meta_data ->> 'role_id')::uuid;
  END IF;
  INSERT INTO public.users (id, name, email, role_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(wanted_role, default_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 6. Guard: users cannot escalate their own row ───────────────────────────
CREATE OR REPLACE FUNCTION public.users_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (API) and permission holders may change anything.
  IF auth.uid() IS NULL OR public.has_permission('manage_users') THEN
    RETURN NEW;
  END IF;
  -- Plain users: only cosmetic fields on their own row.
  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.email  IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'not allowed to change role_id/active/email' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_self_update ON public.users;
CREATE TRIGGER users_guard_self_update BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_self_update();

-- ── 7. Guard: the admin role is immutable ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.roles_guard_system()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'system roles cannot be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.name = 'admin' AND (NEW.permissions IS DISTINCT FROM OLD.permissions OR NEW.name <> OLD.name OR NOT NEW.is_system) THEN
    RAISE EXCEPTION 'the admin role cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF OLD.is_system AND NEW.name <> OLD.name THEN
    RAISE EXCEPTION 'system roles cannot be renamed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_guard_system ON public.roles;
CREATE TRIGGER roles_guard_system BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.roles_guard_system();

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS roles_manage ON public.roles;
CREATE POLICY roles_manage ON public.roles
  FOR ALL TO authenticated
  USING (public.has_permission('manage_roles'))
  WITH CHECK (public.has_permission('manage_roles'));

DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS users_manage ON public.users;
CREATE POLICY users_manage ON public.users
  FOR UPDATE TO authenticated
  USING (public.has_permission('manage_users'))
  WITH CHECK (public.has_permission('manage_users'));

-- Deleting users goes through auth.users (service role) → cascade. No policy.

COMMIT;
