import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { CompressError } from '@rolvium/ui';
import { PACK_DUNGEON, PACK_FOREST } from '../../../../tests/helpers/fakes';
import { compressionLevelsRepo } from '../container';
import { PropsUpload, type Compressor } from './PropsUpload';

vi.mock('../container', () => ({ compressionLevelsRepo: { load: vi.fn(), save: vi.fn() } }));
vi.mock('@rolvium/ui', async importOriginal => ({ ...(await importOriginal<typeof import('@rolvium/ui')>()), compressImage: vi.fn() }));

/**
 * SUBIR PIEZAS EN LOTE (`rolvium.pen` · `DCs6S`, aprobado el 2026-09-11): la zona de arrastre, a qué paquete, la
 * cola con su estado y AÑADIR N PIEZAS. El nombre del fichero se queda como nombre de la pieza.
 *
 * Casi todas mandan `compress` doblado (ver `ok` más abajo); el preparador de serie real —que ahora depende del
 * nivel de Ajustes— se prueba aparte, sin pasar `compress`.
 */
const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const ok: Compressor = async file => ({ blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: file.size, bytes: 1, compressed: true, width: 320, height: 200 });

function mount(over: Partial<React.ComponentProps<typeof PropsUpload>> = {}) {
  const cb = { onAdd: vi.fn(async () => undefined), onClose: vi.fn() };
  renderWithProviders(<PropsUpload packs={[PACK_DUNGEON, PACK_FOREST]} packId={PACK_DUNGEON.id} compress={ok} {...cb} {...over} />);
  return { cb, input: () => screen.getByTestId('mp-propup-input') as HTMLInputElement };
}

describe('<PropsUpload>', () => {
  it('enseña la zona de arrastre, el paquete abierto y AÑADIR apagado hasta que haya ficheros', () => {
    mount();
    expect(screen.getByText('Arrastra aquí tus imágenes')).toBeInTheDocument();
    expect(screen.getByText(/PNG o WEBP con fondo transparente/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'A qué paquete' })).toHaveValue(PACK_DUNGEON.id);
    // Sin nada en cola el botón dice qué hace («Subir objetos») en vez de «Añadir 0 objetos», y está apagado.
    expect(screen.getByRole('button', { name: 'Subir objetos' })).toBeDisabled();
    expect(screen.getByText(/El nombre del fichero se queda como nombre del objeto/)).toBeInTheDocument();
  });

  it('los ficheros entran por el selector o arrastrados, en cola, y el botón cuenta cuántos; lo que no es imagen no entra', () => {
    const { input } = mount();
    fireEvent.change(input(), { target: { files: [png('arbol-viejo.png'), new File(['t'], 'notas.txt', { type: 'text/plain' })] } });
    fireEvent.drop(screen.getByTestId('mp-propup-drop'), { dataTransfer: { files: [png('brasero.webp')] } });
    const filas = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(filas.map(f => f.getAttribute('data-status'))).toEqual(['queued', 'queued']);
    expect(screen.getByText('arbol-viejo.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir 2 objetos' })).not.toBeDisabled();
  });

  it('se puede quitar uno de la lista antes de subir', async () => {
    const u = userEvent.setup();
    mount({ initialFiles: [png('a.png'), png('b.png')] });
    await u.click(screen.getByRole('button', { name: 'Quitar a.png de la lista' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Añadir 1 objeto' })).toBeInTheDocument();
  });

  it('AÑADIR comprime cada una y la guarda con el nombre del fichero, el paquete elegido y su tamaño; al acabar sin fallos se cierra', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ initialFiles: [png('arbol-viejo.png'), png('puerta herrumbre.webp')] });
    await u.selectOptions(screen.getByRole('combobox', { name: 'A qué paquete' }), PACK_FOREST.id);
    await u.click(screen.getByRole('button', { name: 'Añadir 2 objetos' }));
    await waitFor(() => expect(cb.onAdd).toHaveBeenCalledTimes(2));
    // `alpha` viaja con cada una: es de donde sale la silueta (§ 6.9). Aquí llega `null` porque el compresor
    // de mentira no la trae — lo que prueba que una subida sin opacidad sigue funcionando igual.
    expect(cb.onAdd).toHaveBeenNthCalledWith(1, { name: 'arbol-viejo', packId: PACK_FOREST.id, naturalWidth: 320, naturalHeight: 200, alpha: null }, expect.any(Blob));
    expect(cb.onAdd).toHaveBeenNthCalledWith(2, { name: 'puerta herrumbre', packId: PACK_FOREST.id, naturalWidth: 320, naturalHeight: 200, alpha: null }, expect.any(Blob));
    await waitFor(() => expect(cb.onClose).toHaveBeenCalled());
  });

  it('una que falla se queda en la lista diciendo por qué, las demás suben, y NO se cierra', async () => {
    const u = userEvent.setup();
    const mal: Compressor = async file => { if (file.name.startsWith('gordo')) throw new CompressError('input-too-large'); return ok(file); };
    const { cb } = mount({ initialFiles: [png('gordo.png'), png('bien.png')], compress: mal });
    await u.click(screen.getByRole('button', { name: 'Añadir 2 objetos' }));
    await waitFor(() => expect(screen.getAllByRole('listitem').map(f => f.getAttribute('data-status'))).toEqual(['failed', 'done']));
    expect(screen.getByText('pesa más de 8 MB')).toBeInTheDocument();
    expect(cb.onAdd).toHaveBeenCalledTimes(1);
    expect(cb.onClose).not.toHaveBeenCalled();
    // y se puede volver a intentar sólo la que falló
    expect(screen.getByRole('button', { name: 'Añadir 1 objeto' })).not.toBeDisabled();
  });

  it('si guardar falla, la fila dice que no se pudo subir', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ initialFiles: [png('a.png')], onAdd: vi.fn(async () => { throw new Error('rls'); }) });
    await u.click(screen.getByRole('button', { name: 'Añadir 1 objeto' }));
    await waitFor(() => expect(screen.getByText('no se pudo subir')).toBeInTheDocument());
    expect(cb.onClose).not.toHaveBeenCalled();
  });

  it('CANCELAR cierra sin subir nada', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ initialFiles: [png('a.png')] });
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cb.onClose).toHaveBeenCalled();
    expect(cb.onAdd).not.toHaveBeenCalled();
  });

  it('sin `compress`: el preparador de serie comprime al destino `prop` con el nivel guardado en Ajustes', async () => {
    const { compressImage } = await import('@rolvium/ui');
    vi.mocked(compressionLevelsRepo.load).mockResolvedValue({ texture: 'balanced', prop: 'light', background: 'balanced' });
    vi.mocked(compressImage).mockResolvedValue({ blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: 1, bytes: 1, compressed: true, width: 1024, height: 512 });
    const u = userEvent.setup();
    const cb = { onAdd: vi.fn(async () => undefined), onClose: vi.fn() };
    renderWithProviders(<PropsUpload packs={[PACK_DUNGEON, PACK_FOREST]} packId={PACK_DUNGEON.id} initialFiles={[png('arbol.png')]} {...cb} />);
    await u.click(screen.getByRole('button', { name: 'Añadir 1 objeto' }));
    await waitFor(() => expect(cb.onAdd).toHaveBeenCalledTimes(1));
    // Y PIDE LA OPACIDAD (§ 6.9): la silueta sale de la misma pasada, sin volver a abrir la imagen.
    expect(vi.mocked(compressImage)).toHaveBeenCalledWith(expect.any(File), 'prop', 'light', undefined, { alpha: true });
  });
});
