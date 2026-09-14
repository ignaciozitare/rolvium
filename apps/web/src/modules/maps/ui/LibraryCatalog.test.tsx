import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { PACK_DUNGEON, PACK_FOREST, PROP_COLUMN, PROP_OAK, PROP_TABLE } from '../../../../tests/helpers/fakes';
import { LIBRARY_DRAG_MIME } from '../domain/useCases/libraryRules';
import { PropsCatalog } from './PropsCatalog';

/**
 * LO COMÚN DEL CATÁLOGO (`LibraryCatalog`), probado con la cara de las piezas: los tres puntos SIEMPRE a la vista, la
 * selección múltiple (círculo · Ctrl+clic · Mayús+clic · barra · Esc) y el arrastre de baldosas a un grupo del rail.
 * Todo del 2026-09-13 (§ 6.8, puntos 3 y 4), tras probar él la galería: «*nadie va a saber que existen*» y
 * «*seleccionar múltiples componentes y arrastrarlos al paquete que quiera*».
 */
const ALL = [PROP_OAK, PROP_COLUMN, PROP_TABLE];

function mount(over: Partial<React.ComponentProps<typeof PropsCatalog>> = {}) {
  const cb = {
    onToggleFavorite: vi.fn(), onPick: vi.fn(), onUpload: vi.fn(), onRename: vi.fn(), onMoveTo: vi.fn(), onRemove: vi.fn(),
    onNewPack: vi.fn(), onRenamePack: vi.fn(), onRemovePack: vi.fn(), onClose: vi.fn(),
  };
  renderWithProviders(<PropsCatalog props={ALL} packs={[PACK_DUNGEON, PACK_FOREST]} canManage favorites={[]} recents={[]} initialShelf={{ kind: 'all' }} {...cb} {...over} />);
  return { cb, rail: () => screen.getByRole('tablist', { name: 'Paquetes' }) };
}
const marcar = (name: string) => screen.getByRole('button', { name: `Marcar ${name}` });
const barra = () => screen.queryByTestId('mp-propcat-selbar');
/** Un `dataTransfer` de mentira, como el que el navegador da al arrastrar una baldosa. */
const transfer = () => {
  const data: Record<string, string> = {};
  return {
    types: [] as string[], effectAllowed: 'none', dropEffect: 'none',
    setData: (k: string, v: string) => { data[k] = v; if (!(this as unknown)) return; },
    getData: (k: string) => data[k] ?? '',
    files: [] as File[], _data: data,
  };
};

describe('<LibraryCatalog> los tres puntos y el círculo de marcar', () => {
  it('los tres puntos y el círculo están en TODAS las baldosas sin pasar por encima; sin permiso no hay ninguno', () => {
    mount();
    expect(screen.getAllByRole('button', { name: /^Opciones de «/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Marcar / })).toHaveLength(3);
    // No dependen de un estado de «hover»: son botones normales, visibles desde el primer pintado.
    expect(screen.getByRole('button', { name: 'Opciones de «Roble»' })).toBeVisible();
  });

  it('sin permiso no hay ni tres puntos ni círculo, y pinchar sigue eligiendo', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ canManage: false });
    expect(screen.queryByRole('button', { name: /^Marcar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Opciones de «/ })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Elegir Roble' }));
    expect(cb.onPick).toHaveBeenCalledWith(PROP_OAK);
  });
});

describe('<LibraryCatalog> la selección múltiple', () => {
  it('el círculo marca y desmarca; con algo marcado sale la barra con la cuenta, y quitar la selección la esconde', async () => {
    const u = userEvent.setup();
    mount();
    expect(barra()).not.toBeInTheDocument();
    await u.click(marcar('Roble'));
    expect(screen.getByRole('button', { name: 'Desmarcar Roble' })).toHaveAttribute('aria-pressed', 'true');
    expect(barra()).toHaveTextContent('1 seleccionado');
    await u.click(marcar('Columna'));
    expect(barra()).toHaveTextContent('2 seleccionados');
    await u.click(screen.getByRole('button', { name: /Quitar selección/ }));
    expect(barra()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desmarcar Roble' })).not.toBeInTheDocument();
  });

  it('Ctrl+clic en la baldosa marca sin elegir; con algo marcado un clic normal marca otra en vez de salir; Mayús+clic coge el tramo', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir Columna' }), { ctrlKey: true });
    expect(cb.onPick).not.toHaveBeenCalled();
    expect(barra()).toHaveTextContent('1 seleccionado');
    // Con algo marcado, el clic normal no se va del catálogo: marca.
    await u.click(screen.getByRole('button', { name: 'Elegir Roble' }));
    expect(cb.onPick).not.toHaveBeenCalled();
    expect(barra()).toHaveTextContent('2 seleccionados');
    await u.click(screen.getByRole('button', { name: /Quitar selección/ }));
    // Mayús+clic: desde la última marcada hasta ésta, EN EL ORDEN EN QUE SE VEN (por secciones: Columna en
    // Mazmorra, Roble en Bosque, Mesa larga en Sin clasificar): de Columna a Roble son dos; a Mesa larga, las tres.
    await u.click(marcar('Columna'));
    fireEvent.click(screen.getByRole('button', { name: 'Elegir Roble' }), { shiftKey: true });
    expect(barra()).toHaveTextContent('2 seleccionados');
    await u.click(screen.getByRole('button', { name: /Quitar selección/ }));
    await u.click(marcar('Columna'));
    fireEvent.click(screen.getByRole('button', { name: 'Elegir Mesa larga' }), { shiftKey: true });
    expect(barra()).toHaveTextContent('3 seleccionados');
  });

  it('Esc quita la selección SIN cerrar el catálogo; sin selección, Esc cierra como siempre', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(marcar('Roble'));
    await u.keyboard('{Escape}');
    expect(barra()).not.toBeInTheDocument();
    expect(cb.onClose).not.toHaveBeenCalled();
    await u.keyboard('{Escape}');
    expect(cb.onClose).toHaveBeenCalled();
  });

  it('MOVER A… de la barra manda TODAS las marcadas al paquete elegido (menos las que ya están) y limpia la selección', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(marcar('Roble'));      // ya en Bosque de Karen
    await u.click(marcar('Columna'));    // en Mazmorra propia
    await u.click(screen.getByRole('button', { name: /Mover a…/ }));
    await u.click(screen.getByRole('menuitemradio', { name: 'Bosque de Karen' }));
    expect(cb.onMoveTo).toHaveBeenCalledTimes(1);
    expect(cb.onMoveTo).toHaveBeenCalledWith(PROP_COLUMN, PACK_FOREST.id);
    expect(barra()).not.toBeInTheDocument();
  });

  it('BORRAR de la barra pregunta con la cuenta y, al confirmar, borra todas las marcadas', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(marcar('Roble'));
    await u.click(marcar('Mesa larga'));
    await u.click(within(screen.getByTestId('mp-propcat-selbar')).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText(/¿Borrar 2 objetos de la biblioteca\?/)).toBeInTheDocument();
    await u.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!);
    expect(cb.onRemove).toHaveBeenCalledTimes(2);
    expect(cb.onRemove).toHaveBeenCalledWith(PROP_OAK);
    expect(cb.onRemove).toHaveBeenCalledWith(PROP_TABLE);
    expect(barra()).not.toBeInTheDocument();
  });
});

describe('<LibraryCatalog> arrastrar baldosas a un paquete del rail', () => {
  it('arrastrar una baldosa sin marcar la lleva sola al paquete donde se suelta; el paquete se ilumina al pasar', async () => {
    const { cb, rail } = mount();
    const dt = transfer();
    const celda = screen.getByRole('button', { name: 'Elegir Columna' }).closest('.mp-propcat-cell')!;
    expect(celda).toHaveAttribute('draggable', 'true');
    fireEvent.dragStart(celda, { dataTransfer: dt });
    expect(dt._data[LIBRARY_DRAG_MIME]).toBe(JSON.stringify([PROP_COLUMN.id]));
    dt.types = [LIBRARY_DRAG_MIME];
    const destino = within(rail()).getByRole('tab', { name: /Bosque de Karen/ }).parentElement!;
    fireEvent.dragOver(destino, { dataTransfer: dt });
    expect(destino).toHaveClass('drop');
    fireEvent.drop(destino, { dataTransfer: dt });
    expect(cb.onMoveTo).toHaveBeenCalledWith(PROP_COLUMN, PACK_FOREST.id);
    expect(destino).not.toHaveClass('drop');
    // Y no abre la subida en lote: soltar baldosas no es soltar ficheros.
    expect(cb.onUpload).not.toHaveBeenCalled();
  });

  it('con varias marcadas, arrastrar una de ellas las lleva TODAS; a «Sin clasificar» también', async () => {
    const u = userEvent.setup();
    const { cb, rail } = mount();
    await u.click(marcar('Roble'));
    await u.click(marcar('Columna'));
    const dt = transfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Elegir Roble' }).closest('.mp-propcat-cell')!, { dataTransfer: dt });
    expect(JSON.parse(dt._data[LIBRARY_DRAG_MIME]!)).toEqual([PROP_OAK.id, PROP_COLUMN.id]);
    dt.types = [LIBRARY_DRAG_MIME];
    const suelto = within(rail()).getByRole('tab', { name: /Sin clasificar/ }).parentElement!;
    fireEvent.drop(suelto, { dataTransfer: dt });
    expect(cb.onMoveTo).toHaveBeenCalledWith(PROP_OAK, null);
    expect(cb.onMoveTo).toHaveBeenCalledWith(PROP_COLUMN, null);
    expect(barra()).not.toBeInTheDocument();
  });

  it('soltar sobre el paquete donde ya está no escribe nada; sin permiso no se arrastra', () => {
    const { cb, rail } = mount();
    const dt = transfer();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Elegir Roble' }).closest('.mp-propcat-cell')!, { dataTransfer: dt });
    dt.types = [LIBRARY_DRAG_MIME];
    fireEvent.drop(within(rail()).getByRole('tab', { name: /Bosque de Karen/ }).parentElement!, { dataTransfer: dt });
    expect(cb.onMoveTo).not.toHaveBeenCalled();
  });

  it('sin permiso las baldosas no se arrastran', () => {
    mount({ canManage: false });
    expect(screen.getByRole('button', { name: 'Elegir Roble' }).closest('.mp-propcat-cell')).toHaveAttribute('draggable', 'false');
  });
});
