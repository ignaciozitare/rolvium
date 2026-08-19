import { describe, it, expect } from 'vitest';
import { Sheet } from '@rolvium/ui';
import type { SheetSchema } from '@rolvium/core';
import { sheetSchema } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen } from '../helpers/render';

/**
 * Regresión, prueba manual del dueño 2026-08-19 sobre Estado:
 *   «Aguante y Resistencia máxima en tarjetas cuadradas centradas dentro de la tarjeta grande, con
 *    los textos centrados con los números», «penalización por heridas y Resistencia recuperable,
 *    una al lado de la otra, en tarjetas como las de Aguante» y «las casillas de Resistencia y las
 *    lunas, centradas».
 *
 * Los tres puntos son la misma decisión: un número CALCULADO no es una celda más de la rejilla, es
 * una tarjeta; y las tarjetas de una tanda van juntas y centradas. Centrar cada campo en su celda
 * no vale — quedan repartidos por el ancho — así que `<Sheet>` agrupa las tandas SEGUIDAS de números
 * calculados en una fila propia (`.rv-sheet-tiles`). Lo que se fija aquí:
 *   · que la tanda se agrupe, y que un campo editable en medio la parta en dos;
 *   · que el esquema de Plenilunio deje las dos parejas del dueño seguidas (si vuelve a colarse
 *     «Inconsciente» entre penalización y recuperable, este test cae);
 *   · que en `stack` NO haya tarjetas: Armadura tiene su propia lectura en columna y no se toca.
 */
const LABELS = { roll: 'Tirar', add: 'Añadir', remove: 'Quitar', manual: 'manual', of: 'de' };

const tiles = (c: HTMLElement) => Array.from(c.querySelectorAll('.rv-sheet-tiles'))
  .map(row => Array.from(row.querySelectorAll('.rv-sheet-field')).map(f => f.querySelector('.rv-sheet-label')?.textContent ?? ''));

const schemaOf = (layout: 'grid' | 'stack', fields: SheetSchema['sections'][number]['fields']): SheetSchema =>
  ({ version: '1', sections: [{ id: 's', label: 's', layout, fields }] });

const mount = (schema: SheetSchema, data: Record<string, unknown> = {}, derived: Record<string, unknown> = {}) =>
  renderWithProviders(<Sheet schema={schema} data={data} derived={derived} t={(k: string) => k} labels={LABELS} icons={{}} />);

describe('regresión · tarjetas de los números calculados de la ficha', () => {
  it('agrupa la tanda seguida de calculados en UNA fila de tarjetas', () => {
    const { container } = mount(schemaOf('grid', [
      { id: 'endurance', type: 'number', label: 'Aguante', derived: true },
      { id: 'resistanceMax', type: 'number', label: 'Resistencia máxima', derived: true },
    ]), {}, { endurance: 6, resistanceMax: 18 });

    expect(tiles(container)).toEqual([['Aguante', 'Resistencia máxima']]);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('un campo editable en medio parte la tanda en dos filas, y él se queda fuera', () => {
    const { container } = mount(schemaOf('grid', [
      { id: 'a', type: 'number', label: 'A', derived: true },
      { id: 'sel', type: 'select', label: 'Inconsciente', options: [{ value: 'no', label: 'No' }] },
      { id: 'b', type: 'number', label: 'B', derived: true },
      { id: 'c', type: 'number', label: 'C', derived: true },
    ]), {}, { a: 1, b: 2, c: 3 });

    expect(tiles(container)).toEqual([['A'], ['B', 'C']]);
    // el desplegable NO entra en ninguna tarjeta: es editable, necesita el ancho del control
    expect(container.querySelector('.rv-sheet-tiles select')).toBeNull();
  });

  it('un número EDITABLE nunca es tarjeta, aunque vaya seguido de calculados', () => {
    const { container } = mount(schemaOf('grid', [
      { id: 'x', type: 'number', label: 'Extra', min: 0 },
      { id: 'y', type: 'number', label: 'Y', derived: true },
    ]), { x: 2 }, { y: 5 });

    expect(tiles(container)).toEqual([['Y']]);
  });

  it('en `stack` no hay tarjetas: Armadura conserva su lectura en columna', () => {
    const { container } = mount(schemaOf('stack', [
      { id: 'protection', type: 'number', label: 'Protección', derived: true },
      { id: 'armourPenalty', type: 'number', label: 'Penalización', derived: true },
    ]), {}, { protection: 6, armourPenalty: 2 });

    expect(container.querySelectorAll('.rv-sheet-tiles')).toHaveLength(0);
    expect(container.querySelectorAll('.rv-sheet-field.num-derived')).toHaveLength(2);
  });

  it('Plenilunio deja las DOS parejas que pidió el dueño seguidas, y en ese orden', () => {
    const state = sheetSchema.sections.find(s => s.id === 'state');
    const ids = (state?.fields ?? []).map(f => f.id);

    expect(ids.indexOf('resistanceMax')).toBe(ids.indexOf('endurance') + 1);
    expect(ids.indexOf('recoveryMax')).toBe(ids.indexOf('dicePenalty') + 1);
    // «Inconsciente» ya no parte la pareja por la mitad
    expect(ids.indexOf('unconscious')).toBeGreaterThan(ids.indexOf('recoveryMax'));
  });

  it('las casillas y las lunas van a lo ancho de la tarjeta, para poder centrarse', () => {
    const { container } = mount(schemaOf('grid', [
      { id: 'resistance', type: 'boxes', label: 'Resistencia', min: 0, max: 4 },
      { id: 'health', type: 'health', label: 'Salud', options: [{ value: 'healthy', label: 'Sano' }] },
    ]), { resistance: 4 }, { resistanceMax: 4 });

    const spans = Array.from(container.querySelectorAll('.rv-sheet-fields.grid > .rv-sheet-field.span'));
    expect(spans).toHaveLength(2);
    expect(spans[0]?.querySelector('.rv-sheet-boxes')).not.toBeNull();
    expect(spans[1]?.querySelector('.rv-sheet-health')).not.toBeNull();
  });
});
