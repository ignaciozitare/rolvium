// ─── Character generator · Malefic Time: Plenilunio ──────────────────────────
// Steps declared as data (GeneratorStep[]) with the point economy of the
// validated prototype: presets 16/21/25/30 points (max stat 5/5/6/7), Destiny
// 3 ± 2 (each +1 costs a point, each −1 refunds one), 1 point = 2 extra
// specialties (max 2 trades) or 2 gift points; gift points = Destiny (+ trades).
// Manual: stats p.20, specialties p.21–22, destiny/fortune p.90, gifts p.102+.
import type { GeneratorStep, SheetData } from '@rolvium/core';
import { GIFT_MAX_LEVEL, STAT_IDS } from './catalogs';
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
    canAdvance: statsError, budget: pointsBudget,
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
    budget: pointsBudget,
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
      if (giftsOf(draft).some(g => num(g.level) < 1 || num(g.level) > GIFT_MAX_LEVEL)) return 'generator.error.giftLevel';
      if (b.giftsSpent < b.giftPoints) return 'generator.error.giftPointsLeft';
      if (b.giftsSpent > b.giftPoints) return 'generator.error.giftPointsOver';
      return b.available < 0 ? 'generator.error.pointsOver' : null;
    },
    budget: draft => { const b = budgetOf(draft); return { label: 'generator.budget.giftPoints', remaining: b.giftPoints - b.giftsSpent, detail: `${b.giftPoints}` }; },
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
