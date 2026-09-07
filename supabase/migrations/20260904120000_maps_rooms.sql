-- ============================================================================
-- Rebanada 8 · LAS SALAS (specs/modules/maps/SPEC.md § «Cómo se levanta una sala»)
-- ============================================================================
-- Spec CERRADO por el dueño el 2026-09-04, sin ninguna pregunta abierta.
--
-- 🔑 LA VUELTA DE TUERCA, Y SI SE ENTIENDE AL REVÉS TODO LO DEMÁS SALE MAL:
-- el suelo NO se pone encima, se ve por el AGUJERO. La textura de PARED rellena
-- la escena entera —es la roca de la que está excavada la mazmorra— y cada sala
-- ABRE UN HUECO por el que asoma la textura de SUELO. Dibujar una sala no añade
-- suelo: quita pared.
--
-- 🔴 Y LOS MUROS DE UNA SALA **NO** SON LOS DE SIEMPRE (corrección suya del
-- 2026-09-04: «*ojo que estos muros no son los otros… no estoy hablando de los
-- muros con los que venimos trabajando*»). Mismo comportamiento —cortan la
-- vista, frenan a las fichas, recortan las luces— pero entidad distinta:
--
--   · `maps_walls`      = una MARCA INVISIBLE encima de una foto traída de fuera.
--                         Modo A. **NO SE TOCA**: ni tabla, ni RLS, ni conducta.
--   · el muro de una sala = UN OBJETO QUE SE VE: la roca entre dos huecos, con
--                         grosor, textura y sombra. **ES el mapa.**
--
-- Por eso aquí NO hay ninguna columna que ate una sala a `maps_walls`, y una
-- sala NO escribe filas derivadas: su CONTORNO es el muro, y el contorno se
-- CALCULA (`@rolvium/core` → `roomOutline`) a partir de las formas. Si el muro
-- fuera una fila derivada habría que reescribirla cada vez que él mueva una
-- forma, que era justo el punto flojo del plan anterior.
--
-- QUÉ SE GUARDA, Y POR QUÉ ASÍ:
--
-- 1 · UNA FILA = UNA FORMA, NO LA UNIÓN. Elección suya: las salas se FUNDEN al
--     tocarse («*si hago otro rectángulo y se solapa que se fusione dando la
--     nueva forma, nunca se apilan*») **pero cada forma se sigue recordando por
--     separado**, para poder coger un rectángulo, moverlo o borrarlo y que las
--     demás recuperen su forma. La unión se calcula al pintar; no se destruye.
--
-- 2 · LA GEOMETRÍA VA COMO UN ANILLO DE PUNTOS (`points`), también en el
--     círculo. El motor de unión trabaja con polígonos y sólo con polígonos: un
--     círculo guardado como centro+radio obligaría a poligonizarlo en cada
--     pintada, en cada cálculo de visión y en cada choque, y a que el navegador
--     y el servidor lo hicieran EXACTAMENTE igual o la sala tendría un contorno
--     en pantalla y otro para la niebla. `shape` se guarda igual, para que un
--     día se pueda reconocer «esto era un círculo» al editarlo.
--
-- 3 · `created_at` ES DATO, no metadato: al fundirse dos salas con suelos
--     distintos MANDA LA MÁS VIEJA (decisión mía, revisable, § «Decisiones que
--     tomo yo aquí»). De ahí el índice por (scene_id, created_at).
--
-- 4 · EL SUELO SE HEREDA DEL MOMENTO DE DIBUJAR Y SE QUEDA QUIETO. Orden suya
--     del 2026-09-03, en redondo: «*como que repinta las salas, nooooo*».
--     Cambiar el preajuste de la escena NO repinta lo ya levantado, así que la
--     sala se lleva su suelo RESUELTO (`floor_preset` + `floor_url`) y no un
--     puntero a la escena.
--
-- 5 · LAS DOS TEXTURAS BASE Y EL GROSOR SON DE LA ESCENA, no de la sala. Suyo,
--     2026-09-03: «*una cripta y un bosque no se parecen en nada*» → de cada
--     MAPA, no de la campaña. El grosor es decisión mía revisable: un mapa con
--     paredes de grosores distintos según la sala se lee como un error de
--     dibujo, no como una decisión.
--
-- 6 · LAS ABERTURAS NO SON `planOpening` SOBRE UNA FILA DE MURO, porque no hay
--     fila. Son huecos anotados SOBRE EL CONTORNO: dónde empieza, dónde acaba y
--     si está abierto o cerrado. Van por ESCENA y no colgadas de una sala
--     porque el contorno es el de la UNIÓN: un vano puede caer justo donde dos
--     salas se funden y no pertenece a ninguna de las dos. El gesto del
--     director es el mismo disco de siempre.
--
-- 7 · NACEN VISIBLES, y no hay interruptor. Aquí «visible» NO es la casilla
--     `visible_players` de `maps_walls`: dibujando en Rolvium el muro ES el
--     dibujo, y esconderlo dejaría al jugador mirando una mancha de suelo
--     flotando en el vacío. Por eso no existe esa columna en estas tablas y por
--     eso la RLS de lectura es «la escena te es visible», sin más condiciones.
--     El botón «enseñar los muros a los jugadores» del 2026-09-03 es del modo A
--     y sólo de él.
--
-- LO QUE ESTA MIGRACIÓN **NO** TOCA, A PROPÓSITO:
--   · `maps_walls` y su `group_id`. El grupo ata los muros de un gesto en el
--     modo A y ahí se queda; una sala no lo necesita porque no genera filas.
--   · Las capas (§ 7.1). Una sala no vive en una capa: el relleno de pared y su
--     suelo se pintan POR DEBAJO de las capas de terreno, y una capa con
--     transparencia sigue mandando encima (decisión mía, revisable).
-- ============================================================================

-- ── LAS DOS TEXTURAS BASE, EL PREAJUSTE Y EL GROSOR — SON DE LA ESCENA ───────
ALTER TABLE public.maps_scenes
  -- El preajuste elige las dos texturas base DE GOLPE (§ «Las pseudo texturas
  -- base son preajustes»). Nueve, nuestros y en castellano. NO bloquea nada: en
  -- cuanto él cambie una textura a mano, manda la suya.
  ADD COLUMN IF NOT EXISTS room_preset       text NOT NULL DEFAULT 'hatch'
    CHECK (room_preset IN ('hatch', 'module', 'ancient', 'hatch_gray', 'fill', 'cavern', 'simple', 'ink', 'hand')),
  -- NULL = manda el preajuste (que pinta la roca y el suelo él solo). Con valor
  -- = una foto suya, subida al bucket `backgrounds` como todo lo demás.
  ADD COLUMN IF NOT EXISTS wall_texture_url  text,
  ADD COLUMN IF NOT EXISTS floor_texture_url text,
  -- EN CASILLAS, no en px: así el muro se ve igual de grueso con la rejilla en
  -- 15 que en 60, que es lo mismo que ya hacen el alcance de la vista y el
  -- tamaño de las fichas. 0,22 de casilla es el grosor del diseño.
  ADD COLUMN IF NOT EXISTS wall_thickness    real NOT NULL DEFAULT 0.22
    CHECK (wall_thickness > 0 AND wall_thickness <= 1);

COMMENT ON COLUMN public.maps_scenes.room_preset IS
  'Preajuste de mazmorra: elige de golpe la roca y el suelo de las salas de esta escena. No repinta lo ya levantado.';
COMMENT ON COLUMN public.maps_scenes.wall_thickness IS
  'Grosor del muro de una sala, EN CASILLAS (no en px), para que no cambie con la rejilla.';

-- ── LAS SALAS — UNA FILA ES UNA FORMA ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maps_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id      uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  -- Con qué gesto se levantó. No cambia cómo se pinta ni cómo se funde —todas
  -- las formas siguen las mismas reglas, dicho por él— pero saber que «esto era
  -- un círculo» es lo que permitirá editarlo como círculo el día que lo pida.
  shape         text NOT NULL DEFAULT 'rect'
                CHECK (shape IN ('rect', 'circle', 'poly', 'free')),

  -- EL ANILLO, en px de escena: [[x,y], [x,y], …]. Cerrado implícitamente (el
  -- último vuelve al primero), como ya hace `roomRules.ringSides`. Tres puntos
  -- es el mínimo que encierra algo; el tope alto es la red contra un trazo a
  -- pulso desbocado — `freehandSides` ya lo simplifica, esto es el cinturón.
  points        jsonb NOT NULL
                CHECK (jsonb_typeof(points) = 'array'
                       AND jsonb_array_length(points) BETWEEN 3 AND 2000),

  -- ── SU SUELO, HEREDADO DEL MOMENTO DE DIBUJAR (§ pregunta 6) ──────────────
  -- Resuelto y quieto: cambiar el preajuste de la escena no lo toca.
  floor_preset  text NOT NULL DEFAULT 'hatch'
                CHECK (floor_preset IN ('hatch', 'module', 'ancient', 'hatch_gray', 'fill', 'cavern', 'simple', 'ink', 'hand')),
  floor_url     text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Pintar la escena es «dame sus salas, de la más vieja a la más nueva»: el
-- orden ES la regla de qué suelo manda cuando dos se funden.
CREATE INDEX IF NOT EXISTS maps_rooms_scene_idx ON public.maps_rooms (scene_id, created_at);

DROP TRIGGER IF EXISTS maps_rooms_touch ON public.maps_rooms;
CREATE TRIGGER maps_rooms_touch BEFORE UPDATE ON public.maps_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── LAS ABERTURAS — HUECOS ANOTADOS SOBRE EL CONTORNO ───────────────────────
-- Por ESCENA, no por sala: el contorno es el de la UNIÓN y un vano puede caer
-- donde dos salas se funden. Se guarda el TRAMO en px de escena (de dónde a
-- dónde), y al pintar y al calcular la visión se descuenta del contorno lo que
-- caiga dentro de ese tramo. Así sobrevive a que él mueva una forma: el
-- contorno se recalcula, el vano sigue donde lo puso.
CREATE TABLE IF NOT EXISTS public.maps_room_openings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id      uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  campaign_id   uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  x1 real NOT NULL, y1 real NOT NULL, x2 real NOT NULL, y2 real NOT NULL,

  -- Las mismas dos de siempre, y con el mismo significado, para que el disco del
  -- director no tenga que aprender nada nuevo: una ventana deja ver y no deja
  -- pasar; una puerta cerrada no deja ni una cosa ni la otra.
  kind          text NOT NULL DEFAULT 'door' CHECK (kind IN ('door', 'window')),
  is_open       boolean NOT NULL DEFAULT false,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maps_room_openings_scene_idx ON public.maps_room_openings (scene_id);

DROP TRIGGER IF EXISTS maps_room_openings_touch ON public.maps_room_openings;
CREATE TRIGGER maps_room_openings_touch BEFORE UPDATE ON public.maps_room_openings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.maps_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps_room_openings  ENABLE ROW LEVEL SECURITY;

-- LEER: el director siempre; el jugador, si la escena le es visible. Y SIN la
-- condición de `visible_players` que llevan los muros del modo A, porque aquí
-- la sala ES EL DIBUJO DEL MAPA (§ «Nacen visibles»): esconderla dejaría al
-- jugador mirando el vacío. No hay nada que revelar en el contorno de una sala
-- que él no esté viendo ya pintado en su pantalla.
DROP POLICY IF EXISTS maps_rooms_select ON public.maps_rooms;
CREATE POLICY maps_rooms_select ON public.maps_rooms FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.maps_scene_visible(scene_id));

DROP POLICY IF EXISTS maps_room_openings_select ON public.maps_room_openings;
CREATE POLICY maps_room_openings_select ON public.maps_room_openings FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.maps_scene_visible(scene_id));

-- ESCRIBIR: sólo el director. Levantar el mapa es cosa suya, como todo Builder.
DROP POLICY IF EXISTS maps_rooms_dm_write ON public.maps_rooms;
CREATE POLICY maps_rooms_dm_write ON public.maps_rooms FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

DROP POLICY IF EXISTS maps_room_openings_dm_write ON public.maps_room_openings;
CREATE POLICY maps_room_openings_dm_write ON public.maps_room_openings FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_rooms, public.maps_room_openings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_rooms, public.maps_room_openings TO service_role;

-- Replay-safe: añadir una tabla que ya está en la publicación abortaría un re-run.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maps_rooms', 'maps_room_openings'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
-- PostgREST guarda el esquema EN CACHÉ al arrancar. Sin este aviso, una columna
-- recién añadida no existe para él: las consultas que la nombran fallan enteras
-- y la pantalla se queda vacía sin decir por qué. Pasó de verdad el 2026-09-04
-- —«no funciona hacer rectángulos de salas, no sé si los has metido en otra
-- capa»— y costó un rato encontrarlo porque la base estaba perfecta.
NOTIFY pgrst, 'reload schema';
