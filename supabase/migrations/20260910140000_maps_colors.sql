-- ============================================================================
-- Rebanada 10 — LOS COLORES QUE TE INVENTAS SE GUARDAN (spec
-- `specs/modules/maps/SPEC.md` § «Rebanada 10»).
--
-- Petición suya del 2026-09-10, viendo el panel del pincel: «*sí, quiero que se
-- guarde, es sólo para esta campaña o escena, lo que tengamos más o menos
-- creado*». Delegó el alcance, así que se elige **POR CAMPAÑA** y se dice por
-- qué:
--
--   · una campaña es UN MUNDO con un aspecto, y el verde que mezclas para el
--     bosque lo vas a querer en los otros mapas de ese bosque;
--   · por escena obligaría a re-mezclarlo en cada mapa nuevo, que es justo el
--     caso molesto;
--   · y ya hay precedente exacto: `maps_images`, la biblioteca de fondos, es
--     por campaña por esta misma razón.
--
-- Si lo prefiere por escena, se cambia el `campaign_id` por `scene_id` y la
-- política sigue valiendo palabra por palabra.
--
-- ── POR QUÉ UNA TABLA Y NO UNA LISTA DENTRO DE LA CAMPAÑA ───────────────────
-- Una lista JSONB en `campaigns_campaigns` habría ahorrado la tabla, pero
-- añadir un color sería leer-modificar-escribir la lista entera: con dos
-- pestañas abiertas —cosa normal en un director— la segunda pisa el color de la
-- primera y se pierde sin avisar. Una fila por color no puede perderse.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maps_colors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  -- El color tal cual lo devuelve el navegador. Sin CHECK de formato, igual que
  -- `bg_color` y `door_color`: un patrón aquí sólo serviría para rechazar un
  -- color válido escrito de otra manera.
  color        text NOT NULL,
  -- Quién lo mezcló. Se conserva la fila aunque la cuenta desaparezca: el color
  -- es de la campaña, no de la persona.
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Se leen SIEMPRE los de una campaña y por orden de llegada: es el único acceso.
CREATE INDEX IF NOT EXISTS maps_colors_campaign_idx
  ON public.maps_colors (campaign_id, created_at);

-- El mismo color dos veces en la misma campaña no es un color más: es la misma
-- muestra repetida ocupando sitio en la paleta. Lo impide la base para que la
-- pantalla no tenga que acordarse de comprobarlo.
CREATE UNIQUE INDEX IF NOT EXISTS maps_colors_unique_idx
  ON public.maps_colors (campaign_id, lower(color));

ALTER TABLE public.maps_colors ENABLE ROW LEVEL SECURITY;

-- Leen los miembros de la campaña, escribe el director. Exactamente lo mismo
-- que `maps_images`, y por la misma razón: es una biblioteca de la campaña.
DROP POLICY IF EXISTS maps_colors_select ON public.maps_colors;
CREATE POLICY maps_colors_select ON public.maps_colors
  FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id) OR public.is_campaign_dm(campaign_id));

DROP POLICY IF EXISTS maps_colors_dm_write ON public.maps_colors;
CREATE POLICY maps_colors_dm_write ON public.maps_colors
  FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id))
  WITH CHECK (public.is_campaign_dm(campaign_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps_colors TO service_role;

COMMENT ON TABLE public.maps_colors IS
  'Los colores que el director mezcla con el cuentagotas o a mano, guardados para reutilizarlos en los mapas de ESTA campaña (rebanada 10). La paleta base de la casa NO vive aqui: esa es codigo.';
