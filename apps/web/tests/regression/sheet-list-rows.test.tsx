import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { Sheet } from '@rolvium/ui';
import type { SheetSchema } from '@rolvium/core';
import { renderWithProviders, screen, within, fireEvent } from '../helpers/render';

/**
 * Regression, owner 2026-08-19: «los dones no me deja elegirlos, me deja el último y me da
 * problema para borrarlos».
 *
 * A blank list row takes the FIRST option of its select, so two unfilled gifts carried the same
 * `id` — and the list keyed its rows by that id. React then treated the two rows as one: the
 * select bounced back to the other row's value and the × deleted the wrong one.
 */
const SCHEMA: SheetSchema = {
  version: '1',
  sections: [{
    id: 'gifts', label: 'gifts', layout: 'stack', fields: [
      { id: 'gifts', type: 'list', label: 'Dones', itemFields: [
        { id: 'id', type: 'select', label: 'Don', options: [{ value: 'a', label: 'Don A' }, { value: 'b', label: 'Don B' }] },
        { id: 'level', type: 'counter', label: 'Nivel', min: 1, max: 5 },
      ] },
    ],
  }],
};
const LABELS = { roll: 'Tirar', add: 'Añadir', remove: 'Quitar', manual: 'manual', of: 'de' };

/** Stateful host: the bug only shows when the edit really lands and the list re-renders. */
function Host({ canChange, onData }: { canChange?: (id: string, v: unknown) => boolean; onData: (d: unknown) => void }) {
  // two rows on the SAME gift — exactly what «+ Añadir» twice produces before you pick anything
  const [data, setData] = useState<Record<string, unknown>>({ gifts: [{ id: 'a', level: 1 }, { id: 'a', level: 2 }] });
  return <Sheet schema={SCHEMA} data={data} derived={{}} t={(k: string) => k} labels={LABELS} icons={{}}
    {...(canChange ? { canChange } : {})}
    onChange={p => setData(d => { const next = { ...d, ...p }; onData(next); return next; })} />;
}

function mount(over: { canChange?: (id: string, v: unknown) => boolean } = {}) {
  const onData = vi.fn();
  renderWithProviders(<Host onData={onData} {...over} />);
  return { onData, rows: screen.getAllByRole('listitem') };
}

describe('regression · filas de una lista de la ficha', () => {
  it('dos filas con el mismo don son dos filas: se editan y se borran por separado', () => {
    const { onData, rows } = mount();
    expect(rows).toHaveLength(2);

    // subir el nivel de la SEGUNDA fila sube el de la segunda, y la primera no se entera
    fireEvent.click(within(rows[1]!).getByRole('button', { name: '+ Nivel' }));
    expect(onData).toHaveBeenLastCalledWith({ gifts: [{ id: 'a', level: 1 }, { id: 'a', level: 3 }] });

    // la × de la segunda borra la segunda: queda la de nivel 1, no la de nivel 3
    fireEvent.click(within(screen.getAllByRole('listitem')[1]!).getByRole('button', { name: /^Quitar/ }));
    expect(onData).toHaveBeenLastCalledWith({ gifts: [{ id: 'a', level: 1 }] });
    const left = screen.getAllByRole('listitem');
    expect(left).toHaveLength(1);
    expect(within(left[0]!).getByText('1')).toBeInTheDocument();
  });

  it('lo que el guardia veta se ve desactivado, no muerto: antes se elegía y no pasaba nada', () => {
    const { rows } = mount({ canChange: () => false });
    expect(screen.getByRole('button', { name: /Añadir · Dones/ })).toBeDisabled();
    expect(within(rows[0]!).getByRole('button', { name: '+ Nivel' })).toBeDisabled();
    expect(within(rows[0]!).getByRole('button', { name: '− Nivel' })).toBeDisabled();
  });
});
