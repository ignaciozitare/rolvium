import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { IMAGE_CHAPEL, IMAGE_MARKET } from '../../../../tests/helpers/fakes';
import type { Texture } from '../domain/entities/Scene';
import { BackgroundCatalog } from './BackgroundCatalog';

/**
 * EL CATÁLOGO DE FONDOS es EL MISMO que el de texturas y el de objetos (§ «EL FONDO DEL MAPA»; suyo,
 * 2026-09-14: «*no hay un catálogo categorizado como con las texturas y debería ser el mismo*»). Aquí se prueba
 * sólo su CARA: las dos bibliotecas a la vez con las SUYAS ARRIBA, el permiso por pieza y que no hay «mover a».
 * Lo común (buscar, marcar, tres puntos) vive en `LibraryCatalog.test`.
 */
const tex = (over: Partial<Texture> & { id: string; name: string }): Texture => ({
  category: 'stone', url: `https://x/${over.id}.png`, tileCells: 1, uploadedBy: 'u-gm',
  createdAt: '2026-09-01', updatedAt: '', ...over,
});
const ROCA = tex({ id: 'tx-roca', name: 'Roca gris', category: 'stone' });
const ROBLE = tex({ id: 'tx-roble', name: 'Roble viejo', category: 'wood' });
/** Se llama así a propósito: por nombre cae ENTRE «Capilla» y «Mercado», que es lo que hace falta para el tramo. */
const LADRILLO = tex({ id: 'tx-ladrillo', name: 'Ladrillo', category: 'stone' });

function mount(over: Partial<React.ComponentProps<typeof BackgroundCatalog>> = {}) {
  const cb = { onPick: vi.fn(), onUpload: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onClose: vi.fn(), onToggleFavorite: vi.fn() };
  renderWithProviders(
    <BackgroundCatalog images={[IMAGE_CHAPEL, IMAGE_MARKET]} textures={[ROCA, ROBLE]} canManageTextures
      favorites={[]} recents={[]} {...cb} {...over} />,
  );
  return { cb, rail: () => screen.getByRole('tablist', { name: 'Fondos' }), rejilla: () => screen.getByTestId('mp-propcat-grid') };
}
const secciones = (): string[] =>
  [...screen.getByTestId('mp-propcat-grid').querySelectorAll('.mp-propcat-sec-h')].map(h => h.textContent ?? '');

describe('<BackgroundCatalog> las dos bibliotecas, y las suyas arriba', () => {
  it('es el catálogo a pantalla completa, con su cabecera y su buscador de las dos bibliotecas', () => {
    mount();
    expect(screen.getByText('Fondos del mapa')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar en tus fondos y en las texturas…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir fondos/ })).toBeInTheDocument();
  });

  it('el rail lleva DOS bloques: TUS FONDOS con «De esta campaña», y debajo TEXTURAS DE SISTEMA con sus categorías', () => {
    const { rail } = mount();
    expect(within(rail()).getByText('Tus fondos')).toBeInTheDocument();
    expect(within(rail()).getByRole('tab', { name: /De esta campaña/ })).toBeInTheDocument();
    expect(within(rail()).getByText('Texturas de sistema')).toBeInTheDocument();
    expect(within(rail()).getByRole('tab', { name: /Piedra/ })).toBeInTheDocument();
  });

  it('con «Todos», la sección de SUS FONDOS va ARRIBA de las de texturas — que es lo que él pidió', async () => {
    const u = userEvent.setup();
    const { rail } = mount();
    await u.click(within(rail()).getByRole('tab', { name: /Todos/ }));
    const orden = secciones();
    expect(orden[0]).toContain('De esta campaña');
    expect(orden.slice(1).join(' ')).toMatch(/Piedra|Madera/);
  });

  it('elegir uno lo pone de fondo, sea suyo o una textura', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount();
    await u.click(screen.getByRole('button', { name: 'Poner Capilla de fondo' }));
    expect(cb.onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'img-1', mine: true }));
    await u.click(within(rail()).getByRole('tab', { name: /Piedra/ }));
    await u.click(screen.getByRole('button', { name: 'Poner Roca gris de fondo' }));
    expect(cb.onPick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'tx-roca', mine: false }));
  });

  it('SUBIR FONDOS abre la subida en lote', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: /Subir fondos/ }));
    expect(cb.onUpload).toHaveBeenCalled();
  });

  /**
   * EL PERMISO ES POR PIEZA: sus fondos son de su campaña y siempre puede con ellos; tocar una textura es
   * tocar la biblioteca de la herramienta y pide `manage_textures`.
   */
  it('sin el permiso de texturas puede ordenar LOS SUYOS pero no las texturas', async () => {
    const u = userEvent.setup();
    const { rail } = mount({ canManageTextures: false });
    expect(screen.getByRole('button', { name: 'Opciones de «Capilla»' })).toBeInTheDocument();
    await u.click(within(rail()).getByRole('tab', { name: /Piedra/ }));
    expect(screen.queryByRole('button', { name: 'Opciones de «Roca gris»' })).not.toBeInTheDocument();
  });

  /**
   * …Y EL TRAMO DE MAYÚS NO SE SALTA EL PERMISO. Con AGRUPAR apagado (o en Favoritos y Recientes) las dos
   * bibliotecas salen mezcladas en una sola lista, así que Mayús+clic entre dos fondos SUYOS se llevaba por
   * delante las texturas que quedaban en medio — y la papelera de la barra de selección las borraba sin
   * tener `manage_textures`. El tramo sólo coge lo que se puede ordenar.
   */
  it('sin el permiso, el tramo de Mayús entre dos fondos suyos NO se lleva las texturas de en medio', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount({ canManageTextures: false, textures: [ROCA, ROBLE, LADRILLO] });
    await u.click(within(rail()).getByRole('tab', { name: /Todos/ }));
    await u.selectOptions(screen.getByRole('combobox', { name: 'Agrupar' }), 'none');
    await u.click(screen.getByRole('button', { name: 'Marcar Capilla' }));
    await u.keyboard('{Shift>}');
    await u.click(screen.getByRole('button', { name: 'Poner Mercado de fondo' }));
    await u.keyboard('{/Shift}');
    expect(screen.getByTestId('mp-propcat-selbar')).toHaveTextContent('2 seleccionados');
    await u.click(within(screen.getByTestId('mp-propcat-selbar')).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText(/¿Borrar 2 fondos\?/)).toBeInTheDocument();
    await u.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!);
    expect(cb.onRemove).toHaveBeenCalledTimes(2);
    expect(cb.onRemove).not.toHaveBeenCalledWith(expect.objectContaining({ mine: false }));
  });

  it('con el permiso, también las texturas', async () => {
    const u = userEvent.setup();
    const { rail } = mount();
    await u.click(within(rail()).getByRole('tab', { name: /Piedra/ }));
    expect(screen.getByRole('button', { name: 'Opciones de «Roca gris»' })).toBeInTheDocument();
  });

  it('no hay «mover a»: un fondo suyo es de su campaña y una textura ya está en su categoría', async () => {
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Capilla»' }));
    expect(screen.getByRole('menuitem', { name: /Renombrar/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Clasificar|Mover/ })).not.toBeInTheDocument();
  });

  it('renombrar y borrar llegan con el fondo entero, para que cada uno vaya a su biblioteca', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Capilla»' }));
    expect(screen.getByRole('menuitem', { name: /Renombrar/ })).toBeInTheDocument();
    await u.click(screen.getByRole('menuitem', { name: /Eliminar|Borrar/ }));
    await u.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(cb.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'img-1', mine: true }));
  });

  it('mientras no han llegado las dos bibliotecas no dice que esté vacío', () => {
    mount({ textures: null });
    expect(screen.queryByText('Todavía no has subido ningún fondo a esta campaña.')).not.toBeInTheDocument();
  });
});
