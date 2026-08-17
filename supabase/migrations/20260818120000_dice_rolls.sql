-- ─────────────────────────────────────────────────────────────────────────────
-- dice (H6): immutable roll log. Spec: specs/modules/dice/SPEC.md
--   dice_rolls   one row per roll (system or free): the request the client sent,
--                the raw dice the SERVER generated, the system's result, and a
--                visibility (table | dm | secret). Nobody updates/deletes; a
--                correction is a new roll pointing at the old one (`corrects_id`).
--   Insert ONLY through `dice_commit_roll` (service role, from the API): it checks
--   membership as the actor and debits shared-resource dice in the same transaction.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dice_rolls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  character_id  uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  author_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  system_id     text,
  kind          text NOT NULL CHECK (kind IN ('system', 'free')),
  title         text NOT NULL DEFAULT '',
  request       jsonb NOT NULL,
  dice          jsonb NOT NULL,
  result        jsonb NOT NULL,
  visibility    text NOT NULL DEFAULT 'table' CHECK (visibility IN ('table', 'dm', 'secret')),
  corrects_id   uuid REFERENCES public.dice_rolls(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dice_rolls_campaign_idx ON public.dice_rolls (campaign_id, created_at DESC);

-- ── Immutable ───────────────────────────────────────────────────────────────
-- Direct UPDATE/DELETE is refused (even for the DM / service role). FK actions
-- (campaign/user CASCADE, character/corrects SET NULL) run as nested RI triggers
-- (pg_trigger_depth() > 1) and must still go through, or a campaign with a
-- single roll could never be deleted.
CREATE OR REPLACE FUNCTION public.dice_rolls_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'dice_rolls are immutable' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS dice_rolls_immutable ON public.dice_rolls;
CREATE TRIGGER dice_rolls_immutable BEFORE UPDATE OR DELETE ON public.dice_rolls
  FOR EACH ROW EXECUTE FUNCTION public.dice_rolls_immutable();

-- ── Commit (API only): membership as the actor + shared-resource debit + insert ──
-- `shared` = {"destiny": 2}: the actor must hold at least that many dice in hand
-- for each resource; the hand is spent atomically (table_spend_hand). Raises
-- not_member | pool_empty | bad_visibility.
CREATE OR REPLACE FUNCTION public.dice_commit_roll(
  actor uuid, cid uuid, char_id uuid, sys_id text, kind text, title text,
  request jsonb, dice jsonb, result jsonb, visibility text, shared jsonb DEFAULT '{}'::jsonb, corrects uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid text; need int; had int; new_id uuid; is_dm boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT (c.dm_id = actor) INTO is_dm FROM public.campaigns_campaigns c WHERE c.id = cid;
  IF is_dm IS NULL THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
  IF NOT is_dm AND NOT EXISTS (SELECT 1 FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.user_id = actor) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  IF visibility NOT IN ('table', 'dm', 'secret') THEN RAISE EXCEPTION 'bad_visibility' USING ERRCODE = '22023'; END IF;
  IF char_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.characters ch WHERE ch.id = char_id AND ch.campaign_id = cid) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  FOR rid, need IN SELECT key, value::int FROM jsonb_each_text(COALESCE(shared, '{}'::jsonb)) LOOP
    IF need > 0 THEN
      had := public.table_spend_hand(cid, rid, actor);
      IF had < need THEN RAISE EXCEPTION 'pool_empty' USING ERRCODE = 'P0001'; END IF;
    END IF;
  END LOOP;
  INSERT INTO public.dice_rolls (campaign_id, character_id, author_id, system_id, kind, title, request, dice, result, visibility, corrects_id)
  VALUES (cid, char_id, actor, sys_id, kind, left(title, 200), request, dice, result, visibility, corrects)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.dice_commit_roll(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, text, jsonb, uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_commit_roll(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, text, jsonb, uuid) TO service_role;

-- ── RLS: visibility is enforced here, never in the client ───────────────────
ALTER TABLE public.dice_rolls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dice_rolls_select ON public.dice_rolls;
CREATE POLICY dice_rolls_select ON public.dice_rolls
  FOR SELECT TO authenticated
  USING (
    (public.is_campaign_member(campaign_id) OR public.is_campaign_dm(campaign_id))
    AND (visibility = 'table' OR author_id = auth.uid() OR public.is_campaign_dm(campaign_id))
  );
-- No write policies for authenticated: inserts only via dice_commit_roll (service role); rows are immutable.
GRANT SELECT ON public.dice_rolls TO authenticated;
GRANT SELECT, INSERT ON public.dice_rolls TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_rolls;
