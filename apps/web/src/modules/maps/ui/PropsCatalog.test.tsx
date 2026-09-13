import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { PACK_DUNGEON, PACK_FOREST, PROP_COLUMN, PROP_OAK, PROP_TABLE } from '../../../../tests/helpers/fakes';
import type { Prop } from '../domain/entities/Scene';
import { PropsCatalog } from './PropsCatalog';

/**
 * EL CATÁLOGO DE PIEZAS (`rolvium.pen` · `w7sTC0`, aprobado el 2026-09-11). La biblioteca es de la HERRAMIENTA
 * y va en PAQUETES; ordenarla es por permiso (`manage_props`), elegir es de cualquiera.
 */
const APP_CHAIR: Prop = { ...PROP_OAK, id: 'pr-chair', packId: null, uploadedBy: null, name: 'Silla', category: 'furniture' };
const ALL = [PROP_OAK, PROP_COLUMN, PROP_TABLE];

function mount(over: Partial<React.ComponentProps<typeof PropsCatalog>> = {}) {
  const cb = {
    onToggleFavorite: vi.fn(), onPick: vi.fn(), onUpload: vi.fn(), onRename: vi.fn(), onMoveTo: vi.fn(), onRemove: vi.fn(),
    onNewPack: vi.fn(), onRenamePack: vi.fn(), onRemovePack: vi.fn(), onClose: vi.fn(),
  };
  renderWithProviders(<PropsCatalog props={ALL} packs={[PACK_DUNGEON, PACK_FOREST]} canManage favorites={[]} recents={[]} {...cb} {...over} />);
  return { cb, rejilla: () => screen.getByTestId('mp-propcat-grid'), rail: () => screen.getByRole('tablist', { name: 'Paquetes' }) };
}
const baldosas = (): string[] => [...screen.getByTestId('mp-propcat-grid').querySelectorAll('.mp-propcat-tile:not(.mp-propcat-add) .mp-propcat-n')].map(n => n.textContent ?? '');

describe('<PropsCatalog> el rail y la rejilla', () => {
  it('abre en el primer paquete, con su sección y su cuenta; el rail lleva Todo, Recientes, Favoritos y mis paquetes', () => {
    const { rail } = mount();
    expect(within(rail()).getByRole('tab', { name: /Mazmorra propia/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(rail()).getByRole('tab', { name: /Mazmorra propia/ }).textContent).toContain('1');
    expect(within(rail()).getByRole('tab', { name: /Bosque de Karen/ }).textContent).toContain('1');
    expect(within(rail()).getByRole('tab', { name: /Sin clasificar/ }).textContent).toContain('1');
    expect(screen.getByRole('heading', { name: 'Mazmorra propia (1 pieza)' })).toBeInTheDocument();
    expect(baldosas()).toEqual(['Columna']);
    // Sin piezas de serie, «DE SERIE · ROLVIUM» no se pinta: seis rótulos vacíos serían ruido.
    expect(screen.queryByText('De serie · Rolvium')).not.toBeInTheDocument();
  });

  it('«Todo» enseña una sección por paquete, luego las sin clasificar; y las de serie sólo si hay alguna', async () => {
    const u = userEvent.setup();
    const { rail } = mount({ props: [...ALL, APP_CHAIR] });
    await u.click(within(rail()).getByRole('tab', { name: /^Todo/ }));
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Mazmorra propia (1 pieza)', 'Bosque de Karen (1 pieza)', 'Sin clasificar (1 pieza)', 'Mobiliario (1 pieza)']);
    expect(screen.getByText('De serie · Rolvium')).toBeInTheDocument();
    expect(within(rail()).getByRole('tab', { name: /Mobiliario/ })).toBeInTheDocument();
  });

  it('el buscador mira en TODOS los paquetes, sin acentos, y cambia la cuenta', async () => {
    const u = userEvent.setup();
    mount();
    await u.type(screen.getByRole('searchbox'), 'mesa');
    expect(baldosas()).toEqual(['Mesa larga']);
    expect(screen.getByText('Piezas · 1')).toBeInTheDocument();
    await u.clear(screen.getByRole('searchbox'));
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Ninguna pieza con ese nombre aquí.')).toBeInTheDocument();
  });

  it('AGRUPAR en «Ninguno» quita las cabeceras; ORDENAR cambia el orden', async () => {
    const u = userEvent.setup();
    const { rail } = mount();
    await u.click(within(rail()).getByRole('tab', { name: /^Todo/ }));
    await u.selectOptions(screen.getByRole('combobox', { name: 'Agrupar' }), 'none');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(baldosas()).toEqual(['Columna', 'Mesa larga', 'Roble']);
    await u.selectOptions(screen.getByRole('combobox', { name: 'Ordenar' }), 'recent');
    expect(baldosas()).toEqual(['Mesa larga', 'Columna', 'Roble']);
  });

  it('el punto oro marca las tuyas y no las de serie; la leyenda y la nota van al pie', async () => {
    const u = userEvent.setup();
    const { rail } = mount({ props: [PROP_OAK, APP_CHAIR] });
    await u.click(within(rail()).getByRole('tab', { name: /^Todo/ }));
    expect(screen.getByRole('button', { name: 'Elegir Roble' }).querySelector('.mp-texcat-dot')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Elegir Silla' }).querySelector('.mp-texcat-dot')).toBeNull();
    expect(screen.getByText(/el punto marca las tuyas/)).toBeInTheDocument();
    expect(screen.getByText(/Las piezas son de la HERRAMIENTA/)).toBeInTheDocument();
  });

  it('con la biblioteca cargando o vacía lo dice', () => {
    mount({ props: null, packs: null });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount({ props: [], packs: [] });
    expect(screen.getByText(/La biblioteca está vacía/)).toBeInTheDocument();
  });
});

describe('<PropsCatalog> elegir, favoritos y recientes', () => {
  it('pinchar una baldosa la elige como sello', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Elegir Columna' }));
    expect(cb.onPick).toHaveBeenCalledWith(PROP_COLUMN);
  });

  it('la estrella marca y desmarca, y el estante Favoritos enseña las marcadas', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount({ favorites: ['pr-oak'] });
    await u.click(within(rail()).getByRole('tab', { name: /Favoritos/ }));
    expect(baldosas()).toEqual(['Roble']);
    await u.click(screen.getByRole('button', { name: /Quitar de favoritos · Roble/ }));
    expect(cb.onToggleFavorite).toHaveBeenCalledWith(PROP_OAK);
  });

  it('Recientes va en el orden en que se plantaron', async () => {
    const u = userEvent.setup();
    const { rail } = mount({ recents: ['pr-tab', 'pr-oak'] });
    await u.click(within(rail()).getByRole('tab', { name: /Recientes/ }));
    expect(baldosas()).toEqual(['Mesa larga', 'Roble']);
  });
});

describe('<PropsCatalog> ordenar la biblioteca, por permiso', () => {
  it('sin el permiso no salen ni Subir, ni los tres puntos, ni Nuevo paquete — pero elegir sí', () => {
    mount({ canManage: false });
    expect(screen.queryByRole('button', { name: /Subir piezas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Opciones de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo paquete/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Subir')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir Columna' })).toBeInTheDocument();
  });

  it('Subir va al paquete abierto, y la baldosa Subir de cada sección al suyo', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount();
    await u.click(screen.getByRole('button', { name: /Subir piezas/ }));
    expect(cb.onUpload).toHaveBeenCalledWith(PACK_DUNGEON.id);
    await u.click(within(rail()).getByRole('tab', { name: /Sin clasificar/ }));
    await u.click(screen.getByRole('button', { name: /^Subir$/ }));
    expect(cb.onUpload).toHaveBeenLastCalledWith(null);
  });

  it('arrastrar imágenes sobre el catálogo abre la subida con esos ficheros en el paquete abierto', () => {
    const { cb } = mount();
    const f = new File(['x'], 'roble.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('mp-propcat'), { dataTransfer: { files: [f, new File(['y'], 'notas.txt', { type: 'text/plain' })] } });
    expect(cb.onUpload).toHaveBeenCalledWith(PACK_DUNGEON.id, [f]);
  });

  it('los tres puntos: renombrar (pide el nombre), mover a otro paquete ahí mismo, y borrar (pregunta)', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Columna»' }));
    const menu = screen.getByRole('menu', { name: 'Opciones de «Columna»' });
    expect(within(menu).getAllByRole('menuitem').map(m => m.textContent)).toEqual(['editRenombrar', 'drive_file_moveMover a…', 'deleteEliminar']);
    await u.click(within(menu).getByRole('menuitem', { name: 'Mover a…' }));
    await u.click(screen.getByRole('menuitemradio', { name: 'Bosque de Karen' }));
    expect(cb.onMoveTo).toHaveBeenCalledWith(PROP_COLUMN, PACK_FOREST.id);

    await u.click(screen.getByRole('button', { name: 'Opciones de «Columna»' }));
    await u.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    const campo = await screen.findByRole('textbox');
    await u.clear(campo);
    await u.type(campo, '  Pilar  ');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(cb.onRename).toHaveBeenCalledWith(PROP_COLUMN, 'Pilar');

    await u.click(screen.getByRole('button', { name: 'Opciones de «Columna»' }));
    await u.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(await screen.findByText(/¿Borrar la pieza «Columna» de la biblioteca\? Las que ya pusiste en los mapas se quedan\./)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(cb.onRemove).toHaveBeenCalledWith(PROP_COLUMN);
  });

  it('nuevo paquete pide el nombre; el menú del paquete renombra y borra (avisando de que las piezas se quedan)', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: /Nuevo paquete/ }));
    await u.type(await screen.findByRole('textbox'), 'Cripta');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(cb.onNewPack).toHaveBeenCalledWith('Cripta');

    await u.click(screen.getByRole('button', { name: 'Opciones del paquete «Bosque de Karen»' }));
    await u.click(screen.getByRole('menuitem', { name: 'Borrar paquete' }));
    expect(await screen.findByText(/Sus piezas no se borran: pasan a «Sin clasificar»/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(cb.onRemovePack).toHaveBeenCalledWith(PACK_FOREST);
  });
});
