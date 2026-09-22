-- ─────────────────────────────────────────────────────────────────────────────
-- UNA ESCENA SÓLO PUEDE COLGAR DE UNA AVENTURA DE SU PROPIA CAMPAÑA
-- Spec: specs/modules/adventures/SPEC.md § Rules & limits
--   «A scene belongs always and only to one adventure, OF THE SAME CAMPAIGN.»
--
-- Hasta aquí eso era una frase del spec y nada más: la clave ajena de
-- `maps_scenes.adventure_id` sólo probaba que la aventura EXISTE, no de quién es. Un
-- director podía —con un id a mano— colgar su escena de la aventura de otra campaña, y
-- la base lo aceptaba. No es un agujero de privacidad (la RLS de las dos tablas sigue
-- mandando en lo que cada uno ve), pero sí datos rotos y callados: la escena
-- desaparecería del carril de su campaña.
--
-- Se cierra con la pareja de siempre: una clave única (id, campaign_id) en la aventura y
-- una clave ajena COMPUESTA desde la escena. Así la campaña de las dos tiene que ser la
-- misma, y ya no depende de que ninguna pantalla se acuerde.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.adventures_adventures
  DROP CONSTRAINT IF EXISTS adventures_id_campaign_key;
ALTER TABLE public.adventures_adventures
  ADD CONSTRAINT adventures_id_campaign_key UNIQUE (id, campaign_id);

ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_adventure_id_fkey;
ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_adventure_fkey;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_adventure_fkey
  FOREIGN KEY (adventure_id, campaign_id)
  REFERENCES public.adventures_adventures (id, campaign_id)
  ON DELETE RESTRICT;

-- Sin tablas nuevas: `maps_scenes` y `adventures_adventures` conservan su RLS y sus GRANT.
