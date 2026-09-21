import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent, within } from '../../../../tests/helpers/render';
import { emptyDoc, heading, paragraph, type RichDoc } from '@rolvium/core';
import type { MapsPort, Scene } from '@/modules/maps';
import { SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import type { Adventure } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventuresTab } from './AdventuresTab';
import { SAVE_DELAY_MS } from './useAdventureDoc';

const DOC: RichDoc = { v: 1, blocks: [heading(1, [{ t: 'El almacén' }]), paragraph([{ t: 'Llegan de noche.' }])] };

const adv = (over: Partial<Adventure> = {}): Adventure => ({
  id: 'a1', campaignId: 'c1', title: 'El almacén de los muelles', summary: null, doc: DOC,
  status: 'running', sortOrder: 0, updatedAt: '2026-09-20T10:00:00Z', ...over,
});

const scene = (over: Partial<Scene> = {}): Scene => ({ ...SCENE_WAREHOUSE, ...over });

function fakeAdventures(rows: Adventure[], over: Partial<AdventuresPort> = {}): AdventuresPort {
  return {
    list: vi.fn().mockResolvedValue(rows),
    getById: vi.fn(async (id: string) => rows.find(r => r.id === id) ?? null),
    create: vi.fn(async (campaignId: string, title: string) => adv({ id: 'a-new', campaignId, title, doc: emptyDoc(), status: 'draft' })),
    update: vi.fn().mockResolvedValue('2026-09-21T12:00:00Z'),
    saveDoc: vi.fn().mockResolvedValue('2026-09-20T10:05:00Z'),
    remove: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const fakeMaps = (scenes: Scene[]): MapsPort => ({
  listScenes: vi.fn().mockResolvedValue(scenes),
  createScene: vi.fn(async (input: { name: string; adventureId?: string; sortOrder?: number }) => scene({
    id: 's-new', name: input.name, adventureId: input.adventureId ?? 'a1', sortOrder: input.sortOrder ?? 0,
  })),
  updateScene: vi.fn().mockResolvedValue(undefined),
} as unknown as MapsPort);

const paint = (adventures: AdventuresPort, maps: MapsPort, onOpenScene = vi.fn()) => ({
  onOpenScene,
  ...renderWithProviders(<AdventuresTab campaignId="c1" onOpenScene={onOpenScene} adventures={adventures} maps={maps} />),
});

describe('AdventuresTab — el carril', () => {
  it('lista las aventuras de la campaña con su estado y cuántas escenas tienen', async () => {
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft' })]);
    paint(adventures, fakeMaps([scene({ id: 's1', adventureId: 'a1' }), scene({ id: 's2', adventureId: 'a2' })]));
    expect(await screen.findByText('El almacén de los muelles')).toBeInTheDocument();
    expect(screen.getByText('La feria')).toBeInTheDocument();
    // «1 escena», en singular: es lo primero que se lee de cada aventura.
    expect(screen.getAllByText(/1 escena\b/)).toHaveLength(2);
    // Con las archivadas: el carril las enseña aparte, y borrar necesita saber cuántas quedan.
    expect(adventures.list).toHaveBeenCalledWith('c1', { includeArchived: true });
  });

  it('abre sola la que está EN CURSO, no la primera de la lista', async () => {
    const adventures = fakeAdventures([adv({ id: 'a1', title: 'Vieja', status: 'done' }), adv({ id: 'a2', title: 'La de ahora', status: 'running' })]);
    paint(adventures, fakeMaps([]));
    await waitFor(() => expect(adventures.getById).toHaveBeenCalledWith('a2'));
  });

  it('sólo enseña las escenas de la aventura abierta', async () => {
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft' })]);
    paint(adventures, fakeMaps([
      scene({ id: 's1', name: 'El portón', adventureId: 'a1' }),
      scene({ id: 's2', name: 'La carpa', adventureId: 'a2' }),
    ]));
    expect(await screen.findByRole('button', { name: 'El portón' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'La carpa' })).toBeNull();
  });

  it('pinchar una escena la abre en la mesa', async () => {
    const user = userEvent.setup();
    const onOpenScene = vi.fn();
    paint(fakeAdventures([adv()]), fakeMaps([scene({ id: 's1', name: 'El portón', adventureId: 'a1' })]), onOpenScene);
    await user.click(await screen.findByRole('button', { name: 'El portón' }));
    expect(onOpenScene).toHaveBeenCalledWith('s1');
  });

  it('crear una aventura la añade al carril y la abre', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()]);
    paint(adventures, fakeMaps([]));
    await screen.findByText('El almacén de los muelles');
    await user.click(screen.getByRole('button', { name: 'Nueva aventura' }));
    // Detrás de todas: sin su sitio nacían todas en el 0 y empataban con la primera.
    await waitFor(() => expect(adventures.create).toHaveBeenCalledWith('c1', 'Aventura 2', 1));
    expect(await screen.findByText('Aventura 2')).toBeInTheDocument();
  });

  it('si la base no las da, lo cuenta y deja reintentar', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('rls')).mockResolvedValue([adv()]);
    const adventures = fakeAdventures([adv()], { list });
    paint(adventures, fakeMaps([]));
    expect(await screen.findByText('No se han podido abrir las aventuras.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('El almacén de los muelles')).toBeInTheDocument();
  });
});

describe('AdventuresTab — el documento', () => {
  it('pinta el cuaderno de la aventura abierta, con su título y su estado', async () => {
    paint(fakeAdventures([adv()]), fakeMaps([]));
    expect(await screen.findByRole('textbox', { name: 'Título de la aventura' })).toHaveValue('El almacén de los muelles');
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
  });

  it('trae las cosas que SÓLO tiene una aventura: tablas y enlace a escena', async () => {
    paint(fakeAdventures([adv()]), fakeMaps([]));
    expect(await screen.findByRole('button', { name: 'Tabla de encuentro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tabla de PNJ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enlazar escena' })).toBeInTheDocument();
  });

  it('enlazar una escena ofrece las de ESTA aventura y mete el chip', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv()]), fakeMaps([scene({ id: 's1', name: 'El portón', adventureId: 'a1' })]));
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Enlazar escena' }));
    const dialog = await screen.findByText('¿Qué escena enlazo?');
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /El portón/ }).at(-1)!);
    await waitFor(() => expect(screen.queryByText('¿Qué escena enlazo?')).toBeNull());
  });

  it('el índice sale al lado con los títulos del documento', async () => {
    paint(fakeAdventures([adv()]), fakeMaps([]));
    expect(await screen.findByRole('navigation', { name: 'Índice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'El almacén' })).toBeInTheDocument();
  });

  it('ABRIR APARTE abre la ventana de esa aventura', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    paint(fakeAdventures([adv()]), fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Abrir aparte/ }));
    expect(open).toHaveBeenCalledWith('/adventures/a1', '_blank', 'noopener');
    open.mockRestore();
  });

  it('cambiar el título lo guarda y el carril dice lo mismo que la cabecera', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()]);
    paint(adventures, fakeMaps([]));
    const field = await screen.findByRole('textbox', { name: 'Título de la aventura' });
    await user.clear(field);
    await user.type(field, 'X');
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a1', { title: 'X' }));
    // El carril lo dice también: el título es uno solo, no dos que se separan mientras se escribe.
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  /** 🐞 Cazado por el revisor el 2026-09-21: el carril sólo copiaba el título de la ABIERTA, y al abrir otra volvía el viejo. */
  it('el título nuevo se queda en el carril al abrir otra aventura', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]), fakeMaps([]));
    const field = await screen.findByRole('textbox', { name: 'Título de la aventura' });
    await user.clear(field);
    await user.type(field, 'El puerto');
    await user.click(screen.getByRole('button', { name: /La feria.*Borrador/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Título de la aventura' })).toHaveValue('La feria'));
    expect(screen.getByRole('button', { name: /El puerto.*En curso/ })).toBeInTheDocument();
  });

  /**
   * 🐞 Lo mismo que en `journal` (revisión del 2026-09-20): lo pendiente se vaciaba ANTES de mandarlo, así que
   * un fallo al guardar dejaba el texto en el limbo — al cerrar la ventana no había nada que reintentar.
   */
  it('tras un fallo al guardar, lo escrito sigue pendiente y el cierre lo reintenta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const saveDoc = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue('2026-09-20T10:06:00Z');
    const adventures = fakeAdventures([adv()], { saveDoc });
    const { unmount } = paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });

    const texto = screen.getAllByRole('textbox', { name: 'Texto del documento' });
    expect(texto.length).toBeGreaterThan(0);
    await user.click(texto[0]!);
    await user.keyboard(' y llueve');
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(saveDoc).toHaveBeenCalled());
    expect(await screen.findByText('no se ha podido guardar')).toBeInTheDocument();

    unmount();
    // Sale en fila con lo demás que se escribe de la aventura: un instante después, no en el mismo tic.
    await waitFor(() => expect(saveDoc).toHaveBeenCalledTimes(2));
    expect(saveDoc.mock.calls[1]![1]).toEqual(saveDoc.mock.calls[0]![1]);
    vi.useRealTimers();
  });
});

describe('AdventuresTab — Cmd+S', () => {
  it('fuerza el guardado sin esperar al retardo, como en Notas y Bitácora', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()]);
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox', { name: 'Texto del documento' })[0]!);
    await user.keyboard('x');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
  });
});

// ── LO QUE PARÓ EL QA (2026-09-20): el director ORGANIZA, no sólo escribe ──────────────────────────────────
// Diseño: rolvium.pen § 4 · «Aventuras/Carril · MENÚ DE UNA AVENTURA y el ESTADO», «… MENÚ DE UNA ESCENA ·
// mover a otra aventura» y «Aventuras/ARCHIVADAS y BORRAR una aventura con escenas» (aprobadas el 2026-09-21).

const openAdventureMenu = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(await screen.findByRole('button', { name: `Opciones de «${title}»` }));
  return screen.getByRole('menu', { name: 'Opciones de la aventura' });
};

describe('AdventuresTab — el menú de una aventura', () => {
  it('MARCAR EN CURSO: sólo hay una, y la que estaba pasa a terminada', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]);
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'La feria');
    await user.click(within(menu).getByRole('menuitem', { name: /^Marcar en curso/ }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a2', { status: 'running' }));
    expect(adventures.update).toHaveBeenCalledWith('a1', { status: 'done' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText(/^Terminada ·/)).toBeInTheDocument();
  });

  it('la que ya está en curso no se puede volver a marcar', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv()]), fakeMaps([]));
    const menu = await openAdventureMenu(user, 'El almacén de los muelles');
    expect(within(menu).getByRole('menuitem', { name: /^Marcar en curso/ })).toBeDisabled();
  });

  it('SUBIR la cambia de sitio con la de arriba, en pantalla y en la base', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]);
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'La feria');
    expect(within(menu).getByRole('menuitem', { name: 'Bajar' })).toBeDisabled();
    await user.click(within(menu).getByRole('menuitem', { name: 'Subir' }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a2', { sortOrder: 0 }));
    expect(adventures.update).toHaveBeenCalledWith('a1', { sortOrder: 1 });
    const rail = screen.getByRole('navigation', { name: 'Aventuras de la campaña' });
    expect(within(rail).getAllByRole('button', { name: /escenas?$/ }).map(b => b.textContent)[0]).toContain('La feria');
  });

  it('ARCHIVAR la abierta la quita del carril, abre otra y la deja en ARCHIVADAS', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]);
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'El almacén de los muelles');
    await user.click(within(menu).getByRole('menuitem', { name: 'Archivar' }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a1', { status: 'archived' }));
    await waitFor(() => expect(adventures.getById).toHaveBeenCalledWith('a2'));
    const fold = screen.getByRole('button', { name: /Archivadas · 1/ });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /El almacén de los muelles/ })).toBeNull();
    await user.click(fold);
    expect(screen.getByRole('button', { name: /El almacén de los muelles.*Archivada · 0 escenas/ })).toBeInTheDocument();
  });

  it('SACAR DEL ARCHIVO la devuelve al carril, al final y en borrador', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv(), adv({ id: 'a9', title: 'Los túneles', status: 'archived', sortOrder: 0 })]);
    paint(adventures, fakeMaps([]));
    await user.click(await screen.findByRole('button', { name: /Archivadas · 1/ }));
    const menu = await openAdventureMenu(user, 'Los túneles');
    await user.click(within(menu).getByRole('menuitem', { name: 'Sacar del archivo' }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a9', { status: 'draft', sortOrder: 1 }));
    expect(screen.queryByRole('button', { name: /Archivadas/ })).toBeNull();
  });

  it('BORRAR una sin escenas sólo pide confirmar', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]);
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'La feria');
    await user.click(within(menu).getByRole('menuitem', { name: 'Borrar aventura' }));
    expect(await screen.findByText('Se borra con todo lo que tiene escrito. No tiene escenas.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(adventures.remove).toHaveBeenCalledWith('a2'));
    expect(screen.queryByText('La feria')).toBeNull();
  });

  it('BORRAR una CON escenas pregunta a dónde van, las lleva y sólo entonces la borra', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([
      adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 }), adv({ id: 'a3', title: 'Prólogo', status: 'done', sortOrder: 2 }),
    ]);
    const maps = fakeMaps([scene({ id: 's1', name: 'La carpa', adventureId: 'a2' }), scene({ id: 's2', name: 'La noria', adventureId: 'a2' })]);
    paint(adventures, maps);
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'La feria');
    await user.click(within(menu).getByRole('menuitem', { name: 'Borrar aventura' }));
    expect(await screen.findByText(/Tiene 2 escenas, y las escenas no se borran con ella/)).toBeInTheDocument();
    const options = screen.getByRole('radiogroup', { name: 'Llevar sus escenas a' });
    // Sale marcada la EN CURSO, que es adonde irían solas.
    expect(within(options).getByRole('radio', { name: /El almacén de los muelles/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(options).getByRole('radio', { name: /Prólogo/ }));
    await user.click(screen.getByRole('button', { name: /Mover y borrar/ }));
    await waitFor(() => expect(adventures.remove).toHaveBeenCalledWith('a2'));
    expect(maps.updateScene).toHaveBeenCalledWith('s1', { adventureId: 'a3' });
    expect(maps.updateScene).toHaveBeenCalledWith('s2', { adventureId: 'a3' });
    const moved = (maps.updateScene as ReturnType<typeof vi.fn>).mock.invocationCallOrder.at(-1)!;
    expect(moved).toBeLessThan((adventures.remove as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
    expect(screen.getByText(/^Terminada · 2 escenas/)).toBeInTheDocument();
  });

  it('la última aventura de la campaña no se puede borrar, y el menú dice por qué', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv()]), fakeMaps([]));
    const menu = await openAdventureMenu(user, 'El almacén de los muelles');
    const remove = within(menu).getByRole('menuitem', { name: /^Borrar aventura/ });
    expect(remove).toBeDisabled();
    expect(remove).toHaveTextContent('Es la única de la campaña');
  });

  it('si la base no acepta el cambio, lo dice y el carril vuelve a lo que hay de verdad', async () => {
    const user = userEvent.setup();
    const rows = [adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })];
    const adventures = fakeAdventures(rows, { update: vi.fn().mockRejectedValue(new Error('rls')) });
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    const menu = await openAdventureMenu(user, 'La feria');
    await user.click(within(menu).getByRole('menuitem', { name: 'Archivar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido hacer.');
    await waitFor(() => expect(adventures.list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('La feria')).toBeInTheDocument();
  });

  it('se cierra con Escape y devuelve el foco a sus tres puntos', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv()]), fakeMaps([]));
    await openAdventureMenu(user, 'El almacén de los muelles');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Opciones de «El almacén de los muelles»' })).toHaveFocus();
  });
});

describe('AdventuresTab — el estado desde la cabecera', () => {
  it('se elige entre borrador, en curso y terminada', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()]);
    paint(adventures, fakeMaps([]));
    await user.click(await screen.findByRole('button', { name: 'Estado de la aventura: En curso' }));
    const menu = screen.getByRole('menu', { name: 'Estado de la aventura' });
    expect(within(menu).getAllByRole('menuitemradio').map(r => r.querySelector('.av-pop-text')?.textContent)).toEqual(['Borrador', 'En curso', 'Terminada']);
    expect(within(menu).getByRole('menuitemradio', { name: 'En curso' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Terminada' }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalledWith('a1', { status: 'done' }));
    expect(screen.getByRole('button', { name: 'Estado de la aventura: Terminada' })).toBeInTheDocument();
  });
});

describe('AdventuresTab — las escenas de la aventura', () => {
  const twoScenes = () => fakeMaps([
    scene({ id: 's1', name: 'El portón', adventureId: 'a1', sortOrder: 0 }),
    scene({ id: 's2', name: 'El sótano', adventureId: 'a1', sortOrder: 1 }),
  ]);
  const openSceneMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(await screen.findByRole('button', { name: `Opciones de «${name}»` }));
    return screen.getByRole('menu', { name: 'Opciones de la escena' });
  };

  it('el + crea una escena EN ESTA aventura, pidiendo el nombre como en la mesa', async () => {
    const user = userEvent.setup();
    const maps = twoScenes();
    paint(fakeAdventures([adv()]), maps);
    await user.click(await screen.findByRole('button', { name: 'Nueva escena en esta aventura' }));
    await user.type(await screen.findByRole('textbox', { name: '' }), 'La bodega');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(maps.createScene).toHaveBeenCalledWith({ campaignId: 'c1', name: 'La bodega', adventureId: 'a1', sortOrder: 2 }));
    expect(await screen.findByRole('button', { name: 'La bodega' })).toBeInTheDocument();
  });

  it('RENOMBRAR', async () => {
    const user = userEvent.setup();
    const maps = twoScenes();
    paint(fakeAdventures([adv()]), maps);
    const menu = await openSceneMenu(user, 'El portón');
    await user.click(within(menu).getByRole('menuitem', { name: 'Renombrar' }));
    const input = await screen.findByDisplayValue('El portón');
    await user.clear(input);
    await user.type(input, 'La verja');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(maps.updateScene).toHaveBeenCalledWith('s1', { name: 'La verja' }));
    expect(screen.getByRole('button', { name: 'La verja' })).toBeInTheDocument();
  });

  it('BAJAR la cambia de sitio con la de debajo', async () => {
    const user = userEvent.setup();
    const maps = twoScenes();
    paint(fakeAdventures([adv()]), maps);
    const menu = await openSceneMenu(user, 'El portón');
    expect(within(menu).getByRole('menuitem', { name: 'Subir' })).toBeDisabled();
    await user.click(within(menu).getByRole('menuitem', { name: 'Bajar' }));
    await waitFor(() => expect(maps.updateScene).toHaveBeenCalledWith('s1', { sortOrder: 1 }));
    expect(maps.updateScene).toHaveBeenCalledWith('s2', { sortOrder: 0 });
    const names = screen.getAllByRole('button', { name: /^El (portón|sótano)$/ }).map(b => b.textContent?.replace('map', ''));
    expect(names).toEqual(['El sótano', 'El portón']);
  });

  it('MOVER A OTRA AVENTURA la saca de ésta y la mete en la elegida', async () => {
    const user = userEvent.setup();
    const maps = twoScenes();
    paint(fakeAdventures([adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1 })]), maps);
    const menu = await openSceneMenu(user, 'El portón');
    await user.click(within(menu).getByRole('menuitem', { name: 'Mover a otra aventura' }));
    const sub = screen.getByRole('menu', { name: 'Llevarla a' });
    // Sólo las OTRAS: en la que ya está no tiene sentido.
    expect(within(sub).getAllByRole('menuitem')).toHaveLength(1);
    await user.click(within(sub).getByRole('menuitem', { name: /La feria/ }));
    await waitFor(() => expect(maps.updateScene).toHaveBeenCalledWith('s1', { adventureId: 'a2' }));
    expect(screen.queryByRole('button', { name: 'El portón' })).toBeNull();
    expect(screen.getByText(/^Borrador · 1 escena$/)).toBeInTheDocument();
  });

  it('si no hay otra aventura, mover está apagado y lo dice', async () => {
    const user = userEvent.setup();
    paint(fakeAdventures([adv()]), twoScenes());
    const menu = await openSceneMenu(user, 'El portón');
    const move = within(menu).getByRole('menuitem', { name: /^Mover a otra aventura/ });
    expect(move).toBeDisabled();
    expect(move).toHaveTextContent('No hay otra aventura a la que llevarla.');
  });
});

/**
 * 🐞 MEDIDO en su base local el 2026-09-21: cualquier cambio de la fila (título, estado, orden) mueve
 * `updated_at`, y el texto se guarda contra esa marca. Se guardaba con la de ANTES y salía «se guardó desde otro
 * sitio» sin que nadie más lo hubiera tocado.
 */
describe('AdventuresTab — la marca de tiempo del guardado', () => {
  it('tras renombrar, el texto se guarda con la marca NUEVA', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()], { update: vi.fn().mockResolvedValue('2026-09-21T12:34:00Z') });
    paint(adventures, fakeMaps([]));
    const title = await screen.findByRole('textbox', { name: 'Título de la aventura' });
    await user.type(title, '!');
    await waitFor(() => expect(adventures.update).toHaveBeenCalled());
    await user.click(screen.getAllByRole('textbox', { name: 'Texto del documento' })[0]!);
    await user.keyboard('x');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
    expect((adventures.saveDoc as ReturnType<typeof vi.fn>).mock.calls[0]![2]).toBe('2026-09-21T12:34:00Z');
  });

  it('tras cambiar el estado desde la cabecera, igual', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()], { update: vi.fn().mockResolvedValue('2026-09-21T12:40:00Z') });
    paint(adventures, fakeMaps([]));
    await user.click(await screen.findByRole('button', { name: 'Estado de la aventura: En curso' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Terminada' }));
    await waitFor(() => expect(adventures.update).toHaveBeenCalled());
    await user.click(screen.getAllByRole('textbox', { name: 'Texto del documento' })[0]!);
    await user.keyboard('x');
    await user.keyboard('{Meta>}s{/Meta}');
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
    expect((adventures.saveDoc as ReturnType<typeof vi.fn>).mock.calls[0]![2]).toBe('2026-09-21T12:40:00Z');
  });

  it('lo escrito justo antes de archivar la abierta se guarda en ELLA, con SU marca, no en la que se abre', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures(
      [adv(), adv({ id: 'a2', title: 'La feria', status: 'draft', sortOrder: 1, updatedAt: '2026-09-20T11:00:00Z' })],
      { update: vi.fn().mockResolvedValue('2026-09-21T13:00:00Z') },
    );
    paint(adventures, fakeMaps([]));
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox', { name: 'Texto del documento' })[0]!);
    await user.keyboard('x');
    const menu = await openAdventureMenu(user, 'El almacén de los muelles');
    await user.click(within(menu).getByRole('menuitem', { name: 'Archivar' }));
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
    const [id, , stamp] = (adventures.saveDoc as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(id).toBe('a1');
    expect(stamp).toBe('2026-09-21T13:00:00Z');
  });
});
