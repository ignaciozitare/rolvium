-- ============================================================================
-- Rolvium — campaigns (H2): campaigns, members, join requests, invite codes
-- Spec: specs/modules/campaigns/SPEC.md
-- ============================================================================
-- Data model
--   campaigns_campaigns  — one row per campaign. Pinned to a game system
--                          (system_id + system_version, never changed). Holds
--                          visibility (open | invite), seats, invite code,
--                          table options (progression_enabled, shared_resources
--                          jsonb owned by the system), active scene, next session.
--   campaigns_members    — who is in the campaign and with which table role
--                          (dm | player). The DM row is created with the campaign.
--                          `character_id` links the player's character (FK added
--                          by the characters migration).
--   campaigns_requests   — join requests to open campaigns (pending | accepted |
--                          rejected), resolved by the DM.
--
-- Access pattern (drives the RLS below)
--   campaigns : members read their campaigns; everyone reads OPEN, non-archived
--               campaigns (public catalog); DM (or admin) updates; game masters
--               (role game_master) or admins create; only DM/admin archive/delete.
--               `shared_resources` / `progression_enabled` are updated only by DM
--               (a trigger blocks other columns for non-DM writes is not needed
--               because non-DM cannot UPDATE at all).
--   members   : members of the same campaign read the member list; DM inserts /
--               deletes anyone; a user may delete its own row (leave); INSERT of
--               oneself happens only through join_campaign_by_code() (SECURITY
--               DEFINER) or DM acceptance of a request.
--   requests  : the requester reads/creates its own; DM of the campaign reads and
--               updates status.
--
-- Never `TO anon`. Every table has RLS + explicit policies.
-- ============================================================================
BEGIN;

-- ── 1. helpers ──────────────────────────────────────────────────────────────
-- Random, readable invite code: XXXX-XXXX from an unambiguous alphabet.
CREATE OR REPLACE FUNCTION public.campaigns_new_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT (
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '')
    FROM generate_series(1,4)
  ) || '-' || (
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '')
    FROM generate_series(1,4)
  );
$$;

-- ── 2. campaigns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns_campaigns (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description          text NOT NULL DEFAULT '',
  system_id            text NOT NULL,
  system_version       text NOT NULL,
  dm_id                uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  visibility           text NOT NULL DEFAULT 'invite' CHECK (visibility IN ('open','invite')),
  seats                int  NOT NULL DEFAULT 5 CHECK (seats BETWEEN 1 AND 12),
  invite_code          text NOT NULL UNIQUE DEFAULT public.campaigns_new_code(),
  invite_enabled       boolean NOT NULL DEFAULT true,
  progression_enabled  boolean NOT NULL DEFAULT false,
  shared_resources     jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale               text NOT NULL DEFAULT 'es',
  active_scene_id      uuid,                                   -- FK added by maps migration
  next_session_at      timestamptz,
  last_session_at      timestamptz,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_campaigns_dm_idx      ON public.campaigns_campaigns(dm_id);
CREATE INDEX IF NOT EXISTS campaigns_campaigns_open_idx    ON public.campaigns_campaigns(visibility) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_campaigns_system_idx  ON public.campaigns_campaigns(system_id);

DROP TRIGGER IF EXISTS campaigns_campaigns_touch ON public.campaigns_campaigns;
CREATE TRIGGER campaigns_campaigns_touch BEFORE UPDATE ON public.campaigns_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 3. members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns_members (
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'player' CHECK (role IN ('dm','player')),
  character_id  uuid,                                          -- FK added by characters migration
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS campaigns_members_user_idx ON public.campaigns_members(user_id);

-- ── 4. requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message      text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
DROP TRIGGER IF EXISTS campaigns_requests_touch ON public.campaigns_requests;
CREATE TRIGGER campaigns_requests_touch BEFORE UPDATE ON public.campaigns_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 5. membership helpers (SECURITY DEFINER, revoked from anon) ─────────────
CREATE OR REPLACE FUNCTION public.is_campaign_member(cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_campaign_dm(cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.user_id = auth.uid() AND m.role = 'dm');
$$;
-- Only game masters (or admins) create campaigns.
CREATE OR REPLACE FUNCTION public.can_create_campaigns()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR public.current_role_name() = 'game_master';
$$;
REVOKE ALL ON FUNCTION public.is_campaign_member(uuid), public.is_campaign_dm(uuid), public.can_create_campaigns() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_campaign_member(uuid), public.is_campaign_dm(uuid), public.can_create_campaigns() TO authenticated, service_role;

-- ── 6. DM row created with the campaign; dm_id/system pinned ────────────────
CREATE OR REPLACE FUNCTION public.campaigns_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES (NEW.id, NEW.dm_id, 'dm')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS campaigns_campaigns_after_insert ON public.campaigns_campaigns;
CREATE TRIGGER campaigns_campaigns_after_insert AFTER INSERT ON public.campaigns_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_after_insert();

CREATE OR REPLACE FUNCTION public.campaigns_guard_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.system_id <> OLD.system_id OR NEW.system_version <> OLD.system_version THEN
    RAISE EXCEPTION 'campaign system cannot change' USING ERRCODE = '42501';
  END IF;
  IF NEW.dm_id <> OLD.dm_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'dm cannot change' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS campaigns_campaigns_guard ON public.campaigns_campaigns;
CREATE TRIGGER campaigns_campaigns_guard BEFORE UPDATE ON public.campaigns_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_guard_update();

-- ── 7. join by code (the only way a player inserts himself) ─────────────────
-- Returns the campaign id. Raises with a stable code the UI maps to a message.
CREATE OR REPLACE FUNCTION public.join_campaign_by_code(code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.campaigns_campaigns%ROWTYPE; taken int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO c FROM public.campaigns_campaigns
   WHERE invite_code = upper(trim(code)) AND invite_enabled AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaigns_members WHERE campaign_id = c.id AND user_id = auth.uid()) THEN
    RETURN c.id;
  END IF;
  SELECT count(*) INTO taken FROM public.campaigns_members WHERE campaign_id = c.id AND role = 'player';
  IF taken >= c.seats THEN RAISE EXCEPTION 'campaign_full' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES (c.id, auth.uid(), 'player');
  RETURN c.id;
END $$;
-- Look up an invite before signing up / joining: only public-safe fields.
CREATE OR REPLACE FUNCTION public.campaign_invite_preview(code text)
RETURNS TABLE (id uuid, name text, system_id text, dm_name text, seats int, taken int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.system_id, u.name,
         c.seats, (SELECT count(*)::int FROM public.campaigns_members m WHERE m.campaign_id = c.id AND m.role = 'player')
  FROM public.campaigns_campaigns c JOIN public.users u ON u.id = c.dm_id
  WHERE c.invite_code = upper(trim(code)) AND c.invite_enabled AND c.archived_at IS NULL;
$$;
-- DM accepts a request → member.
CREATE OR REPLACE FUNCTION public.campaigns_resolve_request(req uuid, accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.campaigns_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.campaigns_requests WHERE id = req;
  IF NOT FOUND OR NOT public.is_campaign_dm(r.campaign_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.campaigns_requests SET status = CASE WHEN accept THEN 'accepted' ELSE 'rejected' END WHERE id = req;
  IF accept THEN
    INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES (r.campaign_id, r.user_id, 'player')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.join_campaign_by_code(text), public.campaign_invite_preview(text), public.campaigns_resolve_request(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_campaign_by_code(text), public.campaigns_resolve_request(uuid, boolean) TO authenticated, service_role;
-- Visitors signing up with a code get the preview through the API (service role), never via anon.
GRANT EXECUTE ON FUNCTION public.campaign_invite_preview(text) TO authenticated, service_role;

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.campaigns_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns_requests  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_campaigns_select ON public.campaigns_campaigns;
CREATE POLICY campaigns_campaigns_select ON public.campaigns_campaigns
  FOR SELECT TO authenticated
  USING (dm_id = auth.uid() OR public.is_campaign_member(id) OR (visibility = 'open' AND archived_at IS NULL));

DROP POLICY IF EXISTS campaigns_campaigns_insert ON public.campaigns_campaigns;
CREATE POLICY campaigns_campaigns_insert ON public.campaigns_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.can_create_campaigns() AND dm_id = auth.uid());

DROP POLICY IF EXISTS campaigns_campaigns_update ON public.campaigns_campaigns;
CREATE POLICY campaigns_campaigns_update ON public.campaigns_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_campaign_dm(id)) WITH CHECK (public.is_campaign_dm(id));

DROP POLICY IF EXISTS campaigns_campaigns_delete ON public.campaigns_campaigns;
CREATE POLICY campaigns_campaigns_delete ON public.campaigns_campaigns
  FOR DELETE TO authenticated USING (public.is_campaign_dm(id));

DROP POLICY IF EXISTS campaigns_members_select ON public.campaigns_members;
CREATE POLICY campaigns_members_select ON public.campaigns_members
  FOR SELECT TO authenticated USING (public.is_campaign_member(campaign_id));

DROP POLICY IF EXISTS campaigns_members_dm_write ON public.campaigns_members;
CREATE POLICY campaigns_members_dm_write ON public.campaigns_members
  FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

DROP POLICY IF EXISTS campaigns_members_leave ON public.campaigns_members;
CREATE POLICY campaigns_members_leave ON public.campaigns_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND role = 'player');

DROP POLICY IF EXISTS campaigns_members_self_update ON public.campaigns_members;
CREATE POLICY campaigns_members_self_update ON public.campaigns_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());   -- only own row (e.g. character_id)

DROP POLICY IF EXISTS campaigns_requests_select ON public.campaigns_requests;
CREATE POLICY campaigns_requests_select ON public.campaigns_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_campaign_dm(campaign_id));

DROP POLICY IF EXISTS campaigns_requests_insert ON public.campaigns_requests;
CREATE POLICY campaigns_requests_insert ON public.campaigns_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = campaign_id AND c.visibility = 'open' AND c.archived_at IS NULL));

DROP POLICY IF EXISTS campaigns_requests_delete_own ON public.campaigns_requests;
CREATE POLICY campaigns_requests_delete_own ON public.campaigns_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'pending');
-- status changes go through campaigns_resolve_request() (SECURITY DEFINER).

-- ── 9. Grants (RLS still decides row access) ────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns_campaigns, public.campaigns_members, public.campaigns_requests TO authenticated;
GRANT ALL ON public.campaigns_campaigns, public.campaigns_members, public.campaigns_requests TO service_role;

COMMIT;
