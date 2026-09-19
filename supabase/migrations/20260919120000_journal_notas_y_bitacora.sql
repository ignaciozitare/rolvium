-- ─────────────────────────────────────────────────────────────────────────────
-- journal (H9): las dos superficies de escritura de una campaña
-- Spec: specs/modules/journal/SPEC.md
--
--   journal_notes    los apuntes de CADA UNO en esa campaña. Privados de verdad.
--   journal_logbook  la bitácora COMPARTIDA: un documento por campaña.
--
-- `doc` es el MISMO árbol de bloques que `adventures_adventures.doc`
-- (`{ "v": 1, "blocks": [...] }`), pintado por el cliente y nunca inyectado como
-- marcado: JSON, no HTML (regla de XSS del proyecto). Un solo vocabulario para las
-- tres superficies, no dos.
--
-- SIN historial de versiones y SIN presencia en vivo en la v1 — decisión anotada en
-- el spec § Out of scope. Si entran, entran en su propia migración.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Notas: una por persona y campaña ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Árbol de bloques. El default ya trae la forma buena para que el cliente nunca
  -- tenga que distinguir «documento vacío» de «documento con forma desconocida».
  doc          jsonb NOT NULL DEFAULT '{"v":1,"blocks":[]}'::jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- La misma persona en dos campañas tiene dos cuadernos distintos.
  UNIQUE (campaign_id, user_id)
);

-- ── Bitácora: UNA por campaña, compartida ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_logbook (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL UNIQUE REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  doc          jsonb NOT NULL DEFAULT '{"v":1,"blocks":[]}'::jsonb,

  -- Quién guardó el último. Se pone a NULL si esa cuenta desaparece: la bitácora
  -- de la campaña no se borra porque se vaya quien escribió.
  updated_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS journal_notes_touch ON public.journal_notes;
CREATE TRIGGER journal_notes_touch BEFORE UPDATE ON public.journal_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS journal_logbook_touch ON public.journal_logbook;
CREATE TRIGGER journal_logbook_touch BEFORE UPDATE ON public.journal_logbook
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.journal_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_logbook ENABLE ROW LEVEL SECURITY;

-- LAS NOTAS SON PRIVADAS DE VERDAD: sólo su autor, y **sin puerta de atrás para el
-- admin de la plataforma** — a propósito, igual que los susurros de `chat`. Si un
-- admin pudiera leerlas, nadie escribiría nada real en ellas.
DROP POLICY IF EXISTS journal_notes_select ON public.journal_notes;
CREATE POLICY journal_notes_select ON public.journal_notes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS journal_notes_write ON public.journal_notes;
CREATE POLICY journal_notes_write ON public.journal_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- La bitácora es de la mesa: la lee y la escribe cualquier miembro de la campaña,
-- director y jugadores por igual.
DROP POLICY IF EXISTS journal_logbook_select ON public.journal_logbook;
CREATE POLICY journal_logbook_select ON public.journal_logbook
  FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id));

DROP POLICY IF EXISTS journal_logbook_write ON public.journal_logbook;
CREATE POLICY journal_logbook_write ON public.journal_logbook
  FOR ALL TO authenticated
  USING (public.is_campaign_member(campaign_id))
  WITH CHECK (public.is_campaign_member(campaign_id));

-- ── Permisos de tabla ───────────────────────────────────────────────────────
-- Este proyecto recortó los privilegios por defecto: sin estos GRANT, PostgREST
-- responde 403 ANTES de evaluar la RLS y la pantalla no puede ni leer ni guardar.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_notes   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_notes   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_logbook TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_logbook TO service_role;
