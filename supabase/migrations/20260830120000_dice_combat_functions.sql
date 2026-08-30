-- ═══════════════════════════════════════════════════════════════════════════
--  El ORDEN DE TURNOS: las cuatro operaciones que lo mueven (p.92–94)
--
--  Las TABLAS (`dice_combats` + `dice_combat_slots`) las creó
--  `20260822120000_dice_director_panel.sql` y llevan desde entonces SIN
--  CONSUMIDOR, a propósito: se dejaron listas y las funciones para cuando el
--  orden se construyera. Esto es esa segunda mitad.
--
--  Mismo reparto que el resto de la tanda: `SECURITY DEFINER`, API-only
--  (`service_role`), y cada función comprueba por su cuenta quién llama — la
--  guardia vive en el caso de uso Y aquí, cruzadas, porque una sola se salta.
--
--  Lo que SQL NO hace: ordenar. El criterio (Destino descendente, PJ antes que
--  PNJ, Combate entre PJ, y si persiste decide el director) es una regla del
--  SISTEMA y la aplica la API con `orderTurns` de `@rolvium/core`. Los puestos
--  llegan aquí YA ORDENADOS. Rehacer la cuenta en SQL sería la segunda verdad
--  que este proyecto ya ha pagado dos veces.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── Abrir el combate ───────────────────────────────────────────────────────
--  `slots` es un array JSON en ORDEN: [{tokenId, characterId, name}, …]. Los
--  dos ids son opcionales por separado (un PNJ puede no tener token colocado, y
--  un token de criatura no tiene personaje), pero cada uno que venga tiene que
--  ser de esta mesa y de esta escena.
CREATE OR REPLACE FUNCTION public.dice_open_combat(actor uuid, cid uuid, sid uuid, slots jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = cid AND c.dm_id = actor) THEN
    RAISE EXCEPTION 'not_dm' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.maps_scenes s WHERE s.id = sid AND s.campaign_id = cid) THEN
    RAISE EXCEPTION 'not_scene' USING ERRCODE = '42501';
  END IF;
  IF slots IS NULL OR jsonb_typeof(slots) <> 'array' OR jsonb_array_length(slots) = 0 THEN
    RAISE EXCEPTION 'no_slots' USING ERRCODE = '22023';
  END IF;
  -- Uno activo por escena. El índice único ya lo impediría, pero levantarlo
  -- aquí da un código que el caso de uso sabe traducir en vez de un 23505 crudo.
  IF EXISTS (SELECT 1 FROM public.dice_combats k WHERE k.scene_id = sid AND k.status = 'active') THEN
    RAISE EXCEPTION 'combat_active' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(slots) e
    WHERE NULLIF(e.value->>'characterId', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.characters ch
        WHERE ch.id = (e.value->>'characterId')::uuid AND ch.campaign_id = cid
      )
  ) THEN RAISE EXCEPTION 'not_member' USING ERRCODE = '42501'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(slots) e
    WHERE NULLIF(e.value->>'tokenId', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.maps_tokens tk
        WHERE tk.id = (e.value->>'tokenId')::uuid AND tk.scene_id = sid AND tk.campaign_id = cid
      )
  ) THEN RAISE EXCEPTION 'not_token' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.dice_combats (campaign_id, scene_id, created_by)
  VALUES (cid, sid, actor)
  RETURNING id INTO new_id;

  INSERT INTO public.dice_combat_slots (combat_id, campaign_id, position, token_id, character_id, name)
  SELECT new_id, cid, (e.ord - 1)::integer,
         NULLIF(e.value->>'tokenId', '')::uuid,
         NULLIF(e.value->>'characterId', '')::uuid,
         left(COALESCE(e.value->>'name', ''), 80)
  FROM jsonb_array_elements(slots) WITH ORDINALITY AS e(value, ord);

  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.dice_open_combat(uuid, uuid, uuid, jsonb) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_open_combat(uuid, uuid, uuid, jsonb) TO service_role;

-- ─── Pasar al turno siguiente ───────────────────────────────────────────────
--  Sólo el director. Al dar la vuelta sube la ronda.
--
--  Y salda la deuda del que ACABA de actuar: `spent_next` son los dados que
--  gastó defendiéndose del turno que justo termina (p.94, «lo hará con un dado
--  menos por cada uno que haya empleado en defenderse»). Pagado el turno, la
--  deuda se borra — si no, se le restaría para siempre.
CREATE OR REPLACE FUNCTION public.dice_next_turn(kid uuid, actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pos integer; rnd integer; total integer;
BEGIN
  -- `FOR UPDATE`: la fila del combate es el CERROJO de todo lo que mueve este orden. Sin él, dos «siguiente»
  -- seguidos (o un «siguiente» a la vez que un «adelantarse») leen los dos la misma posición y uno de los dos
  -- se pierde — o peor, el que se adelanta calcula su salto contra un turno que ya no es el que manda.
  SELECT k.current_position, k.round INTO pos, rnd
  FROM public.dice_combats k
  WHERE k.id = kid AND k.status = 'active'
    AND EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = k.campaign_id AND c.dm_id = actor)
  FOR UPDATE;
  IF pos IS NULL THEN RAISE EXCEPTION 'not_active' USING ERRCODE = '42501'; END IF;
  SELECT count(*) INTO total FROM public.dice_combat_slots s WHERE s.combat_id = kid;
  IF total = 0 THEN RAISE EXCEPTION 'no_slots' USING ERRCODE = '22023'; END IF;

  UPDATE public.dice_combat_slots s SET spent_next = 0 WHERE s.combat_id = kid AND s.position = pos;

  IF pos + 1 >= total THEN pos := 0; rnd := rnd + 1; ELSE pos := pos + 1; END IF;
  UPDATE public.dice_combats k SET current_position = pos, round = rnd, updated_at = now() WHERE k.id = kid;
  RETURN jsonb_build_object('position', pos, 'round', rnd);
END $$;
REVOKE ALL ON FUNCTION public.dice_next_turn(uuid, uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_next_turn(uuid, uuid) TO service_role;

-- ─── Cerrar el combate ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dice_close_combat(kid uuid, actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dice_combats k
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE k.id = kid AND k.status = 'active'
    AND EXISTS (SELECT 1 FROM public.campaigns_campaigns c WHERE c.id = k.campaign_id AND c.dm_id = actor);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_active' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.dice_close_combat(uuid, uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_close_combat(uuid, uuid) TO service_role;

-- ─── Adelantarse (1 Fortuna, p.89 uso 5 · p.92) ─────────────────────────────
--  Aquí sólo se MUEVE el puesto: la Fortuna la cobra el caso de uso, que es
--  quien sabe leer una ficha y recalcular sus derivados con el motor.
--
--  Sólo el DUEÑO del personaje del puesto: el libro dice «un jugador puede
--  gastar un punto de Fortuna **del personaje**». Un puesto de criatura no se
--  adelanta — las criaturas no llevan Fortuna en su bloque.
--
--  ⚠ Interpretación (RULES.md §5.1): el libro NO dice cuánto se adelanta, sólo
--  «adelantar el turno en el que le toca actuar». Se gana UN puesto por punto,
--  que es la lectura más corta y además escala sola (subir tres sitios cuesta
--  tres puntos). Y no se puede saltar por encima de quien está actuando ni de
--  los que ya actuaron: el sitio que se gana es el de justo delante.
CREATE OR REPLACE FUNCTION public.dice_advance_turn(kid uuid, actor uuid, slot uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur integer; pos integer; ch uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  -- `FOR UPDATE` ANTES de leer nada más: coge el cerrojo de la fila del combate y deja pasar de uno en uno.
  -- Sin él, dos jugadores que se adelantan a la vez leen los dos su posición VIEJA y el segundo escribe
  -- contra un orden que ya cambió: se comprobó en local y dejaba dos puestos en la misma posición y otra
  -- vacía (A0 · C1 · B2 · D2, sin el 3). El intercambio de abajo sigue siendo de dos pasos, pero ahora
  -- nadie más lo está haciendo al mismo tiempo, que es lo único que lo hacía inseguro.
  SELECT k.current_position INTO cur FROM public.dice_combats k WHERE k.id = kid AND k.status = 'active' FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'not_active' USING ERRCODE = '42501'; END IF;
  SELECT s.position, s.character_id INTO pos, ch
  FROM public.dice_combat_slots s WHERE s.id = slot AND s.combat_id = kid;
  IF pos IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  IF ch IS NULL OR NOT EXISTS (SELECT 1 FROM public.characters c WHERE c.id = ch AND c.owner_id = actor) THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF pos <= cur + 1 THEN RAISE EXCEPTION 'cannot_advance' USING ERRCODE = '22023'; END IF;

  -- El intercambio, en dos pasos y en este orden: primero el de delante baja al
  -- hueco que va a dejar el que sube. (position no es única, así que el cruce
  -- intermedio es legal y no hace falta un valor de paso; lo que sostiene esa
  -- licencia es el cerrojo de arriba, que garantiza que nadie más está cruzando.)
  UPDATE public.dice_combat_slots s SET position = pos WHERE s.combat_id = kid AND s.position = pos - 1;
  UPDATE public.dice_combat_slots s SET position = pos - 1 WHERE s.id = slot;
  UPDATE public.dice_combats k SET updated_at = now() WHERE k.id = kid;
  RETURN pos - 1;
END $$;
REVOKE ALL ON FUNCTION public.dice_advance_turn(uuid, uuid, uuid) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.dice_advance_turn(uuid, uuid, uuid) TO service_role;

COMMIT;
