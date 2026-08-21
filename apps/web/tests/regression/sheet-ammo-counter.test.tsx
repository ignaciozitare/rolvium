import { describe, it, expect, vi } from 'vitest';
import { Sheet } from '@rolvium/ui';
import type { SheetSchema } from '@rolvium/core';
import { renderWithProviders, screen, within, fireEvent } from '../helpers/render';

/**
 * Regression, dueño 2026-08-21: «¿por qué no puedo agregar munición?».
 *
 * La Munición de un arma es un contador con techo (el cargador). Una fila guardada ANTES de que esa
 * columna existiera no trae el valor, y la celda pintaba «—» en vez de un contador: sin «+» que pulsar,
 * el valor no podía nacer NUNCA. Y el círculo se cerraba solo, porque `reloadWeapon` lee justo esa clave
 * para llenar el cargador — el motor esperaba un dato que la ficha no dejaba crear.
 *
 * Lo que se fija aquí: un contador que SÍ aplica a la fila arranca en su mínimo aunque la fila venga sin
 * él; el guion se reserva para las columnas que NO aplican (un arma cuerpo a cuerpo no tiene cargador).
 */
const LABELS = { add: 'Añadir', remove: 'Quitar', empty: 'vacío' };

/** `reserve` sólo aplica a las armas con cargador, como en el esquema de Plenilunio. */
const SCHEMA: SheetSchema = {
  version: '1',
  sections: [{
    id: 'weapons', label: 'weapons', layout: 'stack', fields: [
      { id: 'weapons', type: 'table', label: 'Armas', columns: [
        { id: 'id', type: 'select', label: 'Arma', options: [{ value: 'smg', label: 'Subfusil' }, { value: 'knife', label: 'Cuchillo' }] },
        {
          id: 'reserve', type: 'counter', label: 'Munición', min: 0,
          appliesToRow: row => row['id'] === 'smg',
          maxForRow: row => (row['id'] === 'smg' ? 30 : undefined),
        },
      ] },
    ],
  }],
};

const mount = (weapons: Record<string, unknown>[], onChange = vi.fn()) => {
  renderWithProviders(
    <Sheet schema={SCHEMA} data={{ weapons }} derived={{}} t={(k: string) => k} labels={LABELS} icons={{}} onChange={onChange} />,
  );
  return onChange;
};
const ammoCell = () => within(screen.getAllByRole('row')[1]!).getAllByRole('cell').at(-2)!;

describe('regresión · la Munición de un arma se puede subir aunque la fila no la traiga', () => {
  it('una fila guardada SIN munición enseña un contador en 0, no un guion muerto', () => {
    mount([{ id: 'smg', ammo: 0 }]);
    const cell = ammoCell();
    expect(cell).not.toHaveTextContent('—');
    expect(within(cell).getByRole('button', { name: /\+|más|more/i })).toBeInTheDocument();
    expect(cell).toHaveTextContent('0');
  });

  it('y el «+» la sube de verdad: es lo que el dueño no podía hacer', () => {
    const onChange = mount([{ id: 'smg', ammo: 0 }]);
    fireEvent.click(within(ammoCell()).getByRole('button', { name: /\+|más|more/i }));
    expect(onChange).toHaveBeenCalled();
    // `onChange` recibe un parche de la ficha: { weapons: [...filas] }.
    const [patch] = onChange.mock.calls.at(-1)!;
    const rows = (patch as { weapons: Record<string, unknown>[] }).weapons;
    expect(rows[0]).toMatchObject({ id: 'smg', reserve: 1 });
  });

  it('una fila que ya la trae no se toca', () => {
    mount([{ id: 'smg', ammo: 0, reserve: 7 }]);
    expect(ammoCell()).toHaveTextContent('7');
  });

  /** El guion sigue siendo el correcto donde la columna NO aplica: un cuchillo no lleva cargador (p.97). */
  it('un arma sin cargador sigue enseñando el guion, no un contador', () => {
    mount([{ id: 'knife', ammo: null }]);
    const cell = ammoCell();
    expect(cell).toHaveTextContent('—');
    expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
  });
});
