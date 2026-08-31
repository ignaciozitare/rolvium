-- ============================================================================
-- Rebanada 6 · «Galería de piezas» (specs/modules/maps/SPEC.md § Rebanada 6)
-- ============================================================================
-- Dos tablas, y la separación entre ellas ES la regla que pidió el dueño:
--
--   · `maps_props`        — LA BIBLIOTECA. Una pieza que existe para usarse:
--                           su foto, su categoría, y lo que RECUERDA (la escala
--                           de la última vez, y con qué estorbo nace).
--   · `maps_scene_props`  — LO PLANTADO. Cada copia puesta en un mapa, con su
--                           sitio, su tamaño, su giro y su estorbo propios.
--
-- POR QUÉ LO PLANTADO GUARDA SU PROPIA `image_url` (y no sólo un puntero):
-- regla del dueño — «borrar una pieza de la biblioteca NO borra las ya puestas
-- en los mapas». Perder el mobiliario de una mazmorra por limpiar la biblioteca
-- sería un desastre silencioso. Con la foto copiada, `prop_id` puede irse a NULL
-- sin que lo plantado se rompa. El objeto del bucket tampoco se borra al borrar
-- la fila (specs/core/images/SPEC.md ya lo dice), así que la foto sigue ahí.
--
-- POR QUÉ `campaign_id` ES NULABLE EN LA BIBLIOTECA:
-- NULL = pieza DE LA APP (el catálogo de serie del § 6.1), NOT NULL = pieza de
-- esa campaña. El dueño eligió «las dos, en este orden»: hoy sólo existen las
-- suyas, pero la distinción está desde el primer día y el día que haya dibujos
-- aparecen sin migrar nada. Nadie puede escribir en el catálogo de la app desde
-- la API — se siembra por migración, con service role.
--
-- DÓNDE VIVEN LAS FOTOS: en el bucket `backgrounds` que ya existe, bajo
-- `{campaignId}/props/{uuid}.webp`. Mismo precedente que las máscaras del pincel
-- de transparencia (`{campaignId}/masks/…`): un bucket nuevo pediría configurar
-- políticas de storage otra vez para nada.
--
-- LO QUE ESTA MIGRACIÓN **NO** TOCA, A PROPÓSITO:
--   · El § 6.6 («elegir a qué capa va un fondo») NO necesita esquema: la capa ya
--     tiene `image_url` y `transform` desde la rebanada 7. Lo que cambia es que
--     la pantalla deje de dar por hecho «la capa activa» y te la haga elegir.
--     Es trabajo de UI, no de base de datos.
--   · `maps_walls` no se toca. Un prop que estorba NO es un muro: se apunta en
--     su propia fila y el servidor lo suma a la geometría al calcular la visión.
-- ============================================================================

-- ── LA BIBLIOTECA ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maps_props (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = catálogo de la app; NOT NULL = biblioteca de esa campaña. Ver cabecera.
  campaign_id     uuid REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  name            text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  -- Categorías CERRADAS, no etiquetas libres (elección del dueño, 2026-08-31):
  -- las etiquetas obligan a etiquetar bien o no se encuentra nada.
  category        text NOT NULL DEFAULT 'misc'
                  CHECK (category IN ('furniture', 'vegetation', 'floors', 'doors', 'markers', 'misc')),
  image_url       text NOT NULL,

  -- Tamaño del fichero ya subido, en px. Con esto y `default_scale` sale la
  -- huella al plantar, sin tener que esperar a que la imagen cargue.
  natural_width   int NOT NULL CHECK (natural_width > 0),
  natural_height  int NOT NULL CHECK (natural_height > 0),

  -- ── LA ESCALA QUE SE RECUERDA (§ 6.4) ─────────────────────────────────────
  -- «Tengo que poder escalar el objeto y siempre se usa la última escala que
  -- puse» (dueño, 2026-08-31). Un solo número, no ancho y alto: la escala
  -- mantiene la proporción, así que redimensionar no puede deformar la pieza.
  -- Se reescribe tanto al plantar con otro tamaño como al redimensionar una ya
  -- plantada, que son los dos caminos por los que el dueño «pone» una escala.
  default_scale   real NOT NULL DEFAULT 1 CHECK (default_scale > 0 AND default_scale <= 50),

  -- ── CON QUÉ ESTORBO NACE UNA PIEZA PLANTADA (§ 6.5) ───────────────────────
  -- Se COPIAN al plantar; a partir de ahí manda la fila de lo plantado. Así una
  -- columna nace estorbando sin tener que marcarlo una por una, pero una columna
  -- concreta puede dejar de hacerlo sin cambiar la biblioteca entera.
  default_blocks_sight boolean NOT NULL DEFAULT false,
  default_blocks_move  boolean NOT NULL DEFAULT false,
  default_block_shape  text NOT NULL DEFAULT 'rect' CHECK (default_block_shape IN ('rect', 'circle')),

  uploaded_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maps_props_campaign_idx ON public.maps_props (campaign_id);
-- La galería entra siempre por campaña + categoría, y ordena por lo más reciente.
CREATE INDEX IF NOT EXISTS maps_props_campaign_category_idx ON public.maps_props (campaign_id, category, created_at DESC);

DROP TRIGGER IF EXISTS maps_props_touch ON public.maps_props;
CREATE TRIGGER maps_props_touch BEFORE UPDATE ON public.maps_props
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── LO PLANTADO EN UN MAPA ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maps_scene_props (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id      uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  -- Una pieza es un objeto de la escena: vive en una capa. NULL = la de objetos.
  -- CASCADE como los dibujos y las luces de la rebanada 7: borrar una capa se
  -- lleva su contenido. (Las FICHAS son la excepción, y por un buen motivo.)
  layer_id      uuid REFERENCES public.maps_layers(id) ON DELETE CASCADE,

  -- De qué pieza de la biblioteca salió. SET NULL, no CASCADE: ver cabecera.
  prop_id       uuid REFERENCES public.maps_props(id) ON DELETE SET NULL,
  -- Copiadas de la biblioteca al plantar. Son lo que hace que esto sobreviva.
  image_url     text NOT NULL,
  name          text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),

  x             real NOT NULL DEFAULT 0,
  y             real NOT NULL DEFAULT 0,
  -- Huella real en px de escena. Sale de `natural_*` × `default_scale` al plantar.
  width         real NOT NULL CHECK (width > 0),
  height        real NOT NULL CHECK (height > 0),
  rotation      real NOT NULL DEFAULT 0,   -- grados, como el resto del lienzo

  -- ── QUÉ ESTORBA (§ 6.5) ───────────────────────────────────────────────────
  -- Las mismas dos que ya distinguen los muros, no dos conceptos nuevos.
  blocks_sight  boolean NOT NULL DEFAULT false,
  blocks_move   boolean NOT NULL DEFAULT false,
  -- La forma que estorba es SIMPLE y no la silueta del PNG: la silueta real es
  -- cara y da errores raros en los bordes. En px de escena, relativa al CENTRO
  -- de la pieza. Al plantar se rellena con su huella entera; el director la afina.
  block_shape   text NOT NULL DEFAULT 'rect' CHECK (block_shape IN ('rect', 'circle')),
  block_w       real NOT NULL DEFAULT 0 CHECK (block_w >= 0),   -- en 'circle', el DIÁMETRO
  block_h       real NOT NULL DEFAULT 0 CHECK (block_h >= 0),   -- en 'circle', se ignora
  block_dx      real NOT NULL DEFAULT 0,
  block_dy      real NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maps_scene_props_scene_idx ON public.maps_scene_props (scene_id);
CREATE INDEX IF NOT EXISTS maps_scene_props_layer_idx ON public.maps_scene_props (layer_id);
-- El cálculo de visión pide sólo las que estorban la vista: que no barra la escena entera.
CREATE INDEX IF NOT EXISTS maps_scene_props_sight_idx ON public.maps_scene_props (scene_id) WHERE blocks_sight;

DROP TRIGGER IF EXISTS maps_scene_props_touch ON public.maps_scene_props;
CREATE TRIGGER maps_scene_props_touch BEFORE UPDATE ON public.maps_scene_props
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.maps_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_scene_props ENABLE ROW LEVEL SECURITY;

-- La BIBLIOTECA es una herramienta de autor: sólo la lee quien la usa, el
-- director. El catálogo de la app (campaign_id NULL) lo lee cualquiera
-- autenticado — no hay nada que esconder en un dibujo de una silla.
-- A un JUGADOR no le hace falta: lo plantado se lleva su propia foto.
DROP POLICY IF EXISTS maps_props_select ON public.maps_props;
CREATE POLICY maps_props_select ON public.maps_props FOR SELECT TO authenticated
  USING (campaign_id IS NULL OR public.is_campaign_dm(campaign_id));

-- Escribe el director, y SÓLO en su campaña: `campaign_id IS NOT NULL` es lo que
-- impide que nadie meta nada en el catálogo de la app desde la API.
DROP POLICY IF EXISTS maps_props_dm_write ON public.maps_props;
CREATE POLICY maps_props_dm_write ON public.maps_props FOR ALL TO authenticated
  USING (campaign_id IS NOT NULL AND public.is_campaign_dm(campaign_id))
  WITH CHECK (campaign_id IS NOT NULL AND public.is_campaign_dm(campaign_id));

-- Lo PLANTADO se ve como se ve todo lo de una escena: el director todo; el
-- jugador, si la escena le es visible y su capa le llega. Igual que las luces.
DROP POLICY IF EXISTS maps_scene_props_select ON public.maps_scene_props;
CREATE POLICY maps_scene_props_select ON public.maps_scene_props FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR (public.maps_scene_visible(scene_id) AND public.maps_layer_sends_to_players(layer_id))
  );

DROP POLICY IF EXISTS maps_scene_props_dm_write ON public.maps_scene_props;
CREATE POLICY maps_scene_props_dm_write ON public.maps_scene_props FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_props, public.maps_scene_props TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_props, public.maps_scene_props TO service_role;

-- Replay-safe: añadir una tabla que ya está en la publicación abortaría un re-run.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maps_props', 'maps_scene_props'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
