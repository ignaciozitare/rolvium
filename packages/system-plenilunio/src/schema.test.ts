import { describe, expect, it } from 'vitest';
import { defaultFor, fieldById, newSheet, sections, sheetSchema, storedFields, statOf } from './schema';
import { STAT_IDS } from './catalogs';
import { lookup, messages } from './locales';

describe('sheetSchema', () => {
  it('has the expected sections and field types', () => {
    expect(sheetSchema.version).toBe('1');
    // El orden es decisión de pantalla, no capricho: Armas va a todo el ancho en su propia tarjeta y
    // Dones · Equipo · Armadura quedan una al lado de otra debajo (dueño 2026-08-19, rolvium.pen).
    // Por eso `armour` baja detrás de `equipment` y deja de ser `row`, que la marcaba como ancha.
    expect(sections.map(s => s.id)).toEqual(['identity', 'roll', 'stats', 'state', 'weapons', 'gifts', 'equipment', 'armour', 'story', 'creation']);
    expect(sections.find(s => s.id === 'armour')?.layout).toBe('stack');
    // Ninguna sección usa `span` hoy: ensanchar Estado a dos columnas dejó un vacío enorme debajo.
    expect(sections.filter(s => s.span).map(s => s.id)).toEqual([]);
    for (const id of STAT_IDS) expect(fieldById(id)).toMatchObject({ type: 'stat', action: 'roll', min: 1, max: 10 });
    expect(fieldById('weapons')).toMatchObject({ type: 'table', action: 'attack' });
    expect(fieldById('gifts')).toMatchObject({ type: 'list', action: 'gift.activate' });
    expect(fieldById('health')?.options?.map(o => o.value)).toEqual(['healthy', 'bruised', 'wounded', 'badlyWounded', 'dead']);
  });
  it('marks derived fields', () => {
    for (const id of ['endurance', 'resistanceMax', 'recoveryMax', 'fortuneMax', 'dicePenalty', 'protection', 'armourPenalty', 'giftPoints']) expect(fieldById(id)?.derived).toBe(true);
    expect(fieldById('resistance')?.derived).toBeFalsy();
  });
  it('every field label and option label resolves in es and en', () => {
    for (const f of sections.flatMap(s => s.fields)) {
      for (const loc of ['es', 'en'] as const) {
        expect(lookup(messages[loc], f.label), `${loc}:${f.label}`).toBeTruthy();
        for (const o of f.options ?? []) expect(lookup(messages[loc], o.label), `${loc}:${o.label}`).toBeTruthy();
      }
    }
  });
});

describe('newSheet', () => {
  it('contains every stored field with a default and no derived field', () => {
    const s = newSheet();
    for (const f of storedFields()) expect(s, f.id).toHaveProperty(f.id);
    for (const f of sections.flatMap(x => x.fields).filter(x => x.derived)) expect(s).not.toHaveProperty(f.id);
    expect(Object.keys(s)).toHaveLength(storedFields().length);
  });
  it('defaults follow the rules: destiny 3, fortune 3, healthy, medium size, no armour, stats at 1', () => {
    const s = newSheet();
    expect(s).toMatchObject({ destiny: 3, fortune: 3, health: 'healthy', size: 'medium', armour: 'none', difficulty: '2', useSpecialty: 'no', unconscious: 'no', extraDice: 0, xp: 0, weapons: [], gifts: [], equipment: [], story: '', preset: 'standard' });
    for (const id of STAT_IDS) expect(statOf(s, id)).toEqual({ value: 1, specialties: [] });
  });
  it('defaultFor is total over field types', () => {
    expect(defaultFor({ id: 'x', type: 'counter', label: 'l', min: 2 })).toBe(2);
    expect(defaultFor({ id: 'x', type: 'select', label: 'l' })).toBe('');
    expect(defaultFor({ id: 'x', type: 'image', label: 'l' })).toBe('');
    expect(defaultFor({ id: 'x', type: 'health', label: 'l' })).toBe('healthy');
  });
  it('statOf tolerates legacy numeric values', () => {
    expect(statOf({ fortitude: 4 }, 'fortitude')).toEqual({ value: 4, specialties: [] });
    expect(statOf({}, 'fortitude')).toEqual({ value: 1, specialties: [] });
  });
});
