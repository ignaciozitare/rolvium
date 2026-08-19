// ─── Character generator · Malefic Time: Plenilunio ──────────────────────────
// Steps declared as data (GeneratorStep[]) with the manual's point economy:
// presets 16/21/25/30 points (max stat 5/5/6/10, p.21), Destiny 3 ± 2 (each +1
// costs a point, each −1 refunds one, p.23), 1 point = 2 extra specialties
// (max 2 trades, p.23) or 2 gift points; gift points = Destiny (+ trades), p.25.
// See RULES.md §1.
import type { GeneratorStep, SheetData, SheetPatch } from '@rolvium/core';
import { GIFT_MAX_LEVEL, MAX_GIFT_TRADES, MAX_SPECIALTY_TRADES, STAT_IDS, isStatId } from './catalogs';
import { derived } from './engine';
import { DEFAULT_PRESET, PRESETS, giftsOf, num, statOf, str, type PresetId } from './schema';

export const BASE_DESTINY = 3;
export const DESTINY_ADJUST = 2;
/** `MAX_SPECIALTY_TRADES` y `MAX_GIFT_TRADES` viven en `catalogs.ts`: el tope rige creación Y ficha viva. */

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
  const giftTrade = Math.max(0, Math.min(MAX_GIFT_TRADES, num(draft.giftTrade)));
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
 *   it — so the guard always said yes and you could spend creation points you do not have. On top of
 *   the book's own ceiling (`MAX_GIFT_TRADES`), what you can PAY for is the second cap we check.
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
    // Dos techos, y los dos capan sólo la SUBIDA para que un borrador ya excedido se pueda reparar:
    // el del libro (`MAX_GIFT_TRADES`) y el de lo que puedas pagar.
    // Contra el valor CRUDO, no contra `b.giftTrade`, que ya viene recortado a MAX_GIFT_TRADES: si se
    // comparase con el recortado, una ficha guardada con 10 no podría ni bajar a 9.
    const now = Math.max(0, num(draft.giftTrade));
    if (wanted < 0) return null;
    if (wanted > now && (wanted > MAX_GIFT_TRADES || wanted > b.giftTrade + b.available)) return null;
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

/**
 * Per-field guard of the specialties step. The step's budget is the CREATION one, and a specialty
 * costs nothing on its own — the points went into the trade — so `budgetAllows` waves every pick
 * through and the caps only showed up on «Continuar» (owner, 2026-08-19: seis especialidades en
 * Presencia con cero canjes, y luego no se avanza).
 *
 * Both caps come straight from the book (RULES.md §1.3, p.21–23): one per characteristic to start,
 * and each trade buys 2 extra **in two different characteristics** — which is what the per-stat
 * ceiling of `1 + canjes` expresses, with the total capped at `2 × canjes`.
 */
export function applySpecialtyChange(draft: SheetData, fieldId: string, next: unknown): SheetPatch | null {
  if (isStatId(fieldId)) {
    const after = { ...draft, [fieldId]: next };
    const trades = budgetOf(after).specialtyTrade;
    // Only a RISE is capped, the same invariant the gift trade's ceiling and `budgetAllows` keep: a
    // draft can already sit ABOVE the cap without ever adding anything — lowering `specialtyTrade`
    // after spreading the extra ones does it — and a ceiling that also blocks the way down freezes
    // every control that could repair it (the ×, the specialty select, even the stat's −/+), leaving
    // «más especialidades extra de las canjeadas» on screen with nothing able to act on it.
    if (own(after, fieldId) > 1 + trades && own(after, fieldId) > own(draft, fieldId)) return null;
    if (extrasOf(after) > trades * 2 && extrasOf(after) > extrasOf(draft)) return null;
  }
  return applyChange(draft, fieldId, next);
}
const own = (draft: SheetData, id: string): number => (isStatId(id) ? statOf(draft, id).specialties.length : 0);
const extrasOf = (draft: SheetData): number => STAT_IDS.reduce((s, id) => s + Math.max(0, statOf(draft, id).specialties.length - 1), 0);

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
    // `applySpecialtyChange` y no `applyChange`: este paso lista las características, y el campo
    // `stat` arrastra sus desplegables de especialidad a cualquier paso que lo liste, así que aquí
    // también se pueden añadir — sin el cupo, era la puerta de atrás al tope del paso siguiente.
    // (La pantalla que no debería enseñarlos aquí es deuda aparte, ya anotada.)
    canAdvance: statsError, budget: pointsBudget, applyChange: applySpecialtyChange,
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
    budget: pointsBudget, applyChange: applySpecialtyChange,
  },
  {
    id: 'destiny', label: 'generator.step.destiny', fields: ['destiny'],
    // El campo `destiny` de la ficha llega hasta 10 porque ése es el techo DEL LIBRO («El Destino puede
    // adoptar puntuaciones entre 1 y 10», p.88, y en 10 se revela el destino), pero AL CREAR va de 1 a 5
    // («comenzará el juego con una puntuación de Destino entre 1 y 5», p.88; RULES.md §1.4). Sin este guardia el contador
    // dejaba subir hasta 10 y luego «Continuar» lo rechazaba: elegir y que no pase nada, otra vez.
    // Sólo se capa la SUBIDA, para que un borrador que ya venga fuera de rango se pueda reparar.
    applyChange: (draft, fieldId, next) => {
      if (fieldId !== 'destiny') return applyChange(draft, fieldId, next);
      const wanted = num(next), now = num(draft.destiny, BASE_DESTINY);
      const low = BASE_DESTINY - DESTINY_ADJUST, high = BASE_DESTINY + DESTINY_ADJUST;
      if ((wanted > high && wanted > now) || (wanted < low && wanted < now)) return null;
      return { destiny: wanted };
    },
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
  const destiny = num(draft.destiny, BASE_DESTINY);
  // `derived` se calcula sobre el borrador YA sano: `resistanceMax` depende del estado de salud
  // (p.101), asi que leerlo antes de forzar `health: 'healthy'` haria que un borrador que llegara
  // herido naciera con la Resistencia de un herido. Hoy no pasa —`newSheet` nace sano— pero el
  // orden no deberia sostener la regla (hallazgo del Review).
  return { ...draft, destiny, fortune: destiny, resistance: derived({ ...draft, health: 'healthy' }).resistanceMax, health: 'healthy', xp: num(draft.xp) };
}
