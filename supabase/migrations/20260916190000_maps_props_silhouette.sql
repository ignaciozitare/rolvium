-- ─────────────────────────────────────────────────────────────────────────────
-- LA SILUETA — la forma que estorba sale del PNG (specs/modules/maps/SPEC.md § 6.9)
--
-- Su queja del 2026-09-16, con dos capturas de sus vehículos: la sombra de un
-- camión era un bloque negro rectangular que no se parecía en nada al camión.
-- Literal: «*tienen que recortar por la silueta del png no por el área que crees
-- que tenga, o al menos lo más aproximado, pero no un cuadrado u óvalo que no
-- tenga nada que ver con la silueta del objeto*». Vio una maqueta con seis
-- objetos suyos de producción y la aprobó: «está perfecto».
--
-- NO SE BORRA NADA QUE FUNCIONE: el rectángulo y el óvalo se quedan tal cual.
-- `block_shape` gana un tercer valor y aparece una columna con los puntos.
--
-- ── POR QUÉ LOS PUNTOS VAN NORMALIZADOS ──────────────────────────────────────
-- La lista se guarda en fracciones de la huella (-0.5 … +0.5 desde el CENTRO de
-- la pieza), no en píxeles de escena. Es la misma referencia que ya usan
-- `block_dx` / `block_dy`, y hace que la silueta sobreviva a estirar la pieza:
-- el tamaño ya lo dicen `block_w` / `block_h`, así que escalar no obliga a
-- reescribir 24 puntos ni a volver a mirar el PNG. Es también lo que permite que
-- la copia plantada herede la misma lista que la fila de la biblioteca.
--
-- El giro tampoco entra aquí: lo aplica `propBlockRing` con `rotation`, igual
-- que a las otras dos formas. Una sola verdad geométrica, en `@rolvium/core`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── LA BIBLIOTECA (la pieza subida) ─────────────────────────────────────────
ALTER TABLE public.maps_props
  ADD COLUMN IF NOT EXISTS default_silhouette jsonb;

COMMENT ON COLUMN public.maps_props.default_silhouette IS
  'El anillo de la silueta en fracciones de la huella (-0.5…+0.5 desde el centro), '
  '[{"x":…,"y":…}, …] — puntos con nombre, que es como los escribe y los lee `@rolvium/core`. '
  'NULL = todavía sin sacar: la pieza es de antes de la silueta, o el '
  'PNG no dio contorno. Se calcula AL SUBIR, en la misma pasada que ya comprime la imagen.';

ALTER TABLE public.maps_props
  DROP CONSTRAINT IF EXISTS maps_props_default_block_shape_check;
ALTER TABLE public.maps_props
  ADD CONSTRAINT maps_props_default_block_shape_check
  CHECK (default_block_shape IN ('rect', 'circle', 'silhouette'));

/*
 * Una pieza que dice «estorbo por mi silueta» y no trae silueta dejaría de
 * estorbar EN SILENCIO: `propBlockRing` devuelve un anillo vacío y una pieza sin
 * anillo no tapa ni frena. Es exactamente la clase de fallo que él ve en pantalla
 * y nadie ve en el código, así que lo prohíbe la base de datos.
 */
ALTER TABLE public.maps_props
  DROP CONSTRAINT IF EXISTS maps_props_silhouette_shape_check;
ALTER TABLE public.maps_props
  ADD CONSTRAINT maps_props_silhouette_shape_check
  CHECK (default_block_shape <> 'silhouette' OR default_silhouette IS NOT NULL);

-- Un anillo es una LISTA de puntos y tiene que poder cerrar: con menos de tres no
-- hay figura. El tope de 64 es el freno de coste — el spec pide 24, y el óvalo de
-- hoy son 16 lados: de ahí no se sube sin decidirlo.
ALTER TABLE public.maps_props
  DROP CONSTRAINT IF EXISTS maps_props_silhouette_shape_ok;
ALTER TABLE public.maps_props
  ADD CONSTRAINT maps_props_silhouette_shape_ok
  CHECK (
    default_silhouette IS NULL OR (
      jsonb_typeof(default_silhouette) = 'array'
      AND jsonb_array_length(default_silhouette) BETWEEN 3 AND 64
    )
  );

-- ── LO PLANTADO EN UN MAPA ──────────────────────────────────────────────────
-- La copia hereda la silueta al nacer, como hereda hoy el rectángulo. A partir de
-- ahí manda su fila: el director puede cambiarle la forma a esta sola sin tocar la
-- biblioteca, que es como funcionan ya las otras columnas de estorbo.
ALTER TABLE public.maps_scene_props
  ADD COLUMN IF NOT EXISTS silhouette jsonb;

COMMENT ON COLUMN public.maps_scene_props.silhouette IS
  'Copiada de la biblioteca al plantar. Mismo formato: [{"x":…,"y":…}, …] en fracciones '
  'de la huella desde el centro. NULL = esta pieza no estorba por silueta.';

ALTER TABLE public.maps_scene_props
  DROP CONSTRAINT IF EXISTS maps_scene_props_block_shape_check;
ALTER TABLE public.maps_scene_props
  ADD CONSTRAINT maps_scene_props_block_shape_check
  CHECK (block_shape IN ('rect', 'circle', 'silhouette'));

ALTER TABLE public.maps_scene_props
  DROP CONSTRAINT IF EXISTS maps_scene_props_silhouette_shape_check;
ALTER TABLE public.maps_scene_props
  ADD CONSTRAINT maps_scene_props_silhouette_shape_check
  CHECK (block_shape <> 'silhouette' OR silhouette IS NOT NULL);

ALTER TABLE public.maps_scene_props
  DROP CONSTRAINT IF EXISTS maps_scene_props_silhouette_shape_ok;
ALTER TABLE public.maps_scene_props
  ADD CONSTRAINT maps_scene_props_silhouette_shape_ok
  CHECK (
    silhouette IS NULL OR (
      jsonb_typeof(silhouette) = 'array'
      AND jsonb_array_length(silhouette) BETWEEN 3 AND 64
    )
  );

-- ── SIN TABLAS NUEVAS ───────────────────────────────────────────────────────
-- Las dos tablas ya tienen su RLS y sus GRANTs desde `20260831200000_maps_props.sql`
-- y `20260913100000_maps_props_tool_library.sql`; una columna nueva entra dentro de
-- las políticas que ya hay. No se toca ni una política ni un permiso.
