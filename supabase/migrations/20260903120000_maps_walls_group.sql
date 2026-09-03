-- ============================================================================
-- Rebanada 8 · «EL GRUPO» — los muros de un gesto son UNA cosa
-- ============================================================================
-- Petición del dueño del 2026-09-03, probando Builder sobre una foto de mapa:
-- «no puedo arrastrar y seleccionar por grupo» · «debería poder seleccionarlo
-- entero y luego con doble clic por pedacitos, si no, cuando esté en medio de
-- otras cosas no se podrá mover» · «cuando lo seleccione debería poder
-- escalarlo».
--
-- 🔑 ESTO NO ES UNA SALA. Marcando muros sobre una foto no hay suelo, ni
-- textura, ni preajuste: hay muros. Un círculo son once muros que para él son
-- UNA cosa, y puede acabar siendo el contorno de una sala, un pilar o un
-- estanque — al grupo le da igual. Por eso la columna se llama `group_id` y no
-- `room_id`, y por eso NO hay tabla de habitaciones aquí: esa es la pregunta 6
-- del spec, que va aparte y con su propia migración.
--
-- POR QUÉ SE GUARDA Y NO SE ADIVINA: la alternativa era deducir el grupo mirando
-- qué muros se tocan. Se rompe justo cuando más se usa — al abrir una puerta,
-- al mover una pared— y él eligió explícitamente que aguante «abrir puertas,
-- mover paredes y volver mañana».
--
-- Aditiva y nula por defecto: un muro sin grupo es un muro suelto, que es
-- exactamente lo que son todos los que ya existen. Ninguna marca de las de hoy
-- cambia de aspecto ni de comportamiento.
--
-- No crea tablas ni políticas — `maps_walls` ya tiene RLS y su reparto (leen los
-- miembros que ven la escena, escribe sólo el director), que es exactamente el
-- que pide esta columna: agrupar es cosa del director.
-- ============================================================================

ALTER TABLE public.maps_walls
  ADD COLUMN IF NOT EXISTS group_id uuid;

COMMENT ON COLUMN public.maps_walls.group_id IS
  'Ata entre si los muros que salieron de UN gesto (un circulo, un rectangulo, un poligono, un trazo a pulso) o que el director agrupo a mano. NULL = muro suelto. No es una habitacion: no lleva suelo ni textura.';

-- Coger un grupo es «dame los muros de esta escena con este group_id», y eso
-- pasa en cada clic sobre un muro agrupado. Sin indice es un barrido de la
-- escena entera cada vez.
CREATE INDEX IF NOT EXISTS maps_walls_scene_group_idx
  ON public.maps_walls (scene_id, group_id)
  WHERE group_id IS NOT NULL;
