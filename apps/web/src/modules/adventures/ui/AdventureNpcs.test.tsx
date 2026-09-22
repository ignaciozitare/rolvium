import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { emptyDoc, table, type RichDoc } from '@rolvium/core';
import type { MapsPort } from '@/modules/maps';
import type { BestiaryEntry, BestiaryPort } from '@/modules/bestiary';
import type { Adventure } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventuresTab } from './AdventuresTab';
import { SAVE_DELAY_MS } from './useAdventureDoc';

/**
 * LAS FILAS DE PNJ/ENCUENTRO ELEGIDAS DEL BESTIARIO (H5 × H12) — orden suya del 2026-09-22: «*los encuentros
 * y personajes ademas de una opcion de tabl acom lo pusiste que esta bien deberia poder elegirlos del
 * bestiario*», y de las tres opciones que se le ofrecieron eligió «**b**»: nombre y foto, **ver su ficha** y
 * **tirar por él**. Colocarla en la escena desde aquí (la «c») NO entra, y esta prueba lo fija.
 * Lámina: `rolvium.pen` § 4 · `Aventuras/Fila del BESTIARIO · elegir a alguien y lo que ofrece`.
 *
 * Se prueba por la pestaña entera, y no la pieza suelta, porque lo que hay que garantizar es la cadena:
 * mesa → pestaña → cuaderno → editor compartido → Bestiario, que es donde se rompería.
 */

/** Una aventura con una tabla de PNJ de una fila, que es la que se va a enlazar. */
const TABLA = table('npc', ['PNJ', 'Qué es'], 1);
const DOC: RichDoc = { v: 1, blocks: [TABLA] };

const adv = (over: Partial<Adventure> = {}): Adventure => ({
  id: 'a1', campaignId: 'c1', title: 'El almacén de los muelles', summary: null, doc: DOC,
  status: 'running', sortOrder: 0, updatedAt: '2026-09-20T10:00:00Z', ...over,
});

const fakeAdventures = (rows: Adventure[] = [adv()]): AdventuresPort => ({
  list: vi.fn().mockResolvedValue(rows),
  getById: vi.fn(async (id: string) => rows.find(r => r.id === id) ?? null),
  create: vi.fn(async () => adv({ id: 'a-new', doc: emptyDoc() })),
  update: vi.fn().mockResolvedValue('2026-09-21T12:00:00Z'),
  saveDoc: vi.fn().mockResolvedValue('2026-09-20T10:05:00Z'),
  remove: vi.fn().mockResolvedValue(undefined),
});

const fakeMaps = (): MapsPort => ({ listScenes: vi.fn().mockResolvedValue([]) } as unknown as MapsPort);

const OGRO: BestiaryEntry = {
  id: 'be-1', origin: 'custom', name: 'Ogro del puente', notes: 'Cobra peaje',
  tokenUrl: 'https://x/ogro.webp', sourceRef: 'ogre', campaignId: 'c1', editable: true,
  data: {
    stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3,
    abilities: [], specialties: { combat: ['creature.garrote'] }, page: 152,
  },
};

const fakeBestiary = (entries: BestiaryEntry[] = [OGRO]): BestiaryPort => ({
  listForCampaign: vi.fn().mockResolvedValue(entries),
  create: vi.fn(), update: vi.fn().mockResolvedValue(OGRO),
  remove: vi.fn().mockResolvedValue(undefined), uploadToken: vi.fn().mockResolvedValue('https://x/t.webp'),
});

const paint = (over: { bestiary?: BestiaryPort; onRoll?: ReturnType<typeof vi.fn> } = {}) => {
  const onRoll = over.onRoll ?? vi.fn().mockResolvedValue({ id: 'r-1' });
  const adventures = fakeAdventures();
  renderWithProviders(
    <AdventuresTab campaignId="c1" onOpenScene={vi.fn()} adventures={adventures} maps={fakeMaps()}
                   system={plenilunio} onRoll={onRoll} bestiary={over.bestiary ?? fakeBestiary()} />,
  );
  return { onRoll, adventures };
};

/** El libro de la primera celda: elige del Bestiario si la fila está suelta. */
const libro = () => screen.findByRole('button', { name: 'Elegir del Bestiario' }, { timeout: 4000 });
/** El mismo botón cuando la fila YA está enlazada: entonces abre su menú. */
const menu = () => screen.findByRole('button', { name: /Del Bestiario · Ogro del puente/ }, { timeout: 4000 });

/** El `Modal` de plataforma no se anuncia como diálogo: se busca por su título, como ya hace el de escenas. */
const picker = async () => {
  const titulo = await screen.findByText('¿A quién pongo en esta fila?', undefined, { timeout: 4000 });
  return titulo.closest('div')!.parentElement!;
};

const elegirOgro = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await libro());
  // Las propias del director llegan de la base: se ESPERA a que estén, no se da por hecho que ya han llegado.
  const dialogo = await picker();
  await user.click(await within(dialogo).findByRole('button', { name: /Ogro del puente/ }, { timeout: 4000 }));
};

describe('Aventuras — la fila elegida del Bestiario', () => {
  it('cada fila de PNJ ofrece elegir del Bestiario, y el picker lista lo que hay en la campaña', async () => {
    const user = userEvent.setup();
    const bestiary = fakeBestiary();
    paint({ bestiary });
    await user.click(await libro());
    await waitFor(() => expect(bestiary.listForCampaign).toHaveBeenCalledWith('c1', plenilunio.id));
    const dialogo = await picker();
    expect(await within(dialogo).findByRole('button', { name: /Ogro del puente/ }, { timeout: 4000 })).toBeInTheDocument();
    // También los bloques del manual, que es lo mismo que lista la pestaña BESTIARIO.
    expect(within(dialogo).getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('elegir una deja el nombre escrito en la fila, su foto, y la fila enlazada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { adventures } = paint();
    await elegirOgro(user);
    expect(await screen.findByRole('img', { name: 'Del Bestiario' }, { timeout: 4000 })).toBeInTheDocument();
    // El editor guarda solo, con su retardo: el enlace y el nombre tienen que llegar a la base.
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
    const guardado = (adventures.saveDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as RichDoc;
    expect(guardado.blocks[0]).toMatchObject({
      type: 'table', rows: [{ cells: [[{ t: 'Ogro del puente' }], []], npcId: 'be-1' }],
    });
    vi.useRealTimers();
  });

  it('pinchar una fila enlazada ofrece ver su ficha o tirar por ella — y NO colocarla en la escena', async () => {
    const user = userEvent.setup();
    paint();
    await elegirOgro(user);
    await user.click(await menu());
    expect(screen.getByRole('menuitem', { name: 'Ver su ficha' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tirar por él' })).toBeInTheDocument();
    // Su «b», no la «c»: desde la aventura no se coloca nada en el mapa.
    expect(screen.queryByRole('menuitem', { name: /Colocar/i })).toBeNull();
  });

  it('«Ver su ficha» abre LA FICHA DEL BESTIARIO, la misma de la pestaña', async () => {
    const user = userEvent.setup();
    paint();
    await elegirOgro(user);
    await user.click(await menu());
    await user.click(screen.getByRole('menuitem', { name: 'Ver su ficha' }));
    // `SheetOverlay`: la hoja de pergamino del Bestiario, con su rótulo — no una copia hecha aquí.
    const ficha = await screen.findByRole('dialog', { name: 'Ficha del encuentro' }, { timeout: 4000 });
    expect(within(ficha).getByDisplayValue('Ogro del puente')).toBeInTheDocument();
  });

  it('«Tirar por él» arma la tirada DE LA CRIATURA y la manda al servidor con su campaña', async () => {
    const user = userEvent.setup();
    const { onRoll } = paint();
    await elegirOgro(user);
    await user.click(await menu());
    await user.click(screen.getByRole('menuitem', { name: 'Tirar por él' }));
    const pop = await screen.findByRole('dialog', { name: /Ogro del puente/ }, { timeout: 4000 });
    await user.click(within(pop).getByRole('button', { name: /^Tirar/ }));
    await waitFor(() => expect(onRoll).toHaveBeenCalled());
    // Lo que se manda es la tirada de la criatura, no dados sueltos.
    expect(onRoll.mock.calls[0]![0]).toMatchObject({ visibility: expect.any(String) });
  });

  it('quitar el enlace deja el nombre escrito: lo escrito es del documento', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { adventures } = paint();
    await elegirOgro(user);
    await user.click(await menu());
    await user.click(screen.getByRole('menuitem', { name: 'Quitar el enlace' }));
    expect(screen.queryByRole('img', { name: 'Del Bestiario' })).toBeNull();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(adventures.saveDoc).toHaveBeenCalled());
    const guardado = (adventures.saveDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as RichDoc;
    expect(guardado.blocks[0]).toMatchObject({ rows: [{ cells: [[{ t: 'Ogro del puente' }], []], npcId: null }] });
    vi.useRealTimers();
  });

  /**
   * Sin el sistema y sin el puerto de tiradas la pestaña sigue siendo la de siempre: las tablas se escriben a
   * mano. Lo que NO puede pasar es que salga el libro y no haga nada — la función falta entera y a la vista.
   */
  it('sin sistema ni tiradas, la tabla se escribe a mano y no promete un Bestiario que no hay', async () => {
    renderWithProviders(
      <AdventuresTab campaignId="c1" onOpenScene={vi.fn()} adventures={fakeAdventures()} maps={fakeMaps()} />,
    );
    expect(await screen.findByRole('textbox', { name: 'PNJ' }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elegir del Bestiario' })).toBeNull();
  });
});
