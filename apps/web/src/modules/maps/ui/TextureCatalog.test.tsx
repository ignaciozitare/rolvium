import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import type { Texture } from '../domain/entities/Scene';
import { TextureCatalog } from './TextureCatalog';

/**
 * EL CATÁLOGO DE TEXTURAS (`rolvium.pen` frame `sO0GV`). Encargo suyo del 2026-09-04: «*el botón de cambiar
 * debería abrir un catálogo donde estén CLASIFICADAS como en el catálogo de objetos que ya tenemos
 * diseñado*», y al ver el modal viejo: «*no hay filtro ni buscar ni nada*».
 */

const tex = (over: Partial<Texture> & { id: string; name: string }): Texture => ({
  category: 'stone', url: `https://x/${over.id}.png`, tileCells: 1, uploadedBy: 'u-gm',
  createdAt: '', updatedAt: '', ...over,
});
const CATALOGO: Texture[] = [
  tex({ id: 'tx-roca', name: 'Roca gris', category: 'stone', tileCells: 2 }),
  tex({ id: 'tx-roble', name: 'Roble viejo', category: 'wood' }),
  tex({ id: 'tx-mosaico', name: 'Mosaico fino', category: 'tile', tileCells: 0.5 }),
  tex({ id: 'tx-rolvium', name: 'Losa de Rolvium', category: 'stone', uploadedBy: null }),
];

function mount(over: Partial<React.ComponentProps<typeof TextureCatalog>> = {}) {
  const cb = { onPick: vi.fn(), onUpload: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
  renderWithProviders(<TextureCatalog which="floor" textures={CATALOGO} canManage {...cb} {...over} />);
  return { cb, rejilla: () => screen.getByTestId('mp-texcat') };
}
/** Abre el menú de los tres puntos de una textura. */
const abrirMenu = async (u: ReturnType<typeof userEvent.setup>, name: string) =>
  u.click(screen.getByRole('button', { name: `Opciones de «${name}»` }));
/** Sólo las piezas de la rejilla: fuera «Subir» y fuera el botón de borrar que asoma sobre cada una. */
const piezas = (r: HTMLElement): string[] =>
  [...r.querySelectorAll('.mp-texcat-item')].map(b => b.textContent ?? '').filter(x => !x.includes('Subir a'));

describe('<TextureCatalog>', () => {
  it('enseña buscador, categorías y la rejilla — lo que el modal viejo no tenía', () => {
    const { rejilla } = mount();
    expect(screen.getByRole('searchbox', { name: 'Buscar por nombre…' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Categorías' })).toBeInTheDocument();
    expect(piezas(rejilla())).toHaveLength(4);
  });

  /** Las ocho: «Todas» más las siete de la base. Ninguna categoría puede quedarse sin su chip. */
  it('están todas las categorías, y arranca en «Todas»', () => {
    mount();
    const grupo = screen.getByRole('radiogroup', { name: 'Categorías' });
    expect(within(grupo).getAllByRole('radio').map(b => b.textContent))
      .toEqual(['Todas', 'Piedra', 'Madera', 'Baldosa', 'Tierra', 'Hierba', 'Agua', 'Varios']);
    expect(within(grupo).getByRole('radio', { name: 'Todas' })).toHaveAttribute('aria-checked', 'true');
  });

  it('la categoría filtra la rejilla', async () => {
    const u = userEvent.setup();
    const { rejilla } = mount();
    await u.click(screen.getByRole('radio', { name: 'Madera' }));
    expect(piezas(rejilla())).toEqual(['Roble viejo']);
  });

  it('el buscador filtra por nombre, y se cruza con la categoría', async () => {
    const u = userEvent.setup();
    const { rejilla } = mount();
    await u.type(screen.getByRole('searchbox'), 'ro');
    expect(piezas(rejilla()).sort()).toEqual(['Losa de Rolvium', 'Roble viejo', 'Roca gris']);
    await u.click(screen.getByRole('radio', { name: 'Madera' }));
    expect(piezas(rejilla())).toEqual(['Roble viejo']);
  });

  it('sin resultados lo dice, en vez de dejar un hueco mudo', async () => {
    const u = userEvent.setup();
    mount();
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/Ninguna textura con ese nombre/)).toBeInTheDocument();
  });

  /**
   * 🔑 La miniatura se REPITE al tamaño que la textura recuerda, no estirada: es lo único que deja ver si un
   * mosaico va a quedar diminuto o gigante ANTES de ponerlo («*los mosaicos quedan muy grandes*»).
   */
  it('cada miniatura se repite al tamaño de baldosa que recuerda la textura', () => {
    const { rejilla } = mount();
    const mini = (name: string) =>
      within(rejilla()).getByTitle(name).querySelector('.mp-texcat-mini') as HTMLElement;
    expect(mini('Roca gris').style.backgroundSize).toBe('50% auto');       // 2 casillas de 4 → media anchura
    expect(mini('Mosaico fino').style.backgroundSize).toBe('12.5% auto');  // media casilla → ocho azulejos
  });

  it('elegir una la devuelve entera, con su tamaño de baldosa dentro', async () => {
    const u = userEvent.setup();
    const { cb, rejilla } = mount();
    await u.click(within(rejilla()).getByTitle('Roca gris'));
    expect(cb.onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-roca', tileCells: 2 }));
  });

  it('subir va a la categoría que esté elegida, y a «Varios» con «Todas» puesto', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: /Subir a Varios/ }));
    expect(cb.onUpload).toHaveBeenCalledWith('misc');
    await u.click(screen.getByRole('radio', { name: 'Hierba' }));
    await u.click(screen.getByRole('button', { name: /Subir a Hierba/ }));
    expect(cb.onUpload).toHaveBeenLastCalledWith('grass');
  });

  /**
   * 🔒 EL MENÚ DE LOS TRES PUNTOS, pedido por él el 2026-09-04: «*donde está el borrar de la textura, unos …
   * verticales que desplieguen un pequeño menú que diga borrar o categorizar y te deje elegir ahí mismo qué
   * categoría es*», y al rato: «*otra opción además de estas es renombrar*».
   */
  it('los tres puntos despliegan renombrar, categorizar y borrar', async () => {
    const u = userEvent.setup();
    mount();
    await abrirMenu(u, 'Roca gris');
    const menu = screen.getByRole('menu', { name: 'Opciones de «Roca gris»' });
    // Por el nombre accesible, no por el texto crudo: el icono es texto y va marcado como decorativo.
    for (const opcion of ['Renombrar', 'Clasificar', 'Eliminar']) {
      expect(within(menu).getByRole('menuitem', { name: opcion })).toBeInTheDocument();
    }
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  });

  it('categorizar deja elegir la categoría ahí mismo, sin otro diálogo', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Clasificar' }));
    const menu = screen.getByRole('menu', { name: 'Opciones de «Roca gris»' });
    // Las siete de la base, y marcada la que tiene ahora.
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(7);
    expect(within(menu).getByRole('menuitemradio', { name: 'Piedra' })).toHaveAttribute('aria-checked', 'true');
    await u.click(within(menu).getByRole('menuitemradio', { name: 'Hierba' }));
    expect(cb.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-roca' }), { category: 'grass' });
  });

  it('elegir la categoría que ya tenía no escribe nada', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Clasificar' }));
    await u.click(screen.getByRole('menuitemradio', { name: 'Piedra' }));
    expect(cb.onUpdate).not.toHaveBeenCalled();
  });

  it('renombrar pide el nombre nuevo y lo guarda sin espacios de más', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    const campo = await screen.findByRole('textbox');
    await u.clear(campo);
    await u.type(campo, '  Roca húmeda  ');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(cb.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-roca' }), { name: 'Roca húmeda' });
  });

  it('renombrar a vacío no guarda nada: sin nombre no se vuelve a encontrar', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    await u.clear(await screen.findByRole('textbox'));
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(cb.onUpdate).not.toHaveBeenCalled();
  });

  it('borrar pide confirmación antes de tocar nada', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(cb.onRemove).not.toHaveBeenCalled();                       // todavía no: primero pregunta
    await u.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(cb.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-roca' }));
  });

  it('cancelar la confirmación no borra nada', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await abrirMenu(u, 'Roca gris');
    await u.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    await u.click(await screen.findByRole('button', { name: /Cancelar/i }));
    expect(cb.onRemove).not.toHaveBeenCalled();
  });

  /**
   * 🔒 EL PERMISO, no «es tuya» (orden suya del 2026-09-04: «*esto tiene que ser un permiso en el motor de
   * permisos, no lo puede hacer cualquiera*»). Sin él NO hay tres puntos ni botón de subir — ni siquiera sobre
   * una textura que subió uno mismo, que es lo que él eligió cuando se le preguntó.
   */
  it('sin el permiso no hay tres puntos ni subir, pero el catálogo se ve y se elige', async () => {
    const u = userEvent.setup();
    const { cb, rejilla } = mount({ canManage: false });
    expect(screen.queryByRole('button', { name: /Opciones de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subir a/ })).not.toBeInTheDocument();
    // Pero elegir textura sigue siendo de cualquiera: si no, un jugador no podría ni jugar en el mapa.
    await u.click(within(rejilla()).getByTitle('Roca gris'));
    expect(cb.onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-roca' }));
  });

  it('con el permiso, los tres puntos salen en TODAS, no sólo en las tuyas', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Opciones de «Losa de Rolvium»' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opciones de «Roca gris»' })).toBeInTheDocument();
  });

  it('mientras cargan lo dice, y no finge que el catálogo está vacío', () => {
    mount({ textures: null });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(screen.queryByText(/Ninguna textura con ese nombre/)).not.toBeInTheDocument();
  });

  /** 🔑 Y lo que él corrigió: esto NO es la biblioteca de la campaña. */
  it('dice que son de la herramienta, no de la campaña', () => {
    mount();
    expect(screen.getByText(/Son de la HERRAMIENTA, no de tu campaña/)).toBeInTheDocument();
  });

  /**
   * El mismo catálogo sirve para la PUERTA (2026-09-07), pero lo que promete al elegir una no es lo mismo:
   * en una puerta no se pone «como textura base de esta escena, con su tamaño de baldosa».
   */
  it('abierto para una PUERTA cambia el título y lo que promete al elegir', () => {
    const { rejilla } = mount({ which: 'door' });
    expect(screen.getByText('Textura de la puerta')).toBeInTheDocument();
    expect(screen.getByText(/se pone en la puerta, con el azulejo de una casilla/)).toBeInTheDocument();
    expect(screen.queryByText(/textura base de esta escena/)).not.toBeInTheDocument();
    // Y el catálogo es el mismo: las mismas texturas, con el mismo botón de subir.
    expect(piezas(rejilla())).toHaveLength(4);
  });
});
