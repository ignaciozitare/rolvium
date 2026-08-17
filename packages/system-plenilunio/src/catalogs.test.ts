import { describe, expect, it } from 'vitest';
import { ARMOURS, BESTIARY, GIFTS, GIFT_IDS, SPECIALTIES, SPECIALTY_ITEMS, STAT_IDS, WEAPONS, catalogs, isMelee, specialtiesFor, weaponById } from './catalogs';
import { references } from './references';
import { lookup, messages } from './locales';

const resolves = (key: string) => { for (const loc of ['es', 'en'] as const) expect(lookup(messages[loc], key), `${loc}:${key}`).toBeTruthy(); };

describe('catalogs', () => {
  it('has 27 gifts with name and summary in both locales', () => {
    expect(GIFT_IDS).toHaveLength(27);
    expect(GIFTS).toHaveLength(27);
    expect(new Set(GIFT_IDS).size).toBe(27);
    for (const g of GIFTS) { resolves(g.label); resolves(String(g.data?.summary)); }
  });
  it('weapons: 20 entries, melee/ranged split, F+n vs fixed damage, ammo', () => {
    expect(WEAPONS).toHaveLength(20);
    const melee = WEAPONS.filter(w => isMelee(w.data));
    expect(melee).toHaveLength(9);
    expect(WEAPONS.length - melee.length).toBe(11);
    expect(weaponById('bat')?.data).toEqual({ bonus: 1, damage: 1, strength: true, range: 'melee', magazine: null });
    expect(weaponById('magnum44')?.data).toEqual({ bonus: 1, damage: 7, strength: false, range: 'medium', magazine: 6 });
    expect(weaponById('crossbow')?.data.strength).toBe(false);
    expect(weaponById('nope')).toBeNull();
    for (const w of WEAPONS) resolves(w.label);
  });
  it('armours: 10 entries with protection/penalty', () => {
    expect(ARMOURS).toHaveLength(10);
    expect(ARMOURS.find(a => a.id === 'bulletproofVest')?.data).toEqual({ protection: 6, penalty: 2 });
    for (const a of ARMOURS) resolves(a.label);
  });
  it('specialties per stat with labels in both locales', () => {
    expect(Object.keys(SPECIALTIES)).toEqual([...STAT_IDS]);
    expect(SPECIALTIES.fortitude).toHaveLength(14);
    expect(SPECIALTIES.combat).toHaveLength(18);
    expect(specialtiesFor('culture')).toHaveLength(15);
    for (const s of SPECIALTY_ITEMS) resolves(s.label);
  });
  it('bestiary base entries', () => {
    expect(BESTIARY.map(b => b.id)).toEqual(['mutant', 'loner', 'ogre', 'scavenger']);
    for (const b of BESTIARY) { resolves(b.label); resolves(b.data.notes); }
  });
  it('every catalog label and every reference resolves in es and en', () => {
    for (const items of Object.values(catalogs)) for (const it of items) { resolves(it.label); if (it.ref) expect(references[it.ref], it.ref).toBeDefined(); }
    for (const [key, r] of Object.entries(references)) { expect(r.page).toBeGreaterThan(0); resolves(r.title); resolves(r.summary); expect(r.title).toBe(`ref.${key}.title`); }
  });
});
