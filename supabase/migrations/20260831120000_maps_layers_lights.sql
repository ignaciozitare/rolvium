-- ============================================================================
-- Rolvium — maps (H7) rebanada 7: capas de contenido, terreno con máscara y luces
-- Spec: specs/modules/maps/SPEC.md § «Rebanada 7 — capas, luces de ambiente,
--       ojos de un personaje y niebla degradada»
-- ============================================================================
-- Dos tablas nuevas (`maps_layers`, `maps_lights`), una columna `layer_id` en
-- las tablas de contenido que ya existían, y un relleno para que las escenas de
-- hoy aparezcan con sus capas hechas. Nada que tocar a mano.
--
-- CÓMO ENTIENDE EL DUEÑO LAS CAPAS (2026-08-31, literal): «las capas son para
-- cada escena, es un recurso para lograr cosas gráficas. como en photoshop o
-- cualquier otra herramienta de edicion, incluso tengo que poder enviar
-- elementos a distintas capas». De ahí salen las dos decisiones que gobiernan
-- todo este fichero:
--
--   1. `visible` es EL OJO DE PHOTOSHOP: una capa apagada NO SE PINTA, ni para
--      el director ni para el jugador — no es un interruptor de privacidad. Por
--      eso «Notas del director» tiene que ser un TIPO aparte y no una capa
--      apagada: un interruptor se pulsa por error, un tipo no.
--   2. Cualquier elemento se manda a cualquier capa → `layer_id` en dibujos,
--      fichas y luces. `NULL` significa «la capa natural de su tipo», así que
--      nada de lo que ya existe hay que rellenarlo ni migrarlo.
--
-- LO QUE ESTA REBANADA NO GUARDA, A PROPÓSITO:
--   · «Ver con los ojos de un personaje» (§7.3) es una LENTE del director: no
--     mueve la escena activa, no toca la niebla guardada y no avisa a nadie.
--     No hay nada que persistir — la visión la calcula la API por el mismo
--     camino que la del jugador de verdad.
--   · La penumbra (§7.4) no inventa un número: su anchura sale de
--     `maps_tokens.vision_radius` y de la luz de la escena, que ya existen.
--     ⚠ El bulto de una ficha en penumbra NO PUEDE VIAJAR POR RLS: la RLS
--     decide filas enteras, no columnas, así que mandar la fila sería mandar el
--     nombre y el retrato. Lo manda la API con `service_role`, recortado a
--     posición y tamaño. Queda escrito aquí para que nadie «arregle» la
--     política de `maps_tokens` abriéndola a las fichas en penumbra.
-- ============================================================================
BEGIN;

-- ── Capas de contenido ──────────────────────────────────────────────────────
-- Cuatro tipos. Tres son fijas y hay exactamente una de cada por escena
-- (índice único parcial): objetos, criaturas y notas del director. El TERRENO
-- es el que lleva varias, sin límite (decisión del dueño, a sabiendas de que
-- pesa: la app AVISA, no bloquea).
--
-- El nombre se guarda VACÍO en las fijas: se rotulan en pantalla desde `kind`
-- con las claves de i18n, para no meter castellano en la base de datos. Sólo
-- las de terreno, que las crea el director, llevan nombre propio.
--
-- `sort_order` ordena entre capas DEL MISMO TIPO — hoy sólo el terreno tiene
-- más de una. El orden de pintado entre tipos no se guarda porque no se elige:
-- es el motor (terreno → objetos → criaturas → notas del director).
CREATE TABLE IF NOT EXISTS public.maps_layers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id      uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('terrain', 'objects', 'creatures', 'dm_notes')),
  name          text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  sort_order    int  NOT NULL DEFAULT 0,
  -- El ojo: apagada no se pinta para NADIE. No es privacidad (ver cabecera).
  visible       boolean NOT NULL DEFAULT true,
  -- El candado: se ve pero no se selecciona ni se mueve. Es del director y sólo
  -- le afecta a él — un jugador no selecciona nada de todos modos. Es lo que
  -- evita arrastrar el terreno sin querer al mover una ficha.
  locked        boolean NOT NULL DEFAULT false,

  -- ── Sólo terreno ──────────────────────────────────────────────────────────
  -- La foto de esta capa y su encaje, con la misma forma que `maps_scenes.bg_transform`.
  image_url     text,
  transform     jsonb NOT NULL DEFAULT '{"mode":"cover","x":0,"y":0,"scale":1}'::jsonb,

  -- LA MÁSCARA DEL PINCEL DE TRANSPARENCIA — la pieza con más jugo de la rebanada.
  -- Se guarda como un PNG en el bucket `backgrounds`, bajo
  -- `{campaignId}/masks/{layerId}.png`, y aquí sólo vive el puntero.
  --
  -- POR QUÉ UNA IMAGEN Y NO TRAZOS EN JSONB, que es lo que hace el pincel de
  -- niebla de la rebanada 2 (`maps_fog.explored`, polígonos) y era el precedente
  -- a mirar. La niebla es SÍ O NO: un polígono la describe entera. Este pincel
  -- tiene FUERZA REGULABLE — cada punto del mapa guarda «cuánto» se ve, no
  -- «si» se ve. Guardarlo como trazos obliga a:
  --   · repintar todos los trazos en cada fotograma (miles, con degradado) —
  --     una textura es UN dibujado;
  --   · crecer sin techo con cada pincelada, y viajar entera por realtime a
  --     todos los navegadores en cada retoque.
  -- Un PNG pesa lo mismo con una pincelada que con diez mil, se sirve por CDN y
  -- se cachea. Y sigue cumpliendo lo que pidió el dueño: LA FOTO ORIGINAL NO SE
  -- TOCA NUNCA — la máscara es un fichero aparte, así que subir la fuerza en
  -- sentido contrario siempre devuelve la imagen.
  --
  -- `mask_version` sube en cada guardado: sirve para romper la caché
  -- (`mask_url?v=N`) y para que un navegador sepa que el suyo se quedó viejo.
  -- `mask_url` a NULL = capa sin máscara = opaca entera.
  mask_url      text,
  mask_version  int  NOT NULL DEFAULT 0 CHECK (mask_version >= 0),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Imagen y máscara son cosa del terreno; en las otras tres no significan nada.
  CONSTRAINT maps_layers_terrain_only
    CHECK (kind = 'terrain' OR (image_url IS NULL AND mask_url IS NULL))
);

CREATE INDEX IF NOT EXISTS maps_layers_scene_idx ON public.maps_layers (scene_id, kind, sort_order);
-- Exactamente una de cada tipo fijo por escena. El terreno queda fuera: es el único sin límite.
CREATE UNIQUE INDEX IF NOT EXISTS maps_layers_fixed_kind_uidx
  ON public.maps_layers (scene_id, kind) WHERE kind <> 'terrain';

DROP TRIGGER IF EXISTS maps_layers_touch ON public.maps_layers;
CREATE TRIGGER maps_layers_touch BEFORE UPDATE ON public.maps_layers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Luces de ambiente ───────────────────────────────────────────────────────
-- HOY SON PINTURA: no revelan niebla, no cambian lo que ve nadie y no entran en
-- el cálculo de visión del servidor (decisión explícita del dueño). Que ninguna
-- línea prometa lo contrario.
--
-- `range_m` y `casts_shadow` SE GUARDAN DESDE EL PRIMER DÍA aunque todavía no
-- se usen: el día que las luces iluminen de verdad, añadirlos entonces obligaría
-- a repasar a mano todas las luces ya colocadas de todas las escenas.
-- En METROS y no en píxeles, como `maps_scenes.night_radius_m`: es la unidad en
-- la que se razona en la mesa.
CREATE TABLE IF NOT EXISTS public.maps_lights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id      uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  -- Una luz es un objeto de la escena: vive en una capa. NULL = la capa de objetos.
  layer_id      uuid REFERENCES public.maps_layers(id) ON DELETE CASCADE,

  shape         text NOT NULL DEFAULT 'radius' CHECK (shape IN ('cone', 'radius', 'square')),
  -- Los tres del spec más los cuatro que apuntó el diseño. Añadir uno es una línea.
  kind          text NOT NULL DEFAULT 'torch'
                CHECK (kind IN ('torch', 'bulb', 'fire', 'lantern', 'flashlight', 'moonlight', 'magic')),

  x             real NOT NULL DEFAULT 0,
  y             real NOT NULL DEFAULT 0,
  rotation      real NOT NULL DEFAULT 0,      -- grados; se gira como lo demás
  -- Apertura del cono. Sin ella un cono no está definido; en radio y cuadrado se ignora.
  cone_angle    real NOT NULL DEFAULT 60 CHECK (cone_angle > 0 AND cone_angle <= 360),

  color         text NOT NULL DEFAULT '#ffb46b',
  -- Una antorcha tiembla, una bombilla no. El tipo trae su valor por defecto;
  -- esta columna es lo que el director decida para ESTA luz.
  flicker       boolean NOT NULL DEFAULT false,

  -- ── Preparado para el día que iluminen (hoy no se leen) ───────────────────
  range_m       real    NOT NULL DEFAULT 6 CHECK (range_m > 0 AND range_m <= 500),
  casts_shadow  boolean NOT NULL DEFAULT false,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maps_lights_scene_idx ON public.maps_lights (scene_id);

DROP TRIGGER IF EXISTS maps_lights_touch ON public.maps_lights;
CREATE TRIGGER maps_lights_touch BEFORE UPDATE ON public.maps_lights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── «Manda esto a otra capa» ────────────────────────────────────────────────
-- NULL = la capa natural de su tipo (dibujos → objetos, fichas → criaturas).
-- Por eso NO hay que rellenar nada de lo que ya existe.
--
-- Al borrar una capa se van sus dibujos (es lo que significa borrar una capa en
-- cualquier editor), pero las FICHAS NO: una ficha es una pieza de juego con
-- estado —los PV de la copia del bestiario, quién la controla— y perder el
-- personaje de un jugador por borrar una capa decorativa sería un desastre
-- silencioso. Vuelve sola a su capa natural.
ALTER TABLE public.maps_drawings
  ADD COLUMN IF NOT EXISTS layer_id uuid REFERENCES public.maps_layers(id) ON DELETE CASCADE;
ALTER TABLE public.maps_tokens
  ADD COLUMN IF NOT EXISTS layer_id uuid REFERENCES public.maps_layers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maps_drawings_layer_idx ON public.maps_drawings (layer_id);
CREATE INDEX IF NOT EXISTS maps_tokens_layer_idx   ON public.maps_tokens (layer_id);

-- ── ¿Esta capa viaja al navegador de un jugador? ────────────────────────────
-- Una sola verdad para las tres tablas de contenido. Un jugador NO recibe:
--   · nada de la capa «Notas del director» — no es que se pinte oculta: NO SE
--     ENVÍA, que es la regla dura del spec;
--   · nada de una capa apagada — si no se pinta, mandarlo sería un agujero para
--     el jugador curioso que mire lo que le llega.
-- `NULL` (capa natural) pasa: es todo lo que existe hoy.
CREATE OR REPLACE FUNCTION public.maps_layer_sends_to_players(lid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lid IS NULL OR EXISTS (
    SELECT 1 FROM public.maps_layers l
    WHERE l.id = lid AND l.visible AND l.kind <> 'dm_notes'
  );
$$;
REVOKE ALL ON FUNCTION public.maps_layer_sends_to_players(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.maps_layer_sends_to_players(uuid) TO authenticated, service_role;

-- ── Toda escena nace con sus tres capas fijas ───────────────────────────────
-- En un disparador y no en el caso de uso: así vale también para una escena
-- creada desde el seed o desde la consola, y la invariante no depende de que
-- el que la cree se acuerde. Nombre vacío: la pantalla las rotula desde `kind`.
CREATE OR REPLACE FUNCTION public.maps_scenes_seed_layers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.maps_layers (scene_id, campaign_id, kind, sort_order)
  VALUES (NEW.id, NEW.campaign_id, 'objects',   0),
         (NEW.id, NEW.campaign_id, 'creatures', 0),
         (NEW.id, NEW.campaign_id, 'dm_notes',  0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.maps_scenes_seed_layers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS maps_scenes_seed_layers ON public.maps_scenes;
CREATE TRIGGER maps_scenes_seed_layers AFTER INSERT ON public.maps_scenes
  FOR EACH ROW EXECUTE FUNCTION public.maps_scenes_seed_layers();

-- ── Relleno: las escenas que ya existen ─────────────────────────────────────
-- 1. Sus tres capas fijas.
INSERT INTO public.maps_layers (scene_id, campaign_id, kind, sort_order)
SELECT s.id, s.campaign_id, k, 0
FROM public.maps_scenes s CROSS JOIN unnest(ARRAY['objects', 'creatures', 'dm_notes']) AS k
ON CONFLICT DO NOTHING;

-- 2. Su foto de fondo pasa a ser la capa de terreno de más abajo.
-- El dueño espera ver SU foto en la lista de capas — si no aparece, no puede
-- ponerle otra encima ni borrarle trozos, que es justo lo que pidió.
-- `maps_scenes.bg_image_url` y `bg_transform` NO se borran ni se vacían: el
-- código de producción todavía los lee, y quitarlos aquí dejaría la escena en
-- negro entre esta migración y el despliegue de la pantalla. Quedan como
-- respaldo, con esta regla para quien pinte: SI LA ESCENA TIENE ALGUNA CAPA DE
-- TERRENO, manda la capa y `bg_image_url` se ignora. Así no se pinta dos veces
-- ni antes ni después.
INSERT INTO public.maps_layers (scene_id, campaign_id, kind, sort_order, image_url, transform)
SELECT s.id, s.campaign_id, 'terrain', 0, s.bg_image_url, s.bg_transform
FROM public.maps_scenes s
WHERE s.bg_image_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.maps_layers l WHERE l.scene_id = s.id AND l.kind = 'terrain');

-- ── Un jugador tampoco cambia de capa su ficha ──────────────────────────────
-- Misma función de la rebanada 1, con `layer_id` añadido a la lista de columnas
-- que un jugador no toca. Sin esto, quien controla una ficha podría mandarla a
-- la capa de notas del director (y desaparecer del mapa de los demás) o sacarla
-- de una capa apagada. Un jugador SÓLO mueve: `x` e `y`.
CREATE OR REPLACE FUNCTION public.maps_tokens_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_campaign_dm(OLD.campaign_id) THEN RETURN NEW; END IF;
  IF OLD.controlled_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NEW.scene_id <> OLD.scene_id OR NEW.campaign_id <> OLD.campaign_id OR NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.bestiary_ref IS DISTINCT FROM OLD.bestiary_ref OR NEW.name <> OLD.name OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.size <> OLD.size OR NEW.color IS DISTINCT FROM OLD.color OR NEW.visible <> OLD.visible
     OR NEW.controlled_by IS DISTINCT FROM OLD.controlled_by OR NEW.vision_radius IS DISTINCT FROM OLD.vision_radius
     OR NEW.state IS DISTINCT FROM OLD.state OR NEW.layer_id IS DISTINCT FROM OLD.layer_id THEN
    RAISE EXCEPTION 'players may only move their token' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.maps_tokens_guard_update() FROM PUBLIC, anon, authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.maps_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_lights ENABLE ROW LEVEL SECURITY;

-- Capas: el director, todas. El jugador, sólo las que se pintan para él — nunca
-- «Notas del director» (no le existe) ni una capa apagada.
DROP POLICY IF EXISTS maps_layers_select ON public.maps_layers;
CREATE POLICY maps_layers_select ON public.maps_layers FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR (kind <> 'dm_notes' AND visible AND public.maps_scene_visible(scene_id))
  );
DROP POLICY IF EXISTS maps_layers_dm_write ON public.maps_layers;
CREATE POLICY maps_layers_dm_write ON public.maps_layers FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- Luces: las coloca sólo el director; el jugador las ve si ve la escena y la capa viaja.
DROP POLICY IF EXISTS maps_lights_select ON public.maps_lights;
CREATE POLICY maps_lights_select ON public.maps_lights FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR (public.maps_scene_visible(scene_id) AND public.maps_layer_sends_to_players(layer_id))
  );
DROP POLICY IF EXISTS maps_lights_dm_write ON public.maps_lights;
CREATE POLICY maps_lights_dm_write ON public.maps_lights FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- ── Las políticas que ya existían, con la capa en la cuenta ─────────────────
-- Se reescriben enteras (no se «amplían»): la condición del jugador gana un
-- factor. La del director no cambia — sigue viéndolo todo.
--
-- Fichas: la visibilidad por ficha (`visible`) SIGUE MANDANDO, que es de reglas
-- y no de capas; la capa se suma, no la sustituye.
DROP POLICY IF EXISTS maps_tokens_select ON public.maps_tokens;
CREATE POLICY maps_tokens_select ON public.maps_tokens FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR (visible AND public.maps_scene_visible(scene_id) AND public.maps_layer_sends_to_players(layer_id))
  );

DROP POLICY IF EXISTS maps_tokens_player_move ON public.maps_tokens;
CREATE POLICY maps_tokens_player_move ON public.maps_tokens FOR UPDATE TO authenticated
  USING (
    controlled_by = auth.uid() AND public.maps_scene_visible(scene_id)
    AND public.maps_layer_sends_to_players(layer_id)
  )
  WITH CHECK (controlled_by = auth.uid() AND public.maps_layer_sends_to_players(layer_id));

DROP POLICY IF EXISTS maps_drawings_select ON public.maps_drawings;
CREATE POLICY maps_drawings_select ON public.maps_drawings FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR (public.maps_scene_visible(scene_id) AND public.maps_layer_sends_to_players(layer_id))
  );

-- Un jugador dibuja en la capa natural (NULL) o en una que viaje: nunca en la
-- de notas del director, ni siquiera a propósito.
DROP POLICY IF EXISTS maps_drawings_insert ON public.maps_drawings;
CREATE POLICY maps_drawings_insert ON public.maps_drawings FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_campaign_dm(campaign_id)
      OR (public.maps_scene_visible(scene_id) AND public.maps_layer_sends_to_players(layer_id))
    )
  );

-- ── Permisos y realtime ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_layers, public.maps_lights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_layers, public.maps_lights TO service_role;

-- Replay-safe: añadir una tabla que ya está en la publicación abortaría un re-run.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maps_layers', 'maps_lights'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
