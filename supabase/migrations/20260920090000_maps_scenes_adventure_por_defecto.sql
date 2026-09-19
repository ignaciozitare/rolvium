-- ─────────────────────────────────────────────────────────────────────────────
-- LA ESCENA NUEVA CAE SOLA EN UNA AVENTURA
-- Specs: specs/modules/adventures/SPEC.md · specs/modules/maps/SPEC.md
--
-- La migración `20260919120100` puso `maps_scenes.adventure_id` NOT NULL, pero el
-- carril de escenas de la mesa crea escenas SIN decir de qué aventura son — no lo
-- sabe, ahí no hay aventuras a la vista. Comprobado ejecutándolo contra la base
-- local (2026-09-20): crear una escena falla con
--   «null value in column "adventure_id" … violates not-null constraint».
--
-- Se arregla en la BASE y no en la pantalla por la misma razón que la «Aventura 1»
-- de toda campaña nueva: es un invariante de la campaña, no un paso que una
-- pantalla —o la próxima que se escriba— pueda olvidar.
--
-- Cuál le toca: la que el director tiene EN CURSO; si no hay ninguna en curso, la
-- primera del carril. Y si la campaña se ha quedado sin ninguna (se borraron todas),
-- se le crea su «Aventura 1», igual que hace el trigger de campaña nueva.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.maps_scenes_default_adventure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  IF NEW.adventure_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO target
  FROM public.adventures_adventures a
  WHERE a.campaign_id = NEW.campaign_id
    AND a.status <> 'archived'
  ORDER BY (a.status = 'running') DESC, a.sort_order, a.created_at
  LIMIT 1;

  IF target IS NULL THEN
    INSERT INTO public.adventures_adventures (campaign_id, title, status, sort_order, created_by)
    SELECT NEW.campaign_id, 'Aventura 1', 'running', 0, c.dm_id
    FROM public.campaigns_campaigns c
    WHERE c.id = NEW.campaign_id
    RETURNING id INTO target;
  END IF;

  NEW.adventure_id := target;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maps_scenes_default_adventure ON public.maps_scenes;
CREATE TRIGGER maps_scenes_default_adventure BEFORE INSERT ON public.maps_scenes
  FOR EACH ROW EXECUTE FUNCTION public.maps_scenes_default_adventure();

-- Esta migración NO crea tablas: `maps_scenes` y `adventures_adventures` ya traen su
-- RLS y sus GRANT de las migraciones que las crearon, y aquí no se toca ninguna de las dos.
