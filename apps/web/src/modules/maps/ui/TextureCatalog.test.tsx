import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import type { Texture } from '../domain/entities/Scene';
import { TextureCatalog } from './TextureCatalog';

/**
 * EL CATÁLOGO DE TEXTURAS es EL MISMO que el de piezas (él, 2026-09-13, con el modal viejo de chips delante:
 * «*quiero el mismo de los objetos, usa el mismo componente*», § 6.8 punto 1). Aquí se prueba sólo su CARA: las
 * categorías en el rail, la miniatura repetida, clasificar como «mover a», subir en lote a la categoría abierta y
 * la pista según para qué se elige. Lo común (selección, arrastre, tres puntos) vive en `LibraryCatalog.test`.
 */
const tex = (over: Partial<Texture> & { id: string; name: string }): Texture => ({
  category: 'stone', url: `https://x/${over.id}.png`, tileCells: 1, uploadedBy: 'u-gm',
  createdAt: '2026-09-01', updatedAt: '', ...over,
});
const ROCA = tex({ id: 'tx-roca', name: 'Roca gris', category: 'stone', tileCells: 2 });
const ROBLE = tex({ id: 'tx-roble', name: 'Roble viejo', category: 'wood' });
const MOSAICO = tex({ id: 'tx-mosaico', name: 'Mosaico fino', category: 'tile', tileCells: 0.5 });
const LOSA = tex({ id: 'tx-rolvium', name: 'Losa de Rolvium', category: 'stone', uploadedBy: null });
const CATALOGO: Texture[] = [ROCA, ROBLE, MOSAICO, LOSA];

function mount(over: Partial<React.ComponentProps<typeof TextureCatalog>> = {}) {
  const cb = { onPick: vi.fn(), onUpload: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(), onClose: vi.fn(), onToggleFavorite: vi.fn() };
  renderWithProviders(<TextureCatalog which="floor" textures={CATALOGO} canManage favorites={[]} recents={[]} {...cb} {...over} />);
  return { cb, rail: () => screen.getByRole('tablist', { name: 'Categorías' }), rejilla: () => screen.getByTestId('mp-propcat-grid') };
}
const baldosas = (): string[] => [...screen.getByTestId('mp-propcat-grid').querySelectorAll('.mp-propcat-tile:not(.mp-propcat-add) .mp-propcat-n')].map(n => n.textContent ?? '');

describe('<TextureCatalog> la cara de las texturas del catálogo común', () => {
  it('es el catálogo a pantalla completa: cabecera «Texturas», buscador, SUBIR TEXTURAS, agrupar y ordenar, y el rail con LAS SIETE CATEGORÍAS y su cuenta', () => {
    const { rail } = mount();
    expect(screen.getByText('Texturas')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar en todas las categorías…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir texturas/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Agrupar' })).toHaveDisplayValue('Categoría');
    const tabs = within(rail()).getAllByRole('tab').map(t => t.textContent);
    expect(tabs.slice(0, 3)).toEqual(['appsTodas4', 'historyRecientes', 'starFavoritas0']);
    expect(tabs.slice(3)).toEqual(['labelPiedra2', 'labelMadera1', 'labelBaldosa1', 'labelTierra0', 'labelHierba0', 'labelAgua0', 'labelVarios0']);
    // Las categorías son cerradas: ni «Nueva categoría» ni «Sin clasificar».
    expect(screen.queryByRole('button', { name: /Nuev/ })).not.toBeInTheDocument();
    expect(within(rail()).queryByRole('tab', { name: /Sin clasificar/ })).not.toBeInTheDocument();
    // Y ya no está el modal viejo con sus chips de categoría.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('abre en «Todas» con una sección por categoría (en su orden), y la categoría del rail filtra', async () => {
    const u = userEvent.setup();
    const { rail } = mount();
    expect(screen.getByRole('heading', { name: 'Piedra (2 texturas)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Madera (1 textura)' })).toBeInTheDocument();
    expect(baldosas()).toEqual(['Losa de Rolvium', 'Roca gris', 'Roble viejo', 'Mosaico fino']);
    await u.click(within(rail()).getByRole('tab', { name: /Madera/ }));
    expect(baldosas()).toEqual(['Roble viejo']);
    expect(screen.getByText('Texturas · 1')).toBeInTheDocument();
  });

  it('cada miniatura se REPITE al tamaño de baldosa que recuerda la textura, y el punto oro marca las tuyas', () => {
    mount();
    const mini = (name: string) => within(screen.getByRole('button', { name: `Elegir ${name}` })).getByTestId('mp-tex-thumb');
    expect(mini('Roca gris')).toHaveStyle({ backgroundSize: '50% auto' });
    expect(mini('Mosaico fino')).toHaveStyle({ backgroundSize: '12.5% auto' });
    expect(mini('Roble viejo').style.backgroundImage).toContain('tx-roble.png');
    const nombre = (name: string) => screen.getByRole('button', { name: `Elegir ${name}` }).querySelector('.mp-propcat-n')!;
    expect(nombre('Roca gris').querySelector('.mp-texcat-dot')).not.toBeNull();
    expect(nombre('Losa de Rolvium').querySelector('.mp-texcat-dot')).toBeNull();
  });

  it('elegir una la devuelve entera, con su tamaño de baldosa dentro', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Elegir Roca gris' }));
    expect(cb.onPick).toHaveBeenCalledWith(ROCA);
  });

  it('subir va a la categoría abierta (y a «Piedra», la primera, con «Todas» puesto); arrastrar imágenes también', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount();
    await u.click(screen.getByRole('button', { name: /Subir texturas/ }));
    expect(cb.onUpload).toHaveBeenCalledWith('stone');
    await u.click(within(rail()).getByRole('tab', { name: /Madera/ }));
    await u.click(screen.getByRole('button', { name: /^Subir$/ }));
    expect(cb.onUpload).toHaveBeenLastCalledWith('wood');
    const f = new File(['x'], 'granito.jpg', { type: 'image/jpeg' });
    fireEvent.drop(screen.getByTestId('mp-propcat'), { dataTransfer: { files: [f] } });
    expect(cb.onUpload).toHaveBeenLastCalledWith('wood', [f]);
  });

  it('los tres puntos: renombrar, CLASIFICAR EN… otra categoría ahí mismo, y borrar (pregunta)', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Roca gris»' }));
    const menu = screen.getByRole('menu', { name: 'Opciones de «Roca gris»' });
    expect(within(menu).getAllByRole('menuitem').map(m => m.textContent)).toEqual(['editRenombrar', 'drive_file_moveClasificar en…', 'deleteEliminar']);
    await u.click(within(menu).getByRole('menuitem', { name: 'Clasificar en…' }));
    const opciones = screen.getAllByRole('menuitemradio').map(o => o.textContent);
    expect(opciones).toEqual(['Piedra', 'Madera', 'Baldosa', 'Tierra', 'Hierba', 'Agua', 'Varios']);
    expect(screen.getByRole('menuitemradio', { name: 'Piedra' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('menuitemradio', { name: 'Madera' }));
    expect(cb.onUpdate).toHaveBeenCalledWith(ROCA, { category: 'wood' });

    await u.click(screen.getByRole('button', { name: 'Opciones de «Roca gris»' }));
    await u.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    const campo = await screen.findByRole('textbox');
    await u.clear(campo);
    await u.type(campo, 'Roca oscura');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(cb.onUpdate).toHaveBeenCalledWith(ROCA, { name: 'Roca oscura' });

    await u.click(screen.getByRole('button', { name: 'Opciones de «Roca gris»' }));
    await u.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(await screen.findByText(/¿Borrar la textura «Roca gris» del catálogo\?/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(cb.onRemove).toHaveBeenCalledWith(ROCA);
  });

  it('sin el permiso no salen ni subir ni los tres puntos ni marcar; elegir sí', () => {
    mount({ canManage: false });
    expect(screen.queryByRole('button', { name: /Subir texturas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Opciones de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Marcar / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir Roble viejo' })).toBeInTheDocument();
  });

  it('la pista del pie dice para qué se elige: suelo/pared, puerta o pincel', () => {
    mount({ which: 'door' });
    expect(screen.getByText(/se pone en la puerta, con el azulejo de una casilla/)).toBeInTheDocument();
  });

  it('la estrella marca favorita, y el estante Favoritas las enseña', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount({ favorites: ['tx-roble'] });
    await u.click(screen.getByRole('button', { name: /Favorito · Roca gris/ }));
    expect(cb.onToggleFavorite).toHaveBeenCalledWith(ROCA);
    await u.click(within(rail()).getByRole('tab', { name: /Favoritas/ }));
    expect(baldosas()).toEqual(['Roble viejo']);
  });
});
