-- ============================================================================
-- Rebanada 8 · EL CATÁLOGO DE TEXTURAS
-- ============================================================================
-- Petición suya del 2026-09-04, probando el constructor:
--
--   «*las texturas se tienen que alimentar de un catálogo, no que si quieres
--    cambiarlas sólo te permita subirlas — si quiero reutilizar una textura la
--    subo de nuevo, ¿y quedarán infinitas texturas?*»
--   «*el botón de cambiar debería abrir un catálogo donde estén CLASIFICADAS
--    como en el catálogo de objetos que ya tenemos diseñado*»
--   «*ten en cuenta que las texturas sirven para toda la herramienta, no son
--    por usuario*»
--
-- 🔑 LO QUE ESO CAMBIA, Y ES EL MOTIVO DE ESTA TABLA: el primer intento reusó
-- `maps_images`, la biblioteca de fondos DE LA CAMPAÑA. Estaba mal por dos
-- cosas a la vez: una textura no es un fondo (se repite en azulejos, no se
-- encaja) y sobre todo **no es de una campaña**. Es material de la herramienta,
-- como el catálogo de piezas: se sube una vez y sirve en todos los mapas de
-- todas las campañas.
--
-- POR QUÉ UNA TABLA Y NO UNA CATEGORÍA DE `maps_props`:
-- una PIEZA se planta una vez y tiene sitio, tamaño y giro; una TEXTURA se
-- repite hasta el infinito y no tiene sitio. Comparten que son imágenes y nada
-- más. Meterlas juntas obligaría a que media tabla de piezas no significara
-- nada para las texturas y al revés.
--
-- CLASIFICADAS, y con la lista CERRADA como en las piezas (elección suya del
-- 2026-08-31 para el catálogo de objetos: las etiquetas libres obligan a
-- etiquetar bien o no se encuentra nada).
--
-- 🟠 QUIÉN PUEDE SUBIR (decisión mía, revisable): cualquiera con cuenta. Es una
-- biblioteca compartida de la herramienta y no hay nada que proteger en una
-- foto de baldosas; poner aquí un permiso de administrador dejaría el catálogo
-- vacío para todo el mundo menos para él. Borrar, en cambio, sólo lo tuyo: que
-- alguien te quite una textura que estás usando en un mapa sí sería un
-- desastre silencioso.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maps_textures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name          text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  -- Cerradas, como las de las piezas. `misc` es la red: siempre hay una que no
  -- encaja en ninguna, y sin ella se etiqueta mal a propósito.
  category      text NOT NULL DEFAULT 'misc'
                CHECK (category IN ('stone', 'wood', 'tile', 'earth', 'grass', 'water', 'misc')),
  url           text NOT NULL,

  -- Cuánto mide un azulejo de ESTA textura, en casillas. Es una SUGERENCIA que
  -- se copia a la escena al elegirla: un mosaico fino y un suelo de losas
  -- grandes no quieren el mismo tamaño, y obligarle a ajustar el deslizador
  -- cada vez sería hacerle repetir un trabajo que ya hizo una vez.
  tile_cells    real NOT NULL DEFAULT 4 CHECK (tile_cells > 0 AND tile_cells <= 40),

  uploaded_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- El catálogo se abre siempre por categoría y ordena por lo más reciente.
CREATE INDEX IF NOT EXISTS maps_textures_category_idx ON public.maps_textures (category, created_at DESC);

DROP TRIGGER IF EXISTS maps_textures_touch ON public.maps_textures;
CREATE TRIGGER maps_textures_touch BEFORE UPDATE ON public.maps_textures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.maps_textures ENABLE ROW LEVEL SECURITY;

-- LEER: cualquiera con cuenta. Es el catálogo de la herramienta, no de nadie.
DROP POLICY IF EXISTS maps_textures_select ON public.maps_textures;
CREATE POLICY maps_textures_select ON public.maps_textures FOR SELECT TO authenticated
  USING (true);

-- SUBIR: cualquiera con cuenta, y la fila queda a su nombre.
DROP POLICY IF EXISTS maps_textures_insert ON public.maps_textures;
CREATE POLICY maps_textures_insert ON public.maps_textures FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- RENOMBRAR / RECLASIFICAR y BORRAR: sólo lo tuyo. Que otro te quite una
-- textura que estás usando en un mapa sería un desastre silencioso.
DROP POLICY IF EXISTS maps_textures_own_update ON public.maps_textures;
CREATE POLICY maps_textures_own_update ON public.maps_textures FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS maps_textures_own_delete ON public.maps_textures;
CREATE POLICY maps_textures_own_delete ON public.maps_textures FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_textures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_textures TO service_role;

-- ── QUE NO PIERDA LO QUE YA HABÍA SUBIDO ────────────────────────────────────
-- Las texturas que ya están puestas en alguna escena entran al catálogo, para
-- que al abrirlo las encuentre en vez de tener que subirlas otra vez — que es
-- justo lo que vino a evitar. Se clasifican en `misc`: adivinar la categoría
-- por el nombre de un fichero sale mal más veces de las que acierta.
INSERT INTO public.maps_textures (name, category, url, tile_cells)
SELECT DISTINCT COALESCE(i.name, 'Textura'), 'misc', t.url, 4
FROM (
  SELECT wall_texture_url AS url FROM public.maps_scenes WHERE wall_texture_url IS NOT NULL
  UNION
  SELECT floor_texture_url FROM public.maps_scenes WHERE floor_texture_url IS NOT NULL
) t
LEFT JOIN public.maps_images i ON i.url = t.url
WHERE NOT EXISTS (SELECT 1 FROM public.maps_textures x WHERE x.url = t.url);

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
