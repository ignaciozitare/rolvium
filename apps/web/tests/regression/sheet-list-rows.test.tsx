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
function Host({ canChange, onData, initial }: { canChange?: (id: string, v: unknown) => boolean; onData: (d: unknown) => void; initial?: unknown[] }) {
  // two rows on the SAME gift — exactly what «+ Añadir» twice produces before you pick anything
  const [data, setData] = useState<Record<string, unknown>>({ gifts: initial ?? [{ id: 'a', level: 1 }, { id: 'a', level: 2 }] });
  // `rowPicker`: el desplegable por fila vive en el GENERADOR, que es donde se elige el don. En la
  // ficha viva la fila es texto y sólo se borra (dueño, 2026-08-19). El veto por opción es de aquí.
  return <Sheet schema={SCHEMA} data={data} derived={{}} rowPicker t={(k: string) => k} labels={LABELS} icons={{}}
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
    // el desplegable también: era el control que rebotaba en silencio
    const sel = within(rows[0]!).getByLabelText('Don');
    expect(within(sel).getByRole('option', { name: 'Don B' })).toBeDisabled();
    expect(within(sel).getByRole('option', { name: 'Don A' })).toBeEnabled();   // la ya elegida, nunca
  });

  it('el veto es por opción, no por control: lo que sí cabe se sigue pudiendo elegir', () => {
    // veta cualquier lista que contenga el don B; lo demás pasa
    const veto = (_id: string, v: unknown) => !JSON.stringify(v).includes('"b"');
    const { onData, rows } = mount({ canChange: veto });
    const sel = within(rows[0]!).getByLabelText('Don') as HTMLSelectElement;
    expect(sel).toBeEnabled();
    expect(within(sel).getByRole('option', { name: 'Don B' })).toBeDisabled();
    expect(within(rows[0]!).getByRole('button', { name: '+ Nivel' })).toBeEnabled();  // subir nivel no toca el don vetado
    // y lo permitido sigue llegando al onChange, no sólo "no está desactivado"
    fireEvent.click(within(rows[0]!).getByRole('button', { name: '+ Nivel' }));
    expect(onData).toHaveBeenLastCalledWith({ gifts: [{ id: 'a', level: 2 }, { id: 'a', level: 2 }] });
  });

  /**
   * Review 2026-08-19: the gifts step gained a veto on duplicate rows (a gift has ONE level), and a
   * blank row takes the FIRST option of its select. So the second «+ Añadir» proposed a row the guard
   * always refused: the button went dead, with nothing on screen saying why. It has to offer a row the
   * guard accepts, and only give up when none is left.
   */
  it('«+ Añadir» propone una fila que el guardia acepte, no siempre la primera opción', () => {
    const ids = (v: unknown) => (v as { id: string }[]).map(r => r.id);
    const noDupes = (_id: string, v: unknown) => new Set(ids(v)).size === ids(v).length;
    const onData = vi.fn();
    renderWithProviders(<Host onData={onData} canChange={noDupes} initial={[{ id: 'a', level: 1 }]} />);
    const add = screen.getByRole('button', { name: /Añadir · Dones/ });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(onData).toHaveBeenLastCalledWith({ gifts: [{ id: 'a', level: 1 }, { id: 'b', level: 1 }] });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // y con las dos opciones ya cogidas sí está desactivado: ahí no queda nada que añadir
    expect(screen.getByRole('button', { name: /Añadir · Dones/ })).toBeDisabled();
  });

  /**
   * QA 2026-08-19: the three assertions above pass just as well with the rows keyed by `rowId`
   * again — with fully controlled inputs the collision is invisible to jsdom, so nothing pinned
   * the fix and it could be undone without a red test. React itself is the only witness, and it
   * calls duplicate keys unsupported ("children may be duplicated and/or omitted"), so assert on
   * the warning: this is what actually goes red if `rowKey` ever becomes `rowId` again.
   */
  const keyWarnings = (ui: JSX.Element): string[] => {
    const seen: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { seen.push(a.map(String).join(' ')); });
    try { renderWithProviders(ui); } finally { spy.mockRestore(); }
    return seen.filter(m => m.includes('same key'));
  };

  it('dos filas en blanco no comparten clave de React — ni en lista ni en tabla', () => {
    expect(keyWarnings(<Host onData={vi.fn()} />)).toEqual([]);

    // la tabla tiene exactamente la misma forma: «+ Añadir» dos veces da dos armas `unarmed`
    const TABLE: SheetSchema = {
      version: '1',
      sections: [{
        id: 'weapons', label: 'weapons', layout: 'stack', fields: [
          { id: 'weapons', type: 'table', label: 'Armas', columns: [
            { id: 'id', type: 'select', label: 'Arma', options: [{ value: 'a', label: 'Arma A' }, { value: 'b', label: 'Arma B' }] },
            { id: 'ammo', type: 'counter', label: 'Munición', min: 0, max: 9 },
          ] },
        ],
      }],
    };
    expect(keyWarnings(
      <Sheet schema={TABLE} data={{ weapons: [{ id: 'a', ammo: 0 }, { id: 'a', ammo: 0 }] }} derived={{}}
        t={(k: string) => k} labels={LABELS} icons={{}} onChange={() => undefined} />,
    )).toEqual([]);
  });
});
