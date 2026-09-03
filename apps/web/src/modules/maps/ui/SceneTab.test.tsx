import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import { fakeCharactersRepo, fakeMapsRepo, fakeVisionPort, CHARACTER_KAREN, CHARACTER_OTHER, DRAWING_MINE, DRAWING_OTHER, KAREN_DATA, LAYER_CREATURES, LAYER_FLOOR, LAYER_MOSS, LAYER_NOTES, LAYER_OBJECTS, LIGHT_TORCH, PLAYER_USER, SCENE_CHAPEL, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1, WALL_DOOR, IMAGE_CHAPEL } from '../../../../tests/helpers/fakes';
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
/**
 * Las seis de dibujar viven tras UN icono desde el 2026-09-03 («*quiero que todas estas sean un solo icono*»):
 * se abre el menú y se elige dentro. Un ayudante para no repetir los dos clics en cada test.
 */
const dibujo = async (u: ReturnType<typeof userEvent.setup>, name: string): Promise<void> => {
  await u.click(screen.getByRole('button', { name: 'Dibujar' }));
  await u.click(await screen.findByRole('menuitemradio', { name }));
};

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
    // 4 herramientas + Dados: las seis de dibujar se plegaron en un solo icono (dueño, 2026-09-03).
    expect(screen.getByRole('toolbar', { name: 'Herramientas del lienzo' }).querySelectorAll('button')).toHaveLength(5);
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
    await dibujo(u, 'Lápiz');
    await u.click(screen.getByRole('radio', { name: 'Color 3' }));
    fireEvent.pointerDown(canvas(), { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: 30, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(repo.drawings).toHaveLength(3));
    expect(repo.drawings[2]).toMatchObject({ sceneId: 'sc-1', campaignId: 'c1', kind: 'stroke', color: '#b8452c', width: 2, data: { points: [[10, 10], [30, 20]] } });
    await waitFor(() => expect(within(canvas()).getByTestId('mp-drawings').querySelectorAll('[data-drawing-id]')).toHaveLength(3));
    await dibujo(u, 'Borrar');
    fireEvent.pointerDown(canvas(), { clientX: 320, clientY: 290, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.removedDrawings).toEqual(['d-1']));
    fireEvent.pointerDown(canvas(), { clientX: 450, clientY: 520, pointerId: 1, button: 0 }); // someone else's rect: stays
    expect(repo.removedDrawings).toEqual(['d-1']);
    await u.click(screen.getByRole('button', { name: 'Limpiar mis trazos' }));
    await waitFor(() => expect(repo.clearedMine).toEqual(['sc-1']));
    // la barra de Trazo vive dentro del mapa y sólo con herramienta de dibujo: el jugador nunca ve «Limpiar todos»
    expect(screen.queryByRole('button', { name: 'Limpiar todos' })).not.toBeInTheDocument();
  });
  /**
   * «En el prototipo se va actualizando de acuerdo a cuando mueves el token» (dueño, 2026-08-22). La niebla
   * daba un salto al SOLTAR, porque hasta entonces el servidor no sabía dónde estaba el token. Ahora, mientras
   * se arrastra, se le manda la posición PROVISIONAL —`refresh(sceneId, { tokenId, x, y })`— y contesta qué
   * vería ahí sin guardar nada. Va a ~7 Hz, no a los 20 del broadcast: cada una es una ida y vuelta.
   */
  it('regresión · la niebla sigue al token MIENTRAS se arrastra, no al soltarlo', async () => {
    const vision = fakeVisionPort();
    mount('player', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Almacén de Queens/);
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    const conPos = () => vision.calls.filter(c => c.op === 'refresh' && c.at);
    expect(conPos()).toHaveLength(0);

    fireEvent.pointerDown(karen, { clientX: (TOKEN_KAREN.x + 0.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: (TOKEN_KAREN.x + 2.5) * G, clientY: (TOKEN_KAREN.y + 0.5) * G, pointerId: 1 });
    await waitFor(() => expect(conPos().length).toBeGreaterThan(0));
    // y la posición que viaja es la de DEBAJO DEL DEDO, no la guardada
    expect(conPos()[0]!.at).toMatchObject({ tokenId: 'tk-karen', x: expect.closeTo(12, 0) });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
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
  it('lists scenes (starts on the active one), shows walls + hidden tokens + DM label, background popover changes colour/image, «Colocar PJ» adds a controlled token, encounter places a bestiary token', async () => {
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
    // Cae CENTRADO donde se pulsa y sin pegarse a la rejilla (dueño, 2026-08-21): la esquina es el punto menos
    // media huella, 111/27 − 0,75 = 3,36. Y su ancho sale de la ficha: Elías es «mediano» → 1,5 casillas (p.25).
    expect(repo.tokens.at(-1)).toMatchObject({
      characterId: 'ch-elias', controlledBy: 'u-nix', visible: true, size: 1.5,
      x: expect.closeTo(3.36, 1), y: expect.closeTo(6.36, 1),
    });
    // encounter
    await u.click(screen.getByRole('button', { name: 'Encuentro' }));
    await u.click(await screen.findByRole('button', { name: 'Elegir Ogro' }));
    fireEvent.pointerDown(canvas(), { clientX: 5 * G + 3, clientY: 6 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({ bestiaryRef: 'ogre', name: 'Ogro', x: expect.closeTo(4.36, 1), y: expect.closeTo(5.36, 1), size: 1.5, visible: true, controlledBy: null, state: { resistance: 30 } }));
    expect(await within(canvas()).findByRole('img', { name: 'Token Ogro' })).toBeInTheDocument();
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
      bestiaryEntryId: 'be-9', bestiaryRef: null, name: 'Ogro con antorcha',
      x: expect.closeTo(2.36, 1), y: expect.closeTo(3.36, 1),
      // El bloque de una criatura NO imprime tamaño (comprobado en el PDF: el ogro de la p.152 trae Aguante y
      // Destino y nada más), así que se queda con el del mapa. Anotado como deuda en WORK_STATE.
      size: 1.5,
      // Nace VISIBLE: quien lo tapa es la niebla, no un interruptor (dueño, 2026-08-22).
      visible: true, state: { resistance: 30 },
    }));
  });

  /**
   * El OTRO lado de lo mismo: cuando la ficha SÍ dice de qué tamaño es, manda ella y no el valor por defecto
   * del mapa. Sin esta prueba las demás no distinguen «el motor dijo mediano» de «el motor no dijo nada»:
   * las dos cosas dan 1,5, así que un `tokenCells` desconectado pasaría el resto de la tanda sin enterarse.
   *
   * Los números son los de la tabla de tamaños del manual (p.25, verificada en el PDF): grande 3,5 casillas,
   * enorme 7. Y la esquina que se guarda sigue siendo el punto pulsado MENOS media huella, así que una huella
   * más grande se centra igual — es lo que evita que un ogro caiga con el pie donde debería estar su cabeza.
   */
  it('el tamaño de la ficha manda sobre el del mapa: un PJ grande ocupa 3,5 casillas y un PNJ enorme 7, los dos centrados', async () => {
    const u = userEvent.setup();
    const repo = seed();
    const bigPc = { ...CHARACTER_OTHER, id: 'ch-ogro', name: 'Bram el Grande', data: { ...KAREN_DATA, name: 'Bram el Grande', size: 'large' } };
    renderWithProviders(
      <SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS} activeSceneId="sc-1"
                charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, bigPc])} repo={repo} vision={fakeVisionPort()}
                extraEncounters={[{ id: 'be-7', label: 'Dragón de Queens', ref: 'bestiary',
                                    data: { resistance: 30, protection: 0, origin: 'npc', entryId: 'be-7', tokenUrl: null,
                                            creature: { sheet: { ...KAREN_DATA, size: 'huge' } } } }]} />,
    );

    await u.click(await screen.findByRole('button', { name: 'Colocar PJ' }));
    await u.click(await screen.findByRole('menuitem', { name: /Bram/ }));
    fireEvent.pointerDown(canvas(), { clientX: 4 * G + 3, clientY: 7 * G + 3, pointerId: 1, button: 0 });
    // 111/27 − 3,5/2 = 2,361 · 192/27 − 1,75 = 5,361
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({
      characterId: 'ch-ogro', size: 3.5, x: expect.closeTo(2.36, 1), y: expect.closeTo(5.36, 1),
    }));

    await u.click(screen.getByRole('button', { name: 'Encuentro' }));
    await u.click(await screen.findByRole('button', { name: 'Elegir Dragón de Queens' }));
    fireEvent.pointerDown(canvas(), { clientX: 5 * G + 3, clientY: 6 * G + 3, pointerId: 1, button: 0 });
    // 138/27 − 7/2 = 1,611 · 165/27 − 3,5 = 2,611. Una huella grande PUEDE salirse del mapa por arriba: es correcto.
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({
      bestiaryEntryId: 'be-7', name: 'Dragón de Queens', size: 7, x: expect.closeTo(1.61, 1), y: expect.closeTo(2.61, 1),
    }));
    // Y se dibuja: un token de 7 casillas no revienta el glifo (`r = size·grid/2 − 1,5`).
    expect(await within(canvas()).findByRole('img', { name: /Dragón de Queens/ })).toBeInTheDocument();
  });

  it('walls: click-click adds a segment; token bar: select → hide/show + remove; «Limpiar todos»; create + activate a scene', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    await u.click(screen.getByRole('button', { name: 'Builder' }));
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
    await dibujo(u, 'Lápiz');   // la barra de Trazo sólo aparece con herramienta de dibujo
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

  /**
   * Atacar CON el token (`.pen` columna 6). El botón sólo sale sobre una criatura, y la distancia hasta
   * cada personaje la mide el mapa: el mutante está en (20,9) y Karen en (12,11) → 8,2 casillas, o sea
   * un disparo, no cuerpo a cuerpo.
   */
  it('token de criatura: ATACAR mide la distancia y manda la tirada; sobre un PJ no se ofrece', async () => {
    const u = userEvent.setup();
    const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
    const onOpenAttack = vi.fn().mockResolvedValue({ id: 'atk-1' });
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])} repo={seed()}
      vision={fakeVisionPort()} onRoll={onRoll} onOpenAttack={onOpenAttack} />);
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const mutante = await within(canvas()).findByRole('img', { name: /Mutante/ });
    fireEvent.pointerDown(mutante, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    await u.click(within(bar).getByRole('button', { name: 'Atacar' }));
    const modal = await screen.findByRole('dialog', { name: 'Atacar con Mutante' });
    expect(within(modal).getByText(/casillas/)).toBeInTheDocument();
    await u.click(within(modal).getByRole('button', { name: /^Atacar a / }));
    await waitFor(() => expect(onRoll).toHaveBeenCalled());
    expect(onRoll.mock.calls[0]?.[0]).toMatchObject({ campaignId: 'c1', kind: 'system' });
    // Un disparo es un reto y sale en el acto: no hay a quién pedirle una defensa (p.96).
    expect(onOpenAttack).not.toHaveBeenCalled();

    // Sobre el token de un PERSONAJE no hay nada que atacar: el botón no está.
    const karen = await within(canvas()).findByRole('img', { name: 'Token Karen «K»' });
    fireEvent.pointerDown(karen, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar2 = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    expect(within(bar2).queryByRole('button', { name: 'Atacar' })).not.toBeInTheDocument();
  });

  /**
   * Cuerpo a cuerpo es un CONFLICTO (p.93). Con el mutante pegado a Karen —en su misma casilla— el golpe
   * no se tira: se abre un ataque a la espera y la escena rellena de dónde sale (escena y tokens), que es
   * lo único que el modal no sabe.
   */
  it('token de criatura pegado a un PJ: ATACAR abre el ataque a la espera, no tira', async () => {
    const u = userEvent.setup();
    const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
    const onOpenAttack = vi.fn().mockResolvedValue({ id: 'atk-1' });
    const close = fakeMapsRepo({
      scenes: [SCENE_WAREHOUSE], walls: [WALL_1],
      tokens: [TOKEN_KAREN, { ...TOKEN_MUTANT, x: TOKEN_KAREN.x, y: TOKEN_KAREN.y, visible: true }],
    });
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])} repo={close}
      vision={fakeVisionPort()} onRoll={onRoll} onOpenAttack={onOpenAttack} />);
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const mutante = await within(canvas()).findByRole('img', { name: /Mutante/ });
    fireEvent.pointerDown(mutante, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    await u.click(within(bar).getByRole('button', { name: 'Atacar' }));
    const modal = await screen.findByRole('dialog', { name: 'Atacar con Mutante' });
    await u.click(within(modal).getByRole('button', { name: /^Atacar a Karen/ }));
    await waitFor(() => expect(onOpenAttack).toHaveBeenCalled());
    expect(onRoll).not.toHaveBeenCalled();
    expect(onOpenAttack.mock.calls[0]?.[0]).toMatchObject({
      sceneId: 'sc-1', attackerTokenId: TOKEN_MUTANT.id, attackerName: 'Mutante',
      targetTokenId: TOKEN_KAREN.id, targetCharacterId: CHARACTER_KAREN.id,
    });
  });

  /**
   * LA REGRESIÓN DEL ALCANCE (2026-08-22): con cuerpos de 1,5 casillas y los centros a 2,1 (3,15 m), medir
   * de centro a centro clasificaba el ataque como «a corta distancia» → tirada inmediata y SIN aviso de
   * defensa, con los tokens casi tocándose en pantalla. El libro mide si pueden TOCARSE (p.92/p.95): el
   * hueco entre los cuerpos es 0,6 casillas (0,9 m) → cuerpo a cuerpo → ataque a la espera.
   */
  it('regresión · dos cuerpos grandes casi pegados son cuerpo a cuerpo: abre el ataque a la espera', async () => {
    const u = userEvent.setup();
    const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
    const onOpenAttack = vi.fn().mockResolvedValue({ id: 'atk-1' });
    const grandes = fakeMapsRepo({
      scenes: [SCENE_WAREHOUSE], walls: [WALL_1],
      tokens: [{ ...TOKEN_KAREN, size: 1.5 }, { ...TOKEN_MUTANT, x: TOKEN_KAREN.x + 2.1, y: TOKEN_KAREN.y, size: 1.5, visible: true }],
    });
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])} repo={grandes}
      vision={fakeVisionPort()} onRoll={onRoll} onOpenAttack={onOpenAttack} />);
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const mutante = await within(canvas()).findByRole('img', { name: /Mutante/ });
    fireEvent.pointerDown(mutante, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    await u.click(within(bar).getByRole('button', { name: 'Atacar' }));
    const modal = await screen.findByRole('dialog', { name: 'Atacar con Mutante' });
    await u.click(within(modal).getByRole('button', { name: /^Atacar a Karen/ }));
    await waitFor(() => expect(onOpenAttack).toHaveBeenCalled());
    expect(onRoll).not.toHaveBeenCalled();
  });

  /** Sin a dónde mandar el ataque a la espera, ATACAR no se ofrece: la mitad cuerpo a cuerpo moriría al pulsar. */
  it('sin `onOpenAttack` el botón ATACAR no aparece', async () => {
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])} repo={seed()}
      vision={fakeVisionPort()} onRoll={vi.fn()} />);
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    const mutante = await within(canvas()).findByRole('img', { name: /Mutante/ });
    fireEvent.pointerDown(mutante, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    const bar = await screen.findByRole('toolbar', { name: 'Token seleccionado' });
    expect(within(bar).queryByRole('button', { name: 'Atacar' })).not.toBeInTheDocument();
  });
});

describe('<SceneTab> failures', () => {
  it('surfaces a refused map change instead of swallowing it', async () => {
    const u = userEvent.setup();
    const repo = seed();
    repo.addWall = async () => { throw new Error('rls'); };
    mount('dm', repo);
    await screen.findByRole('button', { name: 'Ver escena Almacén de Queens' });
    await u.click(screen.getByRole('button', { name: 'Builder' }));
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
    await u.click(await screen.findByRole('button', { name: 'Niebla automática por visión · se abre sola al moverse' }));
    await waitFor(() => expect(repo.sceneUpdates).toContainEqual({ id: 'sc-1', patch: { fogMode: 'manual' } }));
  });

  it('DM: the Muro tool draws whatever type the picker says, with the flags of that type', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));

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
    await u.click(screen.getByRole('button', { name: 'Builder' }));
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
    await u.click(screen.getByRole('button', { name: 'Builder' }));
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

  /**
   * Regresión, prueba del dueño: en la escena se veían «Colocar encuentro» y «Fondo del mapa» abiertos A LA
   * VEZ, tapándose. Cada uno tenía su interruptor y ninguno sabía de los demás. Ahora sobre el mapa sólo hay
   * una cosa abierta a la vez: abrir una cierra las otras, y cerrarla no abre ninguna.
   */
  it('regresión · sobre el mapa sólo hay UN panel abierto a la vez', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
    const bg = () => screen.queryByRole('dialog', { name: 'Fondo del mapa' });
    const pc = () => screen.queryByRole('menu', { name: 'Elige un personaje' });
    const enc = () => screen.queryByRole('dialog', { name: 'Colocar encuentro' }) ?? screen.queryByRole('menu', { name: 'Colocar encuentro' });

    await u.click(within(bar).getByRole('button', { name: 'Fondo del mapa' }));
    await waitFor(() => expect(bg()).toBeInTheDocument());
    // el encuentro se abre por HERRAMIENTA, y aun así cierra el fondo
    await u.click(within(bar).getByRole('button', { name: 'Encuentro' }));
    await waitFor(() => expect(enc()).toBeInTheDocument());
    expect(bg()).not.toBeInTheDocument();
    // y «Colocar PJ» cierra el de encuentros
    await u.click(within(bar).getByRole('button', { name: 'Colocar PJ' }));
    await waitFor(() => expect(pc()).toBeInTheDocument());
    expect(enc()).not.toBeInTheDocument();
    expect(bg()).not.toBeInTheDocument();
    // volver a pulsar el mismo botón lo cierra, y no abre ningún otro
    await u.click(within(bar).getByRole('button', { name: 'Colocar PJ' }));
    await waitFor(() => expect(pc()).not.toBeInTheDocument());
    expect(bg()).not.toBeInTheDocument();
    expect(enc()).not.toBeInTheDocument();
  });

  /**
   * El cuarto panel que se monta sobre el mapa es el de ATACAR, y no se abre por la barra sino desde el
   * token elegido, así que se le escapaba a la exclusión: con «Fondo del mapa» abierto se podía elegir una
   * criatura en el lienzo —el panel no tapa el mapa— y pulsar Atacar, quedando los dos encima. Es un modal
   * de verdad (se traga los clics con su `.bs-pop-catch`), así que entra en la regla como los demás.
   */
  it('regresión · abrir ATACAR desde un token también cierra lo que hubiera abierto', async () => {
    const u = userEvent.setup();
    renderWithProviders(<SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={MEMBERS}
      activeSceneId="sc-1" charactersRepo={fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER])} repo={seed()}
      vision={fakeVisionPort()} onRoll={vi.fn().mockResolvedValue({ id: 'r-1' })} onOpenAttack={vi.fn().mockResolvedValue({ id: 'a-1' })} />);
    const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
    await u.click(within(bar).getByRole('button', { name: 'Fondo del mapa' }));
    await screen.findByRole('dialog', { name: 'Fondo del mapa' });

    const mutante = await within(canvas()).findByRole('img', { name: /Mutante/ });
    fireEvent.pointerDown(mutante, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await u.click(within(await screen.findByRole('toolbar', { name: 'Token seleccionado' })).getByRole('button', { name: 'Atacar' }));

    await screen.findByRole('dialog', { name: 'Atacar con Mutante' });
    expect(screen.queryByRole('dialog', { name: 'Fondo del mapa' })).not.toBeInTheDocument();
  });

  /**
   * «El modal de Fondo del mapa sale en la otra punta» (dueño): su botón vive en la barra de la IZQUIERDA y
   * el panel estaba clavado a la derecha del lienzo. El arreglo es CSS (`.mp-bgpop` pasa de `right:54px` a
   * `top:60px;left:8px`, el mismo hueco que sus vecinos `.mp-pcmenu` y `.mp-encounter`, que arrancan en 60px
   * para no taparle la etiqueta al lienzo), y jsdom no carga la hoja de estilos, así que el SITIO no se puede
   * comprobar aquí — cae en la excepción cosmética (CSS-only) de CLAUDE.md. Lo que sí se fija es que el panel
   * siga saliendo con su clase, que es de lo que cuelga la posición.
   */
  it('el panel de Fondo del mapa lleva la clase de la que cuelga su posición', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
    await u.click(within(bar).getByRole('button', { name: 'Fondo del mapa' }));
    expect(await screen.findByRole('dialog', { name: 'Fondo del mapa' })).toHaveClass('mp-bgpop');
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
    expect(stage().querySelector('.mp-builder')).toBeNull();

    await dibujo(u, 'Lápiz');
    expect(stage().querySelector('.mp-strokebar')).not.toBeNull();   // «Trazo», sobre el mapa

    await u.click(screen.getByRole('button', { name: 'Builder' }));
    expect(stage().querySelector('.mp-strokebar')).toBeNull();
    expect(stage().querySelector('.mp-builder')).not.toBeNull();     // el panel de Builder, sobre el mapa

    await u.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(stage().querySelector('.mp-brushbar')).not.toBeNull();    // «Pincel», sobre el mapa
  });

  it('cambiar de herramienta suelta la selección: el panel de Builder no se queda pisando a «Trazo»', async () => {
    const u = userEvent.setup();
    mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    const stage = () => canvas().closest('.mp-stage')!;

    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(canvas(), { clientX: WALL_1.x1 + 2, clientY: 380, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByRole('group', { name: 'Builder' });

    await dibujo(u, 'Lápiz');
    expect(stage().querySelector('.mp-strokebar')).not.toBeNull();
    expect(stage().querySelector('.mp-builder')).toBeNull();         // los dos flotan sobre el mismo mapa
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
    /**
     * «Seleccionar» es la PRIMERA (dueño, 2026-09-02). Es la vuelta a casa desde cualquier herramienta, y
     * arriba del todo porque es lo que más se busca; el orden importa y por eso se comprueba el orden.
     */
    const items = within(menu).getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Seleccionar');
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
    await screen.findByRole('group', { name: 'Builder' });
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
    await screen.findByRole('group', { name: 'Builder' });
    fireEvent.contextMenu(canvas(), { clientX: 700, clientY: 100 });
    await u.click(within(await screen.findByRole('menu', { name: 'Acciones rápidas' })).getByRole('menuitem', { name: /Eliminar/ }));
    await waitFor(() => expect(repo.walls).toHaveLength(0));
  });
});

/**
 * EL PANEL DE BUILDER v3 montado de verdad sobre la escena (`rolvium.pen` · `ePNCc`). Orden del dueño del
 * 2026-09-03: se acabó colgar cosas de la barra flotante vieja.
 */
describe('<SceneTab> el panel de Builder v3', () => {
  const dblDown = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0, detail: 2 });

  it('con Builder se abre el panel, con su icono y sus secciones', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    const panel = await screen.findByRole('group', { name: 'Builder' });
    expect(within(panel).getByRole('radiogroup', { name: /En qué estoy trabajando/ })).toBeInTheDocument();
    expect(within(panel).getByRole('radiogroup', { name: 'Tipo de segmento' })).toBeInTheDocument();
    expect(within(panel).getByRole('radiogroup', { name: 'Con qué forma' })).toBeInTheDocument();
    // Arranca ABIERTO, por orden suya: «el pegado a la rejilla debería estar desactivado por defecto».
    expect(within(panel).getByRole('button', { name: /Libre/ })).toBeInTheDocument();
  });

  it('cerrar el panel vuelve a Seleccionar y suelta lo que hubiera cogido', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    await screen.findByRole('group', { name: 'Builder' });
    await u.click(screen.getByRole('button', { name: 'Cerrar Builder' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Builder' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * 🔒 EL CANDADO, de punta a punta. Cerrado (lo de siempre) el muro cuadra a la casilla; abierto cae donde
   * se pinchó. Es la primera condición que él puso: sin abrirlo, nada cambia.
   */
  it('de serie el muro cae donde se pinchó; echando el candado se cuadra a la casilla', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));

    // Como viene de serie —candado ABIERTO— el muro cae exactamente donde se pinchó.
    fireEvent.pointerDown(canvas(), { clientX: 500, clientY: 611, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 613, clientY: 611, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(1));
    expect(repo.walls[0]).toMatchObject({ x1: 500, y1: 611, x2: 613, y2: 611 });

    // Escape corta la cadena: si no, el clic siguiente encadena otro muro desde donde acabó el anterior.
    fireEvent.keyDown(window, { key: 'Escape' });
    await u.click(screen.getByRole('button', { name: /Libre/ }));
    // Echado el candado, 4*G+5 cuadra a 4*G.
    fireEvent.pointerDown(canvas(), { clientX: 4 * G + 5, clientY: 4 * G, pointerId: 1, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 8 * G, clientY: 4 * G, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(2));
    expect(repo.walls[1]).toMatchObject({ x1: 4 * G, y1: 4 * G, x2: 8 * G, y2: 4 * G });
  });

  /**
   * 🆕 EL NODO POR DOBLE CLIC, de punta a punta: un muro entra, dos salen, y el hueco no existe en ningún
   * momento porque el trozo nuevo se escribe ANTES de acortar el viejo.
   */
  it('doble clic sobre la línea de un muro lo parte en dos', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));

    // WALL_1 es vertical de (270,216) a (270,540): se pincha por la mitad.
    dblDown(canvas(), WALL_1.x1, 378);
    fireEvent.pointerUp(canvas(), { pointerId: 1 });

    await waitFor(() => expect(repo.walls).toHaveLength(2));
    expect(repo.walls.find(w => w.id === WALL_1.id)).toMatchObject({ y1: 216, y2: 378 });
    expect(repo.walls.find(w => w.id !== WALL_1.id)).toMatchObject({ y1: 378, y2: 540 });
  });
});

/**
 * 🤝 SELECCIONAR Y BUILDER VIVEN JUNTAS — «*si tengo una herramienta y selecciono la herramienta de selección
 * no tiene que cerrar los modales abiertos, viven juntas, porque si quiero mover algo no indica que deje de
 * trabajar con un muro*» (dueño, 2026-09-03).
 */
describe('<SceneTab> Seleccionar y Builder viven juntas', () => {
  it('pasar de Builder a Seleccionar NO cierra el panel', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    await screen.findByRole('group', { name: 'Builder' });
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    // Sigue ahí: mover algo no es dejar de trabajar con un muro.
    expect(screen.getByRole('group', { name: 'Builder' })).toBeInTheDocument();
  });

  it('y al revés: con un muro cogido, pasar a Builder no lo suelta', async () => {
    const u = userEvent.setup();
    mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: [WALL_1] }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.pointerDown(canvas(), { clientX: WALL_1.x1 + 2, clientY: 380, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByText('Lo que tengo cogido');
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    expect(screen.getByText('Lo que tengo cogido')).toBeInTheDocument();
  });

  /** Cualquier OTRA herramienta sí recoge los paneles: flotan sobre el mismo mapa y se pisarían. */
  it('cualquier otra herramienta sí lo cierra', async () => {
    const u = userEvent.setup();
    mount('dm', seed());
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    await screen.findByRole('group', { name: 'Builder' });
    await dibujo(u, 'Lápiz');
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Builder' })).not.toBeInTheDocument());
  });
});

/**
 * 🔗 LA CADENA, de punta a punta: mover un nodo de una sala no la abre. Es su queja del 2026-09-03 («*me
 * separa los segmentos de la figura original*»).
 */
describe('<SceneTab> los nodos en cadena', () => {
  /** Un cuadrado atado, como el que deja el rectángulo de Builder. La esquina (2G,2G) la comparten dos lados. */
  const lado = (id: string, x1: number, y1: number, x2: number, y2: number) => ({ ...WALL_1, id, x1, y1, x2, y2, groupId: 'g1' });
  const sala = [
    lado('s-a', 2 * G, 2 * G, 8 * G, 2 * G), lado('s-b', 8 * G, 2 * G, 8 * G, 7 * G),
    lado('s-c', 8 * G, 7 * G, 2 * G, 7 * G), lado('s-d', 2 * G, 7 * G, 2 * G, 2 * G),
  ];

  it('arrastrar una esquina se lleva los dos lados que la tocaban', async () => {
    const u = userEvent.setup();
    const repo = mount('dm', fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], walls: sala }));
    await screen.findByText(/Almacén de Queens/);
    await u.click(screen.getByRole('button', { name: 'Seleccionar' }));

    // Entrar al lado de arriba (doble clic), y desde dentro agarrar su esquina de la izquierda y moverla.
    fireEvent.pointerDown(canvas(), { clientX: 5 * G, clientY: 2 * G, pointerId: 1, button: 0, detail: 2 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByText('Lo que tengo cogido');

    fireEvent.pointerDown(canvas(), { clientX: 2 * G, clientY: 2 * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: 4 * G, clientY: 4 * G, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });

    // El lado de arriba y el de la izquierda acaban compartiendo la esquina NUEVA: la sala sigue cerrada.
    await waitFor(() => {
      const a = repo.walls.find(w => w.id === 's-a')!;
      const d = repo.walls.find(w => w.id === 's-d')!;
      expect({ x: a.x1, y: a.y1 }).toEqual({ x: 4 * G, y: 4 * G });
      expect({ x: d.x2, y: d.y2 }).toEqual({ x: 4 * G, y: 4 * G });
    });
    // Y el lado de enfrente no se ha movido: mover una esquina no es mover la sala.
    expect(repo.walls.find(w => w.id === 's-c')).toMatchObject({ x1: 8 * G, y1: 7 * G, x2: 2 * G, y2: 7 * G });
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

  /**
   * El botón derecho abre el menú rápido —«centra mi vista aquí»— y eso es justo lo que hace quien llega del
   * Bestiario antes de soltar la criatura. Con la criatura YA elegida no hay ningún panel de encuentros
   * abierto: sólo una colocación armada y su aviso. Cerrar «el menú de encuentros» ahí mataba en silencio el
   * «pulsa dónde» que el dueño acababa de arreglar («el colocar no funciona», 2026-08-21).
   */
  it('el menú del botón derecho NO desarma la criatura que traes del Bestiario', async () => {
    const { repo } = mountArmed(OGRO);
    await screen.findByText(/Coloca a Ogro/);
    fireEvent.contextMenu(canvas(), { clientX: 700, clientY: 100 });
    await screen.findByRole('menu', { name: 'Acciones rápidas' });
    expect(screen.getByText(/Coloca a Ogro/)).toBeInTheDocument();
    // y sigue colocando de verdad, que es lo que se estaba perdiendo
    fireEvent.pointerDown(canvas(), { clientX: 3 * G + 3, clientY: 4 * G + 3, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.tokens.at(-1)).toMatchObject({ name: 'Ogro' }));
  });
});

/**
 * El panel de capas dentro de la escena de verdad (rebanada 7). Lo que se prueba aquí es la CONEXIÓN —el
 * panel por dentro tiene su propio test—: de quién es, cuándo desaparece, y que lo que se dibuja cae en la
 * capa activa, que es lo que el dueño pidió con «se dibuja y se coloca en la capa ACTIVA».
 */
describe('<SceneTab> capas (rebanada 7)', () => {
  const withLayers = () => fakeMapsRepo({
    scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [], drawings: [], images: [IMAGE_CHAPEL],
    layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES, LAYER_FLOOR, LAYER_MOSS],
    lights: [LIGHT_TORCH],
  });

  it('es del director: el jugador no lo ve, y «ver como jugador» se lo quita a él también', async () => {
    const repo = withLayers();
    mount('player', repo);
    await waitFor(() => expect(screen.getByText(/Almacén de Queens · tu visión/)).toBeInTheDocument());
    expect(screen.queryByRole('complementary', { name: 'Capas' })).not.toBeInTheDocument();
    document.body.innerHTML = '';

    const u = userEvent.setup();
    mount('dm', withLayers());
    expect(await screen.findByRole('complementary', { name: 'Capas' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ver como jugador' }));
    expect(screen.queryByRole('complementary', { name: 'Capas' })).not.toBeInTheDocument();
  });

  it('el ojo de una capa se guarda, y apagarla la quita del lienzo', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    expect(within(canvas()).getAllByTestId('mp-terrain-layer')).toHaveLength(2);
    await u.click(screen.getByRole('button', { name: 'Ocultar la capa Musgo (deja de pintarse para todos)' }));
    await waitFor(() => expect(repo.layerUpdates).toEqual([{ id: 'ly-moss', patch: { visible: false } }]));
    await waitFor(() => expect(within(canvas()).getAllByTestId('mp-terrain-layer')).toHaveLength(1));
  });

  it('lo que se dibuja cae en la capa ACTIVA', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' }));
    await dibujo(u, 'Lápiz');
    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 4 * G, clientY: 4 * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 6 * G, clientY: 5 * G, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.drawings.at(-1)).toMatchObject({ kind: 'stroke', layerId: 'ly-moss' }));
  });

  it('sin capa activa se dibuja donde siempre, como antes de que existieran las capas', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await dibujo(u, 'Lápiz');
    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 4 * G, clientY: 4 * G, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 6 * G, clientY: 5 * G, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.drawings.at(-1)).toMatchObject({ kind: 'stroke', layerId: null }));
  });

  /** Las luces son pintura: se pintan, y no piden la visión de nuevo. */
  it('las luces de la escena se pintan en el lienzo', async () => {
    mount('dm', withLayers());
    await screen.findByRole('complementary', { name: 'Capas' });
    expect(within(canvas()).getAllByTestId('mp-light')).toHaveLength(1);
  });

  it('la herramienta Luz coloca una donde se pincha y abre su editor', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Luz de ambiente' }));
    fireEvent.pointerDown(canvas(), { clientX: 9 * G, clientY: 7 * G, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.lights).toHaveLength(2));
    expect(repo.lights.at(-1)).toMatchObject({ kind: 'torch', flicker: true, rangeM: 6, castsShadow: true, x: 9 * G, y: 7 * G });
    // Y se abre solo para retocarla, sin tener que buscarla.
    expect(await screen.findByRole('group', { name: 'Luz: Antorcha' })).toBeInTheDocument();
  });

  /**
   * Lo que hace que «+ Capa de terreno» sirva de algo: con una capa de terreno activa, «Fondo del mapa» toca
   * la foto DE LA CAPA. Sin esto la capa nacía vacía y parecía que el botón no hacía nada.
   */
  it('con una capa de terreno activa, «Fondo del mapa» le pone la foto a ELLA', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' }));
    await u.click(screen.getByRole('button', { name: 'Fondo del mapa' }));
    expect(await screen.findByRole('dialog', { name: 'Foto de la capa «Musgo»' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: IMAGE_CHAPEL.name }));
    await waitFor(() => expect(repo.layerUpdates.at(-1)).toEqual({ id: 'ly-moss', patch: { imageUrl: IMAGE_CHAPEL.url } }));
    // Y la escena NO se ha tocado: la foto es de la capa.
    expect(repo.sceneUpdates.some(u2 => 'bgImageUrl' in u2.patch)).toBe(false);
  });

  it('sin capa de terreno activa sigue siendo el fondo de la escena', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Fondo del mapa' }));
    expect(await screen.findByRole('dialog', { name: 'Fondo del mapa' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: IMAGE_CHAPEL.name }));
    await waitFor(() => expect(repo.sceneUpdates.at(-1)).toEqual({ id: 'sc-1', patch: { bgImageUrl: IMAGE_CHAPEL.url } }));
  });

  /**
   * El pincel de transparencia necesita una capa de terreno donde pintar. Sin ella no se queda mudo: lo dice.
   */
  it('el pincel avisa si no hay capa de terreno donde pintar, y aparece cuando la hay', async () => {
    const u = userEvent.setup();
    mount('dm', withLayers());
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Pincel de transparencia' }));
    expect(screen.getByText('Elige una capa de terreno en el panel de capas para pintar en ella.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' }));
    const bar = screen.getByRole('radio', { name: 'Borrar' }).closest('.mp-maskbar')!;
    expect(within(bar as HTMLElement).getByRole('slider', { name: 'Fuerza' })).toBeInTheDocument();
    // La barra dice en qué capa se pinta: el pincel no vale para todas a la vez.
    expect(within(bar as HTMLElement).getByText('Musgo')).toBeInTheDocument();
  });

  /**
   * PIN DE DECISIÓN: el tamaño del pincel de transparencia es CONTINUO y vive APARTE del de la niebla, que
   * son cuatro discos fijos. El dueño pidió el gradual sólo para éste. Si alguien «ordena» el código y los
   * junta reusando `brush`, la niebla se queda con un tamaño que ninguno de sus cuatro discos puede marcar:
   * este test es lo único que se entera.
   */
  it('el tamaño de transparencia va aparte del de la niebla', async () => {
    const u = userEvent.setup();
    mount('dm', withLayers());
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Pincel de transparencia' }));
    await u.click(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' }));
    expect(screen.getByText('1.2 casillas')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Tamaño del pincel' }), { target: { value: '35' } });
    expect(await screen.findByText('3.5 casillas')).toBeInTheDocument();
    // La niebla sigue en su disco de siempre…
    await u.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(await screen.findByRole('radio', { name: 'Tamaño 3' })).toBeChecked();
    // …y moverle el disco a la niebla tampoco arrastra al de transparencia (la fusión de una sola dirección).
    await u.click(screen.getByRole('radio', { name: 'Tamaño 1' }));
    expect(await screen.findByRole('radio', { name: 'Tamaño 1' })).toBeChecked();
    // …y al volver, la transparencia conserva el suyo.
    await u.click(screen.getByRole('button', { name: 'Pincel de transparencia' }));
    expect(await screen.findByText('3.5 casillas')).toBeInTheDocument();
  });

  it('retocar y borrar la luz seleccionada llega al repositorio', async () => {
    const u = userEvent.setup();
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await u.click(screen.getByRole('button', { name: 'Luz de ambiente' }));
    fireEvent.pointerDown(canvas(), { clientX: 9 * G, clientY: 7 * G, pointerId: 1, button: 0 });
    await screen.findByRole('group', { name: 'Luz: Antorcha' });
    await u.click(screen.getByRole('radio', { name: 'Hoguera' }));
    await waitFor(() => expect(repo.lightUpdates.at(-1)).toMatchObject({ patch: { kind: 'fire' } }));
    await u.click(screen.getByRole('button', { name: 'Borrar la luz' }));
    await waitFor(() => expect(repo.lights).toHaveLength(1));
    expect(screen.queryByRole('group', { name: /^Luz:/ })).not.toBeInTheDocument();
  });

  /**
   * 🔦 ARRASTRAR UNA LUZ LLEGA A LA TABLA (dueño, 2026-09-01: «no lo puedo arrastrar … y que me deje
   * moverla»). El lienzo por dentro ya tiene su test —que avisa—; lo que se prueba aquí es la CONEXIÓN: que
   * ese aviso acabe escrito en `maps_lights`. Sin esta pieza la luz se movía en pantalla y volvía a su sitio
   * al recargar, que es exactamente el fallo que él vería.
   */
  it('arrastrar una luz por el lienzo guarda su nueva posición', async () => {
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    const svg = canvas();
    // LIGHT_TORCH vive en (300, 200) px de escena, y con Seleccionar —la herramienta de siempre— se agarra.
    fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 360, clientY: 245, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.lightUpdates.at(-1)).toEqual({ id: LIGHT_TORCH.id, patch: { x: 360, y: 245 } }));
  });

  /** Y un clic sin arrastre sólo la elige: abrir su editor no puede escribir en la base de datos. */
  it('pinchar una luz sin arrastrarla abre su editor y no guarda nada', async () => {
    const repo = withLayers();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    expect(await screen.findByRole('group', { name: 'Luz: Antorcha' })).toBeInTheDocument();
    expect(repo.lightUpdates).toEqual([]);
  });

  /**
   * 🗑 BORRAR UNA LUZ ELEGIDA (dueño, 2026-09-02: «si la selecciono a la luz y toco la tecla suprimir o botón
   * derecho eliminar la luz se tiene que borrar»). Antes Suprimir sólo sabía de muros y fichas.
   */
  it('con una luz elegida, Suprimir la borra', async () => {
    const repo = withLayers();
    const antes = repo.lights.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByRole('group', { name: 'Luz: Antorcha' });
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(repo.lights).toHaveLength(antes - 1));
    expect(repo.lights.some(l => l.id === LIGHT_TORCH.id)).toBe(false);
    // Y su editor se va con ella: dejarlo abierto sobre algo que ya no existe es un panel fantasma.
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Luz: Antorcha' })).toBeNull());
  });

  it('con el botón derecho sobre una luz, el menú ofrece borrarla', async () => {
    const repo = withLayers();
    const antes = repo.lights.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.contextMenu(canvas(), { clientX: 300, clientY: 200 });
    const borrar = await screen.findByRole('menuitem', { name: 'Borrar la luz' });
    fireEvent.click(borrar);
    await waitFor(() => expect(repo.lights).toHaveLength(antes - 1));
  });

  /**
   * ✏️ Y LO MISMO CON UN TRAZO (dueño, 2026-09-02: «los textos líneas formas etc deberían poder
   * seleccionarse y mover y borrarse como cualquier cosa»). Aquí se prueba la CONEXIÓN: que el arrastre y el
   * Suprimir acaben escritos, no sólo pintados. Sin esto el trazo volvía a su sitio al recargar.
   */
  /**
   * 🐞 EL PIN DE «no funcionan las herramientas de dibujo que tocaste» (dueño, 2026-09-02, tras añadir
   * elegir/mover/borrar trazos).
   *
   * Lo que había probado no bastaba: los tests del lienzo le PASAN la herramienta como propiedad, así que
   * prueban el lienzo pero no que pulsar el botón de la barra llegue a dibujar. Aquí se pulsa el botón de
   * verdad y se dibuja de verdad, de punta a punta hasta la base.
   */
  it('pulsar Lápiz y arrastrar dibuja de verdad — el botón, el lienzo y la base, enteros', async () => {
    const u = userEvent.setup();
    const repo = withDrawings();
    const antes = repo.drawings.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await dibujo(u, 'Lápiz');
    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 700, clientY: 700, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 720, clientY: 715, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 740, clientY: 730, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.drawings).toHaveLength(antes + 1));
    expect(repo.drawings.at(-1)).toMatchObject({ kind: 'stroke' });
  });

  it('pulsar Caja y arrastrar dibuja un rectángulo', async () => {
    const u = userEvent.setup();
    const repo = withDrawings();
    const antes = repo.drawings.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    await dibujo(u, 'Caja');
    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 700, clientY: 700, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 780, clientY: 760, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.drawings).toHaveLength(antes + 1));
    expect(repo.drawings.at(-1)).toMatchObject({ kind: 'rect' });
  });

  const withDrawings = () => fakeMapsRepo({
    scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [], drawings: [DRAWING_MINE, DRAWING_OTHER], images: [IMAGE_CHAPEL],
    layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES, LAYER_FLOOR, LAYER_MOSS],
    lights: [LIGHT_TORCH],
  });

  it('arrastrar un trazo guarda sus puntos ya movidos', async () => {
    const repo = withDrawings();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    const svg = canvas();
    // DRAWING_OTHER es una caja de (450,500) a (510,540).
    fireEvent.pointerDown(svg, { clientX: 450, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 470, clientY: 530, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(repo.drawingMoves.at(-1)).toEqual({ id: DRAWING_OTHER.id, data: { x1: 470, y1: 530, x2: 530, y2: 570 } }));
  });

  it('con un trazo elegido, Suprimir lo borra', async () => {
    const repo = withDrawings();
    const antes = repo.drawings.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.pointerDown(canvas(), { clientX: 450, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(repo.drawings).toHaveLength(antes - 1));
    expect(repo.drawings.some(d => d.id === DRAWING_OTHER.id)).toBe(false);
  });

  it('con el botón derecho sobre un trazo, el menú ofrece borrarlo', async () => {
    const repo = withDrawings();
    const antes = repo.drawings.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.contextMenu(canvas(), { clientX: 450, clientY: 500 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Borrar el trazo' }));
    await waitFor(() => expect(repo.drawings).toHaveLength(antes - 1));
  });

  /**
   * 🌫 EL VELO GRIS, DE PUNTA A PUNTA (dueño, 2026-09-02: «al dm le falta un desactivar esa capa gris para
   * él, para que pueda ver bien»). El botón está probado por su lado y el lienzo por el suyo, pero los dos
   * podrían pasar mientras `SceneTab` se olvidase de conectarlos — que es EXACTAMENTE la clase de fallo que
   * él vio esta noche con el pincel. Así que se prueba el cable: pulsar el botón y mirar el lienzo.
   */
  it('el director se quita el velo gris y el lienzo se lo quita de verdad, y puede volver a ponérselo', async () => {
    const u = userEvent.setup();
    mount('dm');
    await screen.findByRole('complementary', { name: 'Capas' });
    await waitFor(() => expect(within(canvas()).queryByTestId('mp-fog-veil')).not.toBeNull());
    await u.click(screen.getByRole('button', { name: 'Velo del director: puesto' }));
    await waitFor(() => expect(within(canvas()).queryByTestId('mp-fog-veil')).toBeNull());
    // Y vuelve: es un «déjame mirar un momento», no un interruptor de ida.
    await u.click(screen.getByRole('button', { name: 'Velo del director: quitado' }));
    await waitFor(() => expect(within(canvas()).queryByTestId('mp-fog-veil')).not.toBeNull());
  });

  /**
   * 🔒 Y no toca la escena: es una preferencia de SU pantalla. Si esto acabara escribiéndose, viajaría a los
   * jugadores por `postgres_changes` y les cambiaría la niebla a todos sin que nadie lo hubiera pedido.
   */
  it('quitarse el velo no escribe nada en la escena ni avisa a nadie', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await screen.findByRole('complementary', { name: 'Capas' });
    const antes = repo.sceneUpdates.length, avisos = repo.broadcasts.length;
    await u.click(screen.getByRole('button', { name: 'Velo del director: puesto' }));
    await waitFor(() => expect(within(canvas()).queryByTestId('mp-fog-veil')).toBeNull());
    expect(repo.sceneUpdates).toHaveLength(antes);
    expect(repo.broadcasts).toHaveLength(avisos);
  });

  /** A un jugador no se le ofrece, y su niebla negra sigue donde estaba: el velo gris nunca fue suyo. */
  it('un jugador no tiene ese botón', async () => {
    mount('player');
    await screen.findByText(/Almacén de Queens/);
    expect(screen.queryByRole('button', { name: /Velo del director/ })).toBeNull();
  });

  /**
   * 🔒 Suprimir no puede confundirse de víctima: elegir un muro SUELTA la luz. Si no, la luz se quedaba
   * elegida sin que nada lo dijera y Suprimir borraba la luz en vez del segmento que acababas de pinchar.
   */
  it('elegir un muro suelta la luz, y entonces Suprimir borra el muro', async () => {
    const repo = withLayers();
    const luces = repo.lights.length;
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await screen.findByRole('group', { name: 'Luz: Antorcha' });
    fireEvent.pointerDown(canvas(), { clientX: 272, clientY: 380, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(repo.lights).toHaveLength(luces));
  });
});

/**
 * «Botón derecho sobre cualquier cosa → mándala a otra capa», petición literal del dueño. Se prueba en la
 * escena de verdad porque lo que importa es la CONEXIÓN: que el clic derecho encuentre lo que hay debajo y
 * que el cambio llegue a la tabla que toca según de qué sea.
 */
describe('<SceneTab> mandar a otra capa (rebanada 7)', () => {
  const withStuff = () => fakeMapsRepo({
    scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN], walls: [], drawings: [DRAWING_MINE], images: [IMAGE_CHAPEL],
    layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES, LAYER_FLOOR, LAYER_MOSS], lights: [LIGHT_TORCH],
  });
  /** TOKEN_KAREN vive en la casilla (10, 11) y mide 1: su centro cae en el medio de esa casilla. */
  const KAREN_AT = { x: 10.5 * G, y: 11.5 * G };

  it('el menú sale sobre la ficha, con su nombre y la capa donde está marcada', async () => {
    mount('dm', withStuff());
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.contextMenu(canvas(), { clientX: KAREN_AT.x, clientY: KAREN_AT.y });
    const menu = await screen.findByRole('menu', { name: 'Mandar a la capa' });
    expect(within(menu).getByText('Karen «K»')).toBeInTheDocument();
    // Nunca se movió, así que la marcada es su capa natural: Criaturas y personajes.
    expect(within(menu).getByRole('menuitem', { name: /Criaturas y personajes/ })).toHaveClass('on');
  });

  it('mandar la ficha a las notas del director la guarda ahí', async () => {
    const u = userEvent.setup();
    const repo = withStuff();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.contextMenu(canvas(), { clientX: KAREN_AT.x, clientY: KAREN_AT.y });
    await screen.findByRole('menu', { name: 'Mandar a la capa' });
    await u.click(screen.getByRole('menuitem', { name: /Notas del director/ }));
    await waitFor(() => expect(repo.tokenUpdates.at(-1)).toEqual({ id: 'tk-karen', patch: { layerId: 'ly-dm' } }));
    expect(screen.queryByRole('menu', { name: 'Mandar a la capa' })).not.toBeInTheDocument();
  });

  it('un trazo se manda por su propio camino, no por el de las fichas', async () => {
    const u = userEvent.setup();
    const repo = withStuff();
    mount('dm', repo);
    await screen.findByRole('complementary', { name: 'Capas' });
    // DRAWING_MINE es un trazo que pasa por (300, 300).
    fireEvent.contextMenu(canvas(), { clientX: 300, clientY: 300 });
    await screen.findByRole('menu', { name: 'Mandar a la capa' });
    await u.click(screen.getByRole('menuitem', { name: /Musgo/ }));
    await waitFor(() => expect(repo.drawings.find(d => d.id === DRAWING_MINE.id)!.layerId).toBe('ly-moss'));
    expect(repo.tokenUpdates).toEqual([]);
  });

  /** En el suelo vacío el botón derecho sigue siendo el menú de la VISTA, como antes de esta rebanada. */
  it('en el suelo vacío sigue saliendo el menú de siempre', async () => {
    mount('dm', withStuff());
    await screen.findByRole('complementary', { name: 'Capas' });
    fireEvent.contextMenu(canvas(), { clientX: 30 * G, clientY: 20 * G });
    expect(await screen.findByRole('menu', { name: 'Acciones rápidas' })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Mandar a la capa' })).not.toBeInTheDocument();
  });

  it('un jugador no manda nada a ninguna capa', async () => {
    mount('player', withStuff());
    await waitFor(() => expect(screen.getByText(/Almacén de Queens · tu visión/)).toBeInTheDocument());
    fireEvent.contextMenu(canvas(), { clientX: KAREN_AT.x, clientY: KAREN_AT.y });
    expect(screen.queryByRole('menu', { name: 'Mandar a la capa' })).not.toBeInTheDocument();
  });
});

/**
 * LA SONDA DE PRUEBA (§ 7.3), de punta a punta. Va atada a «ver como jugador» por petición literal del dueño
 * (2026-09-01): «el botón de ver como jugador… me debería dejar poner un token donde quiera para probar».
 *
 * Sustituye a la lente por personaje que llegó a producción y dejaba el mapa en negro. **La diferencia que no
 * se puede perder**: aquella pedía la memoria del DUEÑO de una ficha y un director no acumula memoria nunca,
 * así que llegaba vacía. Una sonda no tiene dueño: se pide la visión DESDE UN PUNTO.
 */
describe('<SceneTab> la sonda de prueba (rebanada 7 · § 7.3)', () => {
  const probeOf = (vision: ReturnType<typeof fakeVisionPort>) => vision.calls.filter(c => c.op === 'refresh' && c.probe);
  /**
   * Encender el modo YA NO la coloca: la pone él con un clic (dueño, 2026-09-02, «déjame poner el token donde
   * quiera, no lo pongas automáticamente en el centro, si no la prueba es una mierda»). Este ayudante hace
   * las dos cosas —encender y pinchar— porque casi todos los tests de aquí abajo la quieren ya puesta.
   */
  const ponerSonda = async (u: ReturnType<typeof userEvent.setup>, at = { x: 300, y: 400 }) => {
    await u.click(screen.getByRole('button', { name: 'Ver como jugador' }));
    fireEvent.pointerDown(canvas(), { clientX: at.x, clientY: at.y, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    return at;
  };

  it('un jugador no la tiene: el botón entero es del director', async () => {
    mount('player');
    await screen.findByText(/Almacén de Queens · tu visión/);
    expect(screen.queryByRole('button', { name: 'Ver como jugador' })).not.toBeInTheDocument();
  });

  /**
   * 🎭 ENCENDER EL MODO NO LA COLOCA — la pone él donde pincha. Antes caía en mitad de lo que se estuviera
   * mirando y había que arrastrarla hasta el sitio que de verdad importa, que con el mapa alejado es un viaje.
   */
  it('encenderla NO la suelta sola: pide que pinches, y se pone donde pinches', async () => {
    const u = userEvent.setup();
    const vision = fakeVisionPort();
    mount('dm', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Vista de director/);
    expect(within(canvas()).queryByRole('img', { name: 'Sonda de prueba' })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Ver como jugador' }));
    // Encendido pero sin sonda: no hay ficha en el mapa y la pantalla dice qué hacer.
    expect(within(canvas()).queryByRole('img', { name: 'Sonda de prueba' })).not.toBeInTheDocument();
    expect(screen.getByText(/Pincha en el mapa donde quieras probar/)).toBeInTheDocument();
    expect(probeOf(vision)).toHaveLength(0);

    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    expect(await within(canvas()).findByRole('img', { name: 'Sonda de prueba' })).toBeInTheDocument();
    await waitFor(() => expect(probeOf(vision).length).toBeGreaterThan(0));
    // Y le pide al SERVIDOR la visión de ESE punto, el que él eligió — no de uno inventado.
    expect(probeOf(vision).at(-1)!.probe).toEqual({ x: 300, y: 400 });
  });

  it('ya puesta, otro clic la muda de sitio sin tener que arrastrarla', async () => {
    const u = userEvent.setup();
    const vision = fakeVisionPort();
    mount('dm', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Vista de director/);
    await ponerSonda(u);
    await waitFor(() => expect(probeOf(vision).length).toBeGreaterThan(0));
    fireEvent.pointerDown(canvas(), { clientX: 800, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(probeOf(vision).some(c => c.probe!.x === 800 && c.probe!.y === 200)).toBe(true));
  });

  it('lo dice en pantalla, y deja de enseñarle lo que un jugador no vería', async () => {
    const u = userEvent.setup();
    mount('dm');
    await screen.findByText(/Vista de director/);
    await waitFor(() => expect(within(canvas()).queryByRole('img', { name: /Mutante/ })).toBeInTheDocument());

    await ponerSonda(u);
    expect(screen.getByText(/SONDA DE PRUEBA · lo que vería un jugador desde aquí/)).toBeInTheDocument();
    expect(screen.getByText(/nada se guarda/)).toBeInTheDocument();
    await waitFor(() => expect(within(canvas()).queryByRole('img', { name: /Mutante/ })).not.toBeInTheDocument());
  });

  it('arrastrarla vuelve a preguntar por el punto NUEVO', async () => {
    const u = userEvent.setup();
    const vision = fakeVisionPort();
    mount('dm', seed(), 'sc-1', fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]), vision);
    await screen.findByText(/Vista de director/);
    await ponerSonda(u);
    await within(canvas()).findByRole('img', { name: 'Sonda de prueba' });
    await waitFor(() => expect(probeOf(vision).length).toBeGreaterThan(0));
    const first = probeOf(vision).at(-1)!.probe!;

    fireEvent.pointerDown(canvas(), { clientX: first.x, clientY: first.y, pointerId: 1, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: first.x + 7 * G, clientY: first.y + 3 * G, pointerId: 1 });
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    await waitFor(() => expect(probeOf(vision).some(c => c.probe!.x === first.x + 7 * G)).toBe(true));
  });

  it('cambiar de escena se la lleva: sus coordenadas no significan nada en la escena nueva', async () => {
    const u = userEvent.setup();
    mount('dm');
    await screen.findByText(/Vista de director/);
    await ponerSonda(u);
    await within(canvas()).findByRole('img', { name: 'Sonda de prueba' });
    await u.click(screen.getByRole('button', { name: 'Ver escena Capilla sin techo' }));
    await waitFor(() => expect(within(canvas()).queryByRole('img', { name: 'Sonda de prueba' })).not.toBeInTheDocument());
    expect(screen.getByText(/Vista de director/)).toBeInTheDocument();
  });

  it('apagarla se la lleva y devuelve la vista de director', async () => {
    const u = userEvent.setup();
    mount('dm');
    await screen.findByText(/Vista de director/);
    await ponerSonda(u);
    await within(canvas()).findByRole('img', { name: 'Sonda de prueba' });
    await u.click(screen.getByRole('button', { name: 'Ver como jugador' }));
    await waitFor(() => expect(within(canvas()).queryByRole('img', { name: 'Sonda de prueba' })).not.toBeInTheDocument());
    expect(screen.getByText(/Vista de director/)).toBeInTheDocument();
  });
});

/**
 * 🏗 BUILDER, DE PUNTA A PUNTA (§ «Rebanada 8»): elegir la forma en la barra, arrastrar sobre el lienzo y que
 * la sala acabe en la base como muros de los de siempre. Los tests de más abajo prueban cada pieza por
 * separado; éste prueba que están enchufadas entre sí, que es donde se cae todo.
 */
describe('<SceneTab> Builder levanta una sala', () => {
  const openBuilder = async (u: ReturnType<typeof userEvent.setup>) => {
    await u.click(screen.getByRole('button', { name: 'Builder' }));
    return screen.getByRole('radiogroup', { name: 'Con qué forma' });
  };

  it('rectángulo: se arrastra sobre el mapa y sus cuatro lados quedan guardados, opacos', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await waitFor(() => expect(repo.walls).toHaveLength(1));
    await u.click(within(await openBuilder(u)).getByRole('radio', { name: 'Rectángulo' }));

    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: G * 8, clientY: G * 6, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });

    await waitFor(() => expect(repo.walls).toHaveLength(5));       // el que ya había + los cuatro lados
    const nuevos = repo.walls.filter(w => w.id !== WALL_1.id);
    expect(nuevos).toHaveLength(4);
    for (const w of nuevos) {
      expect(w.kind).toBe('wall');
      expect(w.blocksSight).toBe(true);
      expect(w.visiblePlayers).toBe(false);                        // como cualquier muro nuevo
    }
  });

  /** 🔒 Lo que él pidió que NO se tocara: con la forma de siempre, Builder sigue poniendo muros clic a clic. */
  it('sin tocar la forma, Builder sigue siendo el de siempre: clic a clic', async () => {
    const u = userEvent.setup();
    const repo = mount('dm');
    await waitFor(() => expect(repo.walls).toHaveLength(1));
    await openBuilder(u);

    const svg = canvas();
    fireEvent.pointerDown(svg, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerDown(svg, { clientX: G * 4, clientY: 0, pointerId: 1, button: 0 });
    await waitFor(() => expect(repo.walls).toHaveLength(2));
  });
});
