-- ============================================================================
-- Rebanada 9 — EL PINCEL (spec `specs/modules/maps/SPEC.md` § «Rebanada 9»,
-- aprobada por el dueño el 2026-09-09).
--
-- DOS CAMBIOS, Y NINGUNA TABLA NUEVA. Merece explicarse por qué es tan poco:
--
--   1. EL ESTADO DEL PINCEL VA EN LA ESCENA, no en el usuario. Decisión suya,
--      contra la recomendación contraria: «el trazo es de la escena». Un mapa
--      tiene un estilo y el pincel es parte de él, así que son columnas de
--      `maps_scenes` y no una tabla de preferencias por director.
--
--   2. NO HAY TABLA DE BROCHAZOS, NI SEMILLAS DEL AZAR. El borde irregular sale
--      distinto en cada pincelada («distinto cada vez»), pero lo que se guarda
--      NO son los trazos: es el RESULTADO — un PNG en `maps_layers.mask_url`
--      para el terreno, y casillas en `maps_fog.explored` para la niebla. El
--      azar queda cocido dentro de lo guardado y no hay nada que reconstruir.
--      (En el spec llegó a escribirse lo contrario; está corregido allí.)
--
-- Lo único de verdad nuevo es la máscara del suelo de una sala, que hoy no
-- existe: `maps_rooms` sabe de qué es su suelo (`floor_preset`/`floor_url`)
-- pero no guarda dónde se ha pintado encima.
--
-- SIN POLÍTICAS NUEVAS: las dos tablas ya tienen RLS activa y sus políticas
-- cubren la fila entera, luego cubren también estas columnas. Añadir políticas
-- aquí sería duplicar la regla en dos sitios y que un día discrepen.
-- ============================================================================

-- ── 1 · El pincel se recuerda POR ESCENA ────────────────────────────────────
-- Los valores por defecto son EXACTAMENTE los que la app ya usa hoy
-- (`layerRules.ts`: DEFAULT_MASK_SIZE 1.2, DEFAULT_MASK_STRENGTH 0.6,
-- DEFAULT_MASK_HARDNESS 0.4), para que una escena vieja abra igual que antes y
-- nadie note el cambio.
ALTER TABLE public.maps_scenes
  -- La punta: disco de canto limpio · difuminado · borde roto.
  ADD COLUMN IF NOT EXISTS brush_tip       text    NOT NULL DEFAULT 'soft',
  -- En CASILLAS y continuo, como ya lo lleva el pincel de transparencia.
  ADD COLUMN IF NOT EXISTS brush_size      numeric NOT NULL DEFAULT 1.2,
  -- Cuánto tapa o destapa cada pasada. Ahora también para la niebla, que hoy
  -- va a saco.
  ADD COLUMN IF NOT EXISTS brush_strength  numeric NOT NULL DEFAULT 0.6,
  -- El borde: 0 se difumina, 1 corta a filo. Es la `hardness` de siempre.
  ADD COLUMN IF NOT EXISTS brush_hardness  numeric NOT NULL DEFAULT 0.4,
  -- Cuánto de roto, y SÓLO pinta con `brush_tip = 'rough'`. Va aparte de la
  -- dureza a propósito: un borde puede ser duro y roto, o suave y roto.
  ADD COLUMN IF NOT EXISTS brush_roughness numeric NOT NULL DEFAULT 0.5;

ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_brush_tip_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_brush_tip_check
  CHECK (brush_tip IN ('disc', 'soft', 'rough'));

-- Los mismos topes que la app ya aplica al mover las barras
-- (`clampMaskSize`: MASK_SIZE_MIN 0.2 … MASK_SIZE_MAX 6). Si la base no los
-- pone, una llamada a mano puede dejar una escena con un pincel de 900
-- casillas y el navegador se cuelga al abrirla.
ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_brush_ranges_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_brush_ranges_check
  CHECK (brush_size      BETWEEN 0.2 AND 6
     AND brush_strength  BETWEEN 0   AND 1
     AND brush_hardness  BETWEEN 0   AND 1
     AND brush_roughness BETWEEN 0   AND 1);

COMMENT ON COLUMN public.maps_scenes.brush_tip IS
  'Punta del pincel: disc (canto limpio), soft (difuminado), rough (borde roto). Por escena — decisión del dueño 2026-09-09.';
COMMENT ON COLUMN public.maps_scenes.brush_roughness IS
  'Cuánto de roto es el borde, 0..1. Sólo se aplica con brush_tip = rough.';

-- ── 2 · La máscara del suelo de una sala ────────────────────────────────────
-- Mismo mecanismo que `maps_layers.mask_url`, y por la misma razón: la textura
-- del suelo NO se toca nunca, se pinta una máscara encima y siempre se puede
-- volver atrás. NULL = sala sin pintar = el suelo se ve entero, que es como
-- están todas las salas que ya existen.
--
-- 🔑 Y ES LO QUE HACE VERDAD «no me manches la pared» (regla suya): la máscara
-- pertenece a LA SALA, así que el brochazo no puede salirse de ella ni aunque
-- el director pase el pincel por encima del muro. El recorte sale del sitio
-- donde se guarda, no de una comprobación que alguien pueda olvidarse de hacer.
ALTER TABLE public.maps_rooms
  ADD COLUMN IF NOT EXISTS floor_mask_url text;

COMMENT ON COLUMN public.maps_rooms.floor_mask_url IS
  'PNG de la máscara pintada sobre el suelo de ESTA sala. NULL = sin pintar. La textura original nunca se modifica.';
