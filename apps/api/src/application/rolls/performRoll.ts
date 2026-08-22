import type { GameSystem, RollRequest, SheetData, SheetPatch } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IRollRepository } from '../../domain/roll/IRollRepository.js';
import { rollDice, type RollOutcome } from './rollDice.js';
import { saveSheet } from '../characters/saveSheet.js';

export interface PerformRollDeps { characters: ICharacterRepository; rolls: IRollRepository; systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number }
export interface PerformRollInput { actorId: string; campaignId: string; request: RollRequest }

export interface PerformedRoll extends RollOutcome {
  id: string;
  /** Present when the roll carried `effects.patch` for a character: whether the API applied it (origin `roll`). */
  effectsApplied?: boolean;
  /** Authoritative derived/health after the effects were applied. */
  sheet?: { derived: Record<string, unknown>; health: string | null };
}
export type PerformRollResult =
  | { ok: true; data: PerformedRoll }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'POOL_EMPTY' | 'SYSTEM_NOT_INSTALLED' };

/**
 * The roll use case: rights → server dice + system resolution → immutable commit (shared dice debited in the same
 * transaction) → sheet effects applied server-side through the same authoritative save as the sheet.
 */
export async function performRoll(deps: PerformRollDeps, input: PerformRollInput): Promise<PerformRollResult> {
  const { request, actorId, campaignId } = input;
  let system: GameSystem | null = null;
  if (request.kind === 'system') {
    system = request.systemId ? deps.systemById(request.systemId) : null;
    if (!system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };
  }
  // Shared-pool dice (e.g. Plenilunio Destiny) are debited from the hand by `shared`; a group may not roll more of
  // them than the request declares — otherwise the debit could be bypassed by tagging extra dice.
  for (const def of system?.engine.sharedResources ?? []) {
    const rolled = request.groups.filter(g => g.tag === def.id).reduce((n, g) => n + g.count, 0);
    if (rolled > (request.sharedResources?.[def.id] ?? 0)) return { ok: false, code: 'FORBIDDEN' };
  }
  let sheet: SheetData | undefined;
  if (request.characterId) {
    const c = await deps.characters.findForActor(request.characterId, actorId);
    if (!c) return { ok: false, code: 'NOT_FOUND' };
    // Rolling *as* a character: its owner or the DM (a member may not log rolls against someone else's sheet).
    if (!c.isMember || c.campaignId !== campaignId || !(c.isOwner || c.isDm)) return { ok: false, code: 'FORBIDDEN' };
    sheet = c.data;
  } else {
    const member = (await deps.characters.isCampaignMember(campaignId, actorId)) || (await deps.characters.isCampaignDm(campaignId, actorId));
    if (!member) return { ok: false, code: 'FORBIDDEN' };
  }
  // Authority over the pool: with a sheet, the server rebuilds the dice groups from the sheet + options through the
  // system's own `poolFor` — the client's `groups` are only a preview and are never trusted for system rolls.
  let effective = request;
  const stat = typeof request.options?.['stat'] === 'string' ? (request.options['stat'] as string) : null;
  if (system && sheet && stat) {
    const rebuilt = system.engine.poolFor(sheet, { stat, options: request.options ?? {} });
    // Las OPCIONES también salen de `poolFor`, no del cliente: son las que el Registro guarda y las que el
    // desglose vuelve a leer dentro de un mes, así que tienen que decir lo que de verdad se tiró. Con las del
    // cliente, un `extraDice: 26` recortado a 2 se tiraba como 2 y se GUARDABA como 26 — el mismo fallo que
    // ya se corrigió con `defence_dice` en los ataques.
    effective = { ...request, groups: rebuilt.groups, options: rebuilt.options ?? request.options ?? {}, sharedResources: rebuilt.sharedResources ?? request.sharedResources ?? {} };
    for (const def of system.engine.sharedResources ?? []) {
      const rolled = effective.groups.filter(g => g.tag === def.id).reduce((n, g) => n + g.count, 0);
      if (rolled > (effective.sharedResources?.[def.id] ?? 0)) return { ok: false, code: 'FORBIDDEN' };
    }
  }
  const outcome = rollDice(effective, system, deps.rng, sheet);
  let id: string;
  try {
    ({ id } = await deps.rolls.commit({
      actorId, campaignId, characterId: request.characterId ?? null, systemId: system?.id ?? null, kind: request.kind, title: request.title,
      request: effective, dice: outcome.dice, result: outcome.result, visibility: request.visibility, shared: effective.sharedResources ?? {},
    }));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'POOL_EMPTY' || code === 'FORBIDDEN') return { ok: false, code };
    throw e;
  }
  const data: PerformedRoll = { id, ...outcome };
  const patch = outcome.result.effects?.['patch'];
  if (request.characterId && sheet && patch && typeof patch === 'object') {
    // Effects on the sheet are applied by the API (origin `roll`), by the same path the sheet itself uses.
    try {
      const r = await saveSheet(deps, { characterId: request.characterId, actorId, data: { ...sheet, ...(patch as SheetPatch) }, origin: 'roll' });
      data.effectsApplied = r.ok;
      if (r.ok) data.sheet = { derived: r.derived, health: r.health };
    } catch { data.effectsApplied = false; }
  }
  return { ok: true, data };
}
