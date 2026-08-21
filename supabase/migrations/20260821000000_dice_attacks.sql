-- ─────────────────────────────────────────────────────────────────────────────
-- dice (H6) · ataques PENDIENTES de respuesta. Spec: specs/modules/dice/SPEC.md
--   Un ataque cuerpo a cuerpo es un CONFLICTO (manual p.93): los dados de enfrente
--   no son una dificultad que ponga el director, son los que el jugador atacado
--   decida gastar en defenderse. Así que la tirada NO puede salir en el momento:
--   se guarda aquí, le llega al jugador, y sólo cuando contesta se tira.
--
--   `dice_attacks` una fila por ataque a la espera. Guarda la petición ya armada
--                  (sin oposición), quién ataca, a quién, y con cuántos dados.
--                  Cuando el jugador contesta, la API tira, escribe la tirada en
--                  `dice_rolls` y deja la fila en `resolved` apuntando a ella.
--
--   Nadie escribe desde el navegador: crear y contestar pasan por la API con el
--   service role, igual que `dice_commit_roll` — los dados los genera el servidor.
--   La fila está en la publicación de realtime para que el aviso le SALTE al
--   jugador sin recargar («le salta al jugador cuando le atacan», rolvium.pen
--   columna 5).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dice_attacks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,
  -- La escena donde pasa. Si se borra la escena, el ataque deja de tener sentido.
  scene_id            uuid REFERENCES public.maps_scenes(id) ON DELETE CASCADE,
  -- Los tokens se sueltan (SET NULL): borrar un token a mitad de partida no puede
  -- borrar el ataque que el jugador tiene delante ni dejarlo sin contestar.
  attacker_token_id   uuid REFERENCES public.maps_tokens(id) ON DELETE SET NULL,
  target_token_id     uuid REFERENCES public.maps_tokens(id) ON DELETE SET NULL,
  -- Copiado, no leído del token: el aviso tiene que poder decir «te ataca un ogro»
  -- aunque el token ya no exista.
  attacker_name       text NOT NULL DEFAULT '',
  -- QUIÉN tiene que contestar. Es lo que decide a quién le sale el aviso y quién
  -- puede leer la fila, así que no es opcional.
  target_character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  -- Dados que pone el atacante (el director los reparte, p.94).
  dice                integer NOT NULL CHECK (dice >= 0 AND dice <= 40),
  -- La `RollRequest` ya armada por el sistema, SIN el grupo de oposición: ése sale
  -- de lo que conteste el jugador. Se guarda entera para que la tirada salga igual
  -- aunque la ficha o la escena hayan cambiado mientras esperaba.
  request             jsonb NOT NULL,
  -- ⚠ `cancelled` está en el CHECK pero HOY NO LO ESCRIBE NADIE: no existe todavía «el director retira el
  -- ataque». Un ataque sólo desaparece al contestarlo, o en cascada si se borra la escena o el personaje.
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
  -- Lo que contestó el jugador. NULL mientras no ha contestado; 0 es «no me defiendo»,
  -- que es una respuesta y no lo mismo que el silencio.
  defence_dice        integer CHECK (defence_dice >= 0 AND defence_dice <= 40),
  -- La tirada que salió al contestar. SET NULL porque una tirada se puede corregir.
  roll_id             uuid REFERENCES public.dice_rolls(id) ON DELETE SET NULL,
  created_by          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  answered_at         timestamptz
);
-- Lo que se consulta: los pendientes de una campaña, y los míos como jugador.
CREATE INDEX IF NOT EXISTS dice_attacks_campaign_idx ON public.dice_attacks (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dice_attacks_pending_idx  ON public.dice_attacks (target_character_id) WHERE status = 'pending';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lo ve el director de la campaña y el DUEÑO del personaje atacado, nadie más: el
-- aviso es suyo y la decisión de defenderse también. Los demás jugadores se
-- enteran por la tirada, cuando salga en el Registro.
ALTER TABLE public.dice_attacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dice_attacks_select ON public.dice_attacks;
CREATE POLICY dice_attacks_select ON public.dice_attacks
  FOR SELECT TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR EXISTS (
      SELECT 1 FROM public.characters ch
      WHERE ch.id = dice_attacks.target_character_id AND ch.owner_id = auth.uid()
    )
  );
-- Sin políticas de escritura para `authenticated`: crear un ataque y contestarlo
-- pasan por la API (service role), porque los dados los genera el servidor y la
-- respuesta y la tirada tienen que ocurrir en el mismo paso.
GRANT SELECT ON public.dice_attacks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dice_attacks TO service_role;

-- El aviso tiene que SALTAR: sin esto el jugador no se entera hasta recargar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dice_attacks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_attacks;
  END IF;
END $$;

-- ── Crear un ataque a la espera (API only) ──────────────────────────────────
-- Comprueba que quien ataca es el DIRECTOR de esa campaña —atacar con una criatura
-- es cosa suya— y que el personaje atacado es de la misma mesa. Devuelve el id.
CREATE OR REPLACE FUNCTION public.dice_open_attack(
  actor uuid, cid uuid, sid uuid, attacker_token uuid, target_token uuid,
  attacker text, target_char uuid, dice_count integer, req jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = cid AND c.dm_id = actor) THEN
    RAISE EXCEPTION 'not_dm' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.characters ch WHERE ch.id = target_char AND ch.campaign_id = cid) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.dice_attacks (campaign_id, scene_id, attacker_token_id, target_token_id, attacker_name,
                                   target_character_id, dice, request, created_by)
  VALUES (cid, sid, attacker_token, target_token, left(COALESCE(attacker, ''), 80), target_char,
          GREATEST(0, LEAST(40, COALESCE(dice_count, 0))), req, actor)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.dice_open_attack(uuid, uuid, uuid, uuid, uuid, text, uuid, integer, jsonb) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_open_attack(uuid, uuid, uuid, uuid, uuid, text, uuid, integer, jsonb) TO service_role;

-- ── Contestar (API only) ────────────────────────────────────────────────────
-- Sólo el DUEÑO del personaje atacado contesta. Devuelve los dados aceptados.
--
-- ⚠ La fila sigue en `pending` al salir de aquí: quien la cierra es
-- `dice_close_attack`, DESPUÉS de que la tirada haya salido bien. Es a propósito:
-- si la tirada falla (la API se cae, el sistema no está instalado), el jugador
-- puede volver a contestar en vez de quedarse con un ataque muerto delante. El
-- precio es que dos respuestas EXACTAMENTE simultáneas tirarían dos veces; la
-- pantalla apaga los botones mientras contesta, y una tirada de más se ve en el
-- Registro (no corrompe nada). Quedarse sin poder contestar no se ve y no se
-- arregla, así que se eligió el fallo visible.
CREATE OR REPLACE FUNCTION public.dice_answer_attack(actor uuid, aid uuid, defence integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  UPDATE public.dice_attacks a
     -- COALESCE por delante: Postgres IGNORA los NULL en LEAST/GREATEST, así que sin él un `defence`
     -- nulo no se recortaría a 0 sino a 40 — el tope falla hacia arriba, que es el peor sitio.
     SET defence_dice = GREATEST(0, LEAST(40, COALESCE(defence, 0))), answered_at = now()
   WHERE a.id = aid
     AND a.status = 'pending'
     AND EXISTS (
       SELECT 1 FROM public.characters ch
       WHERE ch.id = a.target_character_id AND ch.owner_id = actor
     )
  RETURNING a.defence_dice INTO n;
  IF n IS NULL THEN RAISE EXCEPTION 'not_pending' USING ERRCODE = '42501'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.dice_answer_attack(uuid, uuid, integer) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_answer_attack(uuid, uuid, integer) TO service_role;

-- ── Cerrar (API only): apunta la tirada que salió, o lo cancela ─────────────
CREATE OR REPLACE FUNCTION public.dice_close_attack(aid uuid, rid uuid, new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new_status NOT IN ('resolved', 'cancelled') THEN RAISE EXCEPTION 'bad_status' USING ERRCODE = '22023'; END IF;
  UPDATE public.dice_attacks SET status = new_status, roll_id = rid WHERE id = aid AND status = 'pending';
END $$;
REVOKE ALL ON FUNCTION public.dice_close_attack(uuid, uuid, text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_close_attack(uuid, uuid, text) TO service_role;
