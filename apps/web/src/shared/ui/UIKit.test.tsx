import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { UIKit } from './UIKit';

/**
 * El catálogo vivo de `@rolvium/ui`. Se fija lo que se le añadió el 2026-09-11: el ejemplo de las piezas de los
 * paneles de la mesa, que tiene que funcionar de verdad — elegir, deslizar, cerrar y volver a abrir.
 */
describe('<UIKit> · las piezas de los paneles de la mesa', () => {
  it('el panel de ejemplo elige, desliza, se cierra y se vuelve a abrir', async () => {
    const u = userEvent.setup();
    renderWithProviders(<UIKit />);
    const panel = screen.getByRole('group', { name: 'Pincel' });

    const muro = within(panel).getByRole('radio', { name: /Muro/ });
    await u.click(muro);
    expect(muro).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(within(panel).getByRole('slider', { name: 'Tamaño' }), { target: { value: '30' } });
    expect(within(panel).getByText('3.0 casillas')).toBeInTheDocument();
    expect(within(panel).getByRole('slider', { name: 'Grosor' })).toHaveValue('30');

    await u.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('group', { name: 'Pincel' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'abrir el panel' }));
    expect(screen.getByRole('group', { name: 'Pincel' })).toBeInTheDocument();
  });
});
