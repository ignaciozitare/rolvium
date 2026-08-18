-- ─────────────────────────────────────────────────────────────────────────────
-- maps (H7): scenes, walls, tokens, drawings, per-player fog, campaign image library
-- Spec: specs/modules/maps/SPEC.md
--   maps_scenes     the DM's scenes; `campaigns_campaigns.active_scene_id` says which one players see.
--   maps_walls      segments; players never receive walls unless `visible_players` (RLS) — vision is
--                   computed by the API with all walls, players get the resolved polygon.
--   maps_tokens     PCs / bestiary instances; hidden tokens do not exist for players (RLS);
--                   players may only move tokens they control (guard trigger).
--   maps_drawings   shared strokes/shapes/text with author; author or DM deletes.
--   maps_fog        explored polygons per (scene, user); written by the API (service role) or the DM.
--   maps_images     campaign background library (bucket `backgrounds`).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maps_scenes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  width           int  NOT NULL DEFAULT 1600 CHECK (width BETWEEN 200 AND 8000),
  height          int  NOT NULL DEFAULT 1000 CHECK (height BETWEEN 200 AND 8000),
  bg_color        text NOT NULL DEFAULT '#1a1a1a',
  bg_image_url    text,
  bg_transform    jsonb NOT NULL DEFAULT '{"mode":"cover","x":0,"y":0,"scale":1}'::jsonb,
  grid            jsonb NOT NULL DEFAULT '{"size":27,"visible":true}'::jsonb,
  fog_mode        text NOT NULL DEFAULT 'vision' CHECK (fog_mode IN ('vision', 'manual', 'off')),
  sort_order      int  NOT NULL DEFAULT 0,
  visible_players boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_scenes_campaign_idx ON public.maps_scenes (campaign_id, sort_order);
DROP TRIGGER IF EXISTS maps_scenes_touch ON public.maps_scenes;
CREATE TRIGGER maps_scenes_touch BEFORE UPDATE ON public.maps_scenes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.campaigns_campaigns DROP CONSTRAINT IF EXISTS campaigns_active_scene_fk;
ALTER TABLE public.campaigns_campaigns
  ADD CONSTRAINT campaigns_active_scene_fk FOREIGN KEY (active_scene_id) REFERENCES public.maps_scenes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.maps_walls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id        uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  x1 real NOT NULL, y1 real NOT NULL, x2 real NOT NULL, y2 real NOT NULL,
  visible_players boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_walls_scene_idx ON public.maps_walls (scene_id);

CREATE TABLE IF NOT EXISTS public.maps_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id        uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  character_id    uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  bestiary_ref    text,                                     -- system catalog id or bestiary entry (H5) — free text for now
  name            text NOT NULL DEFAULT '',
  image_url       text,
  x               real NOT NULL DEFAULT 0,
  y               real NOT NULL DEFAULT 0,
  size            real NOT NULL DEFAULT 1 CHECK (size > 0 AND size <= 10),   -- in grid cells
  color           text,
  visible         boolean NOT NULL DEFAULT true,
  controlled_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,     -- player who may move it (besides the DM)
  vision_radius   real,                                    -- cells; NULL = unlimited
  state           jsonb NOT NULL DEFAULT '{}'::jsonb,       -- e.g. instance HP for bestiary copies
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_tokens_scene_idx ON public.maps_tokens (scene_id);
DROP TRIGGER IF EXISTS maps_tokens_touch ON public.maps_tokens;
CREATE TRIGGER maps_tokens_touch BEFORE UPDATE ON public.maps_tokens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.maps_drawings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id        uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('stroke', 'line', 'rect', 'circle', 'text')),
  data            jsonb NOT NULL,                           -- points / bbox / text
  color           text NOT NULL DEFAULT '#8a7038',
  width           real NOT NULL DEFAULT 2,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_drawings_scene_idx ON public.maps_drawings (scene_id, created_at);

CREATE TABLE IF NOT EXISTS public.maps_fog (
  scene_id        uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  explored        jsonb NOT NULL DEFAULT '[]'::jsonb,       -- array of polygons [[x,y],...]
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scene_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.maps_images (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  url             text NOT NULL,
  uploaded_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_images_campaign_idx ON public.maps_images (campaign_id);

-- ── Guards ──────────────────────────────────────────────────────────────────
-- Players may move only tokens they control, and only x/y (never name/visibility/size/state).
CREATE OR REPLACE FUNCTION public.maps_tokens_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_campaign_dm(OLD.campaign_id) THEN RETURN NEW; END IF;
  IF OLD.controlled_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NEW.scene_id <> OLD.scene_id OR NEW.campaign_id <> OLD.campaign_id OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.bestiary_ref IS DISTINCT FROM OLD.bestiary_ref OR NEW.name <> OLD.name OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.size <> OLD.size OR NEW.color IS DISTINCT FROM OLD.color OR NEW.visible <> OLD.visible
     OR NEW.controlled_by IS DISTINCT FROM OLD.controlled_by OR NEW.vision_radius IS DISTINCT FROM OLD.vision_radius
     OR NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'players may only move their token' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS maps_tokens_guard_update ON public.maps_tokens;
CREATE TRIGGER maps_tokens_guard_update BEFORE UPDATE ON public.maps_tokens FOR EACH ROW EXECUTE FUNCTION public.maps_tokens_guard_update();

-- Scene visible to a player: flagged visible_players OR the campaign's active scene.
CREATE OR REPLACE FUNCTION public.maps_scene_visible(sid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maps_scenes s JOIN public.campaigns_campaigns c ON c.id = s.campaign_id
    WHERE s.id = sid AND (s.visible_players OR c.active_scene_id = s.id) AND public.is_campaign_member(s.campaign_id)
  );
$$;
REVOKE ALL ON FUNCTION public.maps_scene_visible(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.maps_scene_visible(uuid) TO authenticated, service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.maps_scenes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_walls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_fog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_images   ENABLE ROW LEVEL SECURITY;

-- scenes: DM everything; players read the visible/active ones.
DROP POLICY IF EXISTS maps_scenes_select ON public.maps_scenes;
CREATE POLICY maps_scenes_select ON public.maps_scenes FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.maps_scene_visible(id));
DROP POLICY IF EXISTS maps_scenes_dm_write ON public.maps_scenes;
CREATE POLICY maps_scenes_dm_write ON public.maps_scenes FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- walls: DM everything; players only the ones flagged visible (and only in scenes they can see).
DROP POLICY IF EXISTS maps_walls_select ON public.maps_walls;
CREATE POLICY maps_walls_select ON public.maps_walls FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR (visible_players AND public.maps_scene_visible(scene_id)));
DROP POLICY IF EXISTS maps_walls_dm_write ON public.maps_walls;
CREATE POLICY maps_walls_dm_write ON public.maps_walls FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- tokens: DM everything; players see visible tokens of visible scenes; players update only their own (guard restricts columns).
DROP POLICY IF EXISTS maps_tokens_select ON public.maps_tokens;
CREATE POLICY maps_tokens_select ON public.maps_tokens FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR (visible AND public.maps_scene_visible(scene_id)));
DROP POLICY IF EXISTS maps_tokens_dm_write ON public.maps_tokens;
CREATE POLICY maps_tokens_dm_write ON public.maps_tokens FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
DROP POLICY IF EXISTS maps_tokens_player_move ON public.maps_tokens;
CREATE POLICY maps_tokens_player_move ON public.maps_tokens FOR UPDATE TO authenticated
  USING (controlled_by = auth.uid() AND public.maps_scene_visible(scene_id))
  WITH CHECK (controlled_by = auth.uid());

-- drawings: members of visible scenes read; author inserts (member); author or DM deletes; DM updates any.
DROP POLICY IF EXISTS maps_drawings_select ON public.maps_drawings;
CREATE POLICY maps_drawings_select ON public.maps_drawings FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.maps_scene_visible(scene_id));
DROP POLICY IF EXISTS maps_drawings_insert ON public.maps_drawings;
CREATE POLICY maps_drawings_insert ON public.maps_drawings FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.is_campaign_dm(campaign_id) OR public.maps_scene_visible(scene_id)));
DROP POLICY IF EXISTS maps_drawings_delete ON public.maps_drawings;
CREATE POLICY maps_drawings_delete ON public.maps_drawings FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_campaign_dm(campaign_id));
DROP POLICY IF EXISTS maps_drawings_dm_update ON public.maps_drawings;
CREATE POLICY maps_drawings_dm_update ON public.maps_drawings FOR UPDATE TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- fog: each player reads their own; DM reads all and may write (manual reveal/hide); the API writes with the service role.
DROP POLICY IF EXISTS maps_fog_select ON public.maps_fog;
CREATE POLICY maps_fog_select ON public.maps_fog FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_campaign_dm(campaign_id));
DROP POLICY IF EXISTS maps_fog_dm_write ON public.maps_fog;
CREATE POLICY maps_fog_dm_write ON public.maps_fog FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- images: members read; DM writes.
DROP POLICY IF EXISTS maps_images_select ON public.maps_images;
CREATE POLICY maps_images_select ON public.maps_images FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id) OR public.is_campaign_dm(campaign_id));
DROP POLICY IF EXISTS maps_images_dm_write ON public.maps_images;
CREATE POLICY maps_images_dm_write ON public.maps_images FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_scenes, public.maps_walls, public.maps_tokens, public.maps_drawings, public.maps_fog, public.maps_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_scenes, public.maps_walls, public.maps_tokens, public.maps_drawings, public.maps_fog, public.maps_images TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maps_scenes, public.maps_walls, public.maps_tokens, public.maps_drawings, public.maps_fog;

-- ── Backgrounds bucket: members read (public URLs), DM uploads under {campaignId}/ ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('backgrounds', 'backgrounds', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS backgrounds_read ON storage.objects;
CREATE POLICY backgrounds_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'backgrounds');
DROP POLICY IF EXISTS backgrounds_dm_write ON storage.objects;
CREATE POLICY backgrounds_dm_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backgrounds' AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS backgrounds_dm_update ON storage.objects;
CREATE POLICY backgrounds_dm_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'backgrounds' AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'backgrounds' AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS backgrounds_dm_delete ON storage.objects;
CREATE POLICY backgrounds_dm_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backgrounds' AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid));
