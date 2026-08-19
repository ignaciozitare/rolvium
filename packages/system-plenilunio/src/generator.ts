// ─── Character generator · Malefic Time: Plenilunio ──────────────────────────
// Steps declared as data (GeneratorStep[]) with the manual's point economy:
// presets 16/21/25/30 points (max stat 5/5/6/10, p.21), Destiny 3 ± 2 (each +1
// costs a point, each −1 refunds one, p.22–23), 1 point = 2 extra specialties
// (max 2 trades, p.22) or 2 gift points; gift points = Destiny (+ trades), p.25.
// See RULES.md §1.
import type { GeneratorStep, SheetData, SheetPatch } from '@rolvium/core';
import { GIFT_MAX_LEVEL, STAT_IDS, isStatId } from './catalogs';
import { derived } from './engine';
import { DEFAULT_PRESET, PRESETS, giftsOf, num, statOf, str, type PresetId } from './schema';

export const BASE_DESTINY = 3;
export const DESTINY_ADJUST = 2;
export const MAX_SPECIALTY_TRADES = 2;

export const presetOf = (draft: SheetData) => PRESETS.find(p => p.id === str(draft.preset, DEFAULT_PRESET)) ?? PRESETS[1];

/** Point economy of a draft (mirrors the prototype's `disponibles`). */
export interface Budget {
  preset: PresetId; total: number; maxStat: number;
  statsSpent: number; specialtyTrade: number; giftTrade: number; destinyCost: number; destinyRefund: number;
  available: number; giftPoints: number; giftsSpent: number;
}
export function budgetOf(draft: SheetData): Budget {
  const preset = presetOf(draft);
  const statsSpent = STAT_IDS.reduce((s, id) => s + statOf(draft, id).value, 0);
  const specialtyTrade = Math.max(0, Math.min(MAX_SPECIALTY_TRADES, num(draft.specialtyTrade)));
  const giftTrade = Math.max(0, num(draft.giftTrade));
  const destiny = num(draft.destiny, BASE_DESTINY);
  const destinyCost = Math.max(0, destiny - BASE_DESTINY);
  const destinyRefund = Math.max(0, BASE_DESTINY - destiny);
  const giftsSpent = giftsOf(draft).reduce((s, g) => s + num(g.level), 0);
  return {
    preset: preset.id, total: preset.points, maxStat: preset.maxStat,
    statsSpent, specialtyTrade, giftTrade, destinyCost, destinyRefund,
    available: preset.points + destinyRefund - statsSpent - specialtyTrade - destinyCost - giftTrade,
    giftPoints: destiny + giftTrade * 2, giftsSpent,
  };
}

/** Whether a stat can go up/down under the preset and budget (prototype `ajustar`). */
export function canAdjustStat(draft: SheetData, stat: (typeof STAT_IDS)[number], delta: 1 | -1): boolean {
  const b = budgetOf(draft);
  const next = statOf(draft, stat).value + delta;
  if (next < 1 || next > b.maxStat) return false;
  return delta < 0 || b.available > 0;
}
/** Extra specialties granted by trades: 2 per point, must go to different stats (validated in step 3). */
export const extraSpecialtiesAllowed = (draft: SheetData) => budgetOf(draft).specialtyTrade * 2;

/**
 * Per-field guard of the generator (`GeneratorStep.applyChange`). The point budget alone
 * cannot express the preset's ceiling (p.21), so without this a stat could be pushed to 10
 * under a 21/max-5 spread and the step would then refuse to advance with no way forward.
 * Lowering the preset re-clamps every stat for the same reason: the refunded points show up
 * as "te sobran puntos", which the player can act on, instead of an unreachable maximum.
 */
export function applyChange(draft: SheetData, fieldId: string, next: unknown): SheetPatch | null {
  if (fieldId === 'preset') {
    const preset = PRESETS.find(p => p.id === next) ?? presetOf(draft);
    const patch: SheetPatch = { preset: preset.id };
    for (const id of STAT_IDS) {
      const s = statOf(draft, id);
      if (s.value > preset.maxStat) patch[id] = { ...s, value: preset.maxStat };
    }
    return patch;
  }
  if (isStatId(fieldId)) {
    const value = statOf({ ...draft, [fieldId]: next }, fieldId).value;
    if (value < 1 || value > presetOf(draft).maxStat) return null;
  }
  return { [fieldId]: next };
}

/**
 * Per-field guard of the gifts step. Two things the step's own budget cannot express, both found by
 * the owner on 2026-08-19 with the generator open:
 *
 * - **A trade must be payable.** `giftTrade` spends CREATION points to buy gift points (1 → 2,
 *   RULES.md §1.5), but the budget this step guards is the GIFT one, and a trade only ever raises
 *   it — so the guard always said yes and you could spend creation points you do not have. The book
 *   puts no cap on the number of trades, only on what you can pay for, so that is what we check.
 *   Left unchecked it also became a dead end: 10 trades give 23 gift points, and with the level cap
 *   of 5 that needs five gifts to spend — with three rows «Continuar» could never light up, and the
 *   error only said «reparte los puntos restantes», never naming the trade that caused it.
 * - **The same gift twice is level 6 by the back door.** A gift has ONE level, 1 to 5 (RULES.md §7).
 */
export function applyGiftChange(draft: SheetData, fieldId: string, next: unknown): SheetPatch | null {
  if (fieldId === 'giftTrade') {
    const wanted = num(next);
    const b = budgetOf(draft);
    // `b.available` already has the current trade subtracted, so the ceiling is what it costs today plus
    // what is left. Only a RISE is capped: an overspent draft has to stay repairable, and a ceiling that
    // also blocks the way down would disable the very «−» that fixes it — the same invariant
    // `budgetAllows` keeps for every step that shows the creation budget.
    if (wanted < 0 || (wanted > b.giftTrade && wanted > b.giftTrade + b.available)) return null;
    return { giftTrade: wanted };
  }
  if (fieldId === 'gifts') {
    const ids = giftsOf({ ...draft, gifts: next }).map(g => str(g.id));
    if (new Set(ids).size !== ids.length) return null;
    return { gifts: next };
  }
  // Anything else this step ever gains goes through the generator's own guard, not straight in:
  // dropping to `{ [fieldId]: next }` here would silently lose the preset ceiling and the stat range.
  return applyChange(draft, fieldId, next);
}

const statsError = (draft: SheetData): string | null => {
  const b = budgetOf(draft);
  if (b.available > 0) return 'generator.error.pointsLeft';
  if (b.available < 0) return 'generator.error.pointsOver';
  if (STAT_IDS.some(id => statOf(draft, id).value > b.maxStat || statOf(draft, id).value < 1)) return 'generator.error.statOutOfRange';
  return null;
};

const pointsBudget = (draft: SheetData) => {
  const b = budgetOf(draft);
  return { label: 'generator.budget.points', remaining: b.available, detail: `${b.total}/${b.statsSpent}` };
};

export const generator: GeneratorStep[] = [
  {
    id: 'concept', label: 'generator.step.concept', fields: ['name', 'player', 'concept', 'story', 'size', 'avatar'],
    canAdvance: draft => (str(draft.name).trim() && str(draft.concept).trim() ? null : 'generator.error.nameAndConcept'),
  },
  {
    id: 'stats', label: 'generator.step.stats', fields: ['preset', ...STAT_IDS],
    canAdvance: statsError, budget: pointsBudget, applyChange,
  },
  {
    id: 'specialties', label: 'generator.step.specialties', fields: ['specialtyTrade', ...STAT_IDS],
    canAdvance: draft => {
      if (STAT_IDS.some(id => statOf(draft, id).specialties.filter(s => s.trim()).length === 0)) return 'generator.error.specialtyEach';
      const extra = STAT_IDS.reduce((s, id) => s + Math.max(0, statOf(draft, id).specialties.length - 1), 0);
      if (extra > extraSpecialtiesAllowed(draft)) return 'generator.error.tooManySpecialties';
      if (STAT_IDS.some(id => statOf(draft, id).specialties.length > 1 + budgetOf(draft).specialtyTrade)) return 'generator.error.extraSpecialtiesSpread';
      return budgetOf(draft).available < 0 ? 'generator.error.pointsOver' : null;
    },
    budget: pointsBudget, applyChange,
  },
  {
    id: 'destiny', label: 'generator.step.destiny', fields: ['destiny'],
    canAdvance: draft => {
      const d = num(draft.destiny, BASE_DESTINY);
      if (d < BASE_DESTINY - DESTINY_ADJUST || d > BASE_DESTINY + DESTINY_ADJUST) return 'generator.error.destinyRange';
      return budgetOf(draft).available < 0 ? 'generator.error.pointsOver' : null;
    },
    budget: pointsBudget,
  },
  {
    id: 'gifts', label: 'generator.step.gifts', fields: ['giftTrade', 'gifts'],
    canAdvance: draft => {
      const b = budgetOf(draft);
      // Overspent CREATION points first: that is the trade, and saying «reparte los puntos de don»
      // while the real problem is the trade sends the player to fix the wrong control.
      if (b.available < 0) return 'generator.error.pointsOver';
      const ids = giftsOf(draft).map(g => str(g.id));
      if (new Set(ids).size !== ids.length) return 'generator.error.giftDuplicate';
      if (giftsOf(draft).some(g => num(g.level) < 1 || num(g.level) > GIFT_MAX_LEVEL)) return 'generator.error.giftLevel';
      if (b.giftsSpent < b.giftPoints) return 'generator.error.giftPointsLeft';
      if (b.giftsSpent > b.giftPoints) return 'generator.error.giftPointsOver';
      return null;
    },
    applyChange: applyGiftChange,
    // `total/gastados`, the same shape the points steps use: the big number is what is LEFT, and the
    // hint used to be the total alone here, so «12 · 23» read as two unrelated numbers.
    budget: draft => { const b = budgetOf(draft); return { label: 'generator.budget.giftPoints', remaining: b.giftPoints - b.giftsSpent, detail: `${b.giftPoints}/${b.giftsSpent}` }; },
  },
  {
    id: 'summary', label: 'generator.step.summary', fields: [],
    canAdvance: draft => statsError(draft),
    budget: pointsBudget,
  },
];

/** Values the platform should write when the wizard finishes: fortune = destiny, resistance full, healthy, no xp. */
export function finalizeDraft(draft: SheetData): SheetData {
  const d = derived(draft);
  const destiny = num(draft.destiny, BASE_DESTINY);
  return { ...draft, destiny, fortune: destiny, resistance: d.resistanceMax, health: 'healthy', xp: num(draft.xp) };
}
