import type { RollRequest } from '@rolvium/core';
import type { IRollRequestRepository, OpenRollRequestsInput } from '../../domain/rollRequest/IRollRequestRepository.js';
import { performRoll, type PerformRollDeps, type PerformedRoll } from '../rolls/performRoll.js';

export interface RollRequestDeps extends PerformRollDeps { rollRequests: IRollRequestRepository }

export type RollRequestErrorResult = { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'NOT_PENDING' | 'POOL_EMPTY' | 'SYSTEM_NOT_INSTALLED' };
export type OpenRollRequestsResult = { ok: true; data: { batchId: string } } | RollRequestErrorResult;
export type AnswerRollRequestResult = { ok: true; data: PerformedRoll } | RollRequestErrorResult;

const known = (e: unknown): 'FORBIDDEN' | 'NOT_PENDING' | null => {
  const code = (e as { code?: string }).code;
  return code === 'FORBIDDEN' || code === 'NOT_PENDING' ? code : null;
};

/** El director pide la tirada: una fila por personaje, mismo lote. A cada jugador le SALTA su aviso. */
export async function openRollRequests(deps: Pick<RollRequestDeps, 'rollRequests'>, input: OpenRollRequestsInput): Promise<OpenRollRequestsResult> {
  try {
    return { ok: true, data: await deps.rollRequests.openBatch(input) };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/**
 * El jugador contesta: **la tirada sale ahora**, armada POR EL SERVIDOR desde su ficha.
 *
 * El navegador no manda ni grupos ni opciones: la petición guardada dice característica, dificultad y si
 * le vale la especialidad (lo decidió el director, p.83), y el puñado lo rehace `poolFor` con la ficha del
 * que contesta — el mismo camino de autoridad que toda tirada con personaje. El AUTOR de la tirada es el
 * JUGADOR: es su característica y su tirada; lo que era del director era pedirla.
 *
 * La fila se cierra DESPUÉS de que la tirada haya salido bien; si falla, queda `pending` y el jugador
 * puede volver a contestar (mismo reparto que la columna 5).
 */
export async function answerRollRequest(deps: RollRequestDeps, input: { actorId: string; requestId: string }): Promise<AnswerRollRequestResult> {
  const row = await deps.rollRequests.findById(input.requestId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  const character = await deps.characters.findForActor(row.targetCharacterId, input.actorId);
  if (!character || !character.isOwner) return { ok: false, code: 'FORBIDDEN' };
  const system = deps.systemById(character.systemId);
  if (!system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };

  const pool = system.engine.poolFor(character.data, {
    stat: row.stat,
    options: { difficulty: row.difficulty, ...(row.specialtyAllowed ? { specialty: true } : {}) },
  });
  const request: RollRequest = { ...pool, characterId: row.targetCharacterId, visibility: 'table' };
  const r = await performRoll(deps, { actorId: input.actorId, campaignId: row.campaignId, request });
  if (!r.ok) return r;
  await deps.rollRequests.close(row.id, r.data.id, 'resolved');
  return { ok: true, data: r.data };
}
