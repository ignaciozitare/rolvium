-- ============================================================================
-- 🤫 SUSURROS (H8) — mensajería privada dentro de la campaña
-- (spec `specs/modules/chat/SPEC.md`, cerrado con el dueño el 2026-09-15: «el
-- chat son los susurros»). Por dentro el módulo sigue siendo `chat`.
--
--   1. TRES TABLAS. `chat_conversations` (1:1 o grupo, siempre dentro de UNA
--      campaña), `chat_conversation_members` (quién está en cada una — y aquí
--      vive el contador de no leídos: `last_read_at` por persona), y
--      `chat_messages` (uno debajo de otro, sin editar ni borrar en v1).
--
--   2. LA TIRADA PRIVADA NUNCA TOCA `dice_rolls`. El dueño fue explícito: una
--      tirada hecha dentro de una conversación no deja NINGÚN rastro en el
--      Registro, ni el resultado ni un aviso de que alguien tiró en privado.
--      La única forma de que eso sea cierto de verdad —no sólo «oculto en la
--      pantalla»— es que viva en una tabla que el Registro ni siquiera lee.
--      Por eso `chat_messages.kind = 'roll'` guarda su propio
--      request/dice/result (mismas columnas que `dice_rolls`, para poder
--      reusar el mismo renderizado), y se inserta con el mismo mecanismo de
--      reparto justo del servidor (`chat_commit_roll`, sólo `service_role`,
--      mismo patrón que `dice_commit_roll`). Traer una tirada YA hecha en el
--      Registro es lo contrario: `kind = 'roll_ref'` sólo guarda una
--      referencia a `dice_rolls.id` — nunca copia el resultado.
--
--   3. SIN PERMISOS ESPECIALES. Cualquier miembro de la campaña (jugador o
--      director) escribe a cualquier otro — no hay `has_permission` aquí.
--      Lo único que manda es la RLS de participación: una conversación sólo
--      la leen sus participantes, y a propósito SIN el atajo de admin que
--      llevan otras tablas (`is_campaign_member` deja pasar a is_admin();
--      `is_chat_participant` NO) — lo privado es privado incluso para un
--      administrador de la plataforma, el dueño lo pidió expresamente.
--
--   4. CREAR CONVERSACIÓN Y MARCAR LEÍDO son funciones `SECURITY DEFINER`
--      llamadas DIRECTO desde el navegador (`GRANT ... TO authenticated`,
--      mismo patrón que `join_campaign_by_code`) — no hace falta fairness de
--      servidor, sólo comprobar membresía de la campaña.
--      `chat_create_conversation` además reutiliza la conversación 1:1 ya
--      existente entre dos personas en vez de crear una nueva cada vez que
--      se pincha el mismo nombre en el directorio; un grupo (3+) SIEMPRE crea
--      una fila nueva (v1: no se renombra ni se sale, así que no hace falta
--      fusionar grupos).
-- ============================================================================

-- ── 1. Conversaciones ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_conversations_campaign_idx ON public.chat_conversations (campaign_id);

-- ── 2. Participantes (y el contador de no leídos) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversation_members (
  conversation_id uuid        NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  -- NULL = nunca la abrió: todo lo que haya cuenta como no leído.
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_conversation_members_user_idx ON public.chat_conversation_members (user_id);

-- ── 3. Mensajes (texto · tirada privada · tirada traída del Registro) ──────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  -- Copiado de chat_conversations.campaign_id por un trigger (nunca lo manda el cliente): hace
  -- falta como columna propia para poder filtrar el canal de tiempo real por campaña, igual que
  -- dice_rolls.campaign_id (también redundante con una relación, por el mismo motivo).
  campaign_id     uuid        NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind            text        NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'roll', 'roll_ref')),
  body            text,
  -- Sólo para kind = 'roll': mismas columnas que dice_rolls, para el mismo renderizado.
  character_id    uuid        REFERENCES public.characters(id) ON DELETE SET NULL,
  system_id       text,
  roll_kind       text        CHECK (roll_kind IN ('system', 'free')),
  roll_request    jsonb,
  roll_dice       jsonb,
  roll_result     jsonb,
  -- Sólo para kind = 'roll_ref': referencia a una tirada YA pública en el Registro.
  roll_ref_id     uuid        REFERENCES public.dice_rolls(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'text' AND body IS NOT NULL AND btrim(body) <> '' AND roll_request IS NULL AND roll_ref_id IS NULL)
    OR (kind = 'roll' AND roll_kind IS NOT NULL AND roll_request IS NOT NULL AND roll_dice IS NOT NULL AND roll_result IS NOT NULL AND roll_ref_id IS NULL)
    OR (kind = 'roll_ref' AND roll_ref_id IS NOT NULL AND roll_request IS NULL AND roll_dice IS NULL AND roll_result IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON public.chat_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_campaign_idx ON public.chat_messages (campaign_id, created_at DESC);

-- ── campaign_id siempre lo pone la base, nunca el cliente ni chat_commit_roll ──
CREATE OR REPLACE FUNCTION public.chat_messages_set_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT c.campaign_id INTO NEW.campaign_id FROM public.chat_conversations c WHERE c.id = NEW.conversation_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS chat_messages_set_campaign ON public.chat_messages;
CREATE TRIGGER chat_messages_set_campaign BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_set_campaign();

-- ── Inmutable: sin editar ni borrar en v1 (mismo patrón que dice_rolls) ─────
CREATE OR REPLACE FUNCTION public.chat_messages_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'chat_messages are immutable' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS chat_messages_immutable ON public.chat_messages;
CREATE TRIGGER chat_messages_immutable BEFORE UPDATE OR DELETE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_immutable();

-- ── Ayudante de RLS: participante de la conversación (SIN atajo de admin) ──
CREATE OR REPLACE FUNCTION public.is_chat_participant(conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversation_members m
    WHERE m.conversation_id = conv_id AND m.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_conversations_select ON public.chat_conversations;
CREATE POLICY chat_conversations_select ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(id));
-- Sin política de escritura: sólo se crean por chat_create_conversation.
GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT ON public.chat_conversations TO service_role;

ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_conversation_members_select ON public.chat_conversation_members;
CREATE POLICY chat_conversation_members_select ON public.chat_conversation_members
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(conversation_id));
-- Sin política de escritura: sólo por chat_create_conversation / chat_mark_read.
GRANT SELECT ON public.chat_conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_conversation_members TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(conversation_id));
DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND kind IN ('text', 'roll_ref')
    AND public.is_chat_participant(conversation_id)
    -- Traer una tirada del Registro: sólo una que YA se pudiera ver (misma campaña que la conversación,
    -- y visible para quien la trae — pública, suya, o el director), nunca una ajena ni de otra campaña.
    AND (
      kind <> 'roll_ref'
      OR EXISTS (
        SELECT 1 FROM public.dice_rolls dr
        JOIN public.chat_conversations cv ON cv.id = chat_messages.conversation_id
        WHERE dr.id = chat_messages.roll_ref_id
          AND dr.campaign_id = cv.campaign_id
          AND (dr.visibility = 'table' OR dr.author_id = auth.uid() OR public.is_campaign_dm(dr.campaign_id))
      )
    )
  );
-- kind = 'roll' sólo por chat_commit_roll (service_role): el dado lo tira el servidor.
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO service_role;

-- ── Crear conversación (directo desde el navegador) ─────────────────────────
-- Reutiliza el 1:1 ya existente entre las mismas dos personas; un grupo (3+)
-- siempre crea una fila nueva.
CREATE OR REPLACE FUNCTION public.chat_create_conversation(cid uuid, member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  all_ids  uuid[];
  n        int;
  existing uuid;
  new_id   uuid;
  mid      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_campaign_member(cid) THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;

  SELECT array_agg(DISTINCT x) INTO all_ids FROM unnest(member_ids || auth.uid()) AS x;
  n := array_length(all_ids, 1);
  IF n < 2 THEN RAISE EXCEPTION 'need_two_members' USING ERRCODE = '22023'; END IF;

  FOREACH mid IN ARRAY all_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.campaigns_members m WHERE m.campaign_id = cid AND m.user_id = mid) THEN
      RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF n = 2 THEN
    -- Dos altas a la vez para el MISMO par (doble click, o los dos abriendo el 1:1 por primera vez a la
    -- vez) no deben crear dos conversaciones: se serializan por par dentro de la transacción, se libera
    -- sola al terminar.
    PERFORM pg_advisory_xact_lock(hashtextextended(cid::text || ':' || least(all_ids[1], all_ids[2])::text || ':' || greatest(all_ids[1], all_ids[2])::text, 0));
    SELECT c.id INTO existing
    FROM public.chat_conversations c
    WHERE c.campaign_id = cid
      AND (SELECT count(*) FROM public.chat_conversation_members m WHERE m.conversation_id = c.id) = 2
      AND EXISTS (SELECT 1 FROM public.chat_conversation_members m WHERE m.conversation_id = c.id AND m.user_id = all_ids[1])
      AND EXISTS (SELECT 1 FROM public.chat_conversation_members m WHERE m.conversation_id = c.id AND m.user_id = all_ids[2])
    LIMIT 1;
    IF existing IS NOT NULL THEN RETURN existing; END IF;
  END IF;

  INSERT INTO public.chat_conversations (campaign_id, created_by) VALUES (cid, auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.chat_conversation_members (conversation_id, user_id)
    SELECT new_id, x FROM unnest(all_ids) x;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.chat_create_conversation(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_create_conversation(uuid, uuid[]) TO authenticated, service_role;

-- ── Marcar leído (directo desde el navegador) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_mark_read(cid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.chat_conversation_members
     SET last_read_at = now()
   WHERE conversation_id = cid AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.chat_mark_read(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(uuid) TO authenticated, service_role;

-- ── Directorio: una fila por conversación YA EMPEZADA del que llama, con la  ──
-- previsualización y el contador de no leídos. El directorio COMPLETO (una fila
-- por cada miembro de la campaña, tenga o no conversación todavía) lo arma el
-- cliente cruzando esto con campaigns_members — eso ya lo puede leer sin ayuda.
CREATE OR REPLACE FUNCTION public.chat_list_directory(cid uuid)
RETURNS TABLE (
  conversation_id uuid,
  member_count    int,
  other_user_id   uuid,
  last_kind       text,
  last_body       text,
  last_created_at timestamptz,
  unread_count    int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    cnt.n,
    CASE WHEN cnt.n = 2 THEN
      (SELECT m2.user_id FROM public.chat_conversation_members m2
        WHERE m2.conversation_id = c.id AND m2.user_id <> auth.uid() LIMIT 1)
    END,
    lm.kind, lm.body, lm.created_at,
    -- No leídos = lo de LOS DEMÁS desde la última vez que lo abriste. Lo propio nunca cuenta: escribir
    -- no te pone una campanita a ti mismo.
    (SELECT count(*)::int FROM public.chat_messages msg
      WHERE msg.conversation_id = c.id AND msg.author_id IS DISTINCT FROM me.user_id
        AND msg.created_at > COALESCE(me.last_read_at, 'epoch'::timestamptz))
  FROM public.chat_conversations c
  JOIN public.chat_conversation_members me ON me.conversation_id = c.id AND me.user_id = auth.uid()
  JOIN (SELECT conversation_id, count(*) n FROM public.chat_conversation_members GROUP BY conversation_id) cnt
    ON cnt.conversation_id = c.id
  LEFT JOIN LATERAL (
    SELECT kind, body, created_at FROM public.chat_messages msg2
    WHERE msg2.conversation_id = c.id ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  WHERE c.campaign_id = cid;
$$;
REVOKE ALL ON FUNCTION public.chat_list_directory(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_list_directory(uuid) TO authenticated, service_role;

-- ── Nombres de un grupo (3+): para el título «Marta y Dani» en el directorio ──
CREATE OR REPLACE FUNCTION public.chat_group_member_names(conv_id uuid)
RETURNS TABLE (name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.name FROM public.chat_conversation_members m
  JOIN public.users u ON u.id = m.user_id
  WHERE m.conversation_id = conv_id AND public.is_chat_participant(conv_id)
  ORDER BY u.name;
$$;
REVOKE ALL ON FUNCTION public.chat_group_member_names(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_group_member_names(uuid) TO authenticated, service_role;

-- ── Tirar en privado (API only, mismo patrón que dice_commit_roll) ─────────
-- El dado lo genera el SERVIDOR (apps/api), nunca el navegador. Inserta en
-- chat_messages — jamás en dice_rolls — así que no hay rastro posible en el
-- Registro, ni siquiera para el director.
CREATE OR REPLACE FUNCTION public.chat_commit_roll(
  actor uuid, conv_id uuid, char_id uuid, sys_id text, roll_kind text, title text,
  request jsonb, dice jsonb, result jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_conversation_members m WHERE m.conversation_id = conv_id AND m.user_id = actor) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  IF roll_kind NOT IN ('system', 'free') THEN RAISE EXCEPTION 'bad_roll_kind' USING ERRCODE = '22023'; END IF;
  IF char_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.characters ch
    JOIN public.chat_conversations cv ON cv.id = conv_id
    WHERE ch.id = char_id AND ch.campaign_id = cv.campaign_id
  ) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.chat_messages (conversation_id, author_id, kind, character_id, system_id, roll_kind, body, roll_request, roll_dice, roll_result)
  VALUES (conv_id, actor, 'roll', char_id, sys_id, roll_kind, left(coalesce(title, ''), 200), request, dice, result)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.chat_commit_roll(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_commit_roll(uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb) TO service_role;

-- ── Realtime: mensaje nuevo y conversación nueva llegan solos ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_members;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
