import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../../../../tests/helpers/render';
import { DRAWING_MINE, DRAWING_OTHER, LAYERS_ALL, LAYER_FLOOR, LAYER_MOSS, LAYER_NOTES, LAYER_OBJECTS, LAYER_PUDDLES, LIGHT_BULB, LIGHT_SECRET, LIGHT_TORCH, PLAYER_USER, SCENE_CHAPEL, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1, WALL_DOOR, WALL_VISIBLE, WALL_WINDOW } from '../../../../tests/helpers/fakes';
import type { Tool } from '../domain/useCases/mapRules';
import { MapCanvas } from './MapCanvas';
import { FOG_FEATHER } from './canvasLayers';

// jsdom has no PointerEvent: a MouseEvent with pointerId is enough for the canvas handlers.
class FakePointerEvent extends MouseEvent { pointerId: number; constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

const G = SCENE_WAREHOUSE.grid.size; // 27
const VIEW = { zoom: 1, panX: 0, panY: 0 };

function mount(over: Partial<React.ComponentProps<typeof MapCanvas>> = {}) {
  const cb = { onViewChange: vi.fn(), onDragToken: vi.fn(), onMoveToken: vi.fn(), onAddDrawing: vi.fn(), onErase: vi.fn(), onAddWall: vi.fn(), onToggleWall: vi.fn(), onPaintFog: vi.fn(), onPin: vi.fn(), onPlace: vi.fn(), onSelectToken: vi.fn(), onMarquee: vi.fn(), onSelectWall: vi.fn(), onMoveWall: vi.fn(), onDeleteSelection: vi.fn(), onContextMenu: vi.fn(), onCloseMenus: vi.fn(), onAddText: vi.fn() };
  const props: React.ComponentProps<typeof MapCanvas> = {
    scene: SCENE_WAREHOUSE, tokens: [TOKEN_KAREN, TOKEN_ELIAS, TOKEN_MUTANT], walls: [WALL_1, WALL_VISIBLE], drawings: [DRAWING_MINE, DRAWING_OTHER], drags: {}, pin: null,
    tool: 'select', stroke: { color: '#c9a84c', width: 2 }, me: PLAYER_USER.id, isDm: false, playerView: false, showWalls: true,
    fog: null, brush: 3, view: VIEW, nameOf: id => id, selectedTokenIds: [], ...cb, ...over,
  };
  const r = renderWithProviders(<MapCanvas {...props} />);
  const svg = screen.getByRole('application', { name: 'Lienzo de la escena' });
  const token = (name: string) => within(svg).getByRole('img', { name: new RegExp(name) });
  return { ...r, svg, token, cb, rerender: (o: Partial<React.ComponentProps<typeof MapCanvas>>) => r.rerender(<MapCanvas {...props} {...o} />) };
}
const down = (el: Element, x: number, y: number, button = 0) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button });
const move = (el: Element, x: number, y: number) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 });
const up = (el: Element) => fireEvent.pointerUp(el, { pointerId: 1 });

describe('<MapCanvas> capas de terreno y luces (rebanada 7)', () => {
  /**
   * Regla de convivencia: si la escena tiene capas de terreno, MANDA LA CAPA y `bgImageUrl` se ignora. La
   * migración subió la foto de fondo a una capa pero dejó la columna en su sitio, así que sin esta regla se
   * pintaría la misma foto dos veces.
   */
  it('con capas de terreno se pinta la capa y NO la foto de fondo de siempre', () => {
    const { svg } = mount({ scene: SCENE_CHAPEL, isDm: true, me: 'u-gm', layers: LAYERS_ALL });
    expect(within(svg).queryByTestId('mp-bg-image')).not.toBeInTheDocument();
    // El color de base se pinta siempre: es lo que se ve donde no llega ninguna foto.
    expect(within(svg).getByTestId('mp-bg')).toBeInTheDocument();
    const painted = within(svg).getAllByTestId('mp-terrain-layer');
    // «Charcos» está apagada: no se pinta ni para el director. El ojo es el de Photoshop.
    expect(painted.map(g => g.getAttribute('data-layer-id'))).toEqual([LAYER_FLOOR.id, LAYER_MOSS.id]);
  });

  it('sin capas de terreno todo sigue como antes', () => {
    const { svg } = mount({ scene: SCENE_CHAPEL, isDm: true, me: 'u-gm', layers: [LAYER_OBJECTS, LAYER_NOTES] });
    expect(within(svg).getByTestId('mp-bg-image')).toBeInTheDocument();
    expect(within(svg).queryByTestId('mp-terrain-layer')).not.toBeInTheDocument();
  });

  /**
   * La máscara del pincel va sobre un rectángulo BLANCO dentro del `<mask>`: en SVG el valor es luminancia ×
   * alfa, así que sin él un PNG casi transparente escondería la capa entera en vez de dejarla verse.
   */
  it('la capa con máscara la aplica, con la versión pegada para no servir la vieja', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', layers: LAYERS_ALL });
    const moss = within(svg).getAllByTestId('mp-terrain-layer').find(g => g.dataset.layerId === LAYER_MOSS.id)!;
    const mask = moss.querySelector('mask')!;
    expect(mask.querySelector('rect')).toHaveAttribute('fill', '#ffffff');
    expect(within(moss).getByTestId('mp-terrain-mask')).toHaveAttribute('href', 'https://x/backgrounds/c1/masks/ly-moss.png?v=3');
    expect(moss.querySelectorAll('image')[1]).toHaveAttribute('mask', `url(#mp-mask-${LAYER_MOSS.id})`);
    // El suelo no lleva máscara: se pinta entero, sin `mask`.
    const floor = within(svg).getAllByTestId('mp-terrain-layer').find(g => g.dataset.layerId === LAYER_FLOOR.id)!;
    expect(floor.querySelector('mask')).toBeNull();
    expect(floor.querySelector('image')).not.toHaveAttribute('mask');
  });

  it('las luces se pintan por forma y con su alcance en metros', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', layers: LAYERS_ALL, lights: [LIGHT_TORCH, LIGHT_BULB] });
    const lights = within(svg).getAllByTestId('mp-light');
    expect(lights).toHaveLength(2);
    expect(lights[0]!.tagName.toLowerCase()).toBe('circle');
    expect(lights[1]!.tagName.toLowerCase()).toBe('rect');
    expect(lights[0]).toHaveAttribute('fill', `url(#mp-light-${LIGHT_TORCH.id})`);
    // Más metros, más radio.
    expect(Number(lights[0]!.getAttribute('r'))).toBeGreaterThan(Number(lights[1]!.getAttribute('width')) / 2);
  });

  /**
   * Petición del dueño al aprobar el diseño: que parpadeen. Animar es PINTAR, que es lo único que las luces
   * hacen hoy — no revelan niebla ni entran en el cálculo de visión. El ritmo lo pone el TIPO.
   */
  it('la antorcha parpadea con el ritmo de su tipo; la bombilla apagada se queda quieta', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', lights: [LIGHT_TORCH, LIGHT_BULB] });
    const [torch, bulb] = within(svg).getAllByTestId('mp-light');
    expect(torch).toHaveClass('flicker-soft');
    expect(torch).toHaveStyle({ animationDuration: '220ms' });
    expect(bulb!.getAttribute('class')).not.toMatch(/flicker/);
    expect(bulb).not.toHaveStyle({ animationDuration: '2600ms' });
  });

  it('una bombilla estropeada da golpes secos, no una respiración', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', lights: [{ ...LIGHT_BULB, flicker: true }] });
    expect(within(svg).getByTestId('mp-light')).toHaveClass('flicker-sharp');
  });

  /** Lo de la capa de notas del director NO viaja: ni la luz ni el trazo que vivan en ella. */
  it('la luz escondida en las notas del director es sólo del director', () => {
    const lights = [LIGHT_TORCH, LIGHT_SECRET];
    const dm = mount({ isDm: true, me: 'u-gm', layers: LAYERS_ALL, lights });
    expect(within(dm.svg).getAllByTestId('mp-light')).toHaveLength(2);
    dm.unmount();
    const player = mount({ layers: LAYERS_ALL, lights });
    expect(within(player.svg).getAllByTestId('mp-light')).toHaveLength(1);
  });

  it('«ver como jugador» le quita al director lo que un jugador no recibiría', () => {
    const { svg, rerender } = mount({ isDm: true, me: 'u-gm', layers: LAYERS_ALL, lights: [LIGHT_TORCH, LIGHT_SECRET] });
    expect(within(svg).getAllByTestId('mp-light')).toHaveLength(2);
    rerender({ isDm: true, me: 'u-gm', playerView: true, layers: LAYERS_ALL, lights: [LIGHT_TORCH, LIGHT_SECRET] });
    expect(within(svg).getAllByTestId('mp-light')).toHaveLength(1);
  });

  it('un dibujo en una capa apagada no se pinta para nadie', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', layers: LAYERS_ALL, drawings: [{ ...DRAWING_MINE, layerId: LAYER_PUDDLES.id }, DRAWING_OTHER] });
    expect(within(svg).getByTestId('mp-drawings').querySelectorAll('[data-drawing-id]')).toHaveLength(1);
  });
});

describe('<MapCanvas> layers', () => {
  it('player: background colour + grid, only visible walls, visible tokens (hidden absent), every drawing', () => {
    const { svg, token } = mount();
    expect(within(svg).getByTestId('mp-bg')).toHaveAttribute('fill', '#4a4a3e');
    expect(within(svg).getByTestId('mp-grid')).toBeInTheDocument();
    expect(within(svg).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(1);
    // Dos capas de tokens: los PJ van aparte y SIN máscara, para no perderlos de vista nunca (2026-08-22).
    expect(svg.querySelectorAll('[data-token-id]')).toHaveLength(2);
    expect(within(svg).getByTestId('mp-tokens-pc').querySelectorAll('[data-token-id]')).toHaveLength(2);
    expect(token('Karen')).toHaveAttribute('data-token-id', 'tk-karen');
    expect(within(svg).getByTestId('mp-drawings').querySelectorAll('[data-drawing-id]')).toHaveLength(2);
    expect(within(svg).queryByTestId('mp-bg-image')).not.toBeInTheDocument();
  });
  it('DM: all walls + hidden tokens (gold dashed ring, «oculto» label); «ver como jugador» hides them; walls toggle; background image with fit', () => {
    const { svg, rerender } = mount({ isDm: true, me: 'u-gm', scene: SCENE_CHAPEL });
    expect(within(svg).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(2);
    expect(within(svg).getByRole('img', { name: 'Token Mutante (oculto)' }).classList.contains('hidden')).toBe(true);
    expect(within(svg).getByTestId('mp-bg-image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
    rerender({ isDm: true, me: 'u-gm', scene: { ...SCENE_CHAPEL, bgTransform: { mode: 'contain', x: 0, y: 0, scale: 1 } } });
    expect(within(svg).getByTestId('mp-bg-image')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    rerender({ isDm: true, me: 'u-gm', scene: { ...SCENE_CHAPEL, bgTransform: { mode: 'custom', x: 10, y: 20, scale: 2 } } });
    expect(within(svg).getByTestId('mp-bg-image')).toHaveAttribute('x', '10');
    rerender({ isDm: true, me: 'u-gm', scene: SCENE_CHAPEL, showWalls: false });
    expect(within(svg).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(0);
    rerender({ isDm: true, me: 'u-gm', scene: SCENE_CHAPEL, playerView: true });
    expect(within(svg).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(1);
    expect(within(svg).queryByRole('img', { name: /Mutante/ })).not.toBeInTheDocument();
  });
  it('remote drags override token position; the focus pin renders with its author', () => {
    const { svg, token, rerender } = mount({ drags: { 'tk-elias': { tokenId: 'tk-elias', x: 1, y: 1 } } });
    expect(token('Elías')).toHaveAttribute('transform', `translate(${1.5 * G} ${1.5 * G})`);
    rerender({ pin: { x: 100, y: 200, by: 'u-gm', at: Date.now() } });
    expect(within(svg).getByTestId('mp-pin')).toHaveAttribute('aria-label', 'Pin de u-gm');
  });
});

describe('<MapCanvas> tools', () => {
  /**
   * Regresión, prueba del dueño 2026-08-21: «que el movimiento no dependa de la grilla». Arrastrar YA era
   * libre —`onDragToken` mandaba fracciones—, pero al soltar un `Math.round` daba el tirón a la casilla, así
   * que el token siempre acababa cuadrado. Ahora se guarda donde se soltó, redondeado sólo a la centésima de
   * casilla para no mandar 14 decimales por la red. La columna `x`/`y` de la base ya era `real`.
   */
  it('select: al soltar se guarda DONDE SE SOLTÓ, sin pegarse a la casilla; el token de otro sólo se selecciona', () => {
    const { svg, token, cb } = mount();
    down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    expect(cb.onSelectToken).toHaveBeenCalledWith('tk-karen');
    move(svg, (TOKEN_KAREN.x + 0.5) * G + 2 * G + 3, (TOKEN_KAREN.y + 0.5) * G + G);
    expect(cb.onDragToken).toHaveBeenLastCalledWith('tk-karen', expect.closeTo(12.11, 1), 12, { x: expect.closeTo(12.11, 1), y: 12 });
    up(svg);
    // 12,11 y no 12: la fracción sobrevive al soltar, que es justo lo que se pidió.
    expect(cb.onMoveToken).toHaveBeenCalledWith('tk-karen', expect.closeTo(12.11, 2), 12);
    expect(cb.onMoveToken.mock.calls[0]![1]).not.toBe(12);
    down(token('Elías'), 0, 0); move(svg, 50, 50); up(svg);
    expect(cb.onSelectToken).toHaveBeenLastCalledWith('tk-elias');
    expect(cb.onMoveToken).toHaveBeenCalledTimes(1);
  });
  it('select on empty canvas clears the selection and does NOT pan (panning is space/middle); wheel still zooms', () => {
    const { svg, cb } = mount({ selectedTokenIds: ['tk-karen'] });
    down(svg, 10, 10); move(svg, 30, 50); up(svg);
    expect(cb.onSelectToken).toHaveBeenCalledWith(null);
    expect(cb.onViewChange).not.toHaveBeenCalled();
    fireEvent.wheel(svg, { deltaY: -100, clientX: 0, clientY: 0 });
    expect(cb.onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: expect.closeTo(1.1, 5) }));
  });
  it('pencil inserts a stroke with the stroke bar style; line/rect/circle insert their shape; a click without movement inserts nothing', () => {
    const { svg, cb, rerender } = mount({ tool: 'pencil' });
    down(svg, 10, 10); move(svg, 20, 15); move(svg, 30, 20); up(svg);
    expect(cb.onAddDrawing).toHaveBeenCalledWith('stroke', { points: [[10, 10], [20, 15], [30, 20]] });
    for (const [tool, kind, data] of [['rect', 'rect', { x1: 0, y1: 0, x2: 40, y2: 30 }], ['line', 'line', { x1: 0, y1: 0, x2: 40, y2: 30 }], ['circle', 'circle', { cx: 0, cy: 0, r: 50 }]] as const) {
      rerender({ tool: tool as Tool });
      down(svg, 0, 0); move(svg, 40, 30); up(svg);
      expect(cb.onAddDrawing).toHaveBeenLastCalledWith(kind, data);
    }
    cb.onAddDrawing.mockClear();
    down(svg, 5, 5); up(svg);
    expect(cb.onAddDrawing).not.toHaveBeenCalled();
  });
  it('erase: my drawing goes, another author\'s stays for a player, anything goes for the DM', () => {
    const { svg, cb, rerender } = mount({ tool: 'erase' });
    down(svg, 320, 290);
    expect(cb.onErase).toHaveBeenCalledWith('d-1');
    down(svg, 450, 520);
    expect(cb.onErase).toHaveBeenCalledTimes(1);
    rerender({ tool: 'erase', isDm: true, me: 'u-gm' });
    down(svg, 450, 520);
    expect(cb.onErase).toHaveBeenLastCalledWith('d-2');
  });
  it('measure shows the distance in cells and metres; pin broadcasts the point', () => {
    const { svg, cb, rerender } = mount({ tool: 'measure' });
    down(svg, 0, 0); move(svg, 3 * G, 4 * G);
    expect(within(svg).getByTestId('mp-measure')).toHaveTextContent('5 casillas · 7.5 m');
    up(svg);
    expect(within(svg).getByTestId('mp-measure')).toBeInTheDocument();
    rerender({ tool: 'pin' });
    down(svg, 12, 34);
    expect(cb.onPin).toHaveBeenCalledWith({ x: 12, y: 34 });
  });
  it('wall (DM): click-click chains grid-snapped segments, Escape ends; players get nothing; el encuentro cae CENTRADO donde se pulsa', () => {
    const { svg, cb, rerender } = mount({ tool: 'wall', isDm: true, me: 'u-gm' });
    down(svg, 28, 26); down(svg, 80, 26); down(svg, 80, 110);
    expect(cb.onAddWall).toHaveBeenNthCalledWith(1, { x: G, y: G }, { x: 3 * G, y: G });
    expect(cb.onAddWall).toHaveBeenNthCalledWith(2, { x: 3 * G, y: G }, { x: 3 * G, y: 4 * G });
    fireEvent.keyDown(window, { key: 'Escape' });
    down(svg, 200, 200);
    expect(cb.onAddWall).toHaveBeenCalledTimes(2);
    rerender({ tool: 'wall', isDm: false });
    down(svg, 0, 0); down(svg, 50, 0);
    expect(cb.onAddWall).toHaveBeenCalledTimes(2);
    /**
     * Colocar es un estado, no una herramienta: con algo pendiente el clic manda, venga de donde venga.
     * Y desde 2026-08-22 el token cae CENTRADO en el punto pulsado y sin pegarse a la rejilla — con la huella
     * en fracciones (`DEFAULT_TOKEN_CELLS` = 1,5) caer en el vértice de una casilla lo dejaba medio fuera.
     * La esquina que se guarda es el centro menos media huella: 59/27 − 0,75 = 1,435.
     */
    rerender({ tool: 'encounter', isDm: true, me: 'u-gm', placing: true });
    down(svg, 2 * G + 5, 3 * G + 5);
    expect(cb.onPlace).toHaveBeenCalledWith({ x: expect.closeTo(1.435, 2), y: expect.closeTo(2.435, 2) });
    rerender({ tool: 'select', isDm: true, me: 'u-gm', placing: true });
    down(svg, 5 * G + 5, G + 5);
    expect(cb.onPlace).toHaveBeenLastCalledWith({ x: expect.closeTo(4.435, 2), y: expect.closeTo(0.435, 2) });
    // Y un token grande se centra igual: la huella entra por `placingSize`.
    rerender({ tool: 'select', isDm: true, me: 'u-gm', placing: true, placingSize: 3.5 });
    down(svg, 5 * G + 5, G + 5);
    expect(cb.onPlace).toHaveBeenLastCalledWith({ x: expect.closeTo(3.435, 2), y: expect.closeTo(-0.565, 2) });
  });
});

describe('<MapCanvas> wheel', () => {
  it('registers the zoom listener natively with passive:false (React would make it passive)', () => {
    const add = vi.spyOn(SVGElement.prototype, 'addEventListener');
    mount();
    const wheel = add.mock.calls.find(c => c[0] === 'wheel');
    expect(wheel).toBeDefined();
    expect(wheel![2]).toMatchObject({ passive: false });
    add.mockRestore();
  });
});

// ── slice 2: fog, light and openings ─────────────────────────────────────────
const FOG = { vision: [[[0, 0], [540, 0], [540, 675], [0, 675]]] as [number, number][][], explored: [[0, 0], [1, 0]] as [number, number][], radiusPx: null };

/** Un charco cuadrado alrededor de la antorcha, como el que contesta el servidor ya recortado. */
const LIT_TORCH = { id: LIGHT_TORCH.id, parts: [[[260, 160], [340, 160], [340, 240], [260, 240]]] as [number, number][][] };

describe('<MapCanvas> luces recortadas (§ 7.2)', () => {
  it('el resplandor se recorta a lo que la luz alumbra de verdad', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', lights: [LIGHT_TORCH], fog: { ...FOG, lit: [LIT_TORCH] } });
    expect(within(svg).getByTestId('mp-light')).toHaveAttribute('clip-path', `url(#mp-lit-${LIGHT_TORCH.id})`);
    expect(svg.querySelector(`clipPath#mp-lit-${LIGHT_TORCH.id} path`)).toBeInTheDocument();
  });

  it('una luz que no alumbra nada que este espectador vea no se pinta: el resplandor la delataría', () => {
    const { svg } = mount({ isDm: false, lights: [LIGHT_TORCH, LIGHT_BULB], fog: { ...FOG, lit: [LIT_TORCH] } });
    const shown = within(svg).getAllByTestId('mp-light');
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveAttribute('data-light-id', LIGHT_TORCH.id);
  });

  /**
   * El caso que se escapaba: el servidor manda la lista VACÍA («se calculó, y no te alcanza ninguna») y hay
   * que apagarlas todas. Si se confundiera con «todavía no hay respuesta», el resplandor de una antorcha que
   * este jugador no ve quedaría flotando sobre su niebla y delataría dónde está.
   */
  it('con la lista vacía no se pinta ningún resplandor: no es lo mismo que «aún no hay respuesta»', () => {
    const { svg } = mount({ isDm: false, lights: [LIGHT_TORCH, LIGHT_BULB], fog: { ...FOG, lit: [] } });
    expect(within(svg).queryAllByTestId('mp-light')).toHaveLength(0);
  });

  it('mientras el servidor no ha contestado la luz se pinta entera, sin recorte — igual que la niebla', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', lights: [LIGHT_TORCH], fog: null });
    expect(within(svg).getByTestId('mp-light')).not.toHaveAttribute('clip-path');
  });

  it('lo alumbrado cuenta como visto en niebla «visión»', () => {
    const { svg } = mount({ fog: { ...FOG, lit: [LIT_TORCH] } });
    expect(within(svg).getByTestId('mp-fog-lit')).toBeInTheDocument();
  });

  it('en niebla «manual» la luz llega, pero no revela nada: ahí manda el pincel del director', () => {
    const { svg } = mount({ scene: { ...SCENE_WAREHOUSE, fogMode: 'manual' }, fog: { ...FOG, vision: [], lit: [LIT_TORCH] } });
    expect(within(svg).queryByTestId('mp-fog-lit')).not.toBeInTheDocument();
  });
});

describe('<MapCanvas> fog', () => {
  it('without an answer from the API yet the scene draws unfogged — no black flash', () => {
    const { svg } = mount({ fog: null });
    expect(within(svg).getByTestId('mp-map')).not.toHaveAttribute('mask');
    expect(within(svg).queryByTestId('mp-fog-dim')).not.toBeInTheDocument();
    expect(svg.querySelector('mask')).toBeNull();
  });

  it('player: the map is masked to explored ∪ vision, what is only remembered is dimmed, and tokens live only inside the current sight', () => {
    const { svg } = mount({ fog: FOG });
    expect(within(svg).getByTestId('mp-map')).toHaveAttribute('mask', `url(#mp-seen-${SCENE_WAREHOUSE.id})`);
    expect(within(svg).getByTestId('mp-fog-dim')).toHaveAttribute('mask', `url(#mp-dim-${SCENE_WAREHOUSE.id})`);
    expect(within(svg).getByTestId('mp-tokens')).toHaveAttribute('mask', `url(#mp-lit-${SCENE_WAREHOUSE.id})`);
    /**
     * Los PJ NO llevan máscara: se pintan siempre, encima de la niebla, como en el prototipo. Antes se
     * ocultaban con todo lo demás y el jugador se quedaba solo en un mapa negro (dueño, 2026-08-22).
     * Lo que sí tapa la niebla es lo que no es un PJ: criaturas y PNJ.
     */
    expect(within(svg).getByTestId('mp-tokens-pc')).not.toHaveAttribute('mask');
    expect(within(svg).getByTestId('mp-tokens-pc').querySelectorAll('[data-token-id]').length).toBeGreaterThan(0);
    expect(within(svg).queryByTestId('mp-fog-veil')).not.toBeInTheDocument();
    // the seen mask carries both the remembered cells and the polygon
    const seen = svg.querySelector(`#mp-seen-${SCENE_WAREHOUSE.id}`)!;
    expect(seen.querySelector('path')).toHaveAttribute('d', 'M0 0h27v27h-27zM27 0h27v27h-27z');
    expect(seen.querySelector('polygon')).toHaveAttribute('points', '0,0 540,0 540,675 0,675');
  });

  /**
   * «El borde de la niebla, a cuadros» y «si es de noche que la visión sea más corta pero que no termine de
   * manera abrupta, sino con un fade» (dueño, 2026-08-22). Las dos son el mismo arreglo: se DIFUMINA la
   * máscara. De día basta un pelín, para deshacer la escalera de 27 px de lo explorado, que se guarda por
   * casillas; de noche el corte es el del alcance de la luz y pide un degradado de verdad.
   */
  /**
   * Paredes sólidas (rebanada 4, spec § «Rebanada 4»). El muro va vertical entre Karen y su destino: con el
   * interruptor apagado lo cruza como siempre, y con él encendido se queda a este lado. El DIRECTOR pasa
   * siempre, esté como esté (decisión del dueño), y por eso se prueba con `isDm: false`.
   */
  it('con las paredes sólidas el token NO cruza el muro, y apagadas lo cruza como siempre', () => {
    const MURO = { ...WALL_1, id: 'w-solid', x1: (TOKEN_KAREN.x + 1.5) * G, y1: 0, x2: (TOKEN_KAREN.x + 1.5) * G, y2: 2000, kind: 'wall' as const, blocksSight: true, blocksMove: true, isOpen: false, visiblePlayers: true };
    const arrastrar = (solidWalls: boolean, isDm: boolean) => {
      document.body.innerHTML = '';
      const { svg, token, cb } = mount({ scene: { ...SCENE_WAREHOUSE, solidWalls }, walls: [MURO], isDm, me: isDm ? 'u-gm' : PLAYER_USER.id });
      down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
      move(svg, (TOKEN_KAREN.x + 3.5) * G, (TOKEN_KAREN.y + 0.5) * G);
      up(svg);
      return cb.onMoveToken.mock.calls.at(-1);
    };
    // apagado: pasa de largo, tres casillas a la derecha
    expect(arrastrar(false, false)![1]).toBeCloseTo(TOKEN_KAREN.x + 3, 1);
    // encendido: se queda a ESTE lado del muro
    expect(arrastrar(true, false)![1]).toBeLessThan(TOKEN_KAREN.x + 3);
    // el director nunca choca
    expect(arrastrar(true, true)![1]).toBeCloseTo(TOKEN_KAREN.x + 3, 1);
  });

  /**
   * EL FALLO QUE ME MORDIÓ EN LA APP (2026-08-22). En una escena de verdad NINGÚN muro es visible para el
   * jugador —16 de 16 ocultos, comprobado en la base—, así que su `blockers` está vacío y su freno propio no
   * salta NUNCA. La primera versión aplicaba la corrección del servidor sólo si el navegador ya había frenado
   * por su cuenta: justo al revés. Los tests pasaban —usaban un muro visible— y el token atravesaba las
   * paredes en la app. La corrección del servidor se obedece SIN CONDICIONES.
   */
  it('regresión · sin ver ningún muro, la corrección del servidor sigue frenando al token', () => {
    const onServerCorrection = vi.fn(() => ({ x: 3, y: 4 }));
    const { svg, token, cb } = mount({
      scene: { ...SCENE_WAREHOUSE, solidWalls: true },
      walls: [],                                   // el jugador no recibe NINGÚN muro
      isDm: false, me: PLAYER_USER.id, onServerCorrection,
    });
    down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    move(svg, (TOKEN_KAREN.x + 5.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    up(svg);
    expect(onServerCorrection).toHaveBeenCalledWith('tk-karen');
    expect(cb.onMoveToken).toHaveBeenLastCalledWith('tk-karen', 3, 4);
    // Y aunque PINTE la corrección, al servidor le sigue contando el DESEO del dedo. Preguntarle por la
    // posición corregida era la oscilación: la veía caber, callaba, y el token saltaba al otro lado.
    expect(cb.onDragToken).toHaveBeenLastCalledWith('tk-karen', 3, 4,
      { x: expect.closeTo(TOKEN_KAREN.x + 5, 1), y: expect.closeTo(TOKEN_KAREN.y, 1) });
  });

  /**
   * EL DISCO LIBRE (2026-08-22): a un jugador no le llegan los muros secretos, así que entre respuesta y
   * respuesta del servidor el token seguía al dedo a ciegas — se metía en el muro y al llegar la corrección
   * REBOTABA hacia atrás. `onDragBound` da el último disco confirmado (centro + holgura) y el pintado no
   * sale de él: el token espera en el borde a que el servidor confirme, en vez de cruzar y volver.
   */
  it('regresión · el pintado no sale del disco libre confirmado por el servidor: ni rebote ni cruce a ciegas', () => {
    const onDragBound = vi.fn(() => ({ x: TOKEN_KAREN.x, y: TOKEN_KAREN.y, clearance: 1 }));
    const { svg, token, cb } = mount({
      scene: { ...SCENE_WAREHOUSE, solidWalls: true },
      walls: [], isDm: false, me: PLAYER_USER.id, onDragBound,
    });
    down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    move(svg, (TOKEN_KAREN.x + 5.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    up(svg);
    // el dedo pidió +5 casillas; el disco sólo garantiza 1: se pinta (y se suelta) en el borde del disco
    expect(cb.onDragToken).toHaveBeenLastCalledWith('tk-karen', TOKEN_KAREN.x + 1, TOKEN_KAREN.y,
      { x: expect.closeTo(TOKEN_KAREN.x + 5, 1), y: expect.closeTo(TOKEN_KAREN.y, 1) });
    expect(cb.onMoveToken).toHaveBeenLastCalledWith('tk-karen', TOKEN_KAREN.x + 1, TOKEN_KAREN.y);
  });

  /**
   * EL SALTO DEL BORDE (dueño, 2026-08-22): al rozar el borde de una puerta o ventana el token se engancha
   * un instante mientras el dedo sigue; al liberarse el camino, el hueco se cerraba DE GOLPE — un salto
   * hacia adelante. Ahora el pintado cierra el hueco a razón de lo que se mueve el dedo más
   * `CATCH_UP_CELLS` por evento (deslizamiento), y al soltar se persiste lo LEGAL, no lo suavizado.
   */
  it('regresión · al liberarse de un borde, el token se DESLIZA hasta el cursor en vez de saltar', () => {
    const onServerCorrection = vi.fn()
      .mockReturnValueOnce({ x: TOKEN_KAREN.x, y: TOKEN_KAREN.y })   // enganchado en el borde
      .mockReturnValue(null);                                        // liberado: ya cabe
    const { svg, token, cb } = mount({ scene: { ...SCENE_WAREHOUSE, solidWalls: true }, walls: [], isDm: false, me: PLAYER_USER.id, onServerCorrection });
    down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    // el dedo se va 5 casillas; el token queda clavado donde dijo el servidor
    move(svg, (TOKEN_KAREN.x + 5.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    expect(cb.onDragToken.mock.calls.at(-1)!.slice(0, 3)).toEqual(['tk-karen', TOKEN_KAREN.x, TOKEN_KAREN.y]);
    // liberado, un empujoncito de 0,1 casillas NO teletransporta el hueco de 5: lo cierra 0,1 + 0,35
    move(svg, (TOKEN_KAREN.x + 5.6) * G, (TOKEN_KAREN.y + 0.5) * G);
    expect(cb.onDragToken.mock.calls.at(-1)![1]).toBeCloseTo(TOKEN_KAREN.x + 0.45, 3);
    // y el evento siguiente lo sigue cerrando al ritmo del ratón
    move(svg, (TOKEN_KAREN.x + 5.7) * G, (TOKEN_KAREN.y + 0.5) * G);
    expect(cb.onDragToken.mock.calls.at(-1)![1]).toBeCloseTo(TOKEN_KAREN.x + 0.9, 3);
    // al soltar, el token acaba en lo LEGAL (el dedo, que ya cabía), no a medio deslizamiento
    up(svg);
    expect(cb.onMoveToken).toHaveBeenLastCalledWith('tk-karen', expect.closeTo(TOKEN_KAREN.x + 5.2, 2), TOKEN_KAREN.y);
  });

  it('el borde de la niebla va difuminado, y de noche mucho más (el «fade» del alcance)', () => {
    const dia = mount({ fog: FOG });
    const filtroDia = dia.svg.querySelector(`#mp-seen-${SCENE_WAREHOUSE.id}-feather feGaussianBlur`);
    expect(filtroDia).not.toBeNull();
    expect(Number(filtroDia!.getAttribute('stdDeviation'))).toBe(FOG_FEATHER.day);
    // y las máscaras lo USAN: sin esto el filtro estaría declarado y no se aplicaría a nada
    expect(dia.svg.querySelector(`#mp-seen-${SCENE_WAREHOUSE.id} g[filter]`)).not.toBeNull();
    document.body.innerHTML = '';

    const noche = mount({ scene: { ...SCENE_WAREHOUSE, lighting: 'night' }, fog: FOG });
    const filtroNoche = noche.svg.querySelector(`#mp-seen-${SCENE_WAREHOUSE.id}-feather feGaussianBlur`);
    expect(Number(filtroNoche!.getAttribute('stdDeviation'))).toBe(FOG_FEATHER.night);
    expect(FOG_FEATHER.night).toBeGreaterThan(FOG_FEATHER.day);
  });

  it('with manual fog nothing is dimmed and tokens follow whatever the DM revealed', () => {
    const { svg } = mount({ scene: { ...SCENE_WAREHOUSE, fogMode: 'manual' }, fog: { ...FOG, vision: [] } });
    expect(within(svg).getByTestId('mp-map')).toHaveAttribute('mask', `url(#mp-seen-${SCENE_WAREHOUSE.id})`);
    expect(within(svg).queryByTestId('mp-fog-dim')).not.toBeInTheDocument();
    expect(within(svg).getByTestId('mp-tokens')).toHaveAttribute('mask', `url(#mp-seen-${SCENE_WAREHOUSE.id})`);
  });

  it('a player with no token of their own sees the map they remember but NO tokens on it — memory holds no creatures', () => {
    const { svg } = mount({ fog: { ...FOG, vision: [] } });
    expect(within(svg).getByTestId('mp-map')).toHaveAttribute('mask', `url(#mp-seen-${SCENE_WAREHOUSE.id})`);
    // the `lit` mask is empty, so the token layer resolves to nothing
    expect(within(svg).getByTestId('mp-tokens')).toHaveAttribute('mask', `url(#mp-lit-${SCENE_WAREHOUSE.id})`);
    /**
     * Los PJ NO llevan máscara: se pintan siempre, encima de la niebla, como en el prototipo. Antes se
     * ocultaban con todo lo demás y el jugador se quedaba solo en un mapa negro (dueño, 2026-08-22).
     * Lo que sí tapa la niebla es lo que no es un PJ: criaturas y PNJ.
     */
    expect(within(svg).getByTestId('mp-tokens-pc')).not.toHaveAttribute('mask');
    expect(within(svg).getByTestId('mp-tokens-pc').querySelectorAll('[data-token-id]').length).toBeGreaterThan(0);
    expect(svg.querySelector(`#mp-lit-${SCENE_WAREHOUSE.id}`)!.querySelector('polygon')).toBeNull();
  });

  it('DM: the whole map stays visible under a veil over what nobody explored; «ver como jugador» switches to the player’s fog', () => {
    const { svg, rerender } = mount({ isDm: true, me: 'u-gm', fog: FOG });
    expect(within(svg).getByTestId('mp-map')).not.toHaveAttribute('mask');
    expect(within(svg).getByTestId('mp-fog-veil')).toHaveAttribute('mask', `url(#mp-unex-${SCENE_WAREHOUSE.id})`);
    rerender({ isDm: true, me: 'u-gm', fog: FOG, playerView: true });
    expect(within(svg).queryByTestId('mp-fog-veil')).not.toBeInTheDocument();
    expect(within(svg).getByTestId('mp-map')).toHaveAttribute('mask', `url(#mp-seen-${SCENE_WAREHOUSE.id})`);
  });
});

describe('<MapCanvas> openings', () => {
  it('a door renders its jambs (and a dark core while closed), a window is its own segment, a plain wall stays one line', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', walls: [WALL_1, WALL_DOOR, WALL_WINDOW] });
    const walls = within(svg).getByTestId('mp-walls');
    expect(walls.querySelector('[data-wall-id="w-1"]')!.tagName).toBe('line');
    const door = walls.querySelector('[data-wall-id="w-door"]')!;
    expect(door.getAttribute('data-open')).toBe('false');
    expect(door.querySelectorAll('.mp-wall-core')).toHaveLength(1);
    expect(door.querySelectorAll('.mp-wall-jamb')).toHaveLength(2);
    expect(door.querySelectorAll('.mp-wall-leaf')).toHaveLength(0);
    expect(walls.querySelector('[data-wall-id="w-win"] .mp-wall')!.classList.contains('window')).toBe(true);
  });

  it('an open door drops the core and swings a leaf instead', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', walls: [{ ...WALL_DOOR, isOpen: true }] });
    const door = within(svg).getByTestId('mp-walls').querySelector('[data-wall-id="w-door"]')!;
    expect(door.getAttribute('data-open')).toBe('true');
    expect(door.querySelectorAll('.mp-wall-core')).toHaveLength(0);
    expect(door.querySelectorAll('.mp-wall-leaf')).toHaveLength(1);
  });

  it('Muro sólo construye: empezar un muro sobre una puerta ya no la abre (ése era el choque de la rebanada 2)', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'wall', walls: [WALL_DOOR] });
    // WALL_DOOR is the vertical segment x = 540, y ∈ [216, 324]
    down(svg, 541, 260);
    expect(cb.onToggleWall).not.toHaveBeenCalled();
    down(svg, 541, 360);
    expect(cb.onAddWall).toHaveBeenCalledTimes(1);
  });

  it('el disco de abrir sale al pasar el ratón por una puerta y la abre; sobre un muro no sale, y el jugador no lo tiene', () => {
    const { svg, cb, rerender } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_DOOR, WALL_1] });
    expect(within(svg).queryByTestId('mp-door-toggle')).not.toBeInTheDocument();
    move(svg, 541, 260);
    const disc = within(svg).getByTestId('mp-door-toggle');
    expect(disc).toHaveAttribute('data-wall-id', 'w-door');
    expect(disc).toHaveAttribute('aria-label', 'Abrir');
    // el disco se planta en el centro del vano, no donde esté el ratón
    expect(disc).toHaveAttribute('transform', 'translate(540 270) scale(1)');
    down(disc, 540, 270); up(svg);
    expect(cb.onToggleWall).toHaveBeenCalledWith(WALL_DOOR);

    move(svg, 271, 300);                                   // WALL_1 es un muro liso: no se abre
    expect(within(svg).queryByTestId('mp-door-toggle')).not.toBeInTheDocument();

    rerender({ isDm: true, me: 'u-gm', tool: 'select', walls: [{ ...WALL_DOOR, isOpen: true }] });
    move(svg, 541, 260);
    expect(within(svg).getByTestId('mp-door-toggle')).toHaveAttribute('aria-label', 'Cerrar');

    document.body.innerHTML = '';
    const player = mount({ tool: 'select', walls: [{ ...WALL_DOOR, visiblePlayers: true }] });
    move(player.svg, 541, 260);
    expect(within(player.svg).queryByTestId('mp-door-toggle')).not.toBeInTheDocument();
  });

  it('el disco no roba el arrastre: una puerta de una casilla se sigue pudiendo elegir y mover con Seleccionar', () => {
    // El disco se planta justo encima del cuerpo del segmento; sin esto una puerta corta quedaría inseleccionable
    // (y con ella, sin barra «Segmento»: ni cambiarle el tipo, ni borrarla).
    const short = { ...WALL_DOOR, y2: WALL_DOOR.y1 + G };            // una sola casilla de largo
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [short] });
    move(svg, short.x1 + 1, short.y1 + G / 2);
    const disc = within(svg).getByTestId('mp-door-toggle');
    down(disc, short.x1, short.y1 + G / 2);
    expect(cb.onSelectWall).toHaveBeenCalledWith('w-door');           // el clic llega igual al lienzo: la elige
    move(svg, short.x1, short.y1 + G / 2 + 2 * G);                    // …y arrastrarla la mueve
    up(svg);
    expect(cb.onMoveWall).toHaveBeenCalledTimes(1);
    expect(cb.onToggleWall).not.toHaveBeenCalled();                   // arrastrar NO es abrir
  });

  it('el disco no sale donde tendría que tragarse la pulsación: Muro, Pin, Texto, Borrar, pinceles, ni con algo a medias', () => {
    for (const tool of ['wall', 'pin', 'text', 'erase', 'reveal', 'hide'] as Tool[]) {
      document.body.innerHTML = '';
      const m = mount({ isDm: true, me: 'u-gm', tool, walls: [WALL_DOOR] });
      move(m.svg, 541, 260);
      expect(within(m.svg).queryByTestId('mp-door-toggle')).not.toBeInTheDocument();
    }
    document.body.innerHTML = '';
    const placing = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_DOOR], placing: true });
    move(placing.svg, 541, 260);
    expect(within(placing.svg).queryByTestId('mp-door-toggle')).not.toBeInTheDocument();
  });

  it('el disco mide lo mismo en pantalla a cualquier zoom: es un control, no un dibujo del mapa', () => {
    const { svg } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_DOOR], view: { zoom: 2, panX: 0, panY: 0 } });
    move(svg, 2 * 540 + 2, 2 * 260);
    expect(within(svg).getByTestId('mp-door-toggle')).toHaveAttribute('transform', 'translate(540 270) scale(0.5)');
  });

  it('a player never gets a hidden door: only `visible_players` segments are drawn', () => {
    const { svg } = mount({ walls: [WALL_DOOR, WALL_VISIBLE] });
    const walls = within(svg).getByTestId('mp-walls');
    expect(walls.querySelector('[data-wall-id="w-door"]')).toBeNull();
    expect(walls.querySelector('[data-wall-id="w-2"]')).not.toBeNull();
  });
});

describe('<MapCanvas> reveal/hide brush', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the brush disc under the pointer and paints on press and while dragging', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'reveal', brush: 2 });
    move(svg, 100, 100);
    expect(within(svg).getByTestId('mp-brush')).toHaveAttribute('r', String(2 * G));
    down(svg, 100, 100);
    expect(cb.onPaintFog).toHaveBeenCalledWith({ x: 100, y: 100, radius: 2 * G }, 'reveal');
    // throttled like the token drag: every paint rewrites the fog row of every player and wakes the whole table
    vi.setSystemTime(Date.now() + 100);
    move(svg, 130, 100);
    expect(cb.onPaintFog).toHaveBeenLastCalledWith({ x: 130, y: 100, radius: 2 * G }, 'reveal');
    const painted = cb.onPaintFog.mock.calls.length;
    move(svg, 131, 100);
    move(svg, 132, 100);
    expect(cb.onPaintFog.mock.calls.length).toBe(painted);
    up(svg);
  });

  it('the hide brush sends the other op, and a player never paints', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'hide', brush: 1 });
    down(svg, 50, 50);
    expect(cb.onPaintFog).toHaveBeenCalledWith({ x: 50, y: 50, radius: G }, 'hide');

    document.body.innerHTML = '';
    const player = mount({ tool: 'reveal', brush: 1 });
    down(player.svg, 50, 50);
    expect(player.cb.onPaintFog).not.toHaveBeenCalled();
    expect(within(player.svg).queryByTestId('mp-brush')).not.toBeInTheDocument();
  });
});

describe('<MapCanvas> panning is a modifier, not a tool', () => {
  it('space held pans from a drawing tool and never draws; releasing gives the tool back', () => {
    const { svg, cb } = mount({ tool: 'pencil' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(svg).toHaveStyle({ cursor: 'grab' });
    down(svg, 100, 100);
    move(svg, 140, 130);
    expect(cb.onViewChange).toHaveBeenCalledWith({ zoom: 1, panX: 40, panY: 30 });
    up(svg);
    expect(cb.onAddDrawing).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: ' ' });
    expect(svg).toHaveStyle({ cursor: 'crosshair' });
    down(svg, 200, 200);
    move(svg, 240, 200);
    up(svg);
    expect(cb.onAddDrawing).toHaveBeenCalled();
  });

  it('the middle button pans from any tool too (it already did)', () => {
    const { svg, cb } = mount({ tool: 'wall', isDm: true, me: 'u-gm' });
    down(svg, 100, 100, 1);
    move(svg, 150, 100);
    expect(cb.onViewChange).toHaveBeenCalledWith({ zoom: 1, panX: 50, panY: 0 });
    expect(cb.onAddWall).not.toHaveBeenCalled();
  });

  it('space typed into a field is left alone, and losing the window unsticks the pan', () => {
    const { svg } = mount({ tool: 'pencil' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: ' ' });
    expect(svg).toHaveStyle({ cursor: 'crosshair' });   // still drawing: the field ate the space
    input.remove();

    fireEvent.keyDown(window, { key: ' ' });
    expect(svg).toHaveStyle({ cursor: 'grab' });
    fireEvent.blur(window);                              // alt-tab with space down must not stick
    expect(svg).toHaveStyle({ cursor: 'crosshair' });
  });

  it('space on a focused button is left to the button: it is how a keyboard presses it', () => {
    const { svg } = mount({ tool: 'pencil' });
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    const ev = fireEvent.keyDown(btn, { key: ' ', cancelable: true });
    expect(svg).toHaveStyle({ cursor: 'crosshair' });     // no pan: the toolbar keeps its keyboard
    expect(ev).toBe(true);                                // not preventDefault()ed, so the button still activates
    btn.remove();
  });
});

describe('<MapCanvas> Seleccionar edita muros', () => {
  it('el director elige un segmento, le salen tiradores en los vértices, y arrastrarlo entero lo mueve', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: null });
    // WALL_1 es vertical en x = 270, de y = 216 a 540
    down(svg, 272, 380);
    expect(cb.onSelectWall).toHaveBeenCalledWith('w-1');

    document.body.innerHTML = '';
    const sel = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: 'w-1' });
    expect(within(sel.svg).getByTestId('mp-wall-handles').querySelectorAll('.mp-vertex')).toHaveLength(2);
    down(sel.svg, 272, 380); move(sel.svg, 272 + G, 380); up(sel.svg);
    expect(sel.cb.onMoveWall).toHaveBeenCalledWith('w-1', { x1: 270 + G, y1: 216, x2: 270 + G, y2: 540 });
  });

  it('elegir un token suelta el segmento: una sola selección, o «Segmento» y la barra del token se pisan', () => {
    const { token, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: 'w-1' });
    down(token('Karen'), 300, 300);
    expect(cb.onSelectToken).toHaveBeenCalledWith('tk-karen');
    expect(cb.onSelectWall).toHaveBeenCalledWith(null);
  });

  it('Escape suelta el segmento además del token', () => {
    const { cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: 'w-1' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cb.onSelectToken).toHaveBeenCalledWith(null);
    expect(cb.onSelectWall).toHaveBeenCalledWith(null);
  });

  it('arrastrar un vértice estira sólo ese extremo, ajustado a la rejilla', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: 'w-1' });
    down(svg, 270, 216); move(svg, 270, 216 + G); up(svg);
    expect(cb.onMoveWall).toHaveBeenCalledWith('w-1', { x1: 270, y1: 216 + G, x2: 270, y2: 540 });
  });

  it('pulsar en vacío deselecciona muro y token; un jugador no puede seleccionar muros', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', walls: [WALL_1], selectedWallId: 'w-1' });
    down(svg, 700, 100); up(svg);
    expect(cb.onSelectWall).toHaveBeenCalledWith(null);
    expect(cb.onMoveWall).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    const player = mount({ tool: 'select', walls: [WALL_VISIBLE] });
    down(player.svg, WALL_VISIBLE.x1 + 2, WALL_VISIBLE.y1);
    expect(player.cb.onSelectWall).toHaveBeenCalledWith(null);
  });

  it('una puerta es UN segmento: no encadena el siguiente; un muro liso sí', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'wall', wallKind: 'door' });
    down(svg, 2 * G, 2 * G); down(svg, 6 * G, 2 * G);
    expect(cb.onAddWall).toHaveBeenCalledTimes(1);
    down(svg, 9 * G, 2 * G);              // sin encadenar, este clic sólo abre el siguiente segmento
    expect(cb.onAddWall).toHaveBeenCalledTimes(1);

    document.body.innerHTML = '';
    const chain = mount({ isDm: true, me: 'u-gm', tool: 'wall', wallKind: 'wall' });
    down(chain.svg, 2 * G, 2 * G); down(chain.svg, 6 * G, 2 * G); down(chain.svg, 9 * G, 2 * G);
    expect(chain.cb.onAddWall).toHaveBeenCalledTimes(2);
  });
});

describe('<MapCanvas> teclado y botón derecho', () => {
  it('Suprimir borra lo seleccionado; escribiendo en un campo no borra nada', () => {
    const { cb } = mount({ isDm: true, me: 'u-gm', tool: 'select', selectedWallId: 'w-1', walls: [WALL_1] });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(cb.onDeleteSelection).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(cb.onDeleteSelection).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('el botón derecho termina el muro a medias como Escape, y sólo abre el menú cuando no hay nada pendiente', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'wall' });
    down(svg, 2 * G, 2 * G);                       // muro empezado
    fireEvent.contextMenu(svg, { clientX: 100, clientY: 100 });
    expect(cb.onContextMenu).not.toHaveBeenCalled();   // primero cancela
    down(svg, 6 * G, 2 * G);
    expect(cb.onAddWall).not.toHaveBeenCalled();       // se había cancelado de verdad

    fireEvent.contextMenu(svg, { clientX: 100, clientY: 100 });
    fireEvent.contextMenu(svg, { clientX: 140, clientY: 120 });
    expect(cb.onContextMenu).toHaveBeenCalledWith({ x: 140, y: 120 }, { x: 140, y: 120 });
  });
})

describe('<MapCanvas> selección por área', () => {
  it('mantener pulsado y arrastrar dibuja el marco y devuelve los tokens de dentro', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select' });
    down(svg, 7 * G, 10 * G);
    move(svg, 12 * G, 13 * G);
    expect(within(svg).getByTestId('mp-marquee')).toBeInTheDocument();
    up(svg);
    expect(cb.onMarquee).toHaveBeenCalledWith(['tk-karen', 'tk-elias']);
  });

  it('un clic sin arrastre no es un marco: sólo deselecciona', () => {
    const { svg, cb } = mount({ isDm: true, me: 'u-gm', tool: 'select' });
    down(svg, 7 * G, 10 * G); up(svg);
    expect(cb.onMarquee).not.toHaveBeenCalled();
    expect(cb.onSelectToken).toHaveBeenCalledWith(null);
  });

  it('la herramienta Texto pide el punto y deja que el llamante pregunte el texto', () => {
    const { svg, cb } = mount({ tool: 'text' });
    down(svg, 120, 90);
    expect(cb.onAddText).toHaveBeenCalledWith({ x: 120, y: 90 });
    expect(cb.onAddDrawing).not.toHaveBeenCalled();
  });
});
