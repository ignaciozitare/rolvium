import { describe, expect, it } from 'vitest';
import {
  applyArmour, applyDamage, attackDamage, catchBreath, classify, degreeKey, derived, engine, poolFor, progressionApply, progressionCost, reload,
  resolve, resolveAction, rest, sharedResources, spendAmmo, actions, XP_COSTS, DESTINY_POOL, STAT_MAX,
} from './engine';
import { newSheet, type StatValue } from './schema';
import { STAT_IDS } from './catalogs';
import { budgetOf, generator, canAdjustStat, finalizeDraft } from './generator';
import type { SheetData } from '@rolvium/core';

const stat = (value: number, specialties: string[] = []): StatValue => ({ value, specialties });
const sheet = (over: SheetData = {}): SheetData => ({ ...newSheet(), fortitude: stat(3), will: stat(2), combat: stat(4), destiny: 3, fortune: 3, resistance: 15, ...over });

describe('classify (manual p.82)', () => {
  it('1 fumble · 2–3 miss · 4–5 success · 6 triumph', () => {
    expect(classify([1, 2, 3, 4, 5, 6])).toEqual({ fumbles: 1, misses: 2, successes: 2, triumphs: 1 });
    expect(classify([])).toEqual({ fumbles: 0, misses: 0, successes: 0, triumphs: 0 });
  });
});

describe('resolveAction', () => {
  it('specialty doubles own triumphs only', () => {
    const plain = resolveAction({ own: [6, 6, 4] });
    const spec = resolveAction({ own: [6, 6, 4], specialty: true });
    expect(plain.ownHits).toBe(3);
    expect(spec.ownHits).toBe(5);
  });
  it('destiny dice always double their triumphs and flag destinyUp', () => {
    const r = resolveAction({ own: [2], destiny: [6, 4] });
    expect(r.destinyHits).toBe(3);
    expect(r.destinyUp).toBe(true);
    expect(resolveAction({ own: [2], destiny: [4, 5] }).destinyUp).toBe(false);
  });
  it('armour penalty converts triumphs to successes only when there is a fumble', () => {
    expect(applyArmour(classify([6, 6, 4]), 1)).toEqual({ tally: { fumbles: 0, misses: 0, successes: 1, triumphs: 2 }, converted: 0 });
    expect(applyArmour(classify([6, 6, 1]), 1)).toEqual({ tally: { fumbles: 1, misses: 0, successes: 1, triumphs: 1 }, converted: 1 });
    expect(applyArmour(classify([6, 1]), 3).tally.triumphs).toBe(0);
    const r = resolveAction({ own: [6, 6, 1], specialty: true, armourPenalty: 1 });
    expect(r.ownHits).toBe(3); // 1 triumph doubled + 1 converted success
    expect(r.armourConverted).toBe(1);
  });
  it('setback only with zero raw hits and at least one fumble', () => {
    expect(resolveAction({ own: [1, 2, 3] }).setback).toBe(true);
    expect(resolveAction({ own: [2, 3] }).setback).toBe(false);
    expect(resolveAction({ own: [1, 4] }).setback).toBe(false);
    expect(resolveAction({ own: [1], destiny: [6] }).setback).toBe(false);
    expect(resolveAction({ own: [2], destiny: [1] }).setback).toBe(true);
  });
  it('difference = own + destiny − opposition (difficulty triumphs count 1, p.84)', () => {
    const r = resolveAction({ own: [4, 5], destiny: [6], opposition: [6, 4, 2] });
    expect(r).toMatchObject({ ownHits: 2, destinyHits: 2, oppositionHits: 2, difference: 2 });
  });
  it('p.85 conflict: the rival may apply a specialty (their triumphs count double)', () => {
    // Armand Cunning [2,2,6] vs hidden figure Subtlety+«Esconderse» [1,3,6,6] → 1 vs 4, three in favour of the rival.
    const r = resolveAction({ own: [2, 2, 6], opposition: [1, 3, 6, 6], oppositionSpecialty: true });
    expect(r).toMatchObject({ ownHits: 1, oppositionHits: 4, difference: -3 });
    expect(resolveAction({ own: [2, 2, 6], opposition: [1, 3, 6, 6] }).oppositionHits).toBe(2);
  });
});

describe('degreeKey (manual p.85)', () => {
  it('maps difference to keys', () => {
    expect(degreeKey(0)).toBe('roll.degree.ambiguous');
    expect(degreeKey(1)).toBe('roll.degree.success.1');
    expect(degreeKey(3)).toBe('roll.degree.success.3');
    expect(degreeKey(7)).toBe('roll.degree.success.absolute');
    expect(degreeKey(-2)).toBe('roll.degree.failure.2');
    expect(degreeKey(-4)).toBe('roll.degree.failure.absolute');
  });
});

describe('derived (manual p.25, p.89, p.101)', () => {
  it('endurance = fortitude + will ± size, resistance = ×3 (no cap), fortuneMax = destiny', () => {
    const d = derived(sheet());
    expect(d).toMatchObject({ endurance: 5, resistanceMax: 15, recoveryMax: 15, fortuneMax: 3, dicePenalty: 0, protection: 0, armourPenalty: 0 });
    expect(derived(sheet({ size: 'huge' })).endurance).toBe(7);
    expect(derived(sheet({ size: 'tiny', fortitude: stat(1), will: stat(1) })).endurance).toBe(1);
    expect(derived(sheet({ fortitude: stat(6), will: stat(6) })).resistanceMax).toBe(36);
    expect(derived(sheet({ destiny: 7 })).fortuneMax).toBe(7);
  });
  it('p.101 recoveryMax by health: ×3 healthy/bruised, ×2 wounded, ×1 badly wounded', () => {
    expect(derived(sheet({ health: 'bruised' })).recoveryMax).toBe(15);
    expect(derived(sheet({ health: 'wounded' })).recoveryMax).toBe(10);
    expect(derived(sheet({ health: 'badlyWounded' })).recoveryMax).toBe(5);
    expect(rest(sheet({ health: 'wounded', resistance: 2, unconscious: 'yes' }))).toEqual({ resistance: 10, unconscious: 'no' });
    expect(rest(sheet({ health: 'wounded', resistance: 12 }))).toEqual({ resistance: 12, unconscious: 'no' });
  });
  it('health level sets the dice penalty and armour sets protection/penalty', () => {
    expect(derived(sheet({ health: 'wounded' })).dicePenalty).toBe(1);
    expect(derived(sheet({ health: 'badlyWounded' })).dicePenalty).toBe(2);
    expect(derived(sheet({ armour: 'mailShirt' }))).toMatchObject({ protection: 5, armourPenalty: 3 });
  });
});

describe('poolFor', () => {
  it('builds tagged groups from stat, health penalty, extra, destiny and difficulty', () => {
    const req = poolFor(sheet({ health: 'wounded' }), { stat: 'combat', options: { extraDice: 1, destinyDice: 2, difficulty: 3, specialty: true } });
    expect(req.groups).toEqual([{ count: 4, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'destiny' }, { count: 3, sides: 6, tag: 'opposition' }]);
    expect(req.sharedResources).toEqual({ destiny: 2 });
    expect(req.options).toMatchObject({ stat: 'combat', specialty: true, destinyDice: 2, difficulty: 3 });
    expect(req.systemId).toBe('plenilunio');
  });
  it('caps destiny dice to perTakeMax and blocks them at Destiny 10; never negative own dice', () => {
    expect(poolFor(sheet(), { stat: 'combat', options: { destinyDice: 9, difficulty: 0 } }).groups[1]?.count).toBe(DESTINY_POOL.perTakeMax);
    const at10 = poolFor(sheet({ destiny: 10 }), { stat: 'combat', options: { destinyDice: 2, difficulty: 0 } });
    expect(at10.groups).toHaveLength(1);
    expect(at10.sharedResources).toBeUndefined();
    expect(poolFor(sheet({ fortitude: stat(1), health: 'badlyWounded' }), { stat: 'fortitude', options: { difficulty: 0 } }).groups[0]?.count).toBe(0);
  });
  it('reads the roll block of the sheet as defaults', () => {
    const req = poolFor(sheet({ difficulty: '5', useSpecialty: 'yes', useArmour: 'yes', armour: 'furs', extraDice: 2 }), { stat: 'will' });
    expect(req.groups).toEqual([{ count: 4, sides: 6, tag: 'own' }, { count: 5, sides: 6, tag: 'opposition' }]);
    expect(req.options).toMatchObject({ specialty: true, armourPenalty: 2 });
  });
});

describe('resolve', () => {
  it('returns degree key summary, detail numbers and destiny effects', () => {
    const req = poolFor(sheet(), { stat: 'combat', options: { destinyDice: 1, difficulty: 2 } });
    const res = resolve(req, [[6, 4, 2, 1], [6], [4, 3]], sheet());
    expect(res.detail).toMatchObject({ ownHits: 2, destinyHits: 2, oppositionHits: 1, difference: 3, destinyUp: true, setback: false });
    expect(res.summary).toBe('roll.degree.success.3');
    expect(res.effects).toMatchObject({ destinyUp: true, fortuneRefill: true, patch: { destiny: 4, fortune: 4 } });
    expect(res.total).toBe(3);
  });
  it('flags setback in summary and effects', () => {
    const req = poolFor(sheet(), { stat: 'will', options: { difficulty: 1 } });
    const res = resolve(req, [[1, 2], [4]]);
    expect(res.summary).toBe('roll.summary.setback');
    expect(res.effects).toMatchObject({ setback: true });
  });
  it('destiny patch never exceeds 10', () => {
    const req = poolFor(sheet({ destiny: 9 }), { stat: 'will', options: { destinyDice: 1, difficulty: 0 } });
    expect(resolve(req, [[2], [6]], sheet({ destiny: 9 })).effects).toMatchObject({ patch: { destiny: 10, fortune: 10 } });
  });
});

describe('attacks (manual p.97)', () => {
  const s = sheet({ weapons: [{ id: 'bat', ammo: null }, { id: 'magnum44', ammo: 2 }] });
  it('melee adds the weapon bonus dice and F+n damage; ranged does not add bonus and spends ammo', () => {
    const melee = actions.find(a => a.id === 'attack.melee')!.toRoll(s, 'bat', { difficulty: 0 });
    expect(melee.groups[0]?.count).toBe(5);
    expect(melee.options).toMatchObject({ weaponId: 'bat', weaponDamage: 4, ranged: false });
    const ranged = actions.find(a => a.id === 'attack.ranged')!.toRoll(s, 'magnum44', { difficulty: 0 });
    expect(ranged.groups[0]?.count).toBe(4);
    expect(ranged.options).toMatchObject({ weaponDamage: 7, ranged: true });
    const res = resolve(ranged, [[6, 4, 2, 2]]);
    expect(res.effects).toMatchObject({ ammoSpent: 'magnum44' });
    expect(res.detail?.damage).toBe(8);
  });
  it('opposition cancels successes before triumphs', () => {
    const o = resolveAction({ own: [6, 4, 4], opposition: [4, 4] });
    expect(attackDamage(o, 3)).toBe(3);
    expect(attackDamage(resolveAction({ own: [6, 4], opposition: [4, 4] }), 3)).toBe(0);
  });
  it('p.97 doubled triumphs deal twice the weapon damage and may be half-cancelled', () => {
    // Armand unarmed (F3) with «Artes marciales» rolls [5,6] vs mutant [2,3,4]: the success is cancelled, the doubled triumph deals 2×3 = 6.
    expect(attackDamage(resolveAction({ own: [5, 6], opposition: [2, 3, 4], specialty: true }), 3)).toBe(6);
    // Half-cancelled doubled triumph = plain weapon damage.
    expect(attackDamage(resolveAction({ own: [6], opposition: [4], specialty: true }), 3)).toBe(3);
    // Destiny-die triumphs are always doubled.
    expect(attackDamage(resolveAction({ own: [2], destiny: [6] }), 4)).toBe(8);
    // Without specialty a triumph is a single unit.
    expect(attackDamage(resolveAction({ own: [6, 6], opposition: [4] }), 3)).toBe(3);
  });
  it('p.96 ranged attack takes the difficulty of the range when none is given', () => {
    const req = actions.find(a => a.id === 'attack.ranged')!.toRoll(s, 'magnum44', { range: 'long' });
    expect(req.groups.find(g => g.tag === 'opposition')?.count).toBe(5);
    const explicit = actions.find(a => a.id === 'attack.ranged')!.toRoll(s, 'magnum44', { range: 'long', difficulty: 1 });
    expect(explicit.groups.find(g => g.tag === 'opposition')?.count).toBe(1);
  });
  it('spendAmmo / reload', () => {
    expect(spendAmmo(s, 'magnum44')).toMatchObject({ weapons: [{ id: 'bat', ammo: null }, { id: 'magnum44', ammo: 1 }] });
    expect(spendAmmo(s, 'bat')).toBeNull();
    expect(spendAmmo(sheet({ weapons: [{ id: 'magnum44', ammo: 0 }] }), 'magnum44')).toBeNull();
    expect(reload(s, 'magnum44')).toMatchObject({ weapons: [{ id: 'bat', ammo: null }, { id: 'magnum44', ammo: 6 }] });
    expect(reload(s, 'bat')).toBeNull();
  });
  it('gift activation rolls the given stat and marks the fortune cost', () => {
    const req = actions.find(a => a.id === 'gift.activate')!.toRoll(s, 'titanFury', { stat: 'fortitude', difficulty: 0 });
    expect(req.title).toBe('catalog.gifts.titanFury.name');
    expect(resolve(req, [[4, 4, 4]]).effects).toMatchObject({ fortuneSpent: 1 });
  });
});

describe('applyDamage (manual p.98–100)', () => {
  it('protection subtracts, boxes go down, each multiple of endurance marks a level', () => {
    const s = sheet({ armour: 'leatherJacket' }); // endurance 5, protection 1
    expect(applyDamage(s, 3)).toEqual({ resistance: 13, health: 'healthy' });
    expect(applyDamage(s, 6)).toEqual({ resistance: 10, health: 'bruised' });
    expect(applyDamage(s, 11)).toEqual({ resistance: 5, health: 'wounded' });
    expect(applyDamage(s, 40)).toEqual({ resistance: 0, health: 'dead', unconscious: 'yes' });
  });
  it('accumulates from the current level and stops at dead', () => {
    expect(applyDamage(sheet({ health: 'wounded' }), 5)).toEqual({ resistance: 10, health: 'badlyWounded' });
    expect(applyDamage(sheet({ health: 'badlyWounded' }), 10)).toEqual({ resistance: 5, health: 'dead' });
    expect(applyDamage(sheet({ health: 'dead' }), 1)).toEqual({ resistance: 14, health: 'dead' });
  });
  it('p.100 mutant example: 6 damage − 2 protection = 4 ≥ endurance 4 → bruised, 4 boxes', () => {
    const mutant = sheet({ fortitude: stat(3), will: stat(1), resistance: 12, armour: 'leatherArmour' }); // protection 2 stands in for its hide
    expect(applyDamage(mutant, 6)).toEqual({ resistance: 8, health: 'bruised' });
  });
  it('p.98 dropping below zero Resistance leaves the character unconscious', () => {
    expect(applyDamage(sheet({ resistance: 2 }), 3)).toEqual({ resistance: 0, health: 'healthy', unconscious: 'yes' });
    expect(applyDamage(sheet({ resistance: 3 }), 3)).toEqual({ resistance: 0, health: 'healthy' });
  });
  it('p.89 Fortune lowers wound severity one level per point; Resistance is still lost', () => {
    expect(applyDamage(sheet({ fortune: 3 }), 10, 1)).toEqual({ resistance: 5, health: 'bruised', fortune: 2 });
    expect(applyDamage(sheet({ fortune: 3 }), 10, 2)).toEqual({ resistance: 5, health: 'healthy', fortune: 1 });
  });
  it('p.89 catchBreath: 1 Fortune restores half the lost Resistance', () => {
    expect(catchBreath(sheet({ resistance: 5, fortune: 2 }))).toEqual({ fortune: 1, resistance: 10 });
    expect(catchBreath(sheet({ resistance: 4, fortune: 2 }))).toEqual({ fortune: 1, resistance: 9 });
    expect(catchBreath(sheet({ resistance: 4, fortune: 0 }))).toBeNull();
  });
});

describe('progression (manual p.91)', () => {
  const s = sheet({ xp: 50, fortitude: stat(3, ['fortitude.vigour']), will: stat(5), combat: stat(6, []), gifts: [{ id: 'titanFury', level: 1 }, { id: 'serendipity', level: 5 }] });
  it('costs', () => {
    expect(progressionCost(s, { kind: 'stat', target: 'fortitude' })).toBe(XP_COSTS.statTo5);
    expect(progressionCost(s, { kind: 'stat', target: 'will' })).toBe(XP_COSTS.statTo6);
    expect(progressionCost(s, { kind: 'stat', target: 'combat' })).toBeNull();
    expect(STAT_MAX).toBe(6);
    expect(progressionCost(sheet({ preset: 'mythic', cunning: stat(8) }), { kind: 'stat', target: 'cunning' })).toBeNull();
    expect(progressionCost(s, { kind: 'stat', target: 'nope' })).toBeNull();
    expect(progressionCost(s, { kind: 'specialty.new', target: 'fortitude', to: 'fortitude.climbing' })).toBe(10);
    expect(progressionCost(s, { kind: 'specialty.new', target: 'fortitude', to: 'fortitude.vigour' })).toBeNull();
    expect(progressionCost(s, { kind: 'specialty.change', target: 'fortitude', to: 'fortitude.climbing' })).toBe(3);
    expect(progressionCost(s, { kind: 'specialty.change', target: 'combat', to: 'combat.swords' })).toBeNull();
    expect(progressionCost(s, { kind: 'gift.new', target: 'innerVoice' })).toBe(10);
    expect(progressionCost(s, { kind: 'gift.new', target: 'titanFury' })).toBeNull();
    expect(progressionCost(s, { kind: 'gift.new', target: 'notAGift' })).toBeNull();
    expect(progressionCost(s, { kind: 'gift.level', target: 'titanFury' })).toBe(10);
    expect(progressionCost(s, { kind: 'gift.level', target: 'serendipity' })).toBeNull();
    expect(progressionCost(s, { kind: 'weird', target: 'x' })).toBeNull();
  });
  it('apply debits xp and patches; refuses when unaffordable', () => {
    expect(progressionApply(s, { kind: 'stat', target: 'will' })).toEqual({ xp: 10, will: { value: 6, specialties: [] } });
    expect(progressionApply(s, { kind: 'specialty.new', target: 'fortitude', to: 'fortitude.climbing' })).toEqual({ xp: 40, fortitude: { value: 3, specialties: ['fortitude.vigour', 'fortitude.climbing'] } });
    expect(progressionApply(s, { kind: 'specialty.change', target: 'fortitude', to: 'fortitude.climbing' })).toEqual({ xp: 47, fortitude: { value: 3, specialties: ['fortitude.climbing'] } });
    expect(progressionApply(s, { kind: 'gift.new', target: 'innerVoice' }).gifts).toHaveLength(3);
    expect(progressionApply(s, { kind: 'gift.level', target: 'titanFury' }).gifts).toEqual([{ id: 'titanFury', level: 2 }, { id: 'serendipity', level: 5 }]);
    expect(progressionApply(sheet({ xp: 5 }), { kind: 'stat', target: 'will' })).toEqual({});
    expect(engine.progression.cost(s, { kind: 'stat', target: 'combat' })).toBeNull();
  });
});

describe('shared resources', () => {
  it('destiny pool 10 / 5 per take, blocked at Destiny 10', () => {
    const d = sharedResources[0]!;
    expect(d).toMatchObject({ id: 'destiny', max: 10, initial: 10, perTakeMax: 5, whoCanTake: 'player', whoCanReset: 'dm' });
    expect(d.blockedIf?.(sheet({ destiny: 10 }))).toBe('roll.destinyBlocked');
    expect(d.blockedIf?.(sheet({ destiny: 4 }))).toBeNull();
  });
});

describe('generator budgets', () => {
  const draft = (over: SheetData = {}) => ({ ...newSheet(), ...over });
  it.each([
    ['human', 16, 5], ['standard', 21, 5], ['legendary', 25, 6], ['mythic', 30, 10],
  ])('p.21 creation presets · %s: %i points, max %i', (preset, points, max) => {
    const b = budgetOf(draft({ preset }));
    expect(b.total).toBe(points);
    expect(b.maxStat).toBe(max);
    expect(b.available).toBe(points - 7); // seven stats at 1
    expect(b.giftPoints).toBe(3);
  });
  it('destiny +1 costs a point, −1 refunds; trades cost points and give 2 specialties / 2 gift points', () => {
    expect(budgetOf(draft({ destiny: 5 })).available).toBe(21 - 7 - 2);
    expect(budgetOf(draft({ destiny: 1 })).available).toBe(21 - 7 + 2);
    expect(budgetOf(draft({ specialtyTrade: 2, giftTrade: 1 }))).toMatchObject({ available: 21 - 7 - 3, giftPoints: 5 });
  });
  it('stats step advances only when the budget is exactly spent and within max', () => {
    const stats = generator.find(s => s.id === 'stats')!;
    expect(stats.canAdvance(draft())).toBe('generator.error.pointsLeft');
    const full = draft({ fortitude: stat(5), combat: stat(5), will: stat(5), cunning: stat(3) }); // 5+5+5+3+1+1+1 = 21
    expect(stats.canAdvance(full)).toBeNull();
    expect(stats.canAdvance({ ...full, culture: stat(2) })).toBe('generator.error.pointsOver');
    expect(stats.budget?.(full)).toMatchObject({ remaining: 0 });
    expect(canAdjustStat(full, 'culture', 1)).toBe(false);
    expect(canAdjustStat(draft(), 'culture', 1)).toBe(true);
    expect(canAdjustStat(draft({ fortitude: stat(5) }), 'fortitude', 1)).toBe(false);
    expect(canAdjustStat(draft({ preset: 'legendary', fortitude: stat(5) }), 'fortitude', 1)).toBe(true);
    expect(canAdjustStat(draft({ preset: 'mythic', fortitude: stat(9) }), 'fortitude', 1)).toBe(true);
    expect(canAdjustStat(draft({ preset: 'mythic', fortitude: stat(10) }), 'fortitude', 1)).toBe(false);
    expect(canAdjustStat(draft(), 'fortitude', -1)).toBe(false);
  });
  it('p.21 applyChange caps a stat at the preset maximum even while points remain', () => {
    const stats = generator.find(s => s.id === 'stats')!;
    expect(stats.applyChange).toBeDefined();
    // The budget alone would allow this: 7+1+1+1+1+1+1 = 13 of 21 points still fits.
    expect(stats.applyChange!(draft(), 'fortitude', stat(7))).toBeNull();
    expect(stats.applyChange!(draft(), 'fortitude', stat(5))).toEqual({ fortitude: stat(5) });
    expect(stats.applyChange!(draft(), 'fortitude', stat(0))).toBeNull();
    expect(stats.applyChange!(draft({ preset: 'mythic' }), 'fortitude', stat(7))).toEqual({ fortitude: stat(7) });
    // The state the owner actually reached on 2026-08-18 must now be unreachable.
    const over = draft({ fortitude: stat(7), combat: stat(3), will: stat(3), cunning: stat(2), subtlety: stat(2), presence: stat(2), culture: stat(2) });
    expect(stats.canAdvance(over)).toBe('generator.error.statOutOfRange');
    expect(stats.applyChange!(draft({ combat: stat(3) }), 'fortitude', stat(7))).toBeNull();
  });
  it('p.21 lowering the preset re-clamps every stat instead of stranding the draft', () => {
    const stats = generator.find(s => s.id === 'stats')!;
    const mythic = draft({ preset: 'mythic', fortitude: stat(10, ['Vigor']), combat: stat(6), will: stat(2) });
    const patch = stats.applyChange!(mythic, 'preset', 'standard');
    expect(patch).toEqual({ preset: 'standard', fortitude: stat(5, ['Vigor']), combat: stat(5) });
    // Specialties survive the clamp, and stats already within the new ceiling are left alone.
    expect(patch).not.toHaveProperty('will');
    const after = { ...mythic, ...patch } as SheetData;
    expect(budgetOf(after)).toMatchObject({ total: 21, maxStat: 5 });
    expect(stats.canAdvance(after)).toBe('generator.error.pointsLeft'); // actionable, not a dead end
    expect(stats.applyChange!(draft(), 'preset', 'legendary')).toEqual({ preset: 'legendary' });
  });
  it('specialty, destiny, gift and concept steps validate', () => {
    const by = (id: string) => generator.find(s => s.id === id)!;
    expect(by('concept').canAdvance(draft())).toBe('generator.error.nameAndConcept');
    expect(by('concept').canAdvance(draft({ name: 'K', concept: 'Leader' }))).toBeNull();
    expect(by('specialties').canAdvance(draft())).toBe('generator.error.specialtyEach');
    const withSpecs = draft(Object.fromEntries(['fortitude', 'combat', 'will', 'cunning', 'subtlety', 'presence', 'culture'].map(s => [s, stat(1, [`${s}.x`])])));
    expect(by('specialties').canAdvance(withSpecs)).toBeNull();
    expect(by('specialties').canAdvance({ ...withSpecs, fortitude: stat(1, ['a', 'b']) })).toBe('generator.error.tooManySpecialties');
    expect(by('specialties').canAdvance({ ...withSpecs, specialtyTrade: 1, fortitude: stat(1, ['a', 'b']), combat: stat(1, ['c', 'd']) })).toBeNull();
    expect(by('specialties').canAdvance({ ...withSpecs, specialtyTrade: 1, fortitude: stat(1, ['a', 'b', 'c']) })).toBe('generator.error.extraSpecialtiesSpread');
    expect(by('destiny').canAdvance(draft({ destiny: 6 }))).toBe('generator.error.destinyRange');
    expect(by('destiny').canAdvance(draft({ destiny: 5 }))).toBeNull();
    expect(by('gifts').canAdvance(draft())).toBe('generator.error.giftPointsLeft');
    expect(by('gifts').canAdvance(draft({ gifts: [{ id: 'titanFury', level: 3 }] }))).toBeNull();
    expect(by('gifts').canAdvance(draft({ gifts: [{ id: 'titanFury', level: 4 }] }))).toBe('generator.error.giftPointsOver');
    expect(by('gifts').budget?.(draft({ gifts: [{ id: 'titanFury', level: 1 }] }))).toMatchObject({ remaining: 2 });
  });
  /**
   * Los tres fallos que el dueño vio en el paso de Dones el 2026-08-19: el canje que no comprueba
   * que puedas pagarlo (y deja el paso sin salida), el mismo don repetido, y el contador ilegible.
   */
  it('el canje de dones sólo llega hasta donde alcanzan los puntos de creación', () => {
    const gifts = generator.find(s => s.id === 'gifts')!;
    // reparto estándar: 21 puntos, 7 características a 1 = 7 gastados, quedan 14 para canjear
    const base = draft();
    expect(budgetOf(base).available).toBe(14);
    expect(gifts.applyChange!(base, 'giftTrade', 14)).toEqual({ giftTrade: 14 });
    expect(gifts.applyChange!(base, 'giftTrade', 15)).toBeNull();   // un punto más de los que hay
    expect(gifts.applyChange!(base, 'giftTrade', -1)).toBeNull();
    // y con el canje ya puesto, el tope sigue siendo «lo que cuesta hoy + lo que queda»
    const traded = draft({ giftTrade: 10 });
    expect(budgetOf(traded).available).toBe(4);
    expect(gifts.applyChange!(traded, 'giftTrade', 14)).toEqual({ giftTrade: 14 });
    expect(gifts.applyChange!(traded, 'giftTrade', 15)).toBeNull();
    expect(gifts.applyChange!(traded, 'giftTrade', 9)).toEqual({ giftTrade: 9 });   // bajar siempre se puede
  });
  /**
   * Review 2026-08-19: «bajar siempre se puede» tiene que valer TAMBIÉN con el borrador en rojo, que es
   * justo cuando hace falta. Con el techo mirando sólo «lo que cuesta hoy + lo que queda», un borrador
   * sobregastado desactivaba el «−» del canje y no se salía de ahí — la misma trampa que `budgetAllows`
   * evita en los pasos que enseñan el presupuesto de creación.
   */
  it('un canje que ya no se puede pagar se puede deshacer de uno en uno', () => {
    const gifts = generator.find(s => s.id === 'gifts')!;
    const over = draft({ giftTrade: 20 });   // 14 pagables, 20 canjeados: 6 en rojo
    expect(budgetOf(over).available).toBe(-6);
    expect(gifts.applyChange!(over, 'giftTrade', 19)).toEqual({ giftTrade: 19 });   // el «−» sigue vivo
    expect(gifts.applyChange!(over, 'giftTrade', 0)).toEqual({ giftTrade: 0 });
    expect(gifts.applyChange!(over, 'giftTrade', 21)).toBeNull();                   // subir, ni un punto más
  });
  it('un paso con los puntos de creación en rojo señala el canje, no el reparto de dones', () => {
    const gifts = generator.find(s => s.id === 'gifts')!;
    // Sólo se llega con una ficha guardada a mano: por el asistente los cinco sumandos están vetados
    // (preset/características/especialidades/Destino por `budgetAllows`, el canje por `applyGiftChange`).
    const over = draft({ giftTrade: 20 });
    expect(budgetOf(over).available).toBeLessThan(0);
    expect(gifts.canAdvance(over)).toBe('generator.error.pointsOver');
  });
  it('el mismo don no se puede coger dos veces: es nivel 6 por la puerta de atrás', () => {
    const gifts = generator.find(s => s.id === 'gifts')!;
    const dup = draft({ gifts: [{ id: 'titanFury', level: 2 }, { id: 'titanFury', level: 1 }] });
    expect(gifts.canAdvance(dup)).toBe('generator.error.giftDuplicate');
    expect(gifts.applyChange!(draft({ gifts: [{ id: 'titanFury', level: 1 }] }), 'gifts',
      [{ id: 'titanFury', level: 1 }, { id: 'titanFury', level: 1 }])).toBeNull();
    expect(gifts.applyChange!(draft({ gifts: [{ id: 'titanFury', level: 1 }] }), 'gifts',
      [{ id: 'titanFury', level: 1 }, { id: 'catlike', level: 1 }])).toEqual({ gifts: [{ id: 'titanFury', level: 1 }, { id: 'catlike', level: 1 }] });
  });
  it('el contador del paso dice total/gastados, igual que los pasos de puntos', () => {
    const gifts = generator.find(s => s.id === 'gifts')!;
    expect(gifts.budget?.(draft({ gifts: [{ id: 'titanFury', level: 1 }] }))).toMatchObject({ remaining: 2, detail: '3/1' });
  });
  /**
   * Dueño 2026-08-19: «en especialidades me deja elegir todo lo que quiera y después no me deja
   * avanzar». Las reglas están en RULES.md §1.3 (p.21–22) y ahora se aplican AL ELEGIR.
   */
  it('las especialidades se topan al elegir, no al pulsar Continuar', () => {
    const spec = generator.find(s => s.id === 'specialties')!;
    const one = (over: SheetData = {}) => draft({ presence: stat(1, ['presence.poetry']), ...over });
    // sin canjes: una por característica y ni una más
    expect(spec.applyChange!(one(), 'presence', stat(1, ['presence.poetry', 'presence.empathy']))).toBeNull();
    // un canje: 2 extra, así que hasta 2 en la misma característica…
    const traded = one({ specialtyTrade: 1 });
    expect(spec.applyChange!(traded, 'presence', stat(1, ['presence.poetry', 'presence.empathy']))).toMatchObject({ presence: expect.anything() });
    // …pero no 3, que es lo que pasaría de «1 + canjes»
    expect(spec.applyChange!(traded, 'presence', stat(1, ['presence.poetry', 'presence.empathy', 'presence.humour']))).toBeNull();
    // y el total no pasa de 2 por canje aunque se reparta entre características distintas
    const spread = draft({ specialtyTrade: 1, presence: stat(1, ['presence.poetry', 'presence.empathy']), combat: stat(1, ['combat.martialArts', 'combat.swords']) });
    expect(spec.applyChange!(spread, 'culture', stat(1, ['culture.art', 'culture.history']))).toBeNull();
    // quitar siempre se puede
    expect(spec.applyChange!(traded, 'presence', stat(1, []))).toMatchObject({ presence: expect.anything() });
  });
  /**
   * QA 2026-08-19: «quitar siempre se puede» hay que probarlo con el borrador YA por encima del cupo,
   * que es justo cuando hace falta — la prueba de arriba sólo lo mira estando dentro. Se llega bajando
   * `specialtyTrade` después de repartir las extra (bajar el canje devuelve puntos, así que nada lo veta),
   * y con el techo mirando sólo el cupo se quedaban muertos la ×, el desplegable y hasta el −/+ de la
   * característica: la misma trampa que el Review ya cazó en el techo del canje de dones.
   */
  it('un borrador ya por encima del cupo de especialidades se puede reparar', () => {
    const spec = generator.find(s => s.id === 'specialties')!;
    // una por característica (si no, salta `specialtyEach` antes que el cupo) y dos de más repartidas
    const one = Object.fromEntries(STAT_IDS.map(id => [id, stat(1, [`${id}.a`])]));
    const over = draft({ ...one, specialtyTrade: 0, presence: stat(1, ['presence.poetry', 'presence.empathy']), combat: stat(1, ['combat.swords', 'combat.martialArts']) });
    expect(spec.canAdvance(over)).toBe('generator.error.tooManySpecialties');
    // quitar la de más: baja el exceso, así que pasa aunque siga por encima del cupo
    expect(spec.applyChange!(over, 'presence', stat(1, ['presence.poetry']))).toMatchObject({ presence: stat(1, ['presence.poetry']) });
    // cambiar CUÁL, sin tocar cuántas, tampoco empeora nada
    expect(spec.applyChange!(over, 'presence', stat(1, ['presence.poetry', 'presence.humour']))).toMatchObject({ presence: expect.anything() });
    // y el −/+ de la característica sigue vivo: el cupo es de especialidades, no de puntos
    expect(spec.applyChange!(over, 'presence', stat(2, ['presence.poetry', 'presence.empathy']))).toMatchObject({ presence: stat(2, ['presence.poetry', 'presence.empathy']) });
    // subir sí sigue vetado: reparar no es una puerta trasera para añadir más
    expect(spec.applyChange!(over, 'presence', stat(1, ['presence.poetry', 'presence.empathy', 'presence.humour']))).toBeNull();
    expect(spec.applyChange!(over, 'culture', stat(1, ['culture.art', 'culture.history']))).toBeNull();
    // dos pasos y el paso vuelve a dejar avanzar
    const fixed = draft({ ...over, presence: stat(1, ['presence.poetry']), combat: stat(1, ['combat.swords']) });
    expect(spec.canAdvance(fixed)).toBeNull();
  });
  it('el Destino se topa en 1–5 al crear, aunque la ficha llegue a 10 en juego (RULES.md §1.4)', () => {
    const d = generator.find(s => s.id === 'destiny')!;
    expect(d.applyChange!(draft(), 'destiny', 5)).toEqual({ destiny: 5 });
    expect(d.applyChange!(draft(), 'destiny', 6)).toBeNull();
    expect(d.applyChange!(draft(), 'destiny', 1)).toEqual({ destiny: 1 });
    expect(d.applyChange!(draft(), 'destiny', 0)).toBeNull();
    // un borrador que ya venga fuera de rango se repara: sólo se capa la subida
    expect(d.applyChange!(draft({ destiny: 8 }), 'destiny', 7)).toEqual({ destiny: 7 });
    expect(d.applyChange!(draft({ destiny: 8 }), 'destiny', 9)).toBeNull();
  });
  it('finalizeDraft sets fortune = destiny and full resistance', () => {
    const f = finalizeDraft(draft({ destiny: 4, fortitude: stat(3), will: stat(3) }));
    expect(f).toMatchObject({ fortune: 4, resistance: 18, health: 'healthy', xp: 0 });
  });
});
