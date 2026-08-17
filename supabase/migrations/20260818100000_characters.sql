-- ─────────────────────────────────────────────────────────────────────────────
-- characters (H4): player characters + change audit + tokens bucket
-- Spec: specs/modules/characters/SPEC.md
--   characters        one row per character; `data` jsonb follows the campaign
--                     system's sheetSchema (validated in the API); `derived`
--                     jsonb is the engine's cache; `health`/`xp` are materialised
--                     for the table (group panel, tokens). `owner_id` NULL =
--                     unassigned (DM-made, anyone may claim it).
--   characters_audit  who changed what (before/after per field, origin), written
--                     by trigger; readable ONLY by the campaign DM.
--   Bucket `tokens`   public read; owner-folder writes ({uid}/…), 2 MB, images.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. characters ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.characters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  owner_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kind          text NOT NULL DEFAULT 'pc' CHECK (kind IN ('pc', 'npc')),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  concept       text,
  avatar_url    text,
  token_url     text,
  color         text,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  derived       jsonb NOT NULL DEFAULT '{}'::jsonb,
  health        text,                       -- materialised health level id (system-specific)
  xp            int  NOT NULL DEFAULT 0 CHECK (xp >= 0),
  archived_at   timestamptz,
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_campaign_idx ON public.characters (campaign_id);
CREATE INDEX IF NOT EXISTS characters_owner_idx    ON public.characters (owner_id);

DROP TRIGGER IF EXISTS characters_touch_updated_at ON public.characters;
CREATE TRIGGER characters_touch_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- FK promised by the campaigns migration: the member row points to its character.
ALTER TABLE public.campaigns_members DROP CONSTRAINT IF EXISTS campaigns_members_character_fk;
ALTER TABLE public.campaigns_members
  ADD CONSTRAINT campaigns_members_character_fk FOREIGN KEY (character_id)
  REFERENCES public.characters(id) ON DELETE SET NULL;

-- ── 2. audit ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.characters_audit (
  id            bigserial PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL,
  author_id     uuid,
  origin        text NOT NULL DEFAULT 'sheet' CHECK (origin IN ('sheet', 'roll', 'damage', 'progression', 'dm', 'system')),
  field         text NOT NULL,
  before        jsonb,
  after         jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_audit_char_idx ON public.characters_audit (character_id, at DESC);
CREATE INDEX IF NOT EXISTS characters_audit_campaign_idx ON public.characters_audit (campaign_id, at DESC);

-- The writer tells the trigger where the change comes from (default 'sheet').
CREATE OR REPLACE FUNCTION public.characters_audit_origin()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('rolvium.audit_origin', true), ''), 'sheet');
$$;

CREATE OR REPLACE FUNCTION public.characters_write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text;
  o text := public.characters_audit_origin();
  before_data jsonb := COALESCE(OLD.data, '{}'::jsonb);
  after_data  jsonb := COALESCE(NEW.data, '{}'::jsonb);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
    VALUES (NEW.id, NEW.campaign_id, auth.uid(), 'system', 'created', NULL, jsonb_build_object('name', NEW.name, 'kind', NEW.kind));
    RETURN NEW;
  END IF;
  -- top-level sheet keys that changed
  FOR k IN SELECT DISTINCT key FROM (SELECT jsonb_object_keys(before_data) key UNION SELECT jsonb_object_keys(after_data)) s LOOP
    IF before_data -> k IS DISTINCT FROM after_data -> k THEN
      INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
      VALUES (NEW.id, NEW.campaign_id, auth.uid(), o, 'data.' || k, before_data -> k, after_data -> k);
    END IF;
  END LOOP;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
    VALUES (NEW.id, NEW.campaign_id, auth.uid(), o, 'name', to_jsonb(OLD.name), to_jsonb(NEW.name));
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
    VALUES (NEW.id, NEW.campaign_id, auth.uid(), o, 'owner_id', to_jsonb(OLD.owner_id), to_jsonb(NEW.owner_id));
  END IF;
  IF NEW.xp IS DISTINCT FROM OLD.xp THEN
    INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
    VALUES (NEW.id, NEW.campaign_id, auth.uid(), o, 'xp', to_jsonb(OLD.xp), to_jsonb(NEW.xp));
  END IF;
  IF NEW.health IS DISTINCT FROM OLD.health THEN
    INSERT INTO public.characters_audit (character_id, campaign_id, author_id, origin, field, before, after)
    VALUES (NEW.id, NEW.campaign_id, auth.uid(), o, 'health', to_jsonb(OLD.health), to_jsonb(NEW.health));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS characters_audit_trg ON public.characters;
CREATE TRIGGER characters_audit_trg AFTER INSERT OR UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.characters_write_audit();

-- ── 3. Guards ───────────────────────────────────────────────────────────────
-- Players may not reassign owner/kind/campaign, nor touch xp except through
-- progression (the DM decides); the DM may do anything inside their campaign.
CREATE OR REPLACE FUNCTION public.characters_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_campaign_dm(OLD.campaign_id) THEN RETURN NEW; END IF;
  IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR (NEW.owner_id IS DISTINCT FROM OLD.owner_id AND NOT (OLD.owner_id IS NULL AND NEW.owner_id = auth.uid()))
     OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'players may not change campaign/kind/owner/archive' USING ERRCODE = '42501';
  END IF;
  -- Spending/gaining XP from the sheet only while the DM has progression open for the campaign.
  IF NEW.xp IS DISTINCT FROM OLD.xp
     AND NOT COALESCE((SELECT progression_enabled FROM public.campaigns_campaigns WHERE id = OLD.campaign_id), false) THEN
    RAISE EXCEPTION 'progression_disabled' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS characters_guard_update ON public.characters;
CREATE TRIGGER characters_guard_update BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.characters_guard_update();

-- Claim an unassigned character (DM-made, "sin asignar") and link it to my member row.
CREATE OR REPLACE FUNCTION public.characters_claim(cid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.characters%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.characters WHERE id = cid FOR UPDATE;
  IF NOT FOUND OR c.owner_id IS NOT NULL OR c.kind <> 'pc' OR NOT public.is_campaign_member(c.campaign_id) THEN
    RAISE EXCEPTION 'cannot_claim' USING ERRCODE = '42501';
  END IF;
  UPDATE public.characters SET owner_id = auth.uid() WHERE id = cid;
  UPDATE public.campaigns_members SET character_id = cid WHERE campaign_id = c.campaign_id AND user_id = auth.uid();
END $$;
-- Update a sheet tagging the audit origin (roll / damage / progression / dm). SECURITY INVOKER: RLS + guards apply.
CREATE OR REPLACE FUNCTION public.characters_update_with_origin(cid uuid, patch jsonb, origin text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF origin NOT IN ('sheet', 'roll', 'damage', 'progression', 'dm') THEN RAISE EXCEPTION 'bad_origin' USING ERRCODE = '22023'; END IF;
  -- Only the campaign DM may tag a change as 'dm'.
  IF origin = 'dm' AND NOT public.is_campaign_dm((SELECT campaign_id FROM public.characters WHERE id = cid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('rolvium.audit_origin', origin, true);
  UPDATE public.characters SET
    name       = COALESCE(patch ->> 'name', name),
    concept    = CASE WHEN patch ? 'concept'    THEN patch ->> 'concept'    ELSE concept END,
    data       = COALESCE(patch -> 'data', data),
    derived    = COALESCE(patch -> 'derived', derived),
    health     = CASE WHEN patch ? 'health'     THEN patch ->> 'health'     ELSE health END,
    xp         = COALESCE((patch ->> 'xp')::int, xp),
    color      = CASE WHEN patch ? 'color'      THEN patch ->> 'color'      ELSE color END,
    avatar_url = CASE WHEN patch ? 'avatar_url' THEN patch ->> 'avatar_url' ELSE avatar_url END,
    token_url  = CASE WHEN patch ? 'token_url'  THEN patch ->> 'token_url'  ELSE token_url END
  WHERE id = cid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.characters_claim(uuid), public.characters_audit_origin(), public.characters_update_with_origin(uuid, jsonb, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.characters_claim(uuid), public.characters_audit_origin(), public.characters_update_with_origin(uuid, jsonb, text) TO authenticated, service_role;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- `characters` is a core module (like campaigns): access is membership-scoped, not role-module-gated.
ALTER TABLE public.characters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters_audit ENABLE ROW LEVEL SECURITY;

-- Read: any member of the campaign (the group panel shows everyone's PCs); NPCs only the DM.
DROP POLICY IF EXISTS characters_select ON public.characters;
CREATE POLICY characters_select ON public.characters
  FOR SELECT TO authenticated
  USING ((
           public.is_campaign_dm(campaign_id)
           OR (kind = 'pc' AND (owner_id = auth.uid() OR public.is_campaign_member(campaign_id)))));

-- Insert: a member creates their own PC (owner = me); the DM creates anything (assigned or not).
DROP POLICY IF EXISTS characters_insert ON public.characters;
CREATE POLICY characters_insert ON public.characters
  FOR INSERT TO authenticated
  WITH CHECK ((
           public.is_campaign_dm(campaign_id)
           OR (kind = 'pc' AND owner_id = auth.uid() AND public.is_campaign_member(campaign_id)))
         AND (created_by IS NULL OR created_by = auth.uid()));

-- Update: owner (own PC) or DM; column-level restrictions in the guard trigger.
DROP POLICY IF EXISTS characters_update ON public.characters;
CREATE POLICY characters_update ON public.characters
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid() OR public.is_campaign_dm(campaign_id)))
  WITH CHECK ((owner_id = auth.uid() OR public.is_campaign_dm(campaign_id)));

-- Delete: only the DM (players archive nothing; they leave the campaign instead).
DROP POLICY IF EXISTS characters_delete ON public.characters;
CREATE POLICY characters_delete ON public.characters
  FOR DELETE TO authenticated USING (public.is_campaign_dm(campaign_id));

-- Audit: DM-only reads; nobody writes directly (trigger is SECURITY DEFINER).
DROP POLICY IF EXISTS characters_audit_select ON public.characters_audit;
CREATE POLICY characters_audit_select ON public.characters_audit
  FOR SELECT TO authenticated USING (public.is_campaign_dm(campaign_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT SELECT ON public.characters_audit TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.characters_audit FROM authenticated;

-- ── 5. Tokens bucket (same shape as avatars) ────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tokens', 'tokens', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS tokens_read ON storage.objects;
CREATE POLICY tokens_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tokens');
DROP POLICY IF EXISTS tokens_insert_own ON storage.objects;
CREATE POLICY tokens_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tokens' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS tokens_update_own ON storage.objects;
CREATE POLICY tokens_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tokens' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'tokens' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS tokens_delete_own ON storage.objects;
CREATE POLICY tokens_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tokens' AND (storage.foldername(name))[1] = auth.uid()::text);
