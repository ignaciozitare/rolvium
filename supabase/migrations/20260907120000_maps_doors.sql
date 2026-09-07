-- ============================================================================
-- LAS PUERTAS, DE VERDAD — cómo es cada puerta
-- ============================================================================
-- Encargo suyo del 2026-09-07, con una captura de Dungeon Scrawl delante:
-- «*tengo que poder elegir si la puerta es de una o dos hojas y si abre para un
-- lado o el otro, adentro o afuera (preseteado en algo, cosa de que no sea
-- obligatorio configurarla). Si a la puerta se le puede poner un color o
-- textura mejor*».
--
-- 🔑 LAS MISMAS CUATRO COLUMNAS EN LAS DOS TABLAS. Una puerta de muro suelto
-- vive en `maps_walls` y una de sala en `maps_room_openings`, y las dos ya
-- llevan `kind` e `is_open` en paralelo con el mismo significado. Repetir el
-- juego es lo que deja que el panel de la puerta y el disco de abrir/cerrar
-- sean UNA sola pieza para las dos — que es precisamente lo que hoy está roto:
-- el disco busca sólo en `maps_walls` y las de sala se quedan sin abrir.
--
-- TODO ADITIVO Y CON VALOR POR OMISIÓN: los valores por defecto son exactamente
-- lo que hacen hoy las puertas ya puestas (una hoja, bisagra en el extremo por
-- donde se empezó a dibujar, abriendo hacia el mismo lado de siempre, sin color
-- propio). Ninguna cambia de comportamiento al aplicar esto. El ASPECTO sí
-- cambia, pero eso lo hace el dibujo nuevo, no la base — y es decisión suya:
-- prefiere que cambien las que ya tiene a que convivan dos puertas distintas.
--
-- NO CREA TABLAS NI POLÍTICAS. `maps_walls` y `maps_room_openings` ya tienen RLS
-- y su reparto —leen los miembros que pueden ver la escena, escribe sólo el
-- director—, que es exactamente el que piden estas columnas: cómo es una puerta
-- lo decide quien levanta el mapa. Y BORRAR una abertura de sala, que el spec
-- pide y hoy no se puede, tampoco necesita nada aquí: la política es `FOR ALL` y
-- el GRANT ya incluye DELETE. Lo que falta es que alguien llame a
-- `removeRoomOpening`, y eso es código.
-- ============================================================================

-- ── LAS PUERTAS DE MURO SUELTO ──────────────────────────────────────────────
ALTER TABLE public.maps_walls
  ADD COLUMN IF NOT EXISTS leaves     smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hinge      text     NOT NULL DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS swing      text     NOT NULL DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS door_color text;

-- ── LAS PUERTAS DE SALA ─────────────────────────────────────────────────────
ALTER TABLE public.maps_room_openings
  ADD COLUMN IF NOT EXISTS leaves     smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hinge      text     NOT NULL DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS swing      text     NOT NULL DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS door_color text;

-- ── LAS FORMAS ──────────────────────────────────────────────────────────────
-- Se escriben con DROP + ADD para que un re-run no aborte: ADD CONSTRAINT no
-- tiene IF NOT EXISTS, y es el mismo patrón de `maps_walls_kind_check`.
--
-- `hinge` y `swing` son DOS interruptores y no un menú de cuatro combinaciones
-- (decisión del spec): así el panel se entiende sin leer.
--
--   hinge  'start' = el extremo (x1,y1), por donde empezó a dibujar · 'end' = el otro.
--   swing  el lado de la normal del segmento hacia el que gira la hoja.
--          'right' = +n (con n = (-dy, dx)), que es hacia donde la saca hoy
--          `openingGeometry`; 'left' = el contrario. Se nombran por la geometría
--          y no «adentro/afuera» a propósito: en un muro suelto sobre una foto
--          no hay dentro ni fuera, y el spec ya decidió que el lado por defecto
--          es FIJO y no calculado.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maps_walls', 'maps_room_openings'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_leaves_check');
    EXECUTE format('ALTER TABLE public.%I ADD  CONSTRAINT %I CHECK (leaves IN (1, 2))', t, t || '_leaves_check');

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_hinge_check');
    EXECUTE format('ALTER TABLE public.%I ADD  CONSTRAINT %I CHECK (hinge IN (''start'', ''end''))', t, t || '_hinge_check');

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_swing_check');
    EXECUTE format('ALTER TABLE public.%I ADD  CONSTRAINT %I CHECK (swing IN (''left'', ''right''))', t, t || '_swing_check');

    -- Un color es un color: `#abc`, `#aabbcc` o `#aabbccdd`. NULL = el de la
    -- escena, que es el caso normal y el de todas las puertas que ya existen.
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_door_color_check');
    EXECUTE format('ALTER TABLE public.%I ADD  CONSTRAINT %I CHECK (door_color IS NULL OR door_color ~* ''^#[0-9a-f]{3,8}$'')', t, t || '_door_color_check');
  END LOOP;
END $$;

-- ── EL COLOR DE TODAS LAS PUERTAS DE LA ESCENA ──────────────────────────────
-- «El color es de la ESCENA, con excepción por puerta» (elegido por él): por
-- defecto todas iguales, y si una es especial —la de hierro del jefe— se le
-- cambia a ésa sola con `door_color` de la fila.
--
-- NULO Y NO UN HEX CONCRETO: nulo significa «el trazo del muro», que es de
-- donde salen hoy. Clavar aquí un color obligaría a que la base y el diseño
-- dijeran lo mismo en dos sitios, y el día que el `.pen` cambie de tinta habría
-- que migrar todas las escenas para que no se quedaran con la vieja.
ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS door_color text;

ALTER TABLE public.maps_scenes DROP CONSTRAINT IF EXISTS maps_scenes_door_color_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_door_color_check
  CHECK (door_color IS NULL OR door_color ~* '^#[0-9a-f]{3,8}$');

-- ── LOS COMENTARIOS, QUE SON LOS QUE SOBREVIVEN ─────────────────────────────
COMMENT ON COLUMN public.maps_walls.leaves     IS 'Hojas de la puerta: 1 o 2. Con 2 se parte por la mitad y las dos giran a la vez, cada una desde su extremo. Solo se lee si kind = door.';
COMMENT ON COLUMN public.maps_walls.hinge      IS 'De que extremo cuelga: start = (x1,y1), por donde se empezo a dibujar (el defecto) · end = el otro.';
COMMENT ON COLUMN public.maps_walls.swing      IS 'Hacia que lado gira la hoja: right = +n con n = (-dy, dx), que es el lado de siempre · left = el contrario. Geometrico y no adentro/afuera: en un muro suelto no hay dentro ni fuera.';
COMMENT ON COLUMN public.maps_walls.door_color IS 'Color propio de ESTA puerta. NULL = el de la escena (maps_scenes.door_color), que es el caso normal.';

COMMENT ON COLUMN public.maps_room_openings.leaves     IS 'Hojas de la puerta: 1 o 2. Mismo significado que en maps_walls, a proposito: el panel y el disco de abrir/cerrar son una sola pieza para las dos.';
COMMENT ON COLUMN public.maps_room_openings.hinge      IS 'De que extremo cuelga: start = (x1,y1), por donde se empezo a dibujar (el defecto) · end = el otro.';
COMMENT ON COLUMN public.maps_room_openings.swing      IS 'Hacia que lado gira la hoja: right = +n con n = (-dy, dx) · left = el contrario.';
COMMENT ON COLUMN public.maps_room_openings.door_color IS 'Color propio de ESTA puerta. NULL = el de la escena (maps_scenes.door_color).';

COMMENT ON COLUMN public.maps_scenes.door_color IS 'Color por defecto de TODAS las puertas de la escena. NULL = el trazo del muro, que es de donde salen hoy.';

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
-- PostgREST guarda el esquema EN CACHE al arrancar. Sin este aviso, una columna
-- recien anadida no existe para el: las consultas que la nombran fallan enteras
-- y la pantalla se queda vacia sin decir por que. Paso de verdad el 2026-09-04.
NOTIFY pgrst, 'reload schema';
