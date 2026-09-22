-- ─────────────────────────────────────────────────────────────────────────────
-- adventures (H12): las aventuras del director
-- Spec: specs/modules/adventures/SPEC.md (cerrado por el dueño el 2026-08-19)
--
--   adventures_adventures   el guion de una historia: su texto, y las escenas que le cuelgan.
--   maps_scenes.adventure_id  toda escena pertenece a una aventura, y sólo a una.
--
-- Regla 1 del dueño: «TODA campaña tiene aventuras. No hay escenas sueltas.» Por eso
-- esta migración (a) crea una «Aventura 1» por cada campaña que ya existe y le cuelga
-- sus escenas, y (b) deja un trigger para que toda campaña NUEVA nazca con la suya —
-- sin él, crear una escena en una campaña nueva fallaría contra el NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.adventures_adventures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  -- Una línea para la lista del rail; el resto se escribe dentro del documento.
  summary      text,

  -- El mismo árbol de bloques que `journal`, más los bloques propios de una aventura
  -- (`sceneRef`, tablas de PNJ y de encuentro). JSON, nunca HTML.
  doc          jsonb NOT NULL DEFAULT '{"v":1,"blocks":[]}'::jsonb,

  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','done','archived')),
  sort_order   int  NOT NULL DEFAULT 0,

  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adventures_campaign_idx ON public.adventures_adventures (campaign_id, sort_order);

DROP TRIGGER IF EXISTS adventures_touch ON public.adventures_adventures;
CREATE TRIGGER adventures_touch BEFORE UPDATE ON public.adventures_adventures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── La escena pasa a colgar de una aventura ─────────────────────────────────
-- Entra NULLABLE, se rellena, y sólo entonces se pone NOT NULL: así ninguna escena
-- que ya existe se queda fuera ni se pierde.
-- ON DELETE RESTRICT, no CASCADE: borrar una aventura NO puede llevarse por delante
-- las escenas del director (regla del spec — antes se pregunta a dónde van).
ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS adventure_id uuid REFERENCES public.adventures_adventures(id) ON DELETE RESTRICT;

-- (a) Una «Aventura 1» por campaña que todavía no tenga ninguna. También las campañas
--     sin escenas, para que la regla «toda escena tiene aventura» no tenga excepciones.
INSERT INTO public.adventures_adventures (campaign_id, title, status, sort_order, created_by)
SELECT c.id, 'Aventura 1', 'running', 0, c.dm_id
FROM public.campaigns_campaigns c
WHERE NOT EXISTS (SELECT 1 FROM public.adventures_adventures a WHERE a.campaign_id = c.id);

-- (b) Las escenas que ya existen se cuelgan de la aventura de SU campaña.
UPDATE public.maps_scenes s
SET adventure_id = a.id
FROM public.adventures_adventures a
WHERE a.campaign_id = s.campaign_id
  AND s.adventure_id IS NULL;

ALTER TABLE public.maps_scenes ALTER COLUMN adventure_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS maps_scenes_adventure_idx ON public.maps_scenes (adventure_id);

-- ── Toda campaña NUEVA nace con su «Aventura 1» ─────────────────────────────
-- Sin esto, la primera escena de una campaña recién creada chocaría con el NOT NULL
-- de arriba. Va en la base y no en el front por la misma razón que el rol de director:
-- es un invariante de la campaña, no un paso que la pantalla pueda olvidar.
CREATE OR REPLACE FUNCTION public.adventures_seed_for_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.adventures_adventures (campaign_id, title, status, sort_order, created_by)
  VALUES (NEW.id, 'Aventura 1', 'running', 0, NEW.dm_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_seed_adventure ON public.campaigns_campaigns;
CREATE TRIGGER campaigns_seed_adventure AFTER INSERT ON public.campaigns_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.adventures_seed_for_campaign();

-- ── RLS: material del director ──────────────────────────────────────────────
-- Para el jugador la fila entera NO EXISTE: no es «esconder campos», es que no hay
-- ninguna política que se la enseñe.
ALTER TABLE public.adventures_adventures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adventures_select ON public.adventures_adventures;
CREATE POLICY adventures_select ON public.adventures_adventures
  FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.is_admin());

DROP POLICY IF EXISTS adventures_write ON public.adventures_adventures;
CREATE POLICY adventures_write ON public.adventures_adventures
  FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.is_admin())
  WITH CHECK (public.is_campaign_dm(campaign_id) OR public.is_admin());

-- ── Permisos de tabla ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventures_adventures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventures_adventures TO service_role;
