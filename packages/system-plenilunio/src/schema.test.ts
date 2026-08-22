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
    // El ancho de cada fila sale del `.pen`, en sextos: Identidad, Dificultad, Armas e Historia a fila
    // entera (lo hacen solas por llevar `image`/`row`/`table`/`longtext`); Características y Estado a la
    // MITAD (793 de 1601); Dones, Equipo y Armadura a un TERCIO (523 de 1601).
    expect(sections.filter(s => s.span).map(s => `${s.id}:${s.span}`)).toEqual(['gifts:2', 'equipment:2', 'armour:2']);
    for (const id of ['stats', 'state']) expect(sections.find(s => s.id === id)?.span).toBeUndefined();
    for (const id of STAT_IDS) expect(fieldById(id)).toMatchObject({ type: 'stat', action: 'roll', min: 1, max: 10 });
    expect(fieldById('weapons')).toMatchObject({ type: 'table', action: 'attack' });
    expect(fieldById('gifts')).toMatchObject({ type: 'list', action: 'gift.activate' });
    expect(fieldById('health')?.options?.map(o => o.value)).toEqual(['healthy', 'bruised', 'wounded', 'badlyWounded', 'dead']);
  });
  it('marks derived fields', () => {
    for (const id of ['endurance', 'resistanceMax', 'recoveryMax', 'fortuneMax', 'dicePenalty', 'protection', 'armourPenalty', 'giftPoints']) expect(fieldById(id)?.derived).toBe(true);
    expect(fieldById('resistance')?.derived).toBeFalsy();
    // Son DOS números distintos y los dos se enseñan: la PISTA (3×Aguante, p.25) y lo que devuelve el
    // descanso (×3/×2/×1 según el estado, p.101). Se fundieron en uno el 2026-08-19 y Karen, herida,
    // enseñaba 12 casillas en vez de 18. Cada uno con su referencia al manual (RULES.md §6.3).
    expect(fieldById('resistanceMax')?.ref).toBe('resistance');
    expect(fieldById('recoveryMax')?.ref).toBe('recovery');
    // Se guarda y se valida, pero no se pinta: lo escribe el motor, no se elige (p.101, RULES.md §6.2).
    expect(fieldById('unconscious')?.hidden).toBe(true);
    expect(fieldById('unconscious')?.derived).toBeUndefined();   // se GUARDA: `derived` lo dejaría fuera de `newSheet`
    expect(fieldById('health')?.note?.({ unconscious: 'yes' })).toBe('sheet.state.unconsciousNote');
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
