// ─── Rules engine · Malefic Time: Plenilunio ─────────────────────────────────
// Pure functions ported from the validated prototype (clasificar, aplicarArmadura,
// resolverAccion, describirGrado, damage/health, progression) plus the
// `Engine` object required by the GameSystem port. No I/O, no randomness: the
// platform generates dice on the server and calls `resolve`.
import type { ActionDef, DiceGroup, Engine, RollRequest, RollResult, RolledDice, SharedResourceDef, SheetData, SheetPatch } from '@rolvium/core';
import {
  GIFT_IDS, GIFT_MAX_LEVEL, HEALTH_LEVELS, MAX_GIFT_TRADES, RANGE_DIFFICULTY, RECOVERY, armourById, isMelee, isStatId, sizeMod, weaponById,
  type HealthId, type StatId, type WeaponData,
} from './catalogs';
import { giftsOf, healthOf, num, statOf, str, weaponsOf, type GiftRow, type WeaponRow } from './schema';

export const SYSTEM_ID = 'plenilunio';

// ─── Constants ───────────────────────────────────────────────────────────────
/** Shared Destiny pool (manual p.88–89): 10 dice by default, up to 5 per roll, players take, DM resets. */
export const DESTINY_POOL = { max: 10, initial: 10, perTakeMax: 5 } as const;
export const DESTINY_MAX = 10;
/** Highest value reachable with XP (manual p.91 only prices up to 6; creation presets may go higher, p.21). */
export const STAT_MAX = 6;
/** XP costs (manual p.91). */
export const XP_COSTS = { statTo5: 20, statTo6: 40, newSpecialty: 10, changeSpecialty: 3, gift: 10 } as const;
export const GIFT_ACTIVATION_COST = 1;

// ─── Derived values (manual p.25, p.89, p.98–101) ────────────────────────────
export interface Derived {
  endurance: number; resistanceMax: number; fortuneMax: number; dicePenalty: number; healthIndex: number;
  protection: number; armourPenalty: number; giftPoints: number;
}
export const healthIndexOf = (h: HealthId) => HEALTH_LEVELS.findIndex(l => l.id === h);
export const healthPenaltyOf = (h: HealthId) => HEALTH_LEVELS[healthIndexOf(h)]?.penalty ?? 0;

/**
 * Endurance = Fortitude + Will ± size (min 1); Fortune max = Destiny (p.90, hard cap: «nunca pueden llegar a ser
 * mayores que la puntuación de Destino»).
 *
 * Resistance max = Endurance × the CURRENT health level's factor (p.101, literal): ×3 sano/magullado, ×2 herido,
 * ×1 malherido. No es «lo que cura el descanso» y aparte un tope de 3×Aguante — el libro dice que los puntos
 * máximos «pasan a ser» ese número, así que es EL máximo y el descanso sólo te lleva hasta él. Antes se
 * calculaban los dos por separado (`resistanceMax` = ×3 siempre, `recoveryMax` = el del estado) y la ficha
 * enseñaba lo mismo dos veces con nombres distintos: Karen, herida, salía con «máxima 18» —la de una persona
 * sana, que ella no es— y «recuperable 12». Uno solo, y verdadero (dueño, 2026-08-19; RULES.md §6.3).
 */
export function derived(sheet: SheetData): Derived {
  const endurance = Math.max(1, statOf(sheet, 'fortitude').value + statOf(sheet, 'will').value + sizeMod(sheet.size));
  const health = healthOf(sheet);
  const armour = armourById(str(sheet.armour, 'none'));
  const destiny = num(sheet.destiny, 3);
  const spent = giftsOf(sheet).reduce((s, g) => s + num(g.level), 0);
  return {
    endurance,
    resistanceMax: endurance * RECOVERY[health].restFactor,
    fortuneMax: destiny,
    dicePenalty: healthPenaltyOf(health),
    healthIndex: healthIndexOf(health),
    protection: armour?.data.protection ?? 0,
    armourPenalty: armour?.data.penalty ?? 0,
    // El tope del canje se aplica aquí TAMBIÉN, no sólo en `budgetOf`: si no, una ficha guardada con
    // más de MAX_GIFT_TRADES canjes enseñaría puntos de don inflados para siempre (hallazgo del QA).
    giftPoints: Math.max(0, destiny + Math.min(MAX_GIFT_TRADES, Math.max(0, num(sheet.giftTrade))) * 2 - spent),
  };
}

// ─── Dice classification (manual p.82) ───────────────────────────────────────
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

export interface ResolveInput {
  own: readonly number[]; destiny?: readonly number[]; opposition?: readonly number[];
  specialty?: boolean; armourPenalty?: number;
  /** In conflicts the rival may apply a specialty too (p.85): their triumphs count double. Never for difficulty dice (p.84). */
  oppositionSpecialty?: boolean;
}
export interface Outcome {
  own: Tally; destiny: Tally; opposition: Tally;
  ownHits: number; destinyHits: number; oppositionHits: number;
  /** ownHits + destinyHits − oppositionHits: >0 success degree, <0 failure degree, 0 ambiguous. */
  difference: number;
  setback: boolean; destinyUp: boolean; armourConverted: number; specialty: boolean; oppositionSpecialty: boolean;
}
/**
 * Full resolution (manual p.82–89): specialty doubles own triumphs (p.83); Destiny dice always double and a
 * triumph among them raises Destiny (p.89); setback = no raw hit at all and ≥1 fumble (p.86).
 */
export function resolveAction(input: ResolveInput): Outcome {
  const specialty = !!input.specialty;
  const oppositionSpecialty = !!input.oppositionSpecialty;
  const { tally: own, converted } = applyArmour(classify(input.own), input.armourPenalty ?? 0);
  const destiny = classify(input.destiny ?? []);
  const opposition = classify(input.opposition ?? []);
  const ownHits = own.successes + own.triumphs * (specialty ? 2 : 1);
  const destinyHits = destiny.successes + destiny.triumphs * 2;
  const oppositionHits = opposition.successes + opposition.triumphs * (oppositionSpecialty ? 2 : 1);
  const raw = own.successes + own.triumphs + destiny.successes + destiny.triumphs;
  return {
    own, destiny, opposition, ownHits, destinyHits, oppositionHits,
    difference: ownHits + destinyHits - oppositionHits,
    setback: raw === 0 && own.fumbles + destiny.fumbles > 0,
    destinyUp: destiny.triumphs > 0,
    armourConverted: converted, specialty, oppositionSpecialty,
  };
}

/** Degree of success/failure (manual p.85) as an i18n key of this package. */
export function degreeKey(difference: number): string {
  if (difference === 0) return 'roll.degree.ambiguous';
  if (difference > 0) return difference <= 3 ? `roll.degree.success.${difference}` : 'roll.degree.success.absolute';
  return -difference <= 3 ? `roll.degree.failure.${-difference}` : 'roll.degree.failure.absolute';
}

// ─── Pools (manual p.82–84, p.88, p.97) ──────────────────────────────────────
/** Shape of `RollRequest.options` produced by this system. */
export interface PlenilunioRollOptions {
  stat: StatId;
  specialty?: boolean;
  /** Armour penalty applied on this roll (0 = ignored). */
  armourPenalty?: number;
  /** Rival applies a specialty (conflicts only, p.85). */
  oppositionSpecialty?: boolean;
  extraDice?: number;
  /** Destiny-pool dice taken (≤ perTakeMax, none at Destiny 10). */
  destinyDice?: number;
  /** Opposition dice (challenge difficulty 1/2/3/5/6 or an opponent's pool). */
  difficulty?: number;
  /** Set by actions. `range` picks the ranged difficulty (p.96) when no explicit difficulty is given. */
  weaponId?: string; ranged?: boolean; range?: keyof typeof RANGE_DIFFICULTY; weaponDamage?: number; bonusDice?: number; giftId?: string;
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

/**
 * Damage of a winning attack (manual p.97). Cancellation: opposition hits cancel plain successes first, triumphs last;
 * a doubled triumph (specialty / Destiny die) may be half-cancelled. Then: success = 1, triumph = weapon damage,
 * doubled triumph = 2× weapon damage, half-cancelled doubled triumph = 1× weapon damage.
 * Implemented as units: success = 1 unit worth 1; plain triumph = 1 unit worth `weaponDamage`; doubled triumph = 2 units worth `weaponDamage` each.
 */
export function attackDamage(o: Outcome, weaponDamage: number): number {
  let successes = o.own.successes + o.destiny.successes;
  let triumphUnits = o.own.triumphs * (o.specialty ? 2 : 1) + o.destiny.triumphs * 2;
  let cancel = o.oppositionHits;
  const fromSuccesses = Math.min(cancel, successes); successes -= fromSuccesses; cancel -= fromSuccesses;
  triumphUnits -= Math.min(cancel, triumphUnits);
  return successes + triumphUnits * Math.max(1, weaponDamage);
}

/** Server-side resolution: classifies each tagged group and returns summary key + all numbers + effects. */
export function resolve(request: RollRequest, dice: RolledDice, sheet?: SheetData): RollResult {
  const opts = readOptions(request.options);
  const o = resolveAction({
    own: diceByTag(request, dice, 'own'), destiny: diceByTag(request, dice, 'destiny'), opposition: diceByTag(request, dice, 'opposition'),
    specialty: !!opts.specialty, armourPenalty: num(opts.armourPenalty), oppositionSpecialty: !!opts.oppositionSpecialty,
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

// ─── Damage & health (manual p.89, p.98–101) ─────────────────────────────────
/**
 * Protection subtracts; every full multiple of Endurance in one blow marks one health level (4× = dead); Resistance
 * goes down by the net damage and dropping below 0 leaves the character unconscious (p.98).
 * `fortune` = Fortune points spent to lower the wound's severity, one level each (p.89); Resistance is still lost.
 */
export function applyDamage(sheet: SheetData, damage: number, fortune = 0): SheetPatch {
  const d = derived(sheet);
  const net = Math.max(0, Math.floor(damage) - d.protection);
  const levels = Math.max(0, Math.floor(net / d.endurance) - Math.max(0, Math.floor(fortune)));
  const idx = Math.min(HEALTH_LEVELS.length - 1, d.healthIndex + levels);
  const health = HEALTH_LEVELS[idx]?.id ?? 'dead';
  const remaining = num(sheet.resistance) - net;
  const patch: SheetPatch = { resistance: Math.max(0, remaining), health };
  if (net > 0 && remaining < 0) patch.unconscious = 'yes';
  if (fortune > 0) patch.fortune = Math.max(0, num(sheet.fortune) - Math.floor(fortune));
  return patch;
}

/** Fortune spend/refill helpers (manual p.89–90). */
export const spendFortune = (sheet: SheetData, amount = 1): SheetPatch | null =>
  num(sheet.fortune) >= amount ? { fortune: num(sheet.fortune) - amount } : null;
export const refillFortune = (sheet: SheetData): SheetPatch => ({ fortune: derived(sheet).fortuneMax });
/** «Recobrar el aliento» (p.89): 1 Fortune → regain half of the Resistance lost (rounded down, ⚠ interpretación). */
export function catchBreath(sheet: SheetData): SheetPatch | null {
  if (num(sheet.fortune) < 1) return null;
  const d = derived(sheet);
  const lost = Math.max(0, d.resistanceMax - num(sheet.resistance));
  return { fortune: num(sheet.fortune) - 1, resistance: Math.min(d.resistanceMax, num(sheet.resistance) + Math.floor(lost / 2)) };
}
/** Rest after the scene (p.101): Resistance back to what the current health level allows (×3 / ×2 / ×1 Endurance). */
export const rest = (sheet: SheetData): SheetPatch => ({ resistance: Math.max(num(sheet.resistance), derived(sheet).resistanceMax), unconscious: 'no' });

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
/**
 * Recargar saca balas de la MUNICIÓN que llevas encima (`reserve`) y llena el cargador. Devuelve null
 * si no hay de dónde: el arma no tiene cargador, ya está lleno, o no te queda munición suelta.
 *
 * El libro no da una tabla de recarga, pero sí las dos piezas: el «Cargador» por arma (p.97) y que la
 * munición es un recurso escaso que se consigue y se lleva («entre 20 y 40 balas» en el equipo inicial,
 * p.019; «conseguir munición es muy difícil», p.030). ⚠ Interpretación: el cargador se llena hasta
 * donde alcance la munición, sin exigir tenerlo completo.
 */
export function reload(sheet: SheetData, weaponId: string): SheetPatch | null {
  const rows = weaponsOf(sheet);
  const i = rows.findIndex(r => r.id === weaponId);
  const row = rows[i];
  const data = row ? weaponData(row) : null;
  if (!row || !data || data.magazine === null) return null;
  const inMag = num(row.ammo);
  const reserve = num((row as unknown as Record<string, unknown>)['reserve']);
  const need = data.magazine - inMag;
  if (need <= 0 || reserve <= 0) return null;
  const moved = Math.min(need, reserve);
  return { weapons: rows.map((r, j) => (j === i ? { ...r, ammo: inMag + moved, reserve: reserve - moved } : r)) };
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
  const range = readOptions(options).range;
  if (ranged && range && options?.difficulty === undefined && RANGE_DIFFICULTY[range] !== undefined) extra.difficulty = RANGE_DIFFICULTY[range];
  const req = poolFor(sheet, { stat: 'combat', options: { ...(options ?? {}), ...extra } });
  return { ...req, title: `catalog.weapons.${itemId}` };
};

/** Un arma ofrece SOLO su acción: c/c o a distancia, nunca las dos (p.96–97, y `attackActionFor`). */
const rowIsMelee = (row: Record<string, unknown>): boolean => {
  const d = weaponData(row as unknown as WeaponRow);
  return !d || isMelee(d);
};
export const actions: ActionDef[] = [
  { id: 'attack.melee', icon: 'swords', label: 'sheet.actions.attackMelee', appliesTo: 'weapons', appliesToRow: rowIsMelee, toRoll: (s, id, o) => attackRequest(s, id, o, false) },
  {
    id: 'attack.ranged', icon: 'target', label: 'sheet.actions.attackRanged', appliesTo: 'weapons',
    appliesToRow: r => !rowIsMelee(r),
    /**
     * Un disparo gasta un punto de cargador (p.97). Que el arco, la ballesta y el tirachinas pongan
     * «Cargador 1» es lo que fija la unidad: una unidad = un disparo, y a recargar. Sin balas devuelve
     * null y el botón se apaga; recargar es una acción aparte que el libro cobra en dados de Combate
     * (p.96) y que todavía no está construida.
     */
    spend: (sheet, id) => {
      // `spendAmmo` ya existía y está probado: se reutiliza en vez de repetir la cuenta. Devuelve null
      // cuando el arma no tiene cargador, así que aquí se distingue ese caso —un arma a distancia sin
      // munición declarada se dispara gratis— de quedarse sin balas, que sí apaga el botón.
      const row = weaponsOf(sheet).find(r => str(r.id) === id);
      const d = row ? weaponData(row) : null;
      if (d && d.magazine === null) return {};
      return spendAmmo(sheet, id);
    },
    toRoll: (s, id, o) => attackRequest(s, id, o, true),
  },
  {
    // Recargar no tira dados: mueve balas de la munición al cargador. El libro lo cobra como acción del
    // turno con al menos 1 dado de Combate y sin tirada (p.96); ese coste en dados todavía no se aplica.
    id: 'reload', icon: 'refresh', label: 'sheet.actions.reload', appliesTo: 'weapons',
    appliesToRow: r => !rowIsMelee(r),
    spend: (sheet, id) => reload(sheet, id),
  },
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

