import { describe, expect, it } from 'vitest';
import { ARMOURS, BESTIARY, DIFFICULTIES, GIFTS, GIFT_IDS, RANGE_DIFFICULTY, RECOVERY, SIZES, SPECIALTIES, SPECIALTY_ITEMS, STAT_IDS, WEAPONS, catalogs, isMelee, specialtiesFor, weaponById } from './catalogs';
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
  it('p.21–22 specialties per stat (19/21/18/21/16/16/16) with labels in both locales', () => {
    expect(Object.keys(SPECIALTIES)).toEqual([...STAT_IDS]);
    expect(STAT_IDS.map(s => SPECIALTIES[s].length)).toEqual([19, 21, 18, 21, 16, 16, 16]);
    expect(specialtiesFor('culture')).toHaveLength(16);
    expect(SPECIALTIES.combat).toContain('nets');
    for (const s of SPECIALTY_ITEMS) resolves(s.label);
  });
  it('p.97 weapons table values', () => {
    const t = Object.fromEntries(WEAPONS.map(w => [w.id, [w.data.bonus, w.data.damage, w.data.strength, w.data.range, w.data.magazine]]));
    expect(t.unarmed).toEqual([0, 0, true, 'melee', null]);
    expect(t.swordSpear).toEqual([1, 2, true, 'melee', null]);
    expect(t.maceAxe).toEqual([0, 3, true, 'melee', null]);
    expect(t.greatsword).toEqual([2, 3, true, 'melee', null]);
    expect(t.twoHandedAxe).toEqual([1, 4, true, 'melee', null]);
    expect(t.compoundBow).toEqual([0, 3, true, 'long', 1]);
    expect(t.crossbow).toEqual([0, 5, false, 'medium', 1]);
    expect(t.pistol9mm).toEqual([1, 6, false, 'medium', 15]);
    expect(t.shotgun10).toEqual([1, 10, false, 'medium', 5]);
    expect(t.shotgun12).toEqual([1, 9, false, 'medium', 5]);
    expect(t.assaultRifle).toEqual([1, 8, false, 'long', 30]);
    expect(t.sniperRifle).toEqual([0, 10, false, 'veryLong', 15]);
    expect(t.grenades).toEqual([0, 8, false, 'short', 1]);
  });
  it('p.98 armours table values', () => {
    expect(Object.fromEntries(ARMOURS.map(a => [a.id, [a.data.protection, a.data.penalty]]))).toEqual({
      none: [0, 0], leatherJacket: [1, 1], leatherArmour: [2, 1], breastplate: [3, 1], furs: [3, 2], mailShirt: [5, 3], bulletproofVest: [6, 2],
      smallShield: [1, 0], largeShield: [2, 1], riotShield: [3, 2],
    });
  });
  it('p.25 sizes, p.84 difficulties, p.96 range difficulties, p.101 recovery table', () => {
    expect(SIZES.map(s => s.mod)).toEqual([-2, -1, 0, 1, 2]);
    expect(DIFFICULTIES.map(d => d.value)).toEqual([1, 2, 3, 5, 6]);
    expect(RANGE_DIFFICULTY).toEqual({ short: 2, medium: 3, long: 5, veryLong: 6 });
    expect(RECOVERY.bruised).toEqual({ days: 1, difficulty: 2, restFactor: 3 });
    expect(RECOVERY.wounded).toEqual({ days: 7, difficulty: 3, restFactor: 2 });
    expect(RECOVERY.badlyWounded).toEqual({ days: 14, difficulty: 4, restFactor: 1 });
  });
  /**
   * El bestiario son BLOQUES DEL MANUAL copiados uno a uno, no plantillas nuestras: el director tiene que poder
   * coger un encuentro y tirar por él (dueño, 2026-08-20). Antes había cuatro entradas con sólo Resistencia y
   * protección —y dos, `loner` y `scavenger`, inventadas—, así que no se podía tirar nada.
   */
  it('cada criatura trae el bloque del manual: siete características, Aguante, Destino y página', () => {
    expect(BESTIARY.length).toBeGreaterThanOrEqual(16);
    for (const b of BESTIARY) {
      resolves(b.label); resolves(b.data.notes);
      expect(b.data.page, b.id).toBeGreaterThan(0);
      expect(b.data.resistance, b.id).toBe(b.data.endurance * 3);   // Resistencia = Aguante × 3 (p.25)
      expect(b.data.destiny, b.id).toBeGreaterThanOrEqual(0);
      for (const [k, v] of Object.entries(b.data.stats)) expect(v, `${b.id}.${k}`).toBeGreaterThanOrEqual(0);
    }
    // Ogro p.152: Fortaleza 8, Combate 4, Aguante 10 → Resistencia 30; su Piel gruesa 3 es protección 3 (p.108).
    expect(BESTIARY.find(b => b.id === 'ogre')?.data).toMatchObject({ endurance: 10, resistance: 30, protection: 3, page: 152 });
    expect(BESTIARY.find(b => b.id === 'ogre')?.data.stats).toMatchObject({ fortitude: 8, combat: 4 });
    // Hambriento p.150.
    expect(BESTIARY.find(b => b.id === 'hungry')?.data.stats).toMatchObject({ fortitude: 3, combat: 3, cunning: 4 });
    // Del mutante el libro sólo publica tres características: las demás NO se inventan.
    const mutant = BESTIARY.find(b => b.id === 'mutant')!;
    expect(mutant.data).toMatchObject({ endurance: 4, resistance: 12, protection: 2 });
    expect(Object.keys(mutant.data.stats).sort()).toEqual(['combat', 'fortitude', 'will']);
    // El fantasma no tiene cuerpo: Fortaleza y Combate a 0, y Aguante 0 (p.149).
    expect(BESTIARY.find(b => b.id === 'ghost')?.data).toMatchObject({ endurance: 0, resistance: 0, destiny: 10 });
  });
  it('every catalog label and every reference resolves in es and en', () => {
    for (const items of Object.values(catalogs)) for (const it of items) { resolves(it.label); if (it.ref) expect(references[it.ref], it.ref).toBeDefined(); }
    for (const [key, r] of Object.entries(references)) { expect(r.page).toBeGreaterThan(0); resolves(r.title); resolves(r.summary); expect(r.title).toBe(`ref.${key}.title`); }
  });
  it('reference pages match RULES.md §9', () => {
    const pages = Object.fromEntries(Object.entries(references).map(([k, r]) => [k, r.page]));
    expect(pages).toEqual({
      stats: 20, specialty: 83, roll: 82, difficulty: 84, degree: 85, setback: 86, destinyPool: 88, destiny: 88, fortune: 89,
      endurance: 98, resistance: 98, health: 99, damage: 97, weapons: 97, armours: 98, recovery: 101, gifts: 102, xp: 91, size: 25,
      bestiary: 107,
    });
  });
});
