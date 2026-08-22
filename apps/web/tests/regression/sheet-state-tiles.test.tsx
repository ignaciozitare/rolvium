import { describe, it, expect } from 'vitest';
import { Sheet } from '@rolvium/ui';
import type { SheetSchema } from '@rolvium/core';
import { sheetSchema, newSheet, plenilunio } from '@rolvium/system-plenilunio';
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

  /**
   * Corregido el 2026-08-21 contra el PDF (orden del dueño: «el manual pdf manda»). El 2026-08-19 se
   * fusionaron `resistanceMax` y `recoveryMax` creyendo que eran el mismo número; no lo son. La PISTA es
   * 3×Aguante y la fija la creación (p.25); el ×2/×1 sale sólo bajo «RECUPERACIÓN» (p.101) y limita lo que
   * te devuelve un descanso. Los CUATRO calculados van seguidos —primero lo que mide el cuerpo, luego lo
   * que arrastra el estado de salud— y llenan su fila de tarjetas sin dejar ninguna descolgada.
   */
  it('Plenilunio deja los cuatro calculados del cuerpo SEGUIDOS, y sin campos editables en medio', () => {
    const state = sheetSchema.sections.find(s => s.id === 'state');
    const ids = (state?.fields ?? []).filter(f => !f.hidden).map(f => f.id);

    expect(ids.indexOf('resistanceMax')).toBe(ids.indexOf('endurance') + 1);
    expect(ids.indexOf('dicePenalty')).toBe(ids.indexOf('resistanceMax') + 1);
    // El que se borró por error vuelve, y pegado a la penalización: los dos los mueve el estado de salud
    expect(ids.indexOf('recoveryMax')).toBe(ids.indexOf('dicePenalty') + 1);
  });

  /**
   * El fallo que vio el dueño en la app: Karen, HERIDA, enseñaba 12 casillas en vez de 18 — la pista se le
   * encogía al herirse. La pista no se encoge (p.25); lo que baja es lo que le devuelve un descanso (p.101).
   * Se prueba de punta a punta —motor + ficha— porque el fallo sólo se ve al contar las casillas pintadas.
   */
  it('regresión · herida, la pista NO encoge: 18 casillas y la tarjeta del descanso dice 12', () => {
    const sheet = { ...newSheet(), fortitude: { value: 4, specialties: [] }, will: { value: 2, specialties: [] }, health: 'wounded', resistance: 18 };
    const d = plenilunio.engine.derived(sheet) as Record<string, unknown>;
    expect(d).toMatchObject({ endurance: 6, resistanceMax: 18, recoveryMax: 12 });

    const { container } = mount(sheetSchema, sheet, d);
    expect(container.querySelectorAll('.rv-sheet-boxes button')).toHaveLength(18);
    expect(screen.getByText('18 de 18')).toBeInTheDocument();
  });

  /**
   * «Inconsciente» es el SEXTO nivel de salud del manual (p.101) y NO se elige a mano: lo calcula
   * `applyDamage` al quedarse sin Resistencia. Se sigue GUARDANDO —`validateSheet` rechaza toda clave
   * que el esquema no declare, así que borrarlo tumbaría el guardado tras recibir daño— pero no se
   * pinta como desplegable: sale como aviso bajo las lunas. Antes era un `select` «Inconsciente Sí/No»
   * en la rejilla de Estado, capaz de contradecir al motor.
   */
  it('«Inconsciente» sigue en el esquema pero no se pinta: sale como aviso bajo las lunas', () => {
    const state = sheetSchema.sections.find(s => s.id === 'state');
    const unconscious = state?.fields.find(f => f.id === 'unconscious');
    expect(unconscious?.hidden).toBe(true);

    const health = state?.fields.find(f => f.id === 'health');
    expect(health?.note?.({ unconscious: 'yes' })).toBe('sheet.state.unconsciousNote');
    expect(health?.note?.({ unconscious: 'no' })).toBeNull();

    const { container } = renderWithProviders(
      <Sheet schema={sheetSchema} data={{ unconscious: 'yes', health: 'wounded' }} derived={{}} t={(k: string) => k} labels={LABELS} icons={{}} />,
    );
    expect(container.querySelector('.rv-sheet-note')?.textContent).toBe('sheet.state.unconsciousNote');
    expect(screen.queryByLabelText('sheet.state.unconscious')).toBeNull();
  });

  it('un campo `hidden` no se pinta, esté donde esté', () => {
    const { container } = mount(schemaOf('grid', [
      { id: 'visible', type: 'number', label: 'Visible', derived: true },
      { id: 'oculto', type: 'select', label: 'Oculto', hidden: true, options: [{ value: 'no', label: 'No' }] },
    ]), { oculto: 'no' }, { visible: 1 });

    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(screen.queryByText('Oculto')).toBeNull();
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  /**
   * El techo de la Fortuna es el Destino (p.90, tope duro), no el `max: 10` que llevaba el esquema:
   * Karen salía con «Fortuna 5 · Fortuna máxima 4» y el `+` seguía vivo. Se capa la SUBIDA, nunca la
   * bajada — desde 5 con techo 4 hay que poder volver a bajar.
   */
  it('un contador con `<id>Max` calculado se capa contra el derivado, y sólo hacia arriba', () => {
    mount(schemaOf('grid', [
      { id: 'fortune', type: 'counter', label: 'Fortuna', min: 0, max: 10 },
    ]), { fortune: 5 }, { fortuneMax: 4 });

    expect(screen.getByLabelText('+ Fortuna')).toBeDisabled();
    expect(screen.getByLabelText('− Fortuna')).toBeEnabled();
  });

  it('sin `<id>Max` derivado manda el `max` del esquema, como siempre', () => {
    mount(schemaOf('grid', [
      { id: 'xp', type: 'counter', label: 'Experiencia', min: 0, max: 6 },
    ]), { xp: 6 }, {});

    expect(screen.getByLabelText('+ Experiencia')).toBeDisabled();
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
