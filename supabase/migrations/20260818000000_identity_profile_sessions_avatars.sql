-- ─────────────────────────────────────────────────────────────────────────────
-- identity (H1): profile preferences, own-sessions RPCs, avatars bucket
-- Spec: specs/modules/identity/SPEC.md
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Profile columns ──────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS alias      text,
  ADD COLUMN IF NOT EXISTS locale     text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS theme_pref text NOT NULL DEFAULT 'system';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_locale_check;
ALTER TABLE public.users ADD CONSTRAINT users_locale_check CHECK (locale IN ('es', 'en'));
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_theme_pref_check;
ALTER TABLE public.users ADD CONSTRAINT users_theme_pref_check CHECK (theme_pref IN ('dark', 'light', 'system'));
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_alias_len_check;
ALTER TABLE public.users ADD CONSTRAINT users_alias_len_check CHECK (alias IS NULL OR char_length(alias) BETWEEN 1 AND 40);

-- ── 2. Sign-up trigger: also copy alias + locale from the sign-up metadata ──
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role uuid;
  wanted_role  uuid;
  wanted_locale text;
BEGIN
  SELECT id INTO default_role FROM public.roles WHERE name = 'player';
  IF NEW.raw_user_meta_data ? 'role_id' THEN
    SELECT id INTO wanted_role FROM public.roles WHERE id = (NEW.raw_user_meta_data ->> 'role_id')::uuid;
  END IF;
  wanted_locale := NEW.raw_user_meta_data ->> 'locale';
  IF wanted_locale IS NULL OR wanted_locale NOT IN ('es', 'en') THEN wanted_locale := 'es'; END IF;
  INSERT INTO public.users (id, name, email, role_id, alias, locale)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(wanted_role, default_role),
    NULLIF(left(NEW.raw_user_meta_data ->> 'alias', 40), ''),
    wanted_locale
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3. Own sessions (read from auth.sessions — no duplicated table) ─────────
-- Both functions act ONLY on auth.uid(): nobody can list or revoke someone else's sessions.
CREATE OR REPLACE FUNCTION public.identity_my_sessions()
RETURNS TABLE (id uuid, user_agent text, ip text, created_at timestamptz, last_seen_at timestamptz, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.user_agent, host(s.ip), s.created_at,
         COALESCE(s.refreshed_at, s.updated_at, s.created_at),
         s.id::text = (auth.jwt() ->> 'session_id')
  FROM auth.sessions s
  WHERE auth.uid() IS NOT NULL AND s.user_id = auth.uid()
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY (s.id::text = (auth.jwt() ->> 'session_id')) DESC, COALESCE(s.refreshed_at, s.updated_at, s.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.identity_revoke_session(sid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  DELETE FROM auth.refresh_tokens WHERE session_id = sid AND user_id = auth.uid()::text;
  DELETE FROM auth.sessions WHERE id = sid AND user_id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.identity_my_sessions(), public.identity_revoke_session(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.identity_my_sessions(), public.identity_revoke_session(uuid) TO authenticated;

-- ── 4. Avatars bucket: public read, owner-folder writes, 2 MB, images only ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase; only owner-folder policies for authenticated.
DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
