import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../../../../tests/helpers/render';
import { DRAWING_MINE, DRAWING_OTHER, PLAYER_USER, SCENE_CHAPEL, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1, WALL_VISIBLE } from '../../../../tests/helpers/fakes';
import type { Tool } from '../domain/useCases/mapRules';
import { MapCanvas } from './MapCanvas';

// jsdom has no PointerEvent: a MouseEvent with pointerId is enough for the canvas handlers.
class FakePointerEvent extends MouseEvent { pointerId: number; constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

const G = SCENE_WAREHOUSE.grid.size; // 27
const VIEW = { zoom: 1, panX: 0, panY: 0 };

function mount(over: Partial<React.ComponentProps<typeof MapCanvas>> = {}) {
  const cb = { onViewChange: vi.fn(), onDragToken: vi.fn(), onMoveToken: vi.fn(), onAddDrawing: vi.fn(), onErase: vi.fn(), onAddWall: vi.fn(), onPin: vi.fn(), onPlace: vi.fn(), onSelectToken: vi.fn() };
  const props: React.ComponentProps<typeof MapCanvas> = {
    scene: SCENE_WAREHOUSE, tokens: [TOKEN_KAREN, TOKEN_ELIAS, TOKEN_MUTANT], walls: [WALL_1, WALL_VISIBLE], drawings: [DRAWING_MINE, DRAWING_OTHER], drags: {}, pin: null,
    tool: 'move', stroke: { color: '#c9a84c', width: 2 }, me: PLAYER_USER.id, isDm: false, playerView: false, showWalls: true, view: VIEW, nameOf: id => id, selectedTokenId: null, ...cb, ...over,
  };
  const r = renderWithProviders(<MapCanvas {...props} />);
  const svg = screen.getByRole('application', { name: 'Lienzo de la escena' });
  const token = (name: string) => within(svg).getByRole('img', { name: new RegExp(name) });
  return { ...r, svg, token, cb, rerender: (o: Partial<React.ComponentProps<typeof MapCanvas>>) => r.rerender(<MapCanvas {...props} {...o} />) };
}
const down = (el: Element, x: number, y: number, button = 0) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button });
const move = (el: Element, x: number, y: number) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 });
const up = (el: Element) => fireEvent.pointerUp(el, { pointerId: 1 });

describe('<MapCanvas> layers', () => {
  it('player: background colour + grid, only visible walls, visible tokens (hidden absent), every drawing', () => {
    const { svg, token } = mount();
    expect(within(svg).getByTestId('mp-bg')).toHaveAttribute('fill', '#4a4a3e');
    expect(within(svg).getByTestId('mp-grid')).toBeInTheDocument();
    expect(within(svg).getByTestId('mp-walls').querySelectorAll('line')).toHaveLength(1);
    expect(within(svg).getByTestId('mp-tokens').querySelectorAll('[data-token-id]')).toHaveLength(2);
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
  it('move: dragging my token broadcasts while moving and persists the snapped cell on release; someone else\'s token only selects', () => {
    const { svg, token, cb } = mount();
    down(token('Karen'), (TOKEN_KAREN.x + 0.5) * G, (TOKEN_KAREN.y + 0.5) * G);
    expect(cb.onSelectToken).toHaveBeenCalledWith('tk-karen');
    move(svg, (TOKEN_KAREN.x + 0.5) * G + 2 * G + 3, (TOKEN_KAREN.y + 0.5) * G + G);
    expect(cb.onDragToken).toHaveBeenLastCalledWith('tk-karen', expect.closeTo(12.11, 1), 12);
    up(svg);
    expect(cb.onMoveToken).toHaveBeenCalledWith('tk-karen', 12, 12);
    down(token('Elías'), 0, 0); move(svg, 50, 50); up(svg);
    expect(cb.onSelectToken).toHaveBeenLastCalledWith('tk-elias');
    expect(cb.onMoveToken).toHaveBeenCalledTimes(1);
  });
  it('move on empty canvas pans; wheel zooms', () => {
    const { svg, cb } = mount();
    down(svg, 10, 10); move(svg, 30, 50); up(svg);
    expect(cb.onViewChange).toHaveBeenLastCalledWith({ zoom: 1, panX: 20, panY: 40 });
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
  it('wall (DM): click-click chains grid-snapped segments, Escape ends; players get nothing; encounter places at the clicked cell', () => {
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
    rerender({ tool: 'encounter', isDm: true, me: 'u-gm' });
    down(svg, 2 * G + 5, 3 * G + 5);
    expect(cb.onPlace).toHaveBeenCalledWith({ x: 2, y: 3 });
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
