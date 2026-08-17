import { validateSheet, type GameSystem, type SheetData, type SheetIssue } from '@rolvium/core';
import type { ICharacterRepository, SaveOrigin } from '../../domain/character/ICharacterRepository.js';

export type SaveSheetResult =
  | { ok: true; derived: Record<string, unknown>; health: string | null }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'SYSTEM_NOT_INSTALLED' | 'INVALID_SHEET'; issues?: SheetIssue[] };

/**
 * The authoritative sheet save: rights → schema validation → derived/health
 * from the engine → persist as the actor. Business rules live here, not in the route.
 */
export async function saveSheet(
  deps: { characters: ICharacterRepository; systemById: (id: string) => GameSystem | null },
  input: { characterId: string; actorId: string; data: SheetData; origin: SaveOrigin; xp?: number },
): Promise<SaveSheetResult> {
  const c = await deps.characters.findForActor(input.characterId, input.actorId);
  if (!c) return { ok: false, code: 'NOT_FOUND' };
  if (!(c.isOwner || c.isDm)) return { ok: false, code: 'FORBIDDEN' };
  if (input.origin === 'dm' && !c.isDm) return { ok: false, code: 'FORBIDDEN' };
  const system = deps.systemById(c.systemId);
  if (!system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };
  const issues = validateSheet(system.sheetSchema, input.data);
  if (issues.length) return { ok: false, code: 'INVALID_SHEET', issues };
  // XP authority (RULES §4): the DM awards experience; players only *spend* it through progression.
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const prevXp = num(c.data['xp']) ?? 0;
  const nextXp = num(input.data['xp']);
  if (nextXp !== null && nextXp !== prevXp && !c.isDm) {
    if (nextXp > prevXp || input.origin !== 'progression') return { ok: false, code: 'FORBIDDEN' };
  }
  const derived = system.engine.derived(input.data);
  const health = typeof input.data['health'] === 'string' ? (input.data['health'] as string) : null;
  // The row mirrors identity fields kept inside the sheet (name/concept) so lists never need the jsonb.
  const name = typeof input.data['name'] === 'string' && (input.data['name'] as string).trim() ? (input.data['name'] as string).trim().slice(0, 80) : undefined;
  const concept = typeof input.data['concept'] === 'string' ? (input.data['concept'] as string) : undefined;
  const xp = input.xp ?? (nextXp !== null && nextXp !== prevXp ? nextXp : undefined);
  const patch = { data: input.data, derived, health, ...(xp !== undefined ? { xp } : {}), ...(name !== undefined ? { name } : {}), ...(concept !== undefined ? { concept } : {}) };
  try {
    await deps.characters.saveSheet(c.id, input.actorId, patch, input.origin);
  } catch (e) {
    if ((e as { code?: string }).code === 'FORBIDDEN') return { ok: false, code: 'FORBIDDEN' };
    throw e;
  }
  return { ok: true, derived, health };
}
