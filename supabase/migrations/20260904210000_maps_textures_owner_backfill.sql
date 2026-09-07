-- ============================================================================
-- Rebanada 8 · EL CATÁLOGO DE TEXTURAS — QUIÉN SUBIÓ LAS QUE YA ESTABAN
-- ============================================================================
-- 🐞 Fallo del rescate de `20260904180000_maps_textures.sql`.
--
-- Aquella migración metió en el catálogo las texturas que él ya tenía puestas
-- en alguna escena, para que no las perdiera. Bien. Pero las metió SIN DUEÑO
-- (`uploaded_by` a NULL), y eso tiene dos consecuencias que sólo se ven con el
-- catálogo delante:
--
--   1. Salen marcadas como «las que trae Rolvium» — el punto de la leyenda—,
--      que es justo lo contrario de la verdad: las subió él.
--   2. **No las puede borrar.** La política de borrado es `uploaded_by =
--      auth.uid()`, así que una fila sin dueño no es de nadie y no la borra
--      nadie. Y borrar es exactamente lo que pidió el 2026-09-04: «*también
--      tengo que poder borrar las texturas si quiero, con un modal de
--      confirmación*».
--
-- El dueño se recupera de `maps_images`, que es de donde salieron: la textura
-- se subió como imagen de la campaña y esa tabla sí guardó quién la subió.
-- Sólo se tocan las filas que siguen sin dueño, así que volver a ejecutarla no
-- cambia nada y no puede pisar a nadie.
--
-- ⚠️ Las que NO se puedan emparejar con una imagen se quedan sin dueño a
-- propósito: inventarle un propietario a una fila es peor que dejarla como
-- está, porque le daría a alguien el poder de borrar algo que no subió.
-- ============================================================================

UPDATE public.maps_textures t
SET uploaded_by = i.uploaded_by
FROM public.maps_images i
WHERE i.url = t.url
  AND t.uploaded_by IS NULL
  AND i.uploaded_by IS NOT NULL;

-- ── Y que la API se entere ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
