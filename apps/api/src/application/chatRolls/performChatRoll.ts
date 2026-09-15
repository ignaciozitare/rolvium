import type { GameSystem, RollRequest, SheetData } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IChatRollRepository } from '../../domain/chatRoll/IChatRollRepository.js';
import { rollDice, type RollOutcome } from '../rolls/rollDice.js';

export interface PerformChatRollDeps { characters: ICharacterRepository; chatRolls: IChatRollRepository; systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number }
export interface PerformChatRollInput { actorId: string; conversationId: string; request: RollRequest }

export interface PerformedChatRoll extends RollOutcome { id: string }
export type PerformChatRollResult =
  | { ok: true; data: PerformedChatRoll }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'SYSTEM_NOT_INSTALLED' };

/**
 * The private-roll use case: same server-side fairness as `performRoll` (CSPRNG dice, the system rebuilds the pool
 * from the sheet — the client's `groups` are only a preview), but committed to `chat_messages` through
 * `chat_commit_roll`, never to `dice_rolls`. No shared-resource debit and no sheet-effects application here — a
 * whispered roll is a private aside, not a combat action; spending Destino or applying a wound stays in the table's
 * normal roll flow (`POST /rolls`).
 */
export async function performChatRoll(deps: PerformChatRollDeps, input: PerformChatRollInput): Promise<PerformChatRollResult> {
  const { request, actorId, conversationId } = input;
  const campaignId = await deps.chatRolls.campaignOf(conversationId, actorId);
  if (!campaignId) return { ok: false, code: 'FORBIDDEN' };

  let system: GameSystem | null = null;
  if (request.kind === 'system') {
    system = request.systemId ? deps.systemById(request.systemId) : null;
    if (!system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };
  }

  let sheet: SheetData | undefined;
  if (request.characterId) {
    const c = await deps.characters.findForActor(request.characterId, actorId);
    if (!c) return { ok: false, code: 'NOT_FOUND' };
    if (!c.isMember || c.campaignId !== campaignId || !(c.isOwner || c.isDm)) return { ok: false, code: 'FORBIDDEN' };
    sheet = c.data;
  }

  // Authority over the pool stays with the server, same as the table's roll: the client's `groups` are a preview.
  let effective = request;
  const stat = typeof request.options?.['stat'] === 'string' ? (request.options['stat'] as string) : null;
  if (system && sheet && stat) {
    const rebuilt = system.engine.poolFor(sheet, { stat, options: request.options ?? {} });
    effective = { ...request, groups: rebuilt.groups, options: rebuilt.options ?? request.options ?? {} };
  }

  const outcome = rollDice(effective, system, deps.rng, sheet);
  let id: string;
  try {
    ({ id } = await deps.chatRolls.commit({
      actorId, conversationId, characterId: request.characterId ?? null, systemId: system?.id ?? null,
      rollKind: request.kind, title: request.title, request: effective, dice: outcome.dice, result: outcome.result,
    }));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'FORBIDDEN') return { ok: false, code };
    throw e;
  }
  return { ok: true, data: { id, ...outcome } };
}
