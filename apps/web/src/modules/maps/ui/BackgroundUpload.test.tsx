import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { BackgroundUpload } from './BackgroundUpload';
import type { Preparer } from './LibraryUpload';

/**
 * SUBIR FONDOS EN LOTE (§ «EL FONDO DEL MAPA»; suyo, 2026-09-14: «*el subir está mal, tiene que ser como las
 * texturas*»). Hasta hoy era un fichero cada vez. Y aquí SÍ se comprime, al revés que las texturas: un fondo se
 * mira a pantalla completa.
 */
const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const ok: Preparer = async file => ({ blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: file.size, bytes: 1, compressed: true, width: 2560, height: 1440 });

function mount(over: Partial<React.ComponentProps<typeof BackgroundUpload>> = {}) {
  const cb = { onAdd: vi.fn(async (_name: string, _blob: Blob) => undefined), onClose: vi.fn() };
  renderWithProviders(<BackgroundUpload prepare={ok} {...cb} {...over} />);
  return { cb, input: () => screen.getByTestId('mp-propup-input') as HTMLInputElement };
}

describe('<BackgroundUpload>', () => {
  it('es la misma ventana de lote, y dice que el fondo es de ESTA campaña', () => {
    mount();
    expect(screen.getByText('Arrastra aquí tus imágenes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir fondos' })).toBeDisabled();
    expect(screen.getByText(/sólo lo verás en esta campaña/)).toBeInTheDocument();
  });

  it('entran varios de una vez y el botón cuenta cuántos', () => {
    const { input } = mount();
    fireEvent.change(input(), { target: { files: [png('mazmorra.png'), png('bosque.png')] } });
    expect(screen.getByRole('button', { name: 'Añadir 2 fondos' })).not.toBeDisabled();
  });

  /**
   * TAL CUAL, SIN COMPRIMIR, como las texturas. Pregunta suya del 2026-09-14: «*¿pero se comprimen y pierden
   * calidad? porque eso sería un problema*». Un fondo es lo que más de cerca se mira de toda la mesa.
   */
  it('al añadir, el fichero llega TAL CUAL —sin pasar por el compresor— y con el nombre del fichero', async () => {
    const u = userEvent.setup();
    const cb = { onAdd: vi.fn(async (_name: string, _blob: Blob) => undefined), onClose: vi.fn() };
    // Sin `prepare`: el de serie, que es el que usa la app.
    renderWithProviders(<BackgroundUpload {...cb} />);
    const fichero = png('mazmorra a mano.png');
    fireEvent.change(screen.getByTestId('mp-propup-input'), { target: { files: [fichero] } });
    await u.click(screen.getByRole('button', { name: 'Añadir 1 fondo' }));
    // Lo que sube es EL MISMO fichero, no una copia reguardada.
    await waitFor(() => expect(cb.onAdd).toHaveBeenCalledWith('mazmorra a mano', fichero));
  });
});
