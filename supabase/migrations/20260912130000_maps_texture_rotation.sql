-- ============================================================================
-- 🔄 LAS DOS TEXTURAS BASE DEL BUILDER SE PUEDEN GIRAR (spec
-- `specs/modules/maps/SPEC.md` § «Rebanada 8», punto 5 · petición suya del
-- 2026-09-11: «En la base del suelo y las paredes … tengo que poder rotar sus
-- texturas»; construido el 2026-09-12 por su orden de seguir sin esperarle).
--
-- DOS COLUMNAS EN LA ESCENA, hermanas de `wall_texture_scale` y
-- `floor_texture_scale`: la roca y el suelo son dos fotos distintas, cada una
-- con su trama, y no hay motivo para atarlas — ni en la escala ni en el giro.
--
-- EN GRADOS, de 0 a menos de 360, como el giro de la textura del Pincel
-- (`tileMatrix`): gira el MOSAICO entero, no cada azulejo por su cuenta.
--
-- POR DEFECTO 0: ninguna escena cambia de aspecto por esto.
--
-- SIN POLÍTICAS NUEVAS: `maps_scenes` ya tiene RLS activa y sus políticas
-- cubren la fila entera (escribe el director de la campaña, leen sus miembros).
-- ============================================================================

ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS wall_texture_rotation  real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS floor_texture_rotation real NOT NULL DEFAULT 0;

ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_wall_texture_rotation_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_wall_texture_rotation_check
  CHECK (wall_texture_rotation >= 0 AND wall_texture_rotation < 360);
ALTER TABLE public.maps_scenes
  DROP CONSTRAINT IF EXISTS maps_scenes_floor_texture_rotation_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_floor_texture_rotation_check
  CHECK (floor_texture_rotation >= 0 AND floor_texture_rotation < 360);

COMMENT ON COLUMN public.maps_scenes.wall_texture_rotation IS
  'Giro del mosaico de la textura de pared, en grados (0 <= x < 360). Hermana de wall_texture_scale. Dueño, 2026-09-11.';
COMMENT ON COLUMN public.maps_scenes.floor_texture_rotation IS
  'Giro del mosaico de la textura de suelo, en grados (0 <= x < 360). Hermana de floor_texture_scale. Dueño, 2026-09-11.';

-- PostgREST cachea el esquema: sin esto las columnas nuevas no existen para la API
-- y toda consulta que las nombre falla entera — la lista de escenas saldría vacía.
NOTIFY pgrst, 'reload schema';
