import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { rawTexture, TextureUpload } from './TextureUpload';

/**
 * SUBIR TEXTURAS EN LOTE: la misma ventana que las piezas (él, 2026-09-13: «*hazlo igual que como hiciste con las
 * piezas, puedo subir de a muchas*», § 6.8 punto 1), con «A qué categoría» y sin exigir transparencia.
 */
const jpg = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function mount(over: Partial<React.ComponentProps<typeof TextureUpload>> = {}) {
  const cb = { onAdd: vi.fn(async () => undefined), onClose: vi.fn() };
  renderWithProviders(<TextureUpload category="stone" {...cb} {...over} />);
  return cb;
}

describe('<TextureUpload>', () => {
  it('es la ventana de subir en lote con la cara de las texturas: título, JPG admitido, A QUÉ CATEGORÍA (sin «Sin clasificar») y la nota de la baldosa', () => {
    mount();
    expect(screen.getAllByText('Subir texturas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/JPG, PNG o WEBP · varias a la vez · no hace falta transparencia/)).toBeInTheDocument();
    const cat = screen.getByRole('combobox', { name: 'A qué categoría' });
    expect(cat).toHaveValue('stone');
    expect([...(cat as HTMLSelectElement).options].map(o => o.textContent)).toEqual(['Piedra', 'Madera', 'Baldosa', 'Tierra', 'Hierba', 'Agua', 'Varios']);
    expect(screen.getByText(/Nace con baldosa de 4 casillas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir texturas' })).toBeDisabled();
  });

  it('AÑADIR sube cada una TAL CUAL (sin comprimir) con el nombre del fichero y la categoría elegida, y se cierra al acabar', async () => {
    const u = userEvent.setup();
    const cb = mount({ initialFiles: [jpg('granito.jpg'), jpg('adoquin mojado.png')] });
    await u.selectOptions(screen.getByRole('combobox', { name: 'A qué categoría' }), 'wood');
    await u.click(screen.getByRole('button', { name: 'Añadir 2 texturas' }));
    await waitFor(() => expect(cb.onAdd).toHaveBeenCalledTimes(2));
    expect(cb.onAdd).toHaveBeenNthCalledWith(1, { name: 'granito', category: 'wood' }, expect.any(File));
    expect(cb.onAdd).toHaveBeenNthCalledWith(2, { name: 'adoquin mojado', category: 'wood' }, expect.any(File));
    await waitFor(() => expect(cb.onClose).toHaveBeenCalled());
  });

  it('el fichero entra tal cual: la preparación de serie no lo toca', async () => {
    const f = jpg('losa.jpg');
    const r = await rawTexture(f);
    expect(r.blob).toBe(f);
    expect(r.compressed).toBe(false);
  });

  it('una que falla se queda diciendo que no se pudo subir, y NO se cierra', async () => {
    const u = userEvent.setup();
    const cb = mount({ initialFiles: [jpg('rota.jpg')], onAdd: vi.fn(async () => { throw new Error('boom'); }) });
    await u.click(screen.getByRole('button', { name: 'Añadir 1 textura' }));
    expect(await screen.findByText('no se pudo subir')).toBeInTheDocument();
    expect(cb.onClose).not.toHaveBeenCalled();
  });
});
