-- ============================================================================
-- Rebanada 10 B · EL BORDE ROTO DE «A PULSO» (spec `specs/modules/maps/SPEC.md`
-- § 10B.4, confirmada por el dueño el 2026-09-11).
--
-- DOS COLUMNAS EN LA ESCENA, Y NADA MÁS. Merece explicarse por qué tan poco:
--
--   1. SE RECUERDA POR ESCENA, COMO EL PINCEL (§ 9.4, «el trazo es de la
--      escena»), y APARTE del pincel: son las hermanas de `brush_tip` y
--      `brush_roughness`, no las mismas. Uno pinta encima y el otro levanta
--      paredes; cambiar uno no puede cambiar el otro.
--
--   2. NO HAY SEMILLAS NI TABLA DE TRAZOS. El borde sale distinto en cada trazo,
--      pero lo que se guarda es la FORMA ya rota: los puntos del anillo en
--      `maps_rooms.points`, como cualquier otra forma. El azar queda cocido ahí,
--      y la visión y las colisiones del servidor la leen tal cual — el borde
--      irregular ES la pared.
--
-- SIN POLÍTICAS NUEVAS: `maps_scenes` ya tiene RLS activa y sus políticas cubren
-- la fila entera (escribe el director de la campaña, leen sus miembros), luego
-- cubren también estas columnas.
-- ============================================================================

-- Los valores por defecto dejan cada escena exactamente como está hoy: canto limpio.
ALTER TABLE public.maps_scenes
  -- La punta de «A pulso»: canto limpio (lo de siempre) · borde roto.
  ADD COLUMN IF NOT EXISTS band_tip       text    NOT NULL DEFAULT 'clean',
  -- Cuánto de roto, y SÓLO se aplica con `band_tip = 'rough'`. Arranca en el
  -- mismo 0,5 que el pincel.
  ADD COLUMN IF NOT EXISTS band_roughness numeric NOT NULL DEFAULT 0.5;

ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_band_tip_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_band_tip_check
  CHECK (band_tip IN ('clean', 'rough'));

-- Si la base no pone el tope, una llamada a mano puede guardar un «cuánto» fuera
-- de escala y el trazo saldría partido en trozos, que es justo lo que el spec prohíbe.
ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_band_roughness_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_band_roughness_check
  CHECK (band_roughness BETWEEN 0 AND 1);

COMMENT ON COLUMN public.maps_scenes.band_tip IS
  'Punta de «A pulso» en el Builder: clean (canto limpio) o rough (borde roto). Por escena y aparte de brush_tip — decisión del dueño 2026-09-11.';
COMMENT ON COLUMN public.maps_scenes.band_roughness IS
  'Cuánto de roto sale el borde de «A pulso», 0..1. Sólo se aplica con band_tip = rough. El borde queda cocido en maps_rooms.points.';

-- PostgREST cachea el esquema: sin esto la columna nueva no existe para la API y
-- toda consulta que la nombre falla entera — la pantalla se queda vacía sin decir por qué.
NOTIFY pgrst, 'reload schema';
