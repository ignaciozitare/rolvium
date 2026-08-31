-- ============================================================================
-- El número de orden de las capas de TERRENO lo pone la base, no el navegador
-- ============================================================================
--
-- EL FALLO QUE CIERRA. `sort_order` lo calculaba el cliente con `max + 1`
-- (`nextTerrainSortOrder`, apps/web/.../useScene.ts). Dos pestañas del mismo
-- director piden a la vez, las dos leen el mismo máximo y las dos se llevan el
-- mismo número. Con dos capas empatadas, reordenar escribía lo mismo que ya
-- había: arrastrar se quedaba mudo y —peor— subir y bajar escribían en la base
-- y daban el guardado por bueno sin mover nada.
--
-- El cliente ya se cura solo (`reorderTerrain`/`reorderTerrainTo` renumeran la
-- franja cuando detectan repetidos), pero eso es la red, no el arreglo: el
-- empate se seguía fabricando. Esto lo corta en el origen.
--
-- POR QUÉ NO UN ÍNDICE ÚNICO, que es lo primero que uno piensa.
-- Reordenar escribe cada fila con un UPDATE independiente (`Promise.all` en
-- `useScene`), así que un intercambio A(0)↔B(1) pasa por un instante en el que
-- las dos filas valen lo mismo. Un índice único lo rechazaría y ROMPERÍA el
-- reordenar. En PostgreSQL un índice único parcial no se puede diferir
-- (`DEFERRABLE` sólo existe en constraints, y una constraint no admite `WHERE`),
-- así que no hay forma de tenerlo sin partir el gesto. Se descarta a propósito.
--
-- Nada de esto toca las tres capas fijas (`objects`, `creatures`, `dm_notes`):
-- su sitio en la pila lo pone el motor y ya tienen su propio índice único
-- `maps_layers_fixed_kind_uidx (scene_id, kind)`.

-- ── 1 · Deshacer los empates que ya existan ─────────────────────────────────
-- Se renumera 0..n-1 por escena, respetando el orden que el director YA veía
-- (`sort_order`, luego `created_at`, luego `id` para que sea determinista).
WITH ordenadas AS (
  SELECT id,
         row_number() OVER (PARTITION BY scene_id ORDER BY sort_order, created_at, id) - 1 AS n
    FROM public.maps_layers
   WHERE kind = 'terrain'
)
UPDATE public.maps_layers AS l
   SET sort_order = o.n
  FROM ordenadas AS o
 WHERE l.id = o.id
   AND l.sort_order <> o.n;

-- ── 2 · Que el número lo asigne la base al dar de alta ──────────────────────
CREATE OR REPLACE FUNCTION public.maps_layers_assign_sort_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Sin esto el disparador tendría la MISMA carrera que el navegador: dos
  -- transacciones simultáneas leerían el mismo máximo. El cerrojo es por
  -- escena y se suelta solo al acabar la transacción, así que dos directores
  -- en escenas distintas no se estorban.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.scene_id::text, 0));

  SELECT COALESCE(MAX(sort_order), -1) + 1
    INTO NEW.sort_order
    FROM public.maps_layers
   WHERE scene_id = NEW.scene_id
     AND kind = 'terrain';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.maps_layers_assign_sort_order() IS
  'Asigna el sort_order de una capa de terreno al insertarla, con cerrojo por escena. El valor que mande el cliente se ignora a propósito: era la fuente del empate.';

DROP TRIGGER IF EXISTS maps_layers_assign_sort_order_tg ON public.maps_layers;
CREATE TRIGGER maps_layers_assign_sort_order_tg
  BEFORE INSERT ON public.maps_layers
  FOR EACH ROW
  WHEN (NEW.kind = 'terrain')
  EXECUTE FUNCTION public.maps_layers_assign_sort_order();

-- No se añade RLS aquí: `maps_layers` ya la tiene activada con sus políticas en
-- `20260831120000_maps_layers_lights.sql`, y un disparador BEFORE INSERT no
-- abre ningún camino nuevo — corre dentro del INSERT que la política ya ha
-- autorizado, y es SECURITY INVOKER.
