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

/**
 * Y lo que se le añadió el 2026-09-20: EL editor de texto enriquecido con su índice al lado. El catálogo tiene
 * que enseñarlo FUNCIONANDO, no una captura — si el ejemplo deja de montar, se entera aquí y no el dueño.
 */
describe('<UIKit> · el editor de texto enriquecido', () => {
  it('el ejemplo trae la barra, el documento y el índice, y el índice se cierra y se vuelve a abrir', async () => {
    const u = userEvent.setup();
    renderWithProviders(<UIKit />);

    const bar = screen.getByRole('toolbar', { name: 'Formato' });
    expect(within(bar).getByRole('button', { name: 'Negrita' })).toBeInTheDocument();
    // Las cosas que sólo tiene una aventura también se enseñan: es lo que pide `features`.
    expect(within(bar).getByRole('button', { name: 'Tabla de PNJ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'El almacén de los muelles' })).toBeInTheDocument();

    const index = screen.getByRole('navigation', { name: 'Índice' });
    expect(within(index).getByRole('button', { name: 'Llegada' })).toBeInTheDocument();
    await u.click(within(index).getByRole('button', { name: 'Cerrar el índice' }));
    expect(screen.queryByRole('navigation', { name: 'Índice' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Índice' }));
    expect(screen.getByRole('navigation', { name: 'Índice' })).toBeInTheDocument();
  });
});
