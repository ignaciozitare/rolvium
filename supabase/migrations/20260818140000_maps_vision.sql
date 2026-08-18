-- ============================================================================
-- Rolvium — maps (H7) rebanada 2: luz de la escena y aberturas (puertas/ventanas)
-- Spec: specs/modules/maps/SPEC.md § «Rebanada 2 — niebla, visión, luz y aberturas»
-- ============================================================================
-- Puramente aditiva: sólo columnas nuevas con DEFAULT sobre dos tablas que ya
-- existen. No crea tablas (por eso no hay bloque RLS nuevo: `maps_scenes` y
-- `maps_walls` ya tienen RLS activa y políticas `*_select` / `*_dm_write FOR ALL`,
-- que cubren el UPDATE con el que el director abre y cierra una puerta).
--
-- Lo explorado por jugador (`maps_fog`) NO cambia: la rebanada 1 ya lo dejó con
-- la forma que la visión necesita.
-- ============================================================================
BEGIN;

-- ── Luz de la escena ────────────────────────────────────────────────────────
-- 'day'  = se ve todo lo que la geometría permita.
-- 'night'= se ve hasta `night_radius_m` metros desde cada token propio.
-- En METROS, no en casillas, porque es la unidad en la que se razona en la mesa;
-- la conversión la hace el cliente/API con los metros por casilla del sistema.
ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS lighting       text NOT NULL DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS night_radius_m real NOT NULL DEFAULT 10;

ALTER TABLE public.maps_scenes DROP CONSTRAINT IF EXISTS maps_scenes_lighting_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_lighting_check CHECK (lighting IN ('day', 'night'));

ALTER TABLE public.maps_scenes DROP CONSTRAINT IF EXISTS maps_scenes_night_radius_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_night_radius_check CHECK (night_radius_m > 0 AND night_radius_m <= 500);

-- ── Aberturas: un muro ya no es sólo un segmento ────────────────────────────
-- Semántica deliberadamente uniforme, para que el cálculo de visión sea una
-- sola condición y no un `switch` por tipo:
--     corta la vista  ⇔  blocks_sight AND NOT is_open
--     corta el paso   ⇔  blocks_move  AND NOT is_open
-- De donde salen los tres tipos del spec:
--     muro    → sight=t move=t open=f (inmutable)   corta ambos
--     puerta  → sight=t move=t open=?               cerrada corta ambos, abierta ninguno
--     ventana → sight=f move=t open=?               nunca corta la vista; el paso, cerrada
-- `blocks_move` no tiene efecto todavía (no hay reglas de movimiento hasta la
-- rebanada 3); se guarda ahora para no volver a migrar la tabla.
-- `is_open`, y no `open`: OPEN es palabra reservada de PL/pgSQL (cursores).
ALTER TABLE public.maps_walls
  ADD COLUMN IF NOT EXISTS kind         text    NOT NULL DEFAULT 'wall',
  ADD COLUMN IF NOT EXISTS blocks_sight boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS blocks_move  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_open      boolean NOT NULL DEFAULT false;

ALTER TABLE public.maps_walls DROP CONSTRAINT IF EXISTS maps_walls_kind_check;
ALTER TABLE public.maps_walls
  ADD CONSTRAINT maps_walls_kind_check CHECK (kind IN ('wall', 'door', 'window'));

-- Un muro no se abre. Puertas y ventanas sí.
ALTER TABLE public.maps_walls DROP CONSTRAINT IF EXISTS maps_walls_open_check;
ALTER TABLE public.maps_walls
  ADD CONSTRAINT maps_walls_open_check CHECK (kind <> 'wall' OR NOT is_open);

-- Los muros ya dibujados quedan como muros cerrados que cortan vista y paso:
-- es exactamente lo que hacen hoy, así que los DEFAULT bastan y no hay backfill.

COMMIT;
