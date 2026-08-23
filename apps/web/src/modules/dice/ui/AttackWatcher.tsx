import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { PendingAttack } from '../domain/entities/Attack';
import type { AttacksPort } from '../domain/ports/AttacksPort';
import type { AttackWatchPort } from '../domain/ports/AttackWatchPort';
import { defenceDiceFor } from '../domain/useCases/attackRules';
import { AttackAlert } from './AttackAlert';

interface Props {
  campaignId: string;
  /** Quién está mirando. Sólo contesta el DUEÑO del personaje atacado, y eso no es lo mismo que el rol. */
  userId: string;
  system: GameSystem;
  charactersRepo: CharactersPort;
  attacks: AttacksPort;
  watch: AttackWatchPort;
}

/**
 * Vigila los ataques que me esperan y saca el aviso (`rolvium.pen` columna 5).
 *
 * Está separado de `AttackAlert` a propósito: el aviso es una pantalla sin nada dentro —recibe lo que tiene
 * que enseñar y devuelve la respuesta— y todo el ir y venir (la RLS, el tiempo real, la ficha del jugador)
 * vive aquí. Así el aviso se prueba sin base de datos, que es donde estaban los fallos de esta rama.
 *
 * **Uno cada vez, el más viejo primero**: si le atacan dos criaturas contesta en el orden en que le
 * atacaron. Amontonar dos avisos taparía el segundo con el primero.
 *
 * **Quién ve el aviso lo decide de QUIÉN ES el personaje, no el rol.** La RLS le deja al director leer los
 * ataques de toda su mesa, así que filtrar por rol dejaba dos agujeros: un director que además lleve un PJ
 * no se enteraría de que le atacan, y un ataque contra un PNJ suyo se quedaría esperando para siempre sin
 * que nadie lo viera. Lo que no es mío se descarta en cuanto se sabe de quién es, y no se vuelve a mirar.
 */
export function AttackWatcher({ campaignId, userId, system, charactersRepo, attacks, watch }: Props): JSX.Element | null {
  const { locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [pending, setPending] = useState<PendingAttack[]>([]);
  /** `undefined` = todavía leyendo su ficha (no se enseña nada); `null` = no se pudo leer. */
  const [defenceMax, setDefenceMax] = useState<number | null | undefined>(undefined);
  /** Ataques que ya se sabe que NO son míos. Se recuerdan para no volver a pedir su personaje en cada aviso. */
  const notMine = useRef<Set<string>>(new Set());

  const reload = useCallback(() => {
    void watch.listPending(campaignId).then(setPending).catch(() => setPending([]));
  }, [watch, campaignId]);

  useEffect(() => {
    reload();
    return watch.subscribe(campaignId, reload);
  }, [watch, campaignId, reload]);

  /**
   * Sin personaje atacado la fila es del ESPEJO (un PJ atacando a una criatura): la contesta el DIRECTOR
   * por su propio aviso, no éste. Se salta AQUÍ y no vía `notMine` porque no es cuestión de dueño — y sin
   * saltarla, una fila espejo vieja ATASCABA la cola: `characterId` null cortaba el efecto sin marcarla y
   * un ataque de columna 5 más nuevo no salía nunca (cazado en la revisión del 2026-08-22).
   */
  const attack = pending.find(a => a.targetCharacterId !== null && !notMine.current.has(a.id)) ?? null;
  const attackId = attack?.id ?? null;
  const characterId = attack?.targetCharacterId ?? null;
  const stat = attack?.stat ?? null;

  useEffect(() => {
    if (!attackId || !characterId) { setDefenceMax(undefined); return; }
    let live = true;
    setDefenceMax(undefined);
    void charactersRepo.getById(characterId)
      .then(c => {
        if (!live) return;
        // De otro: se descarta y se pasa al siguiente. `setPending` con la misma lista fuerza el repaso.
        if (c && c.ownerId !== userId) { notMine.current.add(attackId); setPending(l => [...l]); return; }
        setDefenceMax(c ? defenceDiceFor(system, c.data, stat) : null);
      })
      .catch(() => { if (live) setDefenceMax(null); });
    return () => { live = false; };
  }, [attackId, characterId, stat, charactersRepo, system, userId]);

  if (!attack || defenceMax === undefined) return null;
  return (
    <AttackAlert
      // La clave por el id del ataque: al pasar al siguiente, las fichas de dados vuelven a 0 en vez de
      // heredar lo que se eligió para el anterior.
      key={attack.id}
      attack={attack}
      defenceMax={defenceMax}
      statLabel={attack.stat ? ts(`sheet.stats.${attack.stat}`) : null}
      onAnswer={async n => {
        const outcome = await attacks.answer(attack.id, n);
        if (!outcome) return false;
        setPending(list => list.filter(a => a.id !== attack.id));
        return true;
      }}
    />
  );
}
