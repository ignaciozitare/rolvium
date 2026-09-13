-- ============================================================================
-- Rebanada 6 · LA GALERÍA DE PIEZAS — la biblioteca pasa a ser DE LA HERRAMIENTA
-- (specs/modules/maps/SPEC.md § «Rebanada 6», reescrito la noche del 2026-09-12→13)
-- ============================================================================
-- El andamio de agosto (`20260831200000_maps_props.sql`) hizo la biblioteca DE LA
-- CAMPAÑA, con seis categorías cerradas y escribiendo sólo el director de su
-- campaña. Él lo cambió después, con las texturas delante:
--
--   · «*lo que se sube sirve para todos*» (2026-09-11) → una pieza se sube UNA vez
--     y vale en todos los mapas de todas las campañas. Como `maps_textures`.
--   · paquetes PROPIOS, no categorías cerradas (2026-09-09) → el director crea sus
--     paquetes y mete cada pieza en uno.
--   · «*por permisos, como las texturas*» → ordenar la biblioteca (subir, renombrar,
--     mover, borrar; crear y borrar paquetes) es cosa de quien tenga `manage_props`.
--
-- Las dos tablas estaban VACÍAS en producción (comprobado el 2026-09-12), así que
-- quitar `campaign_id` no pierde nada. Lo PLANTADO (`maps_scene_props`) no cambia
-- de dueño: sigue siendo de la escena y lo escribe sólo el director.
--
-- Lo que NO se toca: `maps_scene_props` conserva su copia de la foto y del nombre
-- —«borrar una pieza de la biblioteca NO borra las ya puestas»— y sus políticas.
-- ============================================================================

-- ── 1 · LOS PAQUETES ─────────────────────────────────────────────────────────
-- Un paquete es sólo un nombre y un orden: la carpeta en la que él agrupa sus
-- piezas. Borrarlo NO borra las piezas (SET NULL abajo): pasan a «Sin clasificar».
CREATE TABLE IF NOT EXISTS public.maps_prop_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  sort_order  int  NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maps_prop_packs_order_idx ON public.maps_prop_packs (sort_order, created_at);

DROP TRIGGER IF EXISTS maps_prop_packs_touch ON public.maps_prop_packs;
CREATE TRIGGER maps_prop_packs_touch BEFORE UPDATE ON public.maps_prop_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.maps_prop_packs ENABLE ROW LEVEL SECURITY;

-- LEER: cualquiera con cuenta. Es el catálogo de la herramienta, no de nadie.
DROP POLICY IF EXISTS maps_prop_packs_select ON public.maps_prop_packs;
CREATE POLICY maps_prop_packs_select ON public.maps_prop_packs FOR SELECT TO authenticated
  USING (true);

-- CREAR, RENOMBRAR, REORDENAR y BORRAR: sólo con el permiso. La fila queda a nombre de quien la crea.
DROP POLICY IF EXISTS maps_prop_packs_insert ON public.maps_prop_packs;
CREATE POLICY maps_prop_packs_insert ON public.maps_prop_packs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_tool('manage_props'));

DROP POLICY IF EXISTS maps_prop_packs_update ON public.maps_prop_packs;
CREATE POLICY maps_prop_packs_update ON public.maps_prop_packs FOR UPDATE TO authenticated
  USING (public.has_tool('manage_props')) WITH CHECK (public.has_tool('manage_props'));

DROP POLICY IF EXISTS maps_prop_packs_delete ON public.maps_prop_packs;
CREATE POLICY maps_prop_packs_delete ON public.maps_prop_packs FOR DELETE TO authenticated
  USING (public.has_tool('manage_props'));

-- Este proyecto NO tiene privilegios por defecto: sin esto PostgREST contesta «permission denied» antes de RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_prop_packs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_prop_packs TO service_role;

-- ── 2 · LA BIBLIOTECA, YA SIN CAMPAÑA Y EN PAQUETES ─────────────────────────
-- Fuera las políticas y los índices que hablaban de campaña ANTES de quitar la columna.
DROP POLICY IF EXISTS maps_props_select ON public.maps_props;
DROP POLICY IF EXISTS maps_props_dm_write ON public.maps_props;
DROP INDEX IF EXISTS public.maps_props_campaign_idx;
DROP INDEX IF EXISTS public.maps_props_campaign_category_idx;
ALTER TABLE public.maps_props DROP COLUMN IF EXISTS campaign_id;

-- NULL = «Sin clasificar». SET NULL y no CASCADE: borrar un paquete no puede llevarse las piezas.
ALTER TABLE public.maps_props
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.maps_prop_packs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS maps_props_pack_idx ON public.maps_props (pack_id, created_at DESC);

COMMENT ON COLUMN public.maps_props.pack_id IS
  'El paquete propio en el que esta la pieza (maps_prop_packs). NULL = sin clasificar.';
COMMENT ON COLUMN public.maps_props.category IS
  'Categoria DE SERIE. Solo cuenta para las piezas que trae la app (uploaded_by NULL); las subidas se ordenan por paquete.';

-- LEER: cualquiera con cuenta.
CREATE POLICY maps_props_select ON public.maps_props FOR SELECT TO authenticated
  USING (true);

-- SUBIR: con el permiso, y la fila a tu nombre.
DROP POLICY IF EXISTS maps_props_insert ON public.maps_props;
CREATE POLICY maps_props_insert ON public.maps_props FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.has_tool('manage_props'));

-- RENOMBRAR, MOVER DE PAQUETE, y la ESCALA QUE RECUERDA (§ 6.4): con el permiso.
DROP POLICY IF EXISTS maps_props_update ON public.maps_props;
CREATE POLICY maps_props_update ON public.maps_props FOR UPDATE TO authenticated
  USING (public.has_tool('manage_props')) WITH CHECK (public.has_tool('manage_props'));

DROP POLICY IF EXISTS maps_props_delete ON public.maps_props;
CREATE POLICY maps_props_delete ON public.maps_props FOR DELETE TO authenticated
  USING (public.has_tool('manage_props'));

-- ── 3 · LO PLANTADO: EL ORDEN DE APILADO ────────────────────────────────────
-- Suyo, 2026-09-11: «*mandarlo adelante y atrás como en cualquier programa … top layer, down layer*». Es el
-- orden ENTRE PIEZAS de la misma escena; la capa la sigue decidiendo `layer_id`. Aditiva, con valor de serie.
ALTER TABLE public.maps_scene_props ADD COLUMN IF NOT EXISTS z int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS maps_scene_props_scene_z_idx ON public.maps_scene_props (scene_id, z, created_at);
COMMENT ON COLUMN public.maps_scene_props.z IS
  'Orden de apilado entre piezas de la escena: mayor = mas arriba. La capa la decide layer_id.';

-- ── 4 · LAS FOTOS: `backgrounds/props/{id}.webp`, sin campaña delante ─────────
-- Las políticas del bucket exigían ser director de la campaña de la primera carpeta. Una pieza de la
-- herramienta no es de ninguna campaña, así que va a su propia carpeta `props/` detrás del MISMO permiso
-- que la tabla. Leer no cambia: el bucket es público y `backgrounds_read` ya cubre todo el bucket.
DROP POLICY IF EXISTS backgrounds_props_write ON storage.objects;
CREATE POLICY backgrounds_props_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = 'props' AND public.has_tool('manage_props'));
DROP POLICY IF EXISTS backgrounds_props_update ON storage.objects;
CREATE POLICY backgrounds_props_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = 'props' AND public.has_tool('manage_props'))
  WITH CHECK (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = 'props' AND public.has_tool('manage_props'));
DROP POLICY IF EXISTS backgrounds_props_delete ON storage.objects;
CREATE POLICY backgrounds_props_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = 'props' AND public.has_tool('manage_props'));

-- ── 5 · EL PERMISO, a «los dms» ──────────────────────────────────────────────
-- Igual que `manage_textures` (`20260904230000_tool_permissions.sql`): al `admin` no se le escribe nada —lo
-- tiene por `is_admin()` y el trigger `roles_guard_system` prohíbe tocar sus permisos—.
UPDATE public.roles
SET permissions = jsonb_set(
      permissions,
      '{tools}',
      COALESCE(permissions -> 'tools', '{}'::jsonb) || '{"manage_props": true}'::jsonb,
      true)
WHERE name = 'game_master';

-- ── Y que la API se entere ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
