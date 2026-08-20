import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import { fakeCharactersRepo, fakeMapsRepo, fakeVisionPort, CHARACTER_KAREN, CHARACTER_OTHER, DRAWING_MINE, DRAWING_OTHER, PLAYER_USER, SCENE_CHAPEL, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1, WALL_DOOR, IMAGE_CHAPEL } from '../../../../tests/helpers/fakes';
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

/** Vision always comes from the API — the tests inject a fake port so nothing here ever computes it. */
function mount(role: 'dm' | 'player', repo = seed(), activeSceneId: string | null = 'sc-1', chars = fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision = fakeVisionPort()) {
  renderWithProviders(<SceneTab campaignId="c1" role={role} userId={role === 'dm' ? 'u-gm' : PLAYER_USER.id} system={plenilunio} members={MEMBERS} activeSceneId={activeSceneId} charactersRepo={chars} repo={repo} vision={vision} />);
  return repo;
}

describe('<SceneTab> player', () => {
  it('no active scene → «el director aún no ha activado…»; with one → loads it (only visible tokens), stroke bar, player toolbar and footer', async () => {
    mount('player', seed(), null);
    expect(await screen.findByText('El director aún no ha activado ninguna escena.')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount('player');
    expect(await screen.findByText(/Almacén de Queens · tu visión/)).toBeInTheDocument();  // el nombre va en la etiqueta del lienzo, ya no en una cabecera
    expect(screen.getByText(/La directora decide qué escena ves\./)).toBeInTheDocument();
    await waitFor(() => expect(within(canvas()).getAllByRole('img', { name: /^Token/ })).toHaveLength(2));
    expect(within(canvas()).queryByRole('img', { name: /Mutante/ })).not.toBeInTheDocument();
    expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(0);
    expect(screen.getByRole('toolbar', { name: 'Herramientas del lienzo' }).querySelectorAll('button')).toHaveLength(10); // 9 herramientas + Dados
    expect(screen.getByText(/Los muros no se dibujan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fondo del mapa' })).not.toBeInTheDocument();
    expect(screen.getByText('Almacén de Queens · tu visión')).toBeInTheDocument();
  });
  it('dragging my token broadcasts (final:false … final:true) and persists x/y; drawing a stroke inserts with my colour; erasing my stroke removes it; «Limpiar mis trazos»', async () => {
    const repo = mount('player');
    await screen.findByText(/Almacén de Queens/);
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    fireEvent.pointerDown(karen, { clientX: (TOKEN_KAREN.x + 0.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: (TOKEN_KAREN.x + 2.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(repo.tokenUpdates).toEqual([{ id: 'tk-karen', patch: { x: 12, y: 11 } }]));
    expect(repo.broadcasts.filter(b => b.event.type === 'token.moved').map(b => b.event.type === 'token.moved' && b.event.final)).toEqual([false, true]);
    // moving a token changes what the DM's union of explored covers, and `postgres_changes` cannot say so → broadcast
    expect(repo.broadcasts.some(b => b.event.type === 'fog.updated')).toBe(true);
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
    // la barra de Trazo vive dentro del mapa y sólo con herramienta de dibujo: el jugador nunca ve «Limpiar todos»
    expect(screen.queryByRole('button', { name: 'Limpiar todos' })).not.toBeInTheDocument();
  });
  it('live: token updates / inserts / deletes, remote drag, and a remote pin re-centre the view; a pin by me is not re-applied', async () => {
    const repo = mount('player');
    await screen.findByText(/Almacén de Queens/);
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
    expect(await screen.findByRole('button', { name: 'Ver escena Capilla sin techo' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    await within(canvas()).findByRole('img', { name: 'Token Mutante (oculto)' });
    expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(1);
    expect(screen.getByText(/Vista de director · muros y tokens ocultos visibles · Niebla por visión/)).toBeInTheDocument();
    expect(screen.getByText(/1 muros · 0 puertas · 0 ventanas \(invisibles para jugadores\) · 1 tokens ocultos/)).toBeInTheDocument();
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
    // ahora es en dos pasos, como Encuentro: eliges a quién y luego dónde
    await u.click(screen.getByRole('menuitem', { name: /Elías/ }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Coloca a Elías/);
    expect(repo.tokens.filter(t => t.characterId === 'ch-elias')).toHaveLength(0);
    fireEvent.pointerDown(canvas(), { clientX: 4 * G + 3, clientY: 7 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.filter(t => t.characterId === 'ch-elias')).toHaveLength(1));
    expect(repo.tokens.at(-1)).toMatchObject({ characterId: 'ch-elias', controlledBy: 'u-nix', visible: true, x: 4, y: 7 });
    // encounter
    await u.click(screen.getByRole('button', { name: 'Encuentro' }));
    await u.click(await screen.findByRole('button', { name: 'Elegir Ogro' }));
    fireEvent.pointerDown(canvas(), { clientX: 5 * G + 3, clientY: 6 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({ bestiaryRef: 'ogre', name: 'Ogro', x: 5, y: 6, visible: false, controlledBy: null, state: { resistance: 30 } }));
    expect(await within(canvas()).findByRole('img', { name: 'Token Ogro (oculto)' })).toBeInTheDocument();
  });
  /**
   * Los encuentros PROPIOS del director (H5) tienen que salir en el desplegable junto a las 45 del manual, y
   * al colocarlos enlazar a SU FILA (`bestiaryEntryId`), no al catálogo. Sin esto el director ve el libro y
   * nada de lo que se ha inventado, que es justo lo que pasaba antes de cablearlo.
   */
  it('encuentro: los propios del director salen en el desplegable y colocan una instancia enlazada a su fila', async () => {
    const u = userEvent.setup();
    const repo = seed();
    renderWithProviders(
      <SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS} activeSceneId="sc-1"
                charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} repo={repo} vision={fakeVisionPort()}
                extraEncounters={[{ id: 'be-9', label: 'Ogro con antorcha', ref: 'bestiary',
                                    data: { resistance: 30, protection: 3, origin: 'custom', entryId: 'be-9', tokenUrl: null } }]} />,
    );

    await u.click(await screen.findByRole('button', { name: 'Encuentro' }));
    // El del manual sigue estando: lo propio SUMA, no sustituye.
    expect(await screen.findByRole('button', { name: 'Elegir Ogro' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Elegir Ogro con antorcha' }));
    fireEvent.pointerDown(canvas(), { clientX: 3 * G + 3, clientY: 4 * G + 3, pointerId: 1, button: 0 });

    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({
      bestiaryEntryId: 'be-9', bestiaryRef: null, name: 'Ogro con antorcha', x: 3, y: 4,
      visible: false, state: { resistance: 30 },
    }));
  });

  it('walls: click-click adds a segment; token bar: select → hide/show + remove; «Limpiar todos»; create + activate a scene', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    fireEvent.pointerDown(canvas(), { clientX: 27, clientY: 27, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 81, clientY: 27, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(2));
    expect(repo.walls[1]).toMatchObject({ sceneId: 'sc-1', x1: 27, y1: 27, x2: 81, y2: 27, visiblePlayers: false });
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(karen, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    await u.click(within(bar).getByRole('button', { name: 'Ocultar a los jugadores' }));
    await waitFor(() => expect(repo.tokenUpdates).toContainEqual({ id: 'tk-karen', patch: { visible: false } }));
    await u.click(within(bar).getByRole('button', { name: 'Mostrar a los jugadores' }));
    await waitFor(() => expect(repo.tokenUpdates).toContainEqual({ id: 'tk-karen', patch: { visible: true } }));
    await u.click(within(bar).getByRole('button', { name: 'Quitar de la escena' }));
    await waitFor(() => expect(repo.tokens.some(t => t.id === 'tk-karen')).toBe(false));
    await u.click(screen.getByRole('button', { name: 'Lápiz' }));   // la barra de Trazo sólo aparece con herramienta de dibujo
    await u.click(await screen.findByRole('button', { name: 'Limpiar todos' }));
    await waitFor(() => expect(repo.clearedAll).toEqual(['sc-1']));
    await u.click(screen.getByRole('button', { name: '+ Escena' }));
    await u.type(await screen.findByRole('textbox'), 'Mercado');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('button', { name: 'Ver escena Mercado' })).toBeInTheDocument();
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
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    fireEvent.pointerDown(canvas(), { clientX: 27, clientY: 27, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 81, clientY: 27, pointerId: 1, button: 0 });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio en el mapa');
  });
});

describe('<SceneTab> slice 2 — vision, light and openings', () => {
  it('player: asks the API for its vision on entering, draws what it answers, and never computes it here', async () => {
    const vision = fakeVisionPort();
    mount('player', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Almacén de Queens/);
    await waitFor(() => expect(vision.calls.some(c => c.op === 'refresh' && c.sceneId === 'sc-1')).toBe(true));
    await waitFor(() => expect(within(canvas()).getByTestId('mp-map')).toHaveAttribute('mask', 'url(#mp-seen-sc-1)'));
    // Refreshes are coalesced on a trailing tick: entering the scene costs at most one round trip per DATA
    // arrival (the scene, then its tokens and walls), never one per dependency that happened to change.
    expect(vision.calls.filter(c => c.op === 'refresh').length).toBeLessThanOrEqual(2);
  });

  it('DM: the light switch writes the scene and the label follows; the night radius reaches the player footer', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', seed());
    // la luz ya no es una barra: es un icono en la pila del zoom
    await u.click(await screen.findByRole('button', { name: 'Día' }));
    await waitFor(() => expect(repo.sceneUpdates).toContainEqual({ id: 'sc-1', patch: { lighting: 'night' } }));

    document.body.innerHTML = '';
    mount('player', fakeMapsRepo({ scenes: [{ ...SCENE_WAREHOUSE, lighting: 'night' }], tokens: [TOKEN_KAREN], walls: [WALL_1] }));
    expect(await screen.findByText(/De noche ves hasta 10 m/)).toBeInTheDocument();
    expect(screen.getByText(/Almacén de Queens · tu visión · Noche · 10 m/)).toBeInTheDocument();
  });

  it('DM: «Niebla automática por visión» switches the scene between `vision` and `manual`', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', seed());
    await u.click(await screen.findByRole('button', { name: 'Niebla automática por visión' }));
    await waitFor(() => expect(repo.sceneUpdates).toContainEqual({ id: 'sc-1', patch: { fogMode: 'manual' } }));
  });

  it('DM: the Muro tool draws whatever type the picker says, with the flags of that type', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Muro' }));

    // default: a plain wall
    fireEvent.pointerDown(canvas(), { clientX: 2 * G, clientY: 2 * G, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 6 * G, clientY: 2 * G, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(1));
    expect(repo.walls[0]).toMatchObject({ kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false });

    // Esc ends the chain (walls chain click to click), then pick «Ventana» → the next segment never cuts sight
    fireEvent.keyDown(window, { key: 'Escape' });
    await u.click(screen.getByRole('radio', { name: 'Ventana' }));
    fireEvent.pointerDown(canvas(), { clientX: 6 * G, clientY: 6 * G, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 9 * G, clientY: 6 * G, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(2));
    expect(repo.walls[1]).toMatchObject({ kind: 'window', blocksSight: false, blocksMove: true, isOpen: false });

    // and drawing one announces it, because it changes what everyone can see
    expect(repo.broadcasts.some(b => b.event.type === 'fog.updated')).toBe(true);
  });

  it('DM: el disco de abrir sale al pasar el ratón, persiste `is_open` y lo anuncia — el jugador no puede saberlo por postgres_changes', async () => {
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [WALL_DOOR] }));
    await screen.findByText(/Almacén de Queens/);
    // sin tocar la herramienta: Seleccionar es la de partida y el disco va en cualquiera
    fireEvent.pointerMove(canvas(), { clientX: WALL_DOOR.x1 + 1, clientY: 260, pointerId: 1 });
    // un CLIC sobre el disco abre la puerta; si en vez de soltar arrastrases, el gesto sería de la herramienta
    fireEvent.pointerDown(within(canvas()).getByRole('img', { name: 'Abrir' }), { clientX: WALL_DOOR.x1, clientY: 270, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(repo.wallUpdates).toContainEqual({ id: 'w-door', patch: { isOpen: true } }));
    expect(repo.broadcasts.some(b => b.event.type === 'fog.updated')).toBe(true);
  });

  it('DM: una puerta dibujada sobre un muro lo parte — el muro sale y quedan la abertura y los dos trozos', async () => {
    const u = userEvent.setup();
    // WALL_1 es vertical en x = 270 (10 casillas), de y = 216 (8) a y = 540 (20)
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    await u.click(screen.getByRole('radio', { name: 'Puerta' }));
    fireEvent.pointerDown(canvas(), { clientX: 10 * G, clientY: 10 * G, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 10 * G, clientY: 12 * G, pointerId: 1, button: 0 });

    await waitFor(() => expect(repo.walls).toHaveLength(3));
    expect(repo.walls.some(w => w.id === 'w-1')).toBe(false);
    expect(repo.walls.find(w => w.kind === 'door')).toMatchObject({ x1: 270, y1: 270, x2: 270, y2: 324, blocksSight: true, isOpen: false });
    expect(repo.walls.filter(w => w.kind === 'wall').map(w => [w.y1, w.y2])).toEqual([[216, 270], [324, 540]]);
    expect(repo.broadcasts.some(b => b.event.type === 'fog.updated')).toBe(true);
  });

  it('DM: al partir, el muro original sale EL ÚLTIMO — un fallo a medias lo deja entero, nunca un agujero', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [WALL_1] }));
    // qué había guardado en el instante en que se pidió quitar el muro original
    const whenRemoved: string[][] = [];
    const removeWall = repo.removeWall;
    repo.removeWall = async (id: string) => { whenRemoved.push(repo.walls.map(w => w.id)); await removeWall(id); };
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Muro' }));
    await u.click(screen.getByRole('radio', { name: 'Puerta' }));
    fireEvent.pointerDown(canvas(), { clientX: 10 * G, clientY: 10 * G, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 10 * G, clientY: 12 * G, pointerId: 1, button: 0 });

    await waitFor(() => expect(whenRemoved).toHaveLength(1));
    // los dos trozos y la abertura ya estaban puestos, y el muro seguía ahí: el orden es el que hace inocuo el fallo
    expect(whenRemoved[0]).toHaveLength(4);
    expect(whenRemoved[0]).toContain('w-1');

    // y el lienzo queda con tres segmentos aunque el realtime traiga de vuelta uno de los recién creados
    await waitFor(() => expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('[data-wall-id]')).toHaveLength(3));
    const piece = repo.walls.find(w => w.kind === 'wall')!;
    fireEvent.pointerMove(canvas(), { clientX: 0, clientY: 0, pointerId: 1 });   // suelta el muro a medias
    repo.emit('sc-1', { wall: { type: 'INSERT', id: piece.id, row: piece } });
    repo.emit('sc-1', { wall: { type: 'DELETE', id: 'w-1', row: null } });
    await waitFor(() => expect(within(canvas()).getByTestId('mp-walls').querySelectorAll('[data-wall-id]')).toHaveLength(3));
  });

  it('DM: the reveal brush replaces the stroke bar and «Revelar todo» paints the whole scene for every player', async () => {
    const u = userEvent.setup();
    const vision = fakeVisionPort();
    mount('dm', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(await screen.findByRole('radio', { name: 'Tamaño 3' })).toBeChecked();
    await u.click(screen.getByRole('button', { name: 'Revelar todo' }));
    await waitFor(() => expect(vision.calls.some(c => c.op === 'revealAll')).toBe(true));
  });

  it('a `fog.updated` from someone else makes this client ask the server again; its own does not (that would loop)', async () => {
    const vision = fakeVisionPort();
    const repo = mount('player', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Almacén de Queens/);
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(0));
    const before = vision.calls.length;
    repo.emit('sc-1', { event: { type: 'fog.updated', campaignId: 'c1', sceneId: 'sc-1', userId: PLAYER_USER.id } });
    await waitFor(() => expect(vision.calls.length).toBe(before));
    repo.emit('sc-1', { event: { type: 'fog.updated', campaignId: 'c1', sceneId: 'sc-1', userId: 'u-gm' } });
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(before));
  });

  it('a burst of reasons to recompute collapses into ONE round trip', async () => {
    const vision = fakeVisionPort();
    const repo = mount('player', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Almacén de Queens/);
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(0));
    const before = vision.calls.length;
    // the DM swings three doors in the same tick — that is one answer to ask for, not three
    for (let i = 0; i < 3; i++) repo.emit('sc-1', { event: { type: 'fog.updated', campaignId: 'c1', sceneId: 'sc-1', userId: 'u-gm' } });
    await waitFor(() => expect(vision.calls.length).toBe(before + 1));
  });
});

describe('<SceneTab> rebanada 3 — la cabecera desaparece y su contenido se reparte', () => {
  it('no queda ninguna cabecera de escena: el nombre va en la etiqueta del lienzo y las escenas en el rail', async () => {
    mount('dm', seed());
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    expect(document.querySelector('.mp-head')).toBeNull();
    expect(screen.getByRole('group', { name: 'Escenas' })).toBeInTheDocument();
  });

  it('«Fondo del mapa» y «Colocar PJ» son ahora botones de la barra, y abren su panel', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
    await u.click(within(bar).getByRole('button', { name: 'Fondo del mapa' }));
    expect(await screen.findByText('Biblioteca de imágenes')).toBeInTheDocument();
    await u.click(within(bar).getByRole('button', { name: 'Colocar PJ' }));
    expect(await screen.findByRole('menu', { name: 'Elige un personaje' })).toBeInTheDocument();
  });

  it('el jugador no tiene rail (no elige escena) pero sí el botón de dados', async () => {
    mount('player');
    await screen.findByText(/Almacén de Queens/);
    expect(screen.queryByRole('group', { name: 'Escenas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lanzador de dados' })).toBeInTheDocument();
    expect(screen.getByText(/La directora decide qué escena ves\./)).toBeInTheDocument();
  });
});

describe('<SceneTab> rebanada 3 — barras dentro del mapa, menú al botón derecho y pin que centra', () => {
  it('la barra que aparece depende de la herramienta, y siempre va DENTRO del lienzo', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    await screen.findByText(/Almacén de Queens/);
    const stage = () => canvas().closest('.mp-stage')!;

    // Seleccionar: ninguna barra
    expect(stage().querySelector('.mp-strokebar')).toBeNull();
    expect(stage().querySelector('.mp-segbar')).toBeNull();

    await u.click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(stage().querySelector('.mp-strokebar')).not.toBeNull();   // «Trazo», sobre el mapa

    await u.click(screen.getByRole('button', { name: 'Muro' }));
    expect(stage().querySelector('.mp-strokebar')).toBeNull();
    expect(stage().querySelector('.mp-segbar')).not.toBeNull();      // «Segmento», sobre el mapa

    await u.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(stage().querySelector('.mp-brushbar')).not.toBeNull();    // «Pincel», sobre el mapa
  });

  it('cambiar de herramienta suelta la selección: «Segmento» no se queda pisando a «Trazo»', async () => {
    const u = userEvent.setup();
    mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    const stage = () => canvas().closest('.mp-stage')!;

    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(canvas(), { clientX: WALL_1.x1 + 2, clientY: 380, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByRole('toolbar', { name: 'Segmento' });

    await u.click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(stage().querySelector('.mp-strokebar')).not.toBeNull();
    expect(stage().querySelector('.mp-segbar')).toBeNull();          // las dos flotan en el mismo sitio
    expect(stage().querySelector('.mp-wall-handles')).toBeNull();     // ni tiradores de un muro que ya no editas
  });

  it('el botón derecho en vacío ofrece pin y dados; el pin centra la vista de quien lo pone', async () => {
    const onOpenDice = vi.fn();
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} repo={seed()} vision={fakeVisionPort()} onOpenDice={onOpenDice} />);
    await screen.findByText(/Almacén de Queens/);
    fireEvent.contextMenu(canvas(), { clientX: 120, clientY: 90 });
    const menu = await screen.findByRole('menu', { name: 'Acciones rápidas' });
    // centrar sólo para mí no molesta a nadie; centrar para todos sí manda el pin
    expect(within(menu).getByRole('menuitem', { name: /Centrar mi vista aquí/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Centrar la vista de todos/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Centrar' })).toBeInTheDocument();   // ajustar a la pantalla
    await userEvent.setup().click(within(menu).getByRole('menuitem', { name: /Lanzador de dados/ }));
    expect(onOpenDice).toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: 'Acciones rápidas' })).not.toBeInTheDocument();
  });

  it('Suprimir con un muro seleccionado lo borra', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(canvas(), { clientX: WALL_1.x1 + 2, clientY: 380, pointerId: 1, button: 0 });
    await screen.findByRole('toolbar', { name: 'Segmento' });
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(repo.walls).toHaveLength(0));
  });

  it('el mismo borrar está en el menú del botón derecho, y sólo cuando hay algo elegido', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);

    fireEvent.contextMenu(canvas(), { clientX: 700, clientY: 100 });
    expect(within(await screen.findByRole('menu', { name: 'Acciones rápidas' })).queryByRole('menuitem', { name: /Eliminar/ })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(canvas(), { clientX: WALL_1.x1 + 2, clientY: 380, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByRole('toolbar', { name: 'Segmento' });
    fireEvent.contextMenu(canvas(), { clientX: 700, clientY: 100 });
    await u.click(within(await screen.findByRole('menu', { name: 'Acciones rápidas' })).getByRole('menuitem', { name: /Eliminar/ }));
    await waitFor(() => expect(repo.walls).toHaveLength(0));
  });
});

describe('<SceneTab> cero escenas', () => {
  /**
   * Regresión, dueño 2026-08-19: «no tengo opción de crear mapa». La rebanada 3 se llevó el control de
   * crear al rail, y el rail sólo se pintaba con una escena viva: el cartel «crea la primera escena»
   * pedía justo lo que la pantalla no dejaba hacer.
   */
  it('el director sin ninguna escena sigue teniendo el rail y su «+ Escena», y crearla la deja elegida', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [] }), null);
    expect(await screen.findByText('Crea la primera escena para preparar la mesa.')).toBeInTheDocument();

    const rail = screen.getByRole('group', { name: 'Escenas' });
    await u.click(within(rail).getByRole('button', { name: '+ Escena' }));
    await u.type(await screen.findByRole('textbox'), 'Almacén');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(repo.scenes.map(s => s.name)).toEqual(['Almacén']));
    expect(await screen.findByRole('application', { name: 'Lienzo de la escena' })).toBeInTheDocument();
  });

  it('el jugador sin escena activa NO ve el rail: crear escenas es del director', async () => {
    mount('player', fakeMapsRepo({ scenes: [] }), null);
    expect(await screen.findByText('El director aún no ha activado ninguna escena.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Escenas' })).not.toBeInTheDocument();
  });
});

/**
 * «Colocar» del Bestiario (dueño, 2026-08-21: «el colocar no funciona»).
 *
 * Antes sólo cambiaba de pestaña: llegabas a la escena y no había nada armado, así que el director tenía
 * que volver a buscar la criatura en el desplegable. Ahora llega elegida y sólo falta pulsar dónde.
 */
describe('<SceneTab> — una criatura que llega ya elegida desde el Bestiario', () => {
  const OGRO = { id: 'ogre', label: 'Ogro', ref: 'bestiary', data: { resistance: 30, protection: 3, origin: 'manual', tokenUrl: null, entryId: null } };

  const mountArmed = (armEncounter: typeof OGRO | null, onArmed = vi.fn()) => {
    const repo = seed();
    renderWithProviders(
      <SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS} activeSceneId="sc-1"
                charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} repo={repo} vision={fakeVisionPort()}
                armEncounter={armEncounter} onArmed={onArmed} />,
    );
    return { repo, onArmed };
  };

  it('arma la colocación y lo dice, sin abrir el buscador que ya sobra', async () => {
    const { onArmed } = mountArmed(OGRO);
    expect(await screen.findByText(/Coloca a Ogro/)).toBeInTheDocument();
    // El desplegable preguntaría qué criatura, y eso ya está contestado.
    expect(screen.queryByRole('dialog', { name: /Colocar encuentro/i })).not.toBeInTheDocument();
    // Avisa al padre para que lo suelte: si no, volver a la pestaña la rearmaría sola.
    await waitFor(() => expect(onArmed).toHaveBeenCalled());
  });

  it('pulsar en el mapa coloca la criatura de verdad', async () => {
    const { repo } = mountArmed(OGRO);
    await screen.findByText(/Coloca a Ogro/);
    fireEvent.pointerDown(canvas(), { clientX: 3 * G + 3, clientY: 4 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({ name: 'Ogro' }));
  });

  it('«Cancelar» desarma y devuelve el buscador a su sitio', async () => {
    mountArmed(OGRO);
    await screen.findByText(/Coloca a Ogro/);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText(/Coloca a Ogro/)).not.toBeInTheDocument());
  });

  it('sin nada armado no aparece el aviso', async () => {
    mountArmed(null);
    await screen.findByText(/Almacén de Queens/);
    expect(screen.queryByText(/Coloca a/)).not.toBeInTheDocument();
  });
});
