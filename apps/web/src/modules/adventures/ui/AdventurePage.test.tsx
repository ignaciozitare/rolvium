import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import { heading, type RichDoc } from '@rolvium/core';
import type { MapsPort, Scene } from '@/modules/maps';
import type { CampaignsPort } from '@/modules/campaigns';
import type { BestiaryEntry, BestiaryPort } from '@/modules/bestiary';
import type { RollsPort } from '@/modules/dice';
import { SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import type { Adventure } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventurePage } from './AdventurePage';

const DOC: RichDoc = { v: 1, blocks: [heading(1, [{ t: 'El almacén' }])] };
const ADV: Adventure = {
  id: 'a1', campaignId: 'c1', title: 'El almacén de los muelles', summary: null, doc: DOC,
  status: 'running', sortOrder: 0, updatedAt: '2026-09-20T10:00:00Z',
};

const fakeAdventures = (row: Adventure | null): AdventuresPort => ({
  list: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(row),
  create: vi.fn(), update: vi.fn().mockResolvedValue(undefined),
  saveDoc: vi.fn().mockResolvedValue('t'), remove: vi.fn(),
} as unknown as AdventuresPort);

const fakeMaps = (scenes: Scene[] = []): MapsPort => ({ listScenes: vi.fn().mockResolvedValue(scenes) } as unknown as MapsPort);
const fakeCampaigns = (): CampaignsPort => ({
  getById: vi.fn().mockResolvedValue({ id: 'c1', name: 'Las noches de Queens', systemId: 'plenilunio', myRole: 'dm' }),
} as unknown as CampaignsPort);

/** Con su ruta de verdad: la página saca el id de la URL, así que sin `Route` no sabría qué abrir. */
const paint = (adventures: AdventuresPort, maps = fakeMaps()) =>
  renderWithProviders(
    <Routes>
      <Route path="/adventures/:id" element={<AdventurePage adventures={adventures} maps={maps} campaigns={fakeCampaigns()} />} />
    </Routes>,
    { providers: { routerProps: { initialEntries: ['/adventures/a1'] } } },
  );

const OGRO: BestiaryEntry = {
  id: 'be-1', origin: 'custom', name: 'Ogro del puente', notes: '', tokenUrl: null,
  sourceRef: 'ogre', campaignId: 'c1', editable: true,
  data: { stats: { fortitude: 8 }, endurance: 10, destiny: 0, protection: 0, abilities: [], specialties: {} },
};
const fakeBestiary = (): BestiaryPort => ({
  listForCampaign: vi.fn().mockResolvedValue([OGRO]),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), uploadToken: vi.fn(),
});
const fakeRolls = (): RollsPort => ({ roll: vi.fn().mockResolvedValue(null) });

describe('AdventurePage — la aventura en su propia ventana', () => {
  it('pinta el cuaderno de esa aventura, con la campaña en la barra de la ventana', async () => {
    paint(fakeAdventures(ADV));
    expect(await screen.findByRole('textbox', { name: 'Título de la aventura' })).toHaveValue('El almacén de los muelles');
    await waitFor(() => expect(screen.getByText(/Las noches de Queens/)).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
  });

  it('NO trae el botón de abrir aparte: ya estás en la ventana aparte', async () => {
    paint(fakeAdventures(ADV));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Abrir aparte/ })).toBeNull();
  });

  it('el estado se lee y no se toca: cambiarlo es cosa del carril, que ve las demás', async () => {
    paint(fakeAdventures(ADV));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /^Estado de la aventura/ })).toBeNull();
    expect(screen.getByText('En curso')).toBeInTheDocument();
  });

  it('tampoco trae el carril de aventuras: una aventura por ventana', async () => {
    paint(fakeAdventures(ADV));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('navigation', { name: 'Aventuras de la campaña' })).toBeNull();
  });

  it('⚠ la página suelta NO puede heredar el alto fijo de la mesa, o se queda sin scroll', async () => {
    const { container } = paint(fakeAdventures(ADV));
    await screen.findByRole('heading', { level: 1 });
    // La misma trampa de la ficha aparte (`sheet-standalone-scroll.test.tsx`): `.tb-root` lleva
    // `height:100dvh; overflow:hidden`, y el modificador `.tb-root-page` es quien lo deshace.
    expect(container.querySelector('.tb-root')).toHaveClass('tb-root-page');
  });

  it('una aventura que ya no está se dice, no se queda cargando para siempre', async () => {
    paint(fakeAdventures(null));
    expect(await screen.findByText('Esta aventura ya no está.')).toBeInTheDocument();
  });

  it('el índice también está aquí, con los títulos del documento', async () => {
    paint(fakeAdventures(ADV));
    expect(await screen.findByRole('navigation', { name: 'Índice' })).toBeInTheDocument();
  });

  it('pincha una escena y se abre en la mesa, que está en la otra ventana', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    paint(fakeAdventures({ ...ADV, doc: { v: 1, blocks: [{ id: 's', type: 'sceneRef', sceneId: 'sc-1', label: 'El sótano' }] } }),
      fakeMaps([{ ...SCENE_WAREHOUSE, id: 'sc-1', name: 'El sótano', adventureId: 'a1' }]));
    const chip = await screen.findByRole('button', { name: /El sótano/ });
    chip.click();
    expect(open).toHaveBeenCalledWith('/table/c1?scene=sc-1', '_blank', 'noopener');
    open.mockRestore();
  });

  /**
   * EL BESTIARIO TAMBIÉN AQUÍ (2026-09-22): la ventana aparte es EL MISMO cuaderno que la pestaña, y sus
   * filas de PNJ/encuentro se eligen igual. Aquí no hay mesa que inyecte nada: el sistema lo resuelve la
   * página y el puerto de tiradas sale del contenedor de `dice`.
   */
  it('sus filas de PNJ también se eligen del Bestiario', async () => {
    const tabla = { id: 'tb', type: 'table' as const, kind: 'npc' as const, columns: ['PNJ', 'Qué es'], rows: [{ cells: [[], []], npcId: null }] };
    renderWithProviders(
      <Routes>
        <Route path="/adventures/:id" element={
          <AdventurePage adventures={fakeAdventures({ ...ADV, doc: { v: 1, blocks: [tabla] } })} maps={fakeMaps()}
                         campaigns={fakeCampaigns()} bestiary={fakeBestiary()} rolls={fakeRolls()} />
        } />
      </Routes>,
      { providers: { routerProps: { initialEntries: ['/adventures/a1'] } } },
    );
    expect(await screen.findByRole('button', { name: 'Elegir del Bestiario' })).toBeInTheDocument();
  });

  /**
   * ⚠ La ventana espera a SABER si hay sistema antes de pintar el cuaderno —si llegara después, el envoltorio
   * cambiaría y React lo desmontaría entero, tirando el cursor y el índice—. Pero si la campaña no contesta,
   * la aventura se lee IGUAL: lo que el director quiere es su texto. Cazado al construir el punto 2 (22-09).
   */
  it('si la campaña no contesta, la aventura se lee igual (sin Bestiario, no «Cargando…» para siempre)', async () => {
    const campaigns = { getById: vi.fn().mockRejectedValue(new Error('red')) } as unknown as CampaignsPort;
    renderWithProviders(
      <Routes>
        <Route path="/adventures/:id" element={<AdventurePage adventures={fakeAdventures(ADV)} maps={fakeMaps()} campaigns={campaigns} />} />
      </Routes>,
      { providers: { routerProps: { initialEntries: ['/adventures/a1'] } } },
    );
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
    expect(screen.queryByRole('button', { name: 'Elegir del Bestiario' })).toBeNull();
  });
});
