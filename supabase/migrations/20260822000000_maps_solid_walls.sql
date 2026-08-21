-- ============================================================================
-- Rolvium — maps (H7) rebanada 4: paredes sólidas
-- Spec: specs/modules/maps/SPEC.md § «Rebanada 4 — paredes sólidas»
-- ============================================================================
-- Puramente aditiva: UNA columna nueva con DEFAULT sobre una tabla que ya
-- existe. No crea tablas, y por eso no hay bloque RLS nuevo — `maps_scenes` ya
-- tiene RLS activa con `maps_scenes_select` (los miembros de la campaña leen) y
-- `maps_scenes_dm_write FOR ALL` (sólo el director escribe), que es exactamente
-- el reparto que pide la spec: el interruptor lo pone el DIRECTOR y lo LEEN
-- todos, igual que la luz o el modo de niebla.
--
-- `maps_walls` NO se toca: `blocks_move` existe desde la rebanada 1 y ya guarda
-- qué corta el paso. Lo único que faltaba era un sitio donde decir «en esta
-- escena, hazle caso».
-- ============================================================================
BEGIN;

-- ── Paredes sólidas ─────────────────────────────────────────────────────────
-- false = como hasta hoy: los tokens atraviesan los muros como fantasmas.
-- true  = un token no puede cruzar un muro, una ventana ni una puerta CERRADA
--         (`blocks_move AND NOT is_open`); una puerta abierta deja pasar.
--
-- Por ESCENA y no por campaña porque una mazmorra y un descampado no piden lo
-- mismo (decisión del dueño, 2026-08-22), y guardado y no volátil porque «se te
-- olvida encendido o apagado».
--
-- DEFAULT false a propósito: ninguna escena de las que ya existen se vuelve
-- sólida de un día para otro sin que el director lo pida. Es la regla de la
-- casa — se capa la subida, nunca la bajada, y aquí lo prudente es no cambiarle
-- el mapa a nadie por sorpresa al desplegar.
--
-- El director NUNCA choca, esté esto como esté (decisión del dueño), así que
-- esta columna sólo gobierna a los jugadores. No hace falta guardarlo: es una
-- regla, no un dato, y vive en el código junto al resto de la física.
ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS solid_walls boolean NOT NULL DEFAULT false;

COMMIT;
