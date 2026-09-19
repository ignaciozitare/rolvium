import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../../../tests/helpers/render';
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
    update: vi.fn().mockResolvedValue(undefined),
    saveDoc: vi.fn().mockResolvedValue('2026-09-20T10:05:00Z'),
    remove: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const fakeMaps = (scenes: Scene[]): MapsPort => ({ listScenes: vi.fn().mockResolvedValue(scenes) } as unknown as MapsPort);

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
    expect(adventures.list).toHaveBeenCalledWith('c1');
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
    expect(await screen.findByRole('button', { name: /El portón/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /La carpa/ })).toBeNull();
  });

  it('pinchar una escena la abre en la mesa', async () => {
    const user = userEvent.setup();
    const onOpenScene = vi.fn();
    paint(fakeAdventures([adv()]), fakeMaps([scene({ id: 's1', name: 'El portón', adventureId: 'a1' })]), onOpenScene);
    await user.click(await screen.findByRole('button', { name: /El portón/ }));
    expect(onOpenScene).toHaveBeenCalledWith('s1');
  });

  it('crear una aventura la añade al carril y la abre', async () => {
    const user = userEvent.setup();
    const adventures = fakeAdventures([adv()]);
    paint(adventures, fakeMaps([]));
    await screen.findByText('El almacén de los muelles');
    await user.click(screen.getByRole('button', { name: 'Nueva aventura' }));
    await waitFor(() => expect(adventures.create).toHaveBeenCalledWith('c1', 'Aventura 2'));
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
    expect(saveDoc).toHaveBeenCalledTimes(2);
    expect(saveDoc.mock.calls[1]![1]).toEqual(saveDoc.mock.calls[0]![1]);
    vi.useRealTimers();
  });
});
