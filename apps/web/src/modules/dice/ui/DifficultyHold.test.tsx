import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, renderWithProviders, screen } from '../../../../tests/helpers/render';
import { DifficultyHold } from './DifficultyHold';

/**
 * DOS PADRES A LA VEZ (revisión del 2026-08-23): el panel de pedir y una criatura desplegada montan cada
 * uno sus DifficultyHold con estado PROPIO. El cierre por clase (`.closest('.dc-ask-stat')`) dejaba vivo el
 * menú de un padre al pulsar una característica del otro — dos menús abiertos a la vez. El cierre es por
 * INSTANCIA: todo clic fuera de MI slot me cierra.
 */
function TwoParents({ onPickA, onPickB }: { onPickA: (d: number) => void; onPickB: (d: number) => void }): JSX.Element {
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const ts = (k: string) => k;
  return (
    <div>
      <DifficultyHold label="Alfa" ts={ts} open={openA} onOpen={setOpenA} onPick={onPickA} />
      <DifficultyHold label="Beta" ts={ts} open={openB} onOpen={setOpenB} onPick={onPickB} />
    </div>
  );
}

/** Como el navegador: pointerdown y su mousedown de compatibilidad, en ese orden. */
const press = (el: Element) => { fireEvent.pointerDown(el); fireEvent.mouseDown(el); };

describe('DifficultyHold — un solo menú abierto entre padres', () => {
  it('regresión · abrir el menú de otro padre cierra el ajeno: nunca dos desplegables a la vez', () => {
    renderWithProviders(<TwoParents onPickA={vi.fn()} onPickB={vi.fn()} />);
    press(screen.getByRole('button', { name: 'Alfa' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    press(screen.getByRole('button', { name: 'Beta' }));
    // el de Alfa se cerró con el mousedown fuera de su slot; sólo queda el de Beta
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Beta' }).className).toContain('on');
    expect(screen.getByRole('button', { name: 'Alfa' }).className).not.toContain('on');
  });

  it('clicar DENTRO del propio menú no lo cierra (el camino de pulsar y luego pulsar la dificultad)', () => {
    const onPickA = vi.fn();
    renderWithProviders(<TwoParents onPickA={onPickA} onPickB={vi.fn()} />);
    press(screen.getByRole('button', { name: 'Alfa' }));
    const option = screen.getAllByRole('menuitem')[0]!;
    fireEvent.mouseDown(option);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    fireEvent.click(option);
    expect(onPickA).toHaveBeenCalledTimes(1);
  });
});
