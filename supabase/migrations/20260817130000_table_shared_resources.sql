-- ============================================================================
-- Rolvium — table (H3): shared resources (e.g. Plenilunio Destiny pool)
-- Spec: specs/modules/table/SPEC.md
-- ============================================================================
-- State lives in campaigns_campaigns.shared_resources (jsonb):
--   { "<resourceId>": { "value": 7, "max": 10, "hands": { "<userId>": 2 } } }
-- Only the DM (or the API) updates that column directly. Players change it ONLY
-- through the SECURITY DEFINER functions below, which are atomic (row lock) and
-- enforce the rules the game system declares (per-take max, who can take).
-- ============================================================================
BEGIN;

-- Take `n` dice from a resource into the caller's hand. Fails with a stable
-- message the UI maps: not_member | resource_missing | pool_empty | per_take_max
CREATE OR REPLACE FUNCTION public.table_take_resource(cid uuid, rid text, n int, per_take_max int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; cur int; hand int; uid text := auth.uid()::text;
BEGIN
  IF NOT public.is_campaign_member(cid) THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
  IF n < 1 THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001'; END IF;
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN RAISE EXCEPTION 'resource_missing' USING ERRCODE = 'P0001'; END IF;
  cur  := COALESCE((res ->> 'value')::int, 0);
  hand := COALESCE((res -> 'hands' ->> uid)::int, 0);
  IF cur < n THEN RAISE EXCEPTION 'pool_empty' USING ERRCODE = 'P0001'; END IF;
  IF hand + n > per_take_max THEN RAISE EXCEPTION 'per_take_max' USING ERRCODE = 'P0001'; END IF;
  res := jsonb_set(res, '{value}', to_jsonb(cur - n));
  res := jsonb_set(res, ARRAY['hands', uid], to_jsonb(hand + n), true);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(shared_resources, ARRAY[rid], res) WHERE id = cid;
  RETURN res;
END $$;

-- Return dice from the caller's hand to the pool (all if n is null).
CREATE OR REPLACE FUNCTION public.table_return_resource(cid uuid, rid text, n int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; cur int; hand int; back int; uid text := auth.uid()::text;
BEGIN
  IF NOT public.is_campaign_member(cid) THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN RAISE EXCEPTION 'resource_missing' USING ERRCODE = 'P0001'; END IF;
  cur  := COALESCE((res ->> 'value')::int, 0);
  hand := COALESCE((res -> 'hands' ->> uid)::int, 0);
  back := LEAST(hand, COALESCE(n, hand));
  IF back <= 0 THEN RETURN res; END IF;
  res := jsonb_set(res, '{value}', to_jsonb(cur + back));
  res := jsonb_set(res, ARRAY['hands', uid], to_jsonb(hand - back), true);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(shared_resources, ARRAY[rid], res) WHERE id = cid;
  RETURN res;
END $$;

-- Spend the caller's hand (called by the API when a roll consumes the dice). Returns how many were spent.
CREATE OR REPLACE FUNCTION public.table_spend_hand(cid uuid, rid text, who uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; hand int;
BEGIN
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN RETURN 0; END IF;
  hand := COALESCE((res -> 'hands' ->> who::text)::int, 0);
  res := jsonb_set(res, ARRAY['hands', who::text], to_jsonb(0), true);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(shared_resources, ARRAY[rid], res) WHERE id = cid;
  RETURN hand;
END $$;

-- DM only: reset the pool to `to_value` (or its max) and empty every hand.
CREATE OR REPLACE FUNCTION public.table_reset_resource(cid uuid, rid text, to_value int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; mx int;
BEGIN
  IF NOT public.is_campaign_dm(cid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT shared_resources -> rid INTO res FROM public.campaigns_campaigns WHERE id = cid FOR UPDATE;
  IF res IS NULL THEN res := '{}'::jsonb; END IF;
  mx := COALESCE(to_value, (res ->> 'max')::int, 10);
  res := jsonb_build_object('value', mx, 'max', COALESCE((res ->> 'max')::int, mx), 'hands', '{}'::jsonb);
  UPDATE public.campaigns_campaigns SET shared_resources = jsonb_set(COALESCE(shared_resources,'{}'::jsonb), ARRAY[rid], res, true) WHERE id = cid;
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.table_take_resource(uuid,text,int,int), public.table_return_resource(uuid,text,int), public.table_reset_resource(uuid,text,int) FROM anon, public;
REVOKE ALL ON FUNCTION public.table_spend_hand(uuid,text,uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.table_take_resource(uuid,text,int,int), public.table_return_resource(uuid,text,int), public.table_reset_resource(uuid,text,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.table_spend_hand(uuid,text,uuid) TO service_role;

-- Realtime: the table listens to campaigns_campaigns (shared_resources, active_scene) and members.
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns_campaigns, public.campaigns_members;

COMMIT;
