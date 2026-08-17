// ─── Rules engine · Malefic Time: Plenilunio ─────────────────────────────────
// Pure functions ported from the validated prototype (clasificar, aplicarArmadura,
// resolverAccion, describirGrado, damage/health, progression) plus the
// `Engine` object required by the GameSystem port. No I/O, no randomness: the
// platform generates dice on the server and calls `resolve`.
import type { ActionDef, DiceGroup, Engine, RollRequest, RollResult, RolledDice, SharedResourceDef, SheetData, SheetPatch } from '@rolvium/core';
import {
  GIFT_IDS, GIFT_MAX_LEVEL, HEALTH_LEVELS, armourById, isMelee, isStatId, sizeMod, weaponById,
  type HealthId, type StatId, type WeaponData,
} from './catalogs';
import { giftsOf, healthOf, num, statOf, str, weaponsOf, type GiftRow, type WeaponRow } from './schema';

export const SYSTEM_ID = 'plenilunio';

// ─── Constants ───────────────────────────────────────────────────────────────
/** Shared Destiny pool (manual p.90): 10 dice, up to 5 per roll, players take, DM resets. */
export const DESTINY_POOL = { max: 10, initial: 10, perTakeMax: 5 } as const;
export const DESTINY_MAX = 10;
export const RESISTANCE_CAP = 30;
export const STAT_MAX = 6;
/** XP costs (manual p.91). */
export const XP_COSTS = { statTo5: 20, statTo6: 40, newSpecialty: 10, changeSpecialty: 3, gift: 10 } as const;
export const GIFT_ACTIVATION_COST = 1;

// ─── Derived values (manual p.98, p.90, p.25) ────────────────────────────────
export interface Derived {
  endurance: number; resistanceMax: number; fortuneMax: number; dicePenalty: number; healthIndex: number;
  protection: number; armourPenalty: number; giftPoints: number;
}
export const healthIndexOf = (h: HealthId) => HEALTH_LEVELS.findIndex(l => l.id === h);
export const healthPenaltyOf = (h: HealthId) => HEALTH_LEVELS[healthIndexOf(h)]?.penalty ?? 0;

/** Endurance = Fortitude + Will ± size (min 1); Resistance = Endurance×3 capped at 30; Fortune max = Destiny. */
export function derived(sheet: SheetData): Derived {
  const endurance = Math.max(1, statOf(sheet, 'fortitude').value + statOf(sheet, 'will').value + sizeMod(sheet.size));
  const health = healthOf(sheet);
  const armour = armourById(str(sheet.armour, 'none'));
  const destiny = num(sheet.destiny, 3);
  const spent = giftsOf(sheet).reduce((s, g) => s + num(g.level), 0);
  return {
    endurance,
    resistanceMax: Math.min(RESISTANCE_CAP, endurance * 3),
    fortuneMax: destiny,
    dicePenalty: healthPenaltyOf(health),
    healthIndex: healthIndexOf(health),
    protection: armour?.data.protection ?? 0,
    armourPenalty: armour?.data.penalty ?? 0,
    giftPoints: Math.max(0, destiny + num(sheet.giftTrade) * 2 - spent),
  };
}

// ─── Dice classification (manual p.84) ───────────────────────────────────────
export interface Tally { fumbles: number; misses: number; successes: number; triumphs: number }
/** 1 fumble · 2–3 miss · 4–5 success · 6 triumph. */
export function classify(dice: readonly number[]): Tally {
  const t: Tally = { fumbles: 0, misses: 0, successes: 0, triumphs: 0 };
  for (const d of dice) {
    if (d === 1) t.fumbles++;
    else if (d <= 3) t.misses++;
    else if (d <= 5) t.successes++;
    else t.triumphs++;
  }
  return t;
}
/** Armour (manual p.98): only if the roll shows ≥1 fumble, up to `penalty` triumphs become plain successes. */
export function applyArmour(t: Tally, penalty: number): { tally: Tally; converted: number } {
  if (penalty > 0 && t.fumbles > 0) {
    const converted = Math.min(penalty, t.triumphs);
    return { tally: { ...t, triumphs: t.triumphs - converted, successes: t.successes + converted }, converted };
  }
  return { tally: t, converted: 0 };
}

export interface ResolveInput { own: readonly number[]; destiny?: readonly number[]; opposition?: readonly number[]; specialty?: boolean; armourPenalty?: number }
export interface Outcome {
  own: Tally; destiny: Tally; opposition: Tally;
  ownHits: number; destinyHits: number; oppositionHits: number;
  /** ownHits + destinyHits − oppositionHits: >0 success degree, <0 failure degree, 0 ambiguous. */
  difference: number;
  setback: boolean; destinyUp: boolean; armourConverted: number; specialty: boolean;
}
/**
 * Full resolution (manual p.84–90): specialty doubles own triumphs (p.85); Destiny dice always double and a
 * triumph among them raises Destiny (p.90); setback = no raw hit at all and ≥1 fumble (p.88).
 */
export function resolveAction(input: ResolveInput): Outcome {
  const specialty = !!input.specialty;
  const { tally: own, converted } = applyArmour(classify(input.own), input.armourPenalty ?? 0);
  const destiny = classify(input.destiny ?? []);
  const opposition = classify(input.opposition ?? []);
  const ownHits = own.successes + own.triumphs * (specialty ? 2 : 1);
  const destinyHits = destiny.successes + destiny.triumphs * 2;
  const oppositionHits = opposition.successes + opposition.triumphs;
  const raw = own.successes + own.triumphs + destiny.successes + destiny.triumphs;
  return {
    own, destiny, opposition, ownHits, destinyHits, oppositionHits,
    difference: ownHits + destinyHits - oppositionHits,
    setback: raw === 0 && own.fumbles + destiny.fumbles > 0,
    destinyUp: destiny.triumphs > 0,
    armourConverted: converted, specialty,
  };
}

/** Degree of success/failure (manual p.87) as an i18n key of this package. */
export function degreeKey(difference: number): string {
  if (difference === 0) return 'roll.degree.ambiguous';
  if (difference > 0) return difference <= 3 ? `roll.degree.success.${difference}` : 'roll.degree.success.absolute';
  return -difference <= 3 ? `roll.degree.failure.${-difference}` : 'roll.degree.failure.absolute';
}

// ─── Pools (manual p.84, p.90, p.97) ─────────────────────────────────────────
/** Shape of `RollRequest.options` produced by this system. */
export interface PlenilunioRollOptions {
  stat: StatId;
  specialty?: boolean;
  /** Armour penalty applied on this roll (0 = ignored). */
  armourPenalty?: number;
  extraDice?: number;
  /** Destiny-pool dice taken (≤ perTakeMax, none at Destiny 10). */
  destinyDice?: number;
  /** Opposition dice (challenge difficulty 1/2/3/5/6 or an opponent's pool). */
  difficulty?: number;
  /** Set by actions. */
  weaponId?: string; ranged?: boolean; weaponDamage?: number; bonusDice?: number; giftId?: string;
}
export const readOptions = (o: Record<string, unknown> | undefined): Partial<PlenilunioRollOptions> => (o ?? {}) as Partial<PlenilunioRollOptions>;

/** Reads the roll block of the sheet (difficulty / specialty / armour / extra) as defaults for poolFor. */
export function rollBlockOptions(sheet: SheetData): Pick<PlenilunioRollOptions, 'difficulty' | 'specialty' | 'armourPenalty' | 'extraDice'> {
  const d = derived(sheet);
  return {
    difficulty: Number(sheet.difficulty ?? 2) || 0,
    specialty: sheet.useSpecialty === 'yes' || sheet.useSpecialty === true,
    armourPenalty: (sheet.useArmour === 'yes' || sheet.useArmour === true) ? d.armourPenalty : 0,
    extraDice: num(sheet.extraDice),
  };
}

/** Builds the RollRequest for a stat: own dice = stat − health penalty + extra + bonus; Destiny and opposition groups tagged. */
export function poolFor(sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }): RollRequest {
  const stat: StatId = isStatId(action.stat) ? action.stat : 'fortitude';
  const opts: PlenilunioRollOptions = { ...rollBlockOptions(sheet), ...readOptions(action.options), stat };
  const d = derived(sheet);
  const destiny = num(sheet.destiny, 3);
  const ownCount = Math.max(0, statOf(sheet, stat).value - d.dicePenalty + num(opts.extraDice) + num(opts.bonusDice));
  const destinyDice = destiny >= DESTINY_MAX ? 0 : Math.max(0, Math.min(DESTINY_POOL.perTakeMax, Math.floor(num(opts.destinyDice))));
  const opposition = Math.max(0, Math.floor(num(opts.difficulty)));
  const groups: DiceGroup[] = [{ count: ownCount, sides: 6, tag: 'own' }];
  if (destinyDice > 0) groups.push({ count: destinyDice, sides: 6, tag: 'destiny' });
  if (opposition > 0) groups.push({ count: opposition, sides: 6, tag: 'opposition' });
  const options: PlenilunioRollOptions = { ...opts, destinyDice, armourPenalty: num(opts.armourPenalty), specialty: !!opts.specialty };
  return {
    systemId: SYSTEM_ID, kind: 'system', title: `sheet.stats.${stat}`, groups,
    options: options as unknown as Record<string, unknown>,
    ...(destinyDice > 0 ? { sharedResources: { destiny: destinyDice } } : {}),
    visibility: 'table',
  };
}

const diceByTag = (request: RollRequest, dice: RolledDice, tag: string): number[] =>
  request.groups.flatMap((g, i) => (g.tag === tag ? (dice[i] ?? []) : []));

/** Damage potential of an attack (manual p.97–98): opposition cancels successes first, triumphs last; success = 1, triumph = weapon damage. */
export function attackDamage(o: Outcome, weaponDamage: number): number {
  let successes = o.own.successes + o.destiny.successes;
  let triumphs = o.own.triumphs + o.destiny.triumphs;
  let cancel = o.oppositionHits;
  const fromSuccesses = Math.min(cancel, successes); successes -= fromSuccesses; cancel -= fromSuccesses;
  const fromTriumphs = Math.min(cancel, triumphs); triumphs -= fromTriumphs;
  return successes + triumphs * Math.max(1, weaponDamage);
}

/** Server-side resolution: classifies each tagged group and returns summary key + all numbers + effects. */
export function resolve(request: RollRequest, dice: RolledDice, sheet?: SheetData): RollResult {
  const opts = readOptions(request.options);
  const o = resolveAction({
    own: diceByTag(request, dice, 'own'), destiny: diceByTag(request, dice, 'destiny'), opposition: diceByTag(request, dice, 'opposition'),
    specialty: !!opts.specialty, armourPenalty: num(opts.armourPenalty),
  });
  const detail: Record<string, unknown> = {
    stat: opts.stat, own: o.own, destiny: o.destiny, opposition: o.opposition,
    ownHits: o.ownHits, destinyHits: o.destinyHits, oppositionHits: o.oppositionHits, difference: o.difference,
    setback: o.setback, destinyUp: o.destinyUp, armourConverted: o.armourConverted, specialty: o.specialty, degree: degreeKey(o.difference),
  };
  if (opts.weaponId) detail.damage = o.difference > 0 ? attackDamage(o, num(opts.weaponDamage, 1)) : 0;
  const effects: Record<string, unknown> = {};
  if (o.destinyUp) {
    effects.destinyUp = true; effects.fortuneRefill = true;
    if (sheet) { const next = Math.min(DESTINY_MAX, num(sheet.destiny, 3) + 1); effects.patch = { destiny: next, fortune: next }; }
  }
  if (o.setback) effects.setback = true;
  if (opts.ranged && opts.weaponId) effects.ammoSpent = opts.weaponId;
  if (opts.giftId) effects.fortuneSpent = GIFT_ACTIVATION_COST;
  return { summary: o.setback ? 'roll.summary.setback' : degreeKey(o.difference), detail, effects, total: o.difference };
}

// ─── Damage & health (manual p.98) ───────────────────────────────────────────
/** Protection subtracts; every full multiple of Endurance marks one health level; boxes go down by the net damage. */
export function applyDamage(sheet: SheetData, damage: number): SheetPatch {
  const d = derived(sheet);
  const net = Math.max(0, Math.floor(damage) - d.protection);
  const levels = net >= d.endurance ? Math.floor(net / d.endurance) : 0;
  const idx = Math.min(HEALTH_LEVELS.length - 1, d.healthIndex + levels);
  const health = HEALTH_LEVELS[idx]?.id ?? 'dead';
  return { resistance: Math.max(0, num(sheet.resistance) - net), health };
}

/** Fortune spend/refill helpers (manual p.90). */
export const spendFortune = (sheet: SheetData, amount = 1): SheetPatch | null =>
  num(sheet.fortune) >= amount ? { fortune: num(sheet.fortune) - amount } : null;
export const refillFortune = (sheet: SheetData): SheetPatch => ({ fortune: derived(sheet).fortuneMax });

/** Ammo bookkeeping for ranged weapons (manual p.97). */
export function weaponData(row: WeaponRow): WeaponData | null {
  if (row.custom) return { bonus: row.custom.bonus, damage: row.custom.damage, strength: row.custom.strength, range: row.custom.range as WeaponData['range'], magazine: row.custom.magazine };
  return weaponById(row.id)?.data ?? null;
}
export function spendAmmo(sheet: SheetData, weaponId: string): SheetPatch | null {
  const rows = weaponsOf(sheet);
  const i = rows.findIndex(r => r.id === weaponId);
  const row = rows[i];
  if (!row || row.ammo === null || row.ammo === undefined || row.ammo <= 0) return null;
  return { weapons: rows.map((r, j) => (j === i ? { ...r, ammo: (r.ammo ?? 0) - 1 } : r)) };
}
export function reload(sheet: SheetData, weaponId: string): SheetPatch | null {
  const rows = weaponsOf(sheet);
  const i = rows.findIndex(r => r.id === weaponId);
  const row = rows[i];
  const data = row ? weaponData(row) : null;
  if (!row || !data || data.magazine === null) return null;
  return { weapons: rows.map((r, j) => (j === i ? { ...r, ammo: data.magazine } : r)) };
}

// ─── Progression (manual p.91) ───────────────────────────────────────────────
export type ProgressionKind = 'stat' | 'specialty.new' | 'specialty.change' | 'gift.new' | 'gift.level';
export interface ProgressionChange { kind: string; target: string; to?: unknown }

/** XP cost of a change or null when the rules forbid it (max stat 6, duplicate specialty/gift, gift level 5…). Does not check XP balance. */
export function progressionCost(sheet: SheetData, change: ProgressionChange): number | null {
  switch (change.kind as ProgressionKind) {
    case 'stat': {
      if (!isStatId(change.target)) return null;
      const v = statOf(sheet, change.target).value;
      if (v >= STAT_MAX) return null;
      return v >= 5 ? XP_COSTS.statTo6 : XP_COSTS.statTo5;
    }
    case 'specialty.new': {
      if (!isStatId(change.target) || typeof change.to !== 'string' || !change.to) return null;
      return statOf(sheet, change.target).specialties.includes(change.to) ? null : XP_COSTS.newSpecialty;
    }
    case 'specialty.change': {
      if (!isStatId(change.target) || typeof change.to !== 'string' || !change.to) return null;
      const s = statOf(sheet, change.target).specialties;
      return s.length === 0 || s.includes(change.to) ? null : XP_COSTS.changeSpecialty;
    }
    case 'gift.new':
      if (!(GIFT_IDS as readonly string[]).includes(change.target)) return null;
      return giftsOf(sheet).some(g => g.id === change.target) ? null : XP_COSTS.gift;
    case 'gift.level': {
      const g = giftsOf(sheet).find(x => x.id === change.target);
      return g && num(g.level, 1) < GIFT_MAX_LEVEL ? XP_COSTS.gift : null;
    }
  }
  return null;
}

/** Applies a change, debiting XP. Returns {} when not allowed or unaffordable. */
export function progressionApply(sheet: SheetData, change: ProgressionChange): SheetPatch {
  const cost = progressionCost(sheet, change);
  const xp = num(sheet.xp);
  if (cost === null || xp < cost) return {};
  const patch: SheetPatch = { xp: xp - cost };
  const target = change.target as StatId;
  switch (change.kind as ProgressionKind) {
    case 'stat': { const s = statOf(sheet, target); patch[target] = { ...s, value: s.value + 1 }; break; }
    case 'specialty.new': { const s = statOf(sheet, target); patch[target] = { ...s, specialties: [...s.specialties, change.to as string] }; break; }
    case 'specialty.change': { const s = statOf(sheet, target); patch[target] = { ...s, specialties: [change.to as string, ...s.specialties.slice(1)] }; break; }
    case 'gift.new': patch.gifts = [...giftsOf(sheet), { id: change.target, level: 1 } satisfies GiftRow]; break;
    case 'gift.level': patch.gifts = giftsOf(sheet).map(g => (g.id === change.target ? { ...g, level: num(g.level, 1) + 1 } : g)); break;
  }
  return patch;
}

// ─── Shared resources & actions ──────────────────────────────────────────────
export const sharedResources: SharedResourceDef[] = [{
  id: 'destiny', label: 'system.destinyPool', ref: 'destinyPool',
  max: DESTINY_POOL.max, initial: DESTINY_POOL.initial, perTakeMax: DESTINY_POOL.perTakeMax,
  whoCanTake: 'player', whoCanReset: 'dm',
  blockedIf: sheet => (num(sheet.destiny, 3) >= DESTINY_MAX ? 'roll.destinyBlocked' : null),
}];

const attackRequest = (sheet: SheetData, itemId: string, options: Record<string, unknown> | undefined, ranged: boolean): RollRequest => {
  const row = weaponsOf(sheet).find(r => r.id === itemId) ?? { id: itemId, ammo: null };
  const data = weaponData(row) ?? { bonus: 0, damage: 0, strength: true, range: 'melee' as const, magazine: null };
  const weaponDamage = data.strength ? statOf(sheet, 'fortitude').value + data.damage : data.damage;
  const extra: Partial<PlenilunioRollOptions> = { weaponId: itemId, ranged, weaponDamage, bonusDice: ranged ? 0 : data.bonus };
  const req = poolFor(sheet, { stat: 'combat', options: { ...(options ?? {}), ...extra } });
  return { ...req, title: `catalog.weapons.${itemId}` };
};

export const actions: ActionDef[] = [
  { id: 'attack.melee', icon: 'swords', label: 'sheet.actions.attackMelee', appliesTo: 'weapons', toRoll: (s, id, o) => attackRequest(s, id, o, false) },
  { id: 'attack.ranged', icon: 'target', label: 'sheet.actions.attackRanged', appliesTo: 'weapons', toRoll: (s, id, o) => attackRequest(s, id, o, true) },
  {
    id: 'gift.activate', icon: 'bolt', label: 'sheet.actions.activateGift', appliesTo: 'gifts', cost: 'sheet.actions.giftCost',
    toRoll: (sheet, giftId, options) => {
      const req = poolFor(sheet, { stat: str(options?.stat, 'will'), options: { ...(options ?? {}), giftId } });
      return { ...req, title: `catalog.gifts.${giftId}.name` };
    },
  },
];
/** Which attack action a weapon row uses. */
export const attackActionFor = (row: WeaponRow): 'attack.melee' | 'attack.ranged' => {
  const d = weaponData(row);
  return d && !isMelee(d) ? 'attack.ranged' : 'attack.melee';
};

export const engine: Engine = {
  derived: sheet => ({ ...derived(sheet) }),
  poolFor, resolve, applyDamage,
  progression: { cost: progressionCost, apply: progressionApply },
  sharedResources, actions,
};

