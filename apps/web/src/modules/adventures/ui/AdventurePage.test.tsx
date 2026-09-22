import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import { heading, type RichDoc } from '@rolvium/core';
import type { MapsPort, Scene } from '@/modules/maps';
import type { CampaignsPort } from '@/modules/campaigns';
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
});
