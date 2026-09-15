import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { compressionLevelsRepo } from '../container';
import { BackgroundUpload } from './BackgroundUpload';
import type { Preparer } from './LibraryUpload';

vi.mock('../container', () => ({ compressionLevelsRepo: { load: vi.fn(), save: vi.fn() } }));
vi.mock('@rolvium/ui', async importOriginal => ({ ...(await importOriginal<typeof import('@rolvium/ui')>()), compressImage: vi.fn() }));

/**
 * SUBIR FONDOS EN LOTE (§ «EL FONDO DEL MAPA»; suyo, 2026-09-14: «*el subir está mal, tiene que ser como las
 * texturas*»). Hasta hoy era un fichero cada vez. Desde el mismo día, además, el fondo SÍ se comprime (destino
 * `background`) pero **nunca reduce resolución**, en ningún nivel — sólo cambia formato/calidad (su condición
 * original: «*¿pero se comprimen y pierden calidad? porque eso sería un problema*»).
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
   * Sin `prepare`, el de serie (`compressBackground`) comprime al destino `background` con el nivel de Ajustes:
   * NUNCA reduce resolución (spec `specs/core/images/SPEC.md`), sólo cambia formato/calidad.
   */
  it('al añadir sin `prepare`: comprime al destino `background` con el nivel guardado en Ajustes, y sube el nombre del fichero', async () => {
    const { compressImage } = await import('@rolvium/ui');
    vi.mocked(compressionLevelsRepo.load).mockResolvedValue({ texture: 'balanced', prop: 'balanced', background: 'max' });
    vi.mocked(compressImage).mockResolvedValue({ blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: 1, bytes: 1, compressed: true, width: 1692, height: 930 });
    const u = userEvent.setup();
    const cb = { onAdd: vi.fn(async (_name: string, _blob: Blob) => undefined), onClose: vi.fn() };
    renderWithProviders(<BackgroundUpload {...cb} />);
    const fichero = png('mazmorra a mano.png');
    fireEvent.change(screen.getByTestId('mp-propup-input'), { target: { files: [fichero] } });
    await u.click(screen.getByRole('button', { name: 'Añadir 1 fondo' }));
    await waitFor(() => expect(cb.onAdd).toHaveBeenCalledWith('mazmorra a mano', expect.any(Blob)));
    expect(vi.mocked(compressImage)).toHaveBeenCalledWith(fichero, 'background', 'max');
  });
});
