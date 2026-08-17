-- ============================================================================
-- Rolvium — campaigns/table hardening (Review findings 2026-08-17)
--  #1 players could UPDATE their own member row (any column → role='dm').
--  #2 invite_code readable by every authenticated user for open campaigns.
--  #3 per_take_max was client-supplied.
--  #4 players_count not visible to non-members (RLS on members).
--  #5 resolve_request ignored status/seats.  #16 join without row lock.
-- ============================================================================
BEGIN;

-- ── #1 members: players may only change their own character_id ─────────────
REVOKE UPDATE ON public.campaigns_members FROM authenticated;
GRANT UPDATE (character_id) ON public.campaigns_members TO authenticated;
CREATE OR REPLACE FUNCTION public.campaigns_members_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.role <> OLD.role OR NEW.campaign_id <> OLD.campaign_id OR NEW.user_id <> OLD.user_id)
     AND NOT public.is_campaign_dm(OLD.campaign_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS campaigns_members_guard ON public.campaigns_members;
CREATE TRIGGER campaigns_members_guard BEFORE UPDATE ON public.campaigns_members
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_members_guard();

-- ── #2 invite_code: DM-only. Column revoked from authenticated; DM reads it via RPC.
REVOKE SELECT ON public.campaigns_campaigns FROM authenticated;
GRANT SELECT (id, name, description, system_id, system_version, dm_id, visibility, seats, invite_enabled,
              progression_enabled, shared_resources, locale, active_scene_id, next_session_at, last_session_at,
              archived_at, created_at, updated_at) ON public.campaigns_campaigns TO authenticated;
CREATE OR REPLACE FUNCTION public.campaigns_my_invite_code(cid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.invite_code FROM public.campaigns_campaigns c WHERE c.id = cid AND public.is_campaign_dm(cid);
$$;
CREATE OR REPLACE FUNCTION public.campaigns_regenerate_invite_code(cid uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code text;
BEGIN
  IF NOT public.is_campaign_dm(cid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  LOOP
    code := public.campaigns_new_code();
    BEGIN
      UPDATE public.campaigns_campaigns SET invite_code = code WHERE id = cid;
      RETURN code;
    EXCEPTION WHEN unique_violation THEN END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.campaigns_my_invite_code(uuid), public.campaigns_regenerate_invite_code(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.campaigns_my_invite_code(uuid), public.campaigns_regenerate_invite_code(uuid) TO authenticated, service_role;
-- The UPDATE policy still allows the DM to write invite_enabled etc.; invite_code itself only via the RPC.
REVOKE UPDATE ON public.campaigns_campaigns FROM authenticated;
GRANT UPDATE (name, description, visibility, seats, invite_enabled, progression_enabled, shared_resources, locale,
              active_scene_id, next_session_at, last_session_at, archived_at) ON public.campaigns_campaigns TO authenticated;

-- ── #4 players_count for everyone who can see the campaign ─────────────────
CREATE OR REPLACE FUNCTION public.campaigns_players_count(cid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.role = 'player';
$$;
REVOKE ALL ON FUNCTION public.campaigns_players_count(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.campaigns_players_count(uuid) TO authenticated, service_role;

-- ── #5 / #16 join + resolve: row lock, pending check, seats check ───────────
CREATE OR REPLACE FUNCTION public.join_campaign_by_code(code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.campaigns_campaigns%ROWTYPE; taken int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO c FROM public.campaigns_campaigns
   WHERE invite_code = upper(trim(code)) AND invite_enabled AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaigns_members WHERE campaign_id = c.id AND user_id = auth.uid()) THEN RETURN c.id; END IF;
  SELECT count(*) INTO taken FROM public.campaigns_members WHERE campaign_id = c.id AND role = 'player';
  IF taken >= c.seats THEN RAISE EXCEPTION 'campaign_full' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES (c.id, auth.uid(), 'player');
  RETURN c.id;
END $$;
CREATE OR REPLACE FUNCTION public.campaigns_resolve_request(req uuid, accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.campaigns_requests%ROWTYPE; c public.campaigns_campaigns%ROWTYPE; taken int;
BEGIN
  SELECT * INTO r FROM public.campaigns_requests WHERE id = req FOR UPDATE;
  IF NOT FOUND OR NOT public.is_campaign_dm(r.campaign_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'already_resolved' USING ERRCODE = 'P0001'; END IF;
  IF accept THEN
    SELECT * INTO c FROM public.campaigns_campaigns WHERE id = r.campaign_id FOR UPDATE;
    SELECT count(*) INTO taken FROM public.campaigns_members WHERE campaign_id = c.id AND role = 'player';
    IF taken >= c.seats THEN RAISE EXCEPTION 'campaign_full' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES (r.campaign_id, r.user_id, 'player') ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.campaigns_requests SET status = CASE WHEN accept THEN 'accepted' ELSE 'rejected' END WHERE id = req;
END $$;

-- ── #3 per_take_max comes from the stored resource, never from the client ───
DROP FUNCTION IF EXISTS public.table_take_resource(uuid, text, int, int);
CREATE OR REPLACE FUNCTION public.table_take_resource(cid uuid, rid text, n int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; cur int; hand int; per_take int; uid text := auth.uid()::text;
BEGIN
  IF NOT public.is_campaign_member(cid) THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
  IF n < 1 THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001'; END IF;
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN RAISE EXCEPTION 'resource_missing' USING ERRCODE = 'P0001'; END IF;
  cur  := COALESCE((res ->> 'value')::int, 0);
  hand := COALESCE((res -> 'hands' ->> uid)::int, 0);
  per_take := COALESCE((res ->> 'perTakeMax')::int, 5);
  IF cur < n THEN RAISE EXCEPTION 'pool_empty' USING ERRCODE = 'P0001'; END IF;
  IF hand + n > per_take THEN RAISE EXCEPTION 'per_take_max' USING ERRCODE = 'P0001'; END IF;
  res := jsonb_set(res, '{value}', to_jsonb(cur - n));
  res := jsonb_set(res, ARRAY['hands', uid], to_jsonb(hand + n), true);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(shared_resources, ARRAY[rid], res) WHERE id = cid;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.table_take_resource(uuid,text,int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.table_take_resource(uuid,text,int) TO authenticated, service_role;
-- reset keeps perTakeMax
CREATE OR REPLACE FUNCTION public.table_reset_resource(cid uuid, rid text, to_value int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; mx int;
BEGIN
  IF NOT public.is_campaign_dm(cid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN res := '{}'::jsonb; END IF;
  mx := COALESCE(to_value, (res ->> 'max')::int, 10);
  res := jsonb_build_object('value', mx, 'max', COALESCE((res ->> 'max')::int, mx), 'perTakeMax', COALESCE((res ->> 'perTakeMax')::int, 5), 'hands', '{}'::jsonb);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(COALESCE(shared_resources,'{}'::jsonb), ARRAY[rid], res, true) WHERE id = cid;
  RETURN res;
END $$;

COMMIT;

-- ── Review note: players_count only for campaigns the caller may see ─────────
BEGIN;
CREATE OR REPLACE FUNCTION public.campaigns_players_count(cid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_campaign_member(cid)
                OR EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = cid AND c.visibility = 'open' AND c.archived_at IS NULL)
         THEN (SELECT count(*)::int FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.role = 'player')
         ELSE 0 END;
$$;
COMMIT;
