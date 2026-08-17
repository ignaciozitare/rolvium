import { describe, it, expect } from 'vitest';
import { validateSheet } from './sheetValidation';
import type { SheetSchema } from './gameSystem';

const schema: SheetSchema = { version: '1', sections: [{ id: 's', label: 'x', fields: [
  { id: 'name', type: 'text', label: 'n' },
  { id: 'destiny', type: 'counter', label: 'd', min: 1, max: 10 },
  { id: 'armour', type: 'select', label: 'a', options: [{ value: 'none', label: 'n' }, { value: 'leather', label: 'l' }] },
  { id: 'combat', type: 'stat', label: 'c', min: 1, max: 10 },
  { id: 'weapons', type: 'table', label: 'w', max: 2, columns: [{ id: 'id', type: 'text', label: 'i' }, { id: 'ammo', type: 'number', label: 'a', min: 0 }] },
  { id: 'endurance', type: 'number', label: 'e', derived: true },
] }] };

describe('validateSheet', () => {
  it('accepts a valid sheet and ignores derived + missing fields', () => {
    expect(validateSheet(schema, { name: 'K', destiny: 3, armour: 'leather', combat: { value: 4, specialties: ['x'] }, weapons: [{ id: 'bat', ammo: 0 }], endurance: 'garbage' })).toEqual([]);
  });
  it('reports type/range/option/unknown issues with paths', () => {
    const issues = validateSheet(schema, { name: 3, destiny: 11, armour: 'plate', combat: { value: 0 }, weapons: [{ id: 1, ammo: -1 }, {}, {}], hack: true });
    expect(issues).toEqual(expect.arrayContaining([
      { field: 'name', code: 'type' }, { field: 'destiny', code: 'max' }, { field: 'armour', code: 'option' },
      { field: 'combat.value', code: 'min' }, { field: 'weapons', code: 'max' }, { field: 'weapons[0].id', code: 'type' }, { field: 'weapons[0].ammo', code: 'min' }, { field: 'hack', code: 'unknown' },
    ]));
  });
});
