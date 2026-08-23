-- ─────────────────────────────────────────────────────────────────────────────
-- dice (H6) · el PANEL DEL DIRECTOR. Spec: specs/modules/dice/SPEC.md § columna 4
--   Tanda completa decidida por el dueño (2026-08-22): pedir tiradas a los
--   jugadores · el espejo del ataque (un jugador ataca c/c a una criatura y el
--   DIRECTOR decide su defensa) · el orden de turnos del combate (p.92–94).
--
--   «Ponerse a cubierto» (p.96) NO lleva tabla: es un estado del token en la
--   escena y vive en `maps_tokens.state` (JSONB que ya existe y ya viaja por
--   realtime); lo escribe la API al resolver la tirada de cubrirse.
--
--   Nadie escribe desde el navegador: como en `dice_attacks`, crear, contestar
--   y mover turnos pasan por la API (service role) — los dados los genera el
--   servidor y las respuestas tienen que ser transaccionales.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ═════ 1 · Peticiones de tirada («¿A quién le pides la tirada?») ═════════════
--   Una fila POR PERSONAJE al que se le pide; «A TODOS» = varias filas con el
--   mismo `batch_id`. El jugador contesta TIRANDO (performRoll, dados del
--   servidor); la fila queda `resolved` apuntando a la tirada. Si no contesta,
--   espera indefinidamente — nadie tira por él (decisión del dueño, 2026-08-20).
CREATE TABLE IF NOT EXISTS public.dice_roll_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  -- El lote de un «A TODOS»: el Registro puede agrupar las respuestas de una misma petición.
  batch_id            uuid NOT NULL DEFAULT gen_random_uuid(),
  -- QUIÉN tiene que contestar: decide a quién le salta el aviso y quién lee la fila.
  target_character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  -- La característica y la dificultad elegidas con el mantener-pulsado (p.84).
  stat                text NOT NULL CHECK (length(stat) BETWEEN 1 AND 40),
  difficulty          integer NOT NULL CHECK (difficulty >= 0 AND difficulty <= 12),
  -- «Le vale su especialidad — lo decides tú (p.83)».
  specialty_allowed   boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
  -- La tirada con la que contestó. SET NULL porque una tirada se puede corregir.
  roll_id             uuid REFERENCES public.dice_rolls(id) ON DELETE SET NULL,
  created_by          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  answered_at         timestamptz
);
CREATE INDEX IF NOT EXISTS dice_roll_requests_campaign_idx ON public.dice_roll_requests (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dice_roll_requests_pending_idx  ON public.dice_roll_requests (target_character_id) WHERE status = 'pending';

-- La ve el director y el DUEÑO del personaje al que se le pide, nadie más.
ALTER TABLE public.dice_roll_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dice_roll_requests_select ON public.dice_roll_requests;
CREATE POLICY dice_roll_requests_select ON public.dice_roll_requests
  FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR EXISTS (
      SELECT 1 FROM public.characters ch
      WHERE ch.id = dice_roll_requests.target_character_id AND ch.owner_id = auth.uid()
    )
  );
GRANT SELECT ON public.dice_roll_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dice_roll_requests TO service_role;

-- El aviso «Tirada pedida» tiene que SALTAR sin recargar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dice_roll_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_roll_requests;
  END IF;
END $$;

-- Crear las peticiones de un lote (API only): el actor debe ser el DIRECTOR y
-- cada personaje, de su mesa. Devuelve el batch_id.
CREATE OR REPLACE FUNCTION public.dice_open_roll_requests(
  actor uuid, cid uuid, target_chars uuid[], stat_key text, diff integer, specialty boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch uuid := gen_random_uuid(); tc uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = cid AND c.dm_id = actor) THEN
    RAISE EXCEPTION 'not_dm' USING ERRCODE = '42501';
  END IF;
  IF target_chars IS NULL OR array_length(target_chars, 1) IS NULL THEN
    RAISE EXCEPTION 'no_targets' USING ERRCODE = '22023';
  END IF;
  FOREACH tc IN ARRAY target_chars LOOP
    IF NOT EXISTS (SELECT 1 FROM public.characters ch WHERE ch.id = tc AND ch.campaign_id = cid) THEN
      RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.dice_roll_requests (campaign_id, batch_id, target_character_id, stat, difficulty, specialty_allowed, created_by)
    VALUES (cid, batch, tc, stat_key, GREATEST(0, LEAST(12, COALESCE(diff, 0))), COALESCE(specialty, false), actor);
  END LOOP;
  RETURN batch;
END $$;
REVOKE ALL ON FUNCTION public.dice_open_roll_requests(uuid, uuid, uuid[], text, integer, boolean) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_open_roll_requests(uuid, uuid, uuid[], text, integer, boolean) TO service_role;

-- Cerrar una petición (API only), DESPUÉS de que la tirada haya salido bien —
-- mismo reparto que dice_close_attack: si la tirada falla, la fila sigue
-- pendiente y el jugador puede volver a contestar.
CREATE OR REPLACE FUNCTION public.dice_close_roll_request(rid uuid, roll uuid, new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new_status NOT IN ('resolved', 'cancelled') THEN RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023'; END IF;
  UPDATE public.dice_roll_requests
  SET status = new_status, roll_id = roll, answered_at = CASE WHEN new_status = 'resolved' THEN now() ELSE answered_at END
  WHERE id = rid AND status = 'pending';
END $$;
REVOKE ALL ON FUNCTION public.dice_close_roll_request(uuid, uuid, text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_close_roll_request(uuid, uuid, text) TO service_role;

-- ═════ 2 · El ESPEJO del ataque (jugador ataca c/c → el director defiende) ═══
--   Misma tubería que los ataques a la espera. La dirección la dice quién falta:
--   · target_character_id NOT NULL → criatura ataca a un PJ (columna 5, contesta el jugador)
--   · target_character_id NULL     → un PJ ataca a una criatura (contesta el DIRECTOR);
--     attacker_character_id dice quién ataca y target_token_id a qué criatura.
ALTER TABLE public.dice_attacks
  ADD COLUMN IF NOT EXISTS attacker_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE;
ALTER TABLE public.dice_attacks ALTER COLUMN target_character_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dice_attacks_direction') THEN
    ALTER TABLE public.dice_attacks ADD CONSTRAINT dice_attacks_direction
      CHECK (target_character_id IS NOT NULL OR (target_token_id IS NOT NULL AND attacker_character_id IS NOT NULL));
  END IF;
END $$;

-- La lectura suma al DUEÑO del personaje ATACANTE (ve su ataque esperando la defensa).
DROP POLICY IF EXISTS dice_attacks_select ON public.dice_attacks;
CREATE POLICY dice_attacks_select ON public.dice_attacks
  FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR EXISTS (
      SELECT 1 FROM public.characters ch
      WHERE ch.id = dice_attacks.target_character_id AND ch.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.characters ch
      WHERE ch.id = dice_attacks.attacker_character_id AND ch.owner_id = auth.uid()
    )
  );

-- Abrir el espejo (API only): el actor debe SER DUEÑO del personaje atacante en
-- esa campaña, y el token atacado debe ser una CRIATURA (sin personaje) de la escena.
CREATE OR REPLACE FUNCTION public.dice_open_player_attack(
  actor uuid, cid uuid, sid uuid, attacker_char uuid, attacker_token uuid,
  target_token uuid, attacker text, dice_count integer, req jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.characters ch
    WHERE ch.id = attacker_char AND ch.campaign_id = cid AND ch.owner_id = actor
  ) THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.maps_tokens tk
    WHERE tk.id = target_token AND tk.scene_id = sid AND tk.campaign_id = cid AND tk.character_id IS NULL
  ) THEN
    RAISE EXCEPTION 'not_creature' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.dice_attacks (campaign_id, scene_id, attacker_token_id, target_token_id, attacker_name,
                                   attacker_character_id, dice, request, created_by)
  VALUES (cid, sid, attacker_token, target_token, left(COALESCE(attacker, ''), 80), attacker_char,
          GREATEST(0, LEAST(40, COALESCE(dice_count, 0))), req, actor)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.dice_open_player_attack(uuid, uuid, uuid, uuid, uuid, uuid, text, integer, jsonb) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_open_player_attack(uuid, uuid, uuid, uuid, uuid, uuid, text, integer, jsonb) TO service_role;

-- Contestar el espejo (API only): SÓLO el director pone la defensa de su criatura.
-- La fila sigue `pending` hasta que la tirada sale bien (mismo reparto que columna 5).
CREATE OR REPLACE FUNCTION public.dice_answer_player_attack(aid uuid, actor uuid, defence integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.dice_attacks a
  SET defence_dice = GREATEST(0, LEAST(40, COALESCE(defence, 0)))
  WHERE a.id = aid AND a.status = 'pending' AND a.target_character_id IS NULL
    AND EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = a.campaign_id AND c.dm_id = actor)
  RETURNING a.defence_dice INTO n;
  IF n IS NULL THEN RAISE EXCEPTION 'not_pending' USING ERRCODE = '42501'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.dice_answer_player_attack(uuid, uuid, integer) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_answer_player_attack(uuid, uuid, integer) TO service_role;

-- ═════ 3 · El ORDEN DE TURNOS del combate (p.92–94) ═════════════════════════
--   Un combate vive EN UNA ESCENA (como los encuentros) y sólo puede haber uno
--   activo por escena. Los puestos guardan el orden; «adelantarse cuesta 1
--   Fortuna y el sitio nuevo se queda» = reordenar posiciones y no volver.
--   `spent_next` son los dados ya gastados del turno SIGUIENTE (defensas y
--   adelantos, p.94: «sólo puede tomar dados de su siguiente turno»).
CREATE TABLE IF NOT EXISTS public.dice_combats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  scene_id         uuid NOT NULL REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  -- El puesto al que le toca (posición dentro de los slots). El siguiente lo pulsa el director.
  current_position integer NOT NULL DEFAULT 0,
  round            integer NOT NULL DEFAULT 1 CHECK (round >= 1),
  created_by       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS dice_combats_active_scene_idx ON public.dice_combats (scene_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS dice_combats_campaign_idx ON public.dice_combats (campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dice_combat_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_id    uuid NOT NULL REFERENCES public.dice_combats(id) ON DELETE CASCADE,
  -- Copiado del combate para que la RLS no tenga que hacer un doble salto.
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position >= 0),
  -- Los tokens se sueltan (SET NULL): borrar un token no puede romper el orden del combate.
  token_id     uuid REFERENCES public.maps_tokens(id) ON DELETE SET NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  -- Copiado, como attacker_name: el orden tiene que poder decir «el ogro» aunque el token ya no exista.
  name         text NOT NULL DEFAULT '',
  spent_next   integer NOT NULL DEFAULT 0 CHECK (spent_next >= 0 AND spent_next <= 40),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dice_combat_slots_combat_idx ON public.dice_combat_slots (combat_id, position);

-- El orden lo VE toda la mesa (quién actúa es información de todos); lo mueve la API.
ALTER TABLE public.dice_combats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dice_combats_select ON public.dice_combats;
CREATE POLICY dice_combats_select ON public.dice_combats
  FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id));
GRANT SELECT ON public.dice_combats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dice_combats TO service_role;

ALTER TABLE public.dice_combat_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dice_combat_slots_select ON public.dice_combat_slots;
CREATE POLICY dice_combat_slots_select ON public.dice_combat_slots
  FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id));
GRANT SELECT ON public.dice_combat_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dice_combat_slots TO service_role;

-- El turno tiene que moverse en las pantallas de todos sin recargar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dice_combats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_combats;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dice_combat_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_combat_slots;
  END IF;
END $$;

COMMIT;
