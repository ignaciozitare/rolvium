import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import { fakeCharactersRepo, fakeMapsRepo, CHARACTER_KAREN, CHARACTER_OTHER, DRAWING_MINE, DRAWING_OTHER, PLAYER_USER, SCENE_CHAPEL, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1, IMAGE_CHAPEL } from '../../../../tests/helpers/fakes';
import { SceneTab } from './SceneTab';

class FakePointerEvent extends MouseEvent { pointerId: number; constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

const MEMBERS: CampaignMember[] = [
  { campaignId: 'c1', userId: 'u-gm', name: 'Laura', avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' },
  { campaignId: 'c1', userId: 'u-pip', name: 'Pip', avatarUrl: 'https://x/pip.png', role: 'player', characterId: 'ch-karen', joinedAt: '' },
  { campaignId: 'c1', userId: 'u-nix', name: 'Dani', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' },
];
const seed = () => fakeMapsRepo({ scenes: [SCENE_WAREHOUSE, SCENE_CHAPEL], tokens: [TOKEN_KAREN, TOKEN_ELIAS, TOKEN_MUTANT], walls: [WALL_1], drawings: [DRAWING_MINE, DRAWING_OTHER], images: [IMAGE_CHAPEL] });
const G = SCENE_WAREHOUSE.grid.size;
const canvas = () => screen.getByRole('application', { name: 'Lienzo de la escena' });

function mount(role: 'dm' | 'player', repo = seed(), activeSceneId: string | null = 'sc-1', chars = fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])) {
  renderWithProviders(<SceneTab campaignId="c1" role={role} userId={role === 'dm' ? 'u-gm' : PLAYER_USER.id} system={plenilunio} members={MEMBERS} activeSceneId={activeSceneId} charactersRepo={chars} repo={repo} />);
  return repo;
}

describe('<SceneTab> player', () => {
  it('no active scene → «el director aún no ha activado…»; with one → loads it (only visible tokens), stroke bar, player toolbar and footer', async () => {
    mount('player', seed(), null);
    expect(await screen.findByText('El director aún no ha activado ninguna escena.')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount('player');
    expect(await screen.findByText('Almacén de Queens')).toBeInTheDocument();
    expect(screen.getByText('La directora decide qué escena ves.')).toBeInTheDocument();
    await waitFor(() => expect(within(canvas()).getAllByRole('img', { name: /^Token/ })).toHaveLength(2));
    expect(within(canvas()).queryByRole('img', { name: /Mutante/ })).not.toBeInTheDocument();
    expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(0);
    expect(screen.getByRole('toolbar', { name: 'Herramientas del lienzo' }).querySelectorAll('button')).toHaveLength(8);
    expect(screen.getByText(/Los muros no se dibujan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fondo del mapa' })).not.toBeInTheDocument();
    expect(screen.getByText('Almacén de Queens · tu visión')).toBeInTheDocument();
  });
  it('dragging my token broadcasts (final:false … final:true) and persists x/y; drawing a stroke inserts with my colour; erasing my stroke removes it; «Limpiar mis trazos»', async () => {
    const repo = mount('player');
    await screen.findByText('Almacén de Queens');
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    fireEvent.pointerDown(karen, { clientX: (TOKEN_KAREN.x + 0.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: (TOKEN_KAREN.x + 2.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(repo.tokenUpdates).toEqual([{ id: 'tk-karen', patch: { x: 12, y: 11 } }]));
    expect(repo.broadcasts.map(b => b.event.type === 'token.moved' && b.event.final)).toEqual([false, true]);
    expect(repo.broadcasts[0]!.sceneId).toBe('sc-1');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Lápiz' }));
    await u.click(screen.getByRole('radio', { name: 'Color 3' }));
    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: 30, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(repo.drawings).toHaveLength(3));
    expect(repo.drawings[2]).toMatchObject({ sceneId: 'sc-1', campaignId: 'c1', kind: 'stroke', color: '#b8452c', width: 2, data: { points: [[10, 10], [30, 20]] } });
    await waitFor(() => expect(within(canvas()).getByTestId('mp-drawings').querySelectorAll('[data-drawing-id]')).toHaveLength(3));
    await u.click(screen.getByRole('button', { name: 'Borrar' }));
    fireEvent.pointerDown(canvas(), { clientX: 320, clientY: 290, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.removedDrawings).toEqual(['d-1']));
    fireEvent.pointerDown(canvas(), { clientX: 450, clientY: 520, pointerId: 1, button: 0 }); // someone else's rect: stays
    expect(repo.removedDrawings).toEqual(['d-1']);
    await u.click(screen.getByRole('button', { name: 'Limpiar mis trazos' }));
    await waitFor(() => expect(repo.clearedMine).toEqual(['sc-1']));
    expect(screen.queryByRole('button', { name: 'Limpiar todos' })).not.toBeInTheDocument();
  });
  it('live: token updates / inserts / deletes, remote drag, and a remote pin re-centre the view; a pin by me is not re-applied', async () => {
    const repo = mount('player');
    await screen.findByText('Almacén de Queens');
    await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    repo.emit('sc-1', { token: { type: 'UPDATE', id: 'tk-elias', row: { ...TOKEN_ELIAS, x: 1, y: 1 } } });
    await waitFor(() => expect(within(canvas()).getByRole('img', { name: 'Token Elías Vance' })).toHaveAttribute('transform', `translate(${1.5 * G} ${1.5 * G})`));
    repo.emit('sc-1', { token: { type: 'INSERT', id: 'tk-x', row: { ...TOKEN_ELIAS, id: 'tk-x', name: 'Nix' } } });
    expect(await within(canvas()).findByRole('img', { name: 'Token Nix' })).toBeInTheDocument();
    repo.emit('sc-1', { token: { type: 'DELETE', id: 'tk-x', row: null } });
    await waitFor(() => expect(within(canvas()).queryByRole('img', { name: 'Token Nix' })).not.toBeInTheDocument());
    repo.emit('sc-1', { event: { type: 'token.moved', campaignId: 'c1', sceneId: 'sc-1', tokenId: 'tk-elias', x: 4, y: 4, final: false } });
    await waitFor(() => expect(within(canvas()).getByRole('img', { name: 'Token Elías Vance' })).toHaveAttribute('transform', `translate(${4.5 * G} ${4.5 * G})`));
    repo.emit('sc-1', { event: { type: 'pin.focused', campaignId: 'c1', sceneId: 'sc-1', x: 100, y: 100, by: 'u-gm' } });
    expect(await within(canvas()).findByTestId('mp-pin')).toHaveAttribute('aria-label', 'Pin de Laura');
    repo.emit('sc-1', { drawing: { type: 'INSERT', id: 'd-live', row: { ...DRAWING_OTHER, id: 'd-live' } } });
    await waitFor(() => expect(within(canvas()).getByTestId('mp-drawings').querySelectorAll('[data-drawing-id]')).toHaveLength(3));
    repo.emit('sc-1', { scene: { type: 'UPDATE', id: 'sc-1', row: { ...SCENE_WAREHOUSE, bgColor: '#123456' } } });
    await waitFor(() => expect(within(canvas()).getByTestId('mp-bg')).toHaveAttribute('fill', '#123456'));
  });
});

describe('<SceneTab> DM', () => {
  it('lists scenes (starts on the active one), shows walls + hidden tokens + DM label, background popover changes colour/image, «Colocar PJ» adds a controlled token, encounter places a hidden bestiary token', async () => {
    const u = userEvent.setup();
    // Elías is not on the map yet: «Colocar PJ» must be able to add him (Karen already is → disabled).
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE, SCENE_CHAPEL], tokens: [TOKEN_KAREN, TOKEN_MUTANT], walls: [WALL_1], drawings: [DRAWING_MINE, DRAWING_OTHER], images: [IMAGE_CHAPEL] }), 'sc-2');
    expect(await screen.findByText('Capilla sin techo', { selector: '.mp-scene-name' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    await within(canvas()).findByRole('img', { name: 'Token Mutante (oculto)' });
    expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(1);
    expect(screen.getByText('Vista de director · muros y tokens ocultos visibles')).toBeInTheDocument();
    expect(screen.getByText(/1 muros \(invisibles para jugadores\) · 1 tokens ocultos/)).toBeInTheDocument();
    // background
    await u.click(screen.getByRole('button', { name: 'Fondo del mapa' }));
    await u.click(await screen.findByRole('button', { name: 'Capilla' }));
    await waitFor(() => expect(repo.sceneUpdates).toContainEqual({ id: 'sc-1', patch: { bgImageUrl: IMAGE_CHAPEL.url } }));
    expect(within(canvas()).getByTestId('mp-bg-image')).toHaveAttribute('href', IMAGE_CHAPEL.url);
    await u.click(screen.getByRole('radio', { name: '#0f0f0f' }));
    await waitFor(() => expect(within(canvas()).getByTestId('mp-bg')).toHaveAttribute('fill', '#0f0f0f'));
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    // place PC
    await u.click(screen.getByRole('button', { name: 'Colocar PJ' }));
    expect((await screen.findByRole('menuitem', { name: /Karen/ }))).toBeDisabled(); // already in scene
    await u.click(screen.getByRole('menuitem', { name: /Elías/ }));
    await waitFor(() => expect(repo.tokens.filter(t => t.characterId === 'ch-elias')).toHaveLength(1));
    expect(repo.tokens.at(-1)).toMatchObject({ characterId: 'ch-elias', controlledBy: 'u-nix', visible: true });
    // encounter
    await u.click(screen.getByRole('button', { name: 'Encuentro' }));
    await u.click(await screen.findByRole('button', { name: 'Elegir Ogro' }));
    fireEvent.pointerDown(canvas(), { clientX: 5 * G + 3, clientY: 6 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({ bestiaryRef: 'ogre', name: 'Ogro', x: 5, y: 6, visible: false, controlledBy: null, state: { resistance: 30 } }));
    expect(await within(canvas()).findByRole('img', { name: 'Token Ogro (oculto)' })).toBeInTheDocument();
  });
  it('walls: click-click adds a segment; token bar: select → hide/show + remove; «Limpiar todos»; create + activate a scene', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await screen.findByText('Almacén de Queens', { selector: '.mp-scene-name' });
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    fireEvent.pointerDown(canvas(), { clientX: 27, clientY: 27, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 81, clientY: 27, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(2));
    expect(repo.walls[1]).toMatchObject({ sceneId: 'sc-1', x1: 27, y1: 27, x2: 81, y2: 27, visiblePlayers: false });
    await u.click(screen.getByRole('button', { name: 'Mover' }));
    fireEvent.pointerDown(karen, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    await u.click(within(bar).getByRole('button', { name: 'Ocultar a los jugadores' }));
    await waitFor(() => expect(repo.tokenUpdates).toContainEqual({ id: 'tk-karen', patch: { visible: false } }));
    await u.click(within(bar).getByRole('button', { name: 'Mostrar a los jugadores' }));
    await waitFor(() => expect(repo.tokenUpdates).toContainEqual({ id: 'tk-karen', patch: { visible: true } }));
    await u.click(within(bar).getByRole('button', { name: 'Quitar de la escena' }));
    await waitFor(() => expect(repo.tokens.some(t => t.id === 'tk-karen')).toBe(false));
    await u.click(screen.getByRole('button', { name: 'Limpiar todos' }));
    await waitFor(() => expect(repo.clearedAll).toEqual(['sc-1']));
    await u.click(screen.getByRole('button', { name: '+ Escena' }));
    await u.type(await screen.findByRole('textbox'), 'Mercado');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Mercado', { selector: '.mp-scene-name' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ver escena Mercado' }));
    await u.click(screen.getByRole('menuitem', { name: 'Activar para los jugadores' }));
    // the fake's id counter is shared across creations — assert against the scene that was just created
    expect(repo.activated).toEqual([repo.scenes.at(-1)!.id]);
    expect(repo.scenes.at(-1)).toMatchObject({ name: 'Mercado', campaignId: 'c1' });
  });
});

describe('<SceneTab> failures', () => {
  it('surfaces a refused map change instead of swallowing it', async () => {
    const u = userEvent.setup();
    const repo = seed();
    repo.addWall = async () => { throw new Error('rls'); };
    mount('dm', repo);
    await screen.findByText('Almacén de Queens', { selector: '.mp-scene-name' });
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    fireEvent.pointerDown(canvas(), { clientX: 27, clientY: 27, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 81, clientY: 27, pointerId: 1, button: 0 });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio en el mapa');
  });
});
