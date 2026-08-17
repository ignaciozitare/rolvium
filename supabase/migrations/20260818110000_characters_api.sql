-- ─────────────────────────────────────────────────────────────────────────────
-- characters (H4): API-side sheet save. The Rolvium API validates `data`
-- against the system's sheetSchema and recomputes derived/health, then persists
-- **as the acting user**: this function (service_role only) impersonates the
-- actor for the transaction (`request.jwt.claims.sub` → auth.uid()) so the
-- existing guard triggers, audit author and DM/owner checks all apply.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.characters_api_update(cid uuid, patch jsonb, origin text, actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.characters%ROWTYPE;
BEGIN
  IF origin NOT IN ('sheet', 'roll', 'damage', 'progression', 'dm') THEN RAISE EXCEPTION 'bad_origin' USING ERRCODE = '22023'; END IF;
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  -- Impersonate the actor for auth.uid() inside this transaction.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('rolvium.audit_origin', origin, true);
  SELECT * INTO c FROM public.characters WHERE id = cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  -- Same rule as RLS `characters_update`: owner or campaign DM.
  IF NOT (c.owner_id = actor OR public.is_campaign_dm(c.campaign_id)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF origin = 'dm' AND NOT public.is_campaign_dm(c.campaign_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.characters SET
    name       = COALESCE(patch ->> 'name', name),
    concept    = CASE WHEN patch ? 'concept' THEN patch ->> 'concept' ELSE concept END,
    data       = COALESCE(patch -> 'data', data),
    derived    = COALESCE(patch -> 'derived', derived),
    health     = CASE WHEN patch ? 'health' THEN patch ->> 'health' ELSE health END,
    xp         = COALESCE((patch ->> 'xp')::int, xp)
  WHERE id = cid;
END $$;
REVOKE ALL ON FUNCTION public.characters_api_update(uuid, jsonb, text, uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.characters_api_update(uuid, jsonb, text, uuid) TO service_role;
