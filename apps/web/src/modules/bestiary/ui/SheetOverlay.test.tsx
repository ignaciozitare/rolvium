import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { SheetOverlay } from './SheetOverlay';

const setup = (over: Partial<Parameters<typeof SheetOverlay>[0]> = {}) => {
  const onClose = vi.fn();
  const props = { title: 'Ficha del encuentro', onClose, children: <button type="button">Guardar</button>, ...over };
  renderWithProviders(<SheetOverlay {...props} />);
  return { onClose };
};

beforeEach(() => vi.clearAllMocks());

describe('SheetOverlay — la hoja de pergamino de las fichas', () => {
  it('es un diálogo con nombre, no un div suelto', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Ficha del encuentro' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('pinta el rótulo del filete y el texto de la derecha («Titulo Derecha» del .pen)', () => {
    setup({ note: 'Propio · manual p.152' });
    expect(screen.getByRole('heading', { name: 'Ficha del encuentro' })).toBeInTheDocument();
    expect(screen.getByText('Propio · manual p.152')).toBeInTheDocument();
  });

  it('sin `note` no deja un hueco con nada dentro', () => {
    setup();
    expect(screen.queryByText('·')).not.toBeInTheDocument();
  });

  /**
   * Las tres salidas. La de Escape y la del clic fuera existían en el `Modal` que esto sustituye, así que
   * perderlas sería una regresión silenciosa: se prueban las tres, no sólo el botón.
   */
  it('cierra con el botón de cerrar', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra con Escape', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra al pulsar fuera de la hoja, pero NO al pulsar dentro', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClose).not.toHaveBeenCalled();

    const scrim = screen.getByRole('dialog').parentElement as HTMLElement;
    await userEvent.click(scrim);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('mete el foco en la hoja al abrirla y lo devuelve al cerrarla', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderWithProviders(
      <SheetOverlay title="Ficha" onClose={vi.fn()}><span>x</span></SheetOverlay>,
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());

    unmount();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('el contenido que recibe se pinta dentro de la hoja, no fuera', () => {
    setup();
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('button', { name: 'Guardar' }));
  });
});
