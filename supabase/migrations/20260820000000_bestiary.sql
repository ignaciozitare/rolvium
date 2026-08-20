-- ─────────────────────────────────────────────────────────────────────────────
-- bestiary (H5): los encuentros PROPIOS del director
-- Spec: specs/modules/bestiary/SPEC.md
--
--   bestiary_entries  plantillas que crea el director: copias ajustadas de una criatura del manual
--                     ("otro mutante"), PNJ inventados y aliados con ficha completa.
--
-- Las criaturas DEL MANUAL no viven aquí: son datos del paquete del sistema
-- (`packages/system-plenilunio` → `catalogs.bestiary`, 45 bloques). Meterlas en la base duplicaría
-- 45 filas por campaña sin ganar nada, y el manual manda sobre sus valores. El listado del hexágono
-- une las dos fuentes: catálogo (filtro «Manual») + esta tabla (filtros «Propios» y «PNJ»).
--
-- Las INSTANCIAS colocadas en escena tampoco viven aquí: son `maps_tokens`, que ya tiene su `state`
-- jsonb para la Resistencia propia de cada una. Esta migración sólo le añade el enlace tipado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bestiary_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = «guardar para todas mis campañas» (decisión del dueño: casilla al crear, editable después).
  -- Con valor = la entrada vive sólo en esa campaña.
  campaign_id     uuid REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  -- Siempre el director que la creó. Es lo que sostiene la RLS de las entradas globales,
  -- que por definición no cuelgan de ninguna campaña.
  owner_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Sistema de juego al que pertenecen sus características, para no mezclar criaturas
  -- de sistemas distintos en el listado (`campaigns_campaigns.system_id`).
  system_id       text NOT NULL CHECK (char_length(system_id) BETWEEN 1 AND 60),

  -- 'custom' = encuentro del director (incluidas las copias de una criatura del manual).
  -- 'npc'    = PNJ aliado con ficha completa, misma forma que `characters.data`.
  origin          text NOT NULL DEFAULT 'custom' CHECK (origin IN ('custom', 'npc')),

  -- Id del bloque del catálogo del que se duplicó, si es el caso ('ogre', 'harpy'…).
  -- Conserva la referencia a la página del manual; NO es una clave foránea: el catálogo es código.
  source_ref      text,

  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),

  -- Mismo contrato que `BestiaryData` del paquete del sistema:
  --   stats {fortitude,combat,will,cunning,subtlety,presence,culture} (parcial: una característica
  --   ausente se pinta «—», nunca se inventa), endurance, destiny, protection, abilities[],
  --   specialties {stat: string[]}, page. La Resistencia NO se guarda: es Aguante × 3 (p.25).
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Imagen propia del encuentro (bucket `tokens`, comprimida a WebP en el navegador).
  -- Ver specs/core/images/SPEC.md. NULL = se pinta color + iniciales.
  token_url       text,

  notes           text NOT NULL DEFAULT '',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- El listado siempre filtra por dueño y sistema; la campaña puede ser NULL (entradas globales).
CREATE INDEX IF NOT EXISTS bestiary_entries_owner_idx    ON public.bestiary_entries (owner_id, system_id);
CREATE INDEX IF NOT EXISTS bestiary_entries_campaign_idx ON public.bestiary_entries (campaign_id) WHERE campaign_id IS NOT NULL;
-- Buscador por nombre, sin distinguir mayúsculas ni acentos de más.
CREATE INDEX IF NOT EXISTS bestiary_entries_name_idx     ON public.bestiary_entries (lower(name));

DROP TRIGGER IF EXISTS bestiary_entries_touch ON public.bestiary_entries;
CREATE TRIGGER bestiary_entries_touch BEFORE UPDATE ON public.bestiary_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Enlace desde la escena ───────────────────────────────────────────────────
-- `maps_tokens.bestiary_ref` (texto libre) se queda como está: es el id del CATÁLOGO cuando se
-- coloca una criatura del manual, que no tiene fila. Este campo nuevo es para las entradas propias.
-- ON DELETE SET NULL, no CASCADE: borrar la plantilla NO borra las instancias ya colocadas
-- (regla del spec) — el token sigue en la escena con su nombre y su Resistencia.
ALTER TABLE public.maps_tokens
  ADD COLUMN IF NOT EXISTS bestiary_entry_id uuid REFERENCES public.bestiary_entries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS maps_tokens_bestiary_entry_idx ON public.maps_tokens (bestiary_entry_id) WHERE bestiary_entry_id IS NOT NULL;

-- ── RLS: SÓLO EL DIRECTOR ────────────────────────────────────────────────────
-- Un jugador no ve NADA de esta tabla, ni siquiera de un aliado. Lo único que llega al jugador es
-- el token visible en la escena, y eso lo gobierna la RLS de `maps_tokens`, que no se toca aquí.
ALTER TABLE public.bestiary_entries ENABLE ROW LEVEL SECURITY;

-- Doble condición a propósito: ser el dueño Y, si la entrada cuelga de una campaña, seguir siendo
-- su director. Así una entrada no sobrevive a que la dirección de la campaña cambie de manos.
DROP POLICY IF EXISTS bestiary_entries_select ON public.bestiary_entries;
CREATE POLICY bestiary_entries_select ON public.bestiary_entries
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND (campaign_id IS NULL OR public.is_campaign_dm(campaign_id)));

DROP POLICY IF EXISTS bestiary_entries_write ON public.bestiary_entries;
CREATE POLICY bestiary_entries_write ON public.bestiary_entries
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND (campaign_id IS NULL OR public.is_campaign_dm(campaign_id)))
  WITH CHECK (owner_id = auth.uid() AND (campaign_id IS NULL OR public.is_campaign_dm(campaign_id)));

-- ── Permisos de tabla ────────────────────────────────────────────────────────
-- La RLS decide QUÉ FILAS se ven; esto decide si el rol puede tocar la tabla siquiera. Sin este GRANT,
-- PostgREST responde 403 a todo y la pantalla no puede ni leer ni crear — la RLS no llega a evaluarse.
-- Se descubrió mirando la app corriendo: los tests con el cliente simulado no pasan por PostgREST.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bestiary_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bestiary_entries TO service_role;
