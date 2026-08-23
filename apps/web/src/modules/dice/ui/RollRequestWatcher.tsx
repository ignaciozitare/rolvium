import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import { DIFFICULTIES } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { PendingRollRequest } from '../domain/entities/RollRequestAsk';
import type { RollRequestsPort } from '../domain/ports/RollRequestsPort';
import type { RollRequestWatchPort } from '../domain/ports/RollRequestWatchPort';
import { defenceDiceFor } from '../domain/useCases/attackRules';
import { RollRequestAlert } from './RollRequestAlert';

interface Props {
  campaignId: string;
  /** Quién está mirando. Sólo contesta el DUEÑO del personaje al que se le pidió, y eso no es el rol. */
  userId: string;
  system: GameSystem;
  charactersRepo: CharactersPort;
  rollRequests: RollRequestsPort;
  watch: RollRequestWatchPort;
}

/**
 * Vigila las peticiones de tirada que me esperan y saca el aviso — mismo reparto, decisiones y porqués que
 * `AttackWatcher` (uno cada vez, el más viejo primero; lo que no es mío se descarta al saber de quién es;
 * quién ve el aviso lo decide de QUIÉN ES el personaje, no el rol).
 */
export function RollRequestWatcher({ campaignId, userId, system, charactersRepo, rollRequests, watch }: Props): JSX.Element | null {
  const { locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [pending, setPending] = useState<PendingRollRequest[]>([]);
  /** `undefined` = todavía leyendo su ficha; `null` = no se pudo leer (el botón tira igual, sin el número). */
  const [poolSize, setPoolSize] = useState<number | null | undefined>(undefined);
  const notMine = useRef<Set<string>>(new Set());

  const reload = useCallback(() => {
    void watch.listPending(campaignId).then(setPending).catch(() => setPending([]));
  }, [watch, campaignId]);

  useEffect(() => {
    reload();
    return watch.subscribe(campaignId, reload);
  }, [watch, campaignId, reload]);

  const request = pending.find(r => !notMine.current.has(r.id)) ?? null;
  const requestId = request?.id ?? null;
  const characterId = request?.targetCharacterId ?? null;
  const stat = request?.stat ?? null;

  useEffect(() => {
    if (!requestId || !characterId) { setPoolSize(undefined); return; }
    let live = true;
    setPoolSize(undefined);
    void charactersRepo.getById(characterId)
      .then(c => {
        if (!live) return;
        if (c && c.ownerId !== userId) { notMine.current.add(requestId); setPending(l => [...l]); return; }
        setPoolSize(c ? defenceDiceFor(system, c.data, stat) : null);
      })
      .catch(() => { if (live) setPoolSize(null); });
    return () => { live = false; };
  }, [requestId, characterId, stat, charactersRepo, system, userId]);

  if (!request || poolSize === undefined) return null;
  const diffId = DIFFICULTIES.find(d => d.value === request.difficulty)?.id ?? null;
  return (
    <RollRequestAlert
      key={request.id}
      request={request}
      statLabel={ts(`sheet.stats.${request.stat}`)}
      difficultyLabel={diffId ? ts(`roll.difficulty.${diffId}`) : String(request.difficulty)}
      poolSize={poolSize}
      onAnswer={async () => {
        const outcome = await rollRequests.answer(request.id);
        if (!outcome) return false;
        setPending(list => list.filter(r => r.id !== request.id));
        return true;
      }}
    />
  );
}
