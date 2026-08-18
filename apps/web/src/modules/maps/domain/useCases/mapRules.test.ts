import { describe, it, expect } from 'vitest';
import { CHARACTER_KAREN, DRAWING_MINE, DRAWING_OTHER, SCENE_TUNNELS, SCENE_WAREHOUSE, TOKEN_KAREN, TOKEN_MUTANT, WALL_1 } from '../../../../../tests/helpers/fakes';
import {
  canEraseDrawing, canMoveToken, canvasToScene, centerOn, clampZoom, distanceCells, distanceLabel, filterEntries, fitView, hitDrawing, hitTest, initialsOf,
  MAX_ZOOM, MIN_ZOOM, sceneToCanvas, sceneVisibleTo, shapeData, snap, cellOf, tokenCellAt, tokenCenter, tokenFromBestiary, tokenFromCharacter, toolsFor, visibleTokens, zoomAt,
  blocksMoveNow, blocksSightNow, brushRadius, canOpen, cellsPath, hitWall, isBrush, METRES_PER_CELL, newWallOf, nightLabelM, openingGeometry, polygonPoints, sceneRadiusPx, TOOLS_NOT_YET, WALL_FLAGS, WALL_KINDS,
} from './mapRules';

describe('mapRules — view & coordinates', () => {
  it('canvas ↔ scene round-trips through zoom/pan', () => {
    const v = { zoom: 2, panX: 100, panY: -50 };
    const p = canvasToScene({ x: 300, y: 150 }, v);
    expect(p).toEqual({ x: 100, y: 100 });
    expect(sceneToCanvas(p, v)).toEqual({ x: 300, y: 150 });
  });
  it('zoomAt keeps the anchor fixed and clamps', () => {
    const v = { zoom: 1, panX: 0, panY: 0 };
    const at = { x: 200, y: 100 };
    const z = zoomAt(v, 2, at);
    expect(z.zoom).toBe(2);
    expect(sceneToCanvas(canvasToScene(at, v), z)).toEqual(at);
    expect(zoomAt(v, 100, at).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(v, 0.0001, at).zoom).toBe(MIN_ZOOM);
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
  });
  it('fitView centres the whole scene; degenerate viewport → identity; centerOn puts the point mid-viewport', () => {
    const v = fitView({ width: 1000, height: 500 }, { width: 500, height: 500 });
    expect(v.zoom).toBe(0.5);
    expect(v).toEqual({ zoom: 0.5, panX: 0, panY: 125 });
    expect(fitView(SCENE_WAREHOUSE, { width: 0, height: 0 })).toEqual({ zoom: 1, panX: 0, panY: 0 });
    const c = centerOn({ zoom: 2, panX: 0, panY: 0 }, { x: 100, y: 100 }, { width: 400, height: 200 });
    expect(sceneToCanvas({ x: 100, y: 100 }, c)).toEqual({ x: 200, y: 100 });
  });
});

describe('mapRules — grid & measure', () => {
  it('snaps, cells and token centre', () => {
    expect(snap(40, 27)).toBe(27);
    expect(snap(41, 27)).toBe(54);
    expect(cellOf(53, 27)).toBe(1);
    expect(tokenCellAt({ x: 60, y: 30 }, 27)).toEqual({ x: 2, y: 1 });
    expect(tokenCellAt({ x: 60, y: 30 }, 27, 2)).toEqual({ x: 2, y: 1 });
    expect(tokenCellAt({ x: 60, y: 30 }, 27, 3)).toEqual({ x: 1, y: 0 });
    expect(tokenCenter({ x: 2, y: 1, size: 1 }, 10)).toEqual({ x: 25, y: 15 });
  });
  it('distance in cells and metres (1 cell = 1.5 m by default)', () => {
    expect(distanceCells({ x: 0, y: 0 }, { x: 81, y: 0 }, 27)).toBe(3);
    expect(distanceCells({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toBe(5);
    expect(distanceLabel(3)).toEqual({ cells: '3', metres: '4.5' });
    expect(distanceLabel(2.333, 2)).toEqual({ cells: '2.3', metres: '4.7' });
  });
});

describe('mapRules — permissions & visibility', () => {
  it('canMoveToken: DM anything; players only tokens they control', () => {
    expect(canMoveToken(TOKEN_KAREN, 'u-pip', false)).toBe(true);
    expect(canMoveToken(TOKEN_KAREN, 'u-nix', false)).toBe(false);
    expect(canMoveToken(TOKEN_MUTANT, 'u-nix', true)).toBe(true);
    expect(canMoveToken(TOKEN_MUTANT, null, false)).toBe(false);
  });
  it('canEraseDrawing: author or DM', () => {
    expect(canEraseDrawing(DRAWING_MINE, 'u-pip', false)).toBe(true);
    expect(canEraseDrawing(DRAWING_OTHER, 'u-pip', false)).toBe(false);
    expect(canEraseDrawing(DRAWING_OTHER, 'dm', true)).toBe(true);
  });
  it('sceneVisibleTo: DM always; players when flagged or active', () => {
    expect(sceneVisibleTo(SCENE_WAREHOUSE, null, true)).toBe(true);
    expect(sceneVisibleTo(SCENE_WAREHOUSE, null, false)).toBe(false);
    expect(sceneVisibleTo(SCENE_WAREHOUSE, 'sc-1', false)).toBe(true);
    expect(sceneVisibleTo(SCENE_TUNNELS, null, false)).toBe(true);
  });
  it('visibleTokens hides hidden tokens for players and for the DM in player view', () => {
    const all = [TOKEN_KAREN, TOKEN_MUTANT];
    expect(visibleTokens(all, true)).toHaveLength(2);
    expect(visibleTokens(all, false)).toEqual([TOKEN_KAREN]);
    expect(visibleTokens(all, true, true)).toEqual([TOKEN_KAREN]);
  });
  it('toolsFor: DM gets the gold group', () => {
    expect(toolsFor(false)).not.toContain('wall');
    expect(toolsFor(true)).toEqual(expect.arrayContaining(['wall', 'reveal', 'hide', 'encounter']));
  });
});

describe('mapRules — hit tests & shapes', () => {
  it('hits strokes near a segment, misses far away; single-point strokes are dots', () => {
    expect(hitDrawing(DRAWING_MINE, { x: 320, y: 290 })).toBe(true);
    expect(hitDrawing(DRAWING_MINE, { x: 320, y: 340 })).toBe(false);
    const dot = { kind: 'stroke' as const, data: { points: [[10, 10]] as [number, number][] }, width: 4 };
    expect(hitDrawing(dot, { x: 14, y: 12 })).toBe(true);
    expect(hitDrawing(dot, { x: 30, y: 12 })).toBe(false);
  });
  it('rect hits its border only; circle its ring; line its segment; text its box', () => {
    expect(hitDrawing(DRAWING_OTHER, { x: 450, y: 520 })).toBe(true);   // left edge
    expect(hitDrawing(DRAWING_OTHER, { x: 480, y: 520 })).toBe(false);  // inside
    const circle = { kind: 'circle' as const, data: { cx: 0, cy: 0, r: 50 }, width: 2 };
    expect(hitDrawing(circle, { x: 50, y: 0 })).toBe(true);
    expect(hitDrawing(circle, { x: 20, y: 0 })).toBe(false);
    const line = { kind: 'line' as const, data: { x1: 0, y1: 0, x2: 100, y2: 0 }, width: 2 };
    expect(hitDrawing(line, { x: 50, y: 4 })).toBe(true);
    expect(hitDrawing(line, { x: 50, y: 20 })).toBe(false);
    const text = { kind: 'text' as const, data: { x: 10, y: 20, text: 'hola' }, width: 1 };
    expect(hitDrawing(text, { x: 30, y: 12 })).toBe(true);
    expect(hitDrawing(text, { x: 300, y: 12 })).toBe(false);
  });
  it('hitTest returns the topmost (last) hit or null', () => {
    const twin = { ...DRAWING_MINE, id: 'd-top' };
    expect(hitTest([DRAWING_MINE, twin], { x: 320, y: 290 })?.id).toBe('d-top');
    expect(hitTest([DRAWING_MINE], { x: 0, y: 0 })).toBeNull();
  });
  it('shapeData builds line/rect bbox and circle radius', () => {
    expect(shapeData('rect', { x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x1: 1, y1: 2, x2: 3, y2: 4 });
    expect(shapeData('circle', { x: 0, y: 0 }, { x: 3, y: 4 })).toEqual({ cx: 0, cy: 0, r: 5 });
  });
});

describe('mapRules — token factories & search', () => {
  it('tokenFromCharacter: image precedence token → avatar → owner; owner controls it', () => {
    const t = tokenFromCharacter(CHARACTER_KAREN, 'https://x/owner.png', 'sc-1', { x: 3, y: 4 });
    expect(t).toMatchObject({ sceneId: 'sc-1', campaignId: 'c1', characterId: 'ch-karen', name: 'Karen «K»', imageUrl: 'https://x/owner.png', x: 3, y: 4, controlledBy: 'u-pip', visible: true });
    expect(tokenFromCharacter({ ...CHARACTER_KAREN, avatarUrl: 'a', tokenUrl: 'tk' }, 'o', 'sc-1', { x: 0, y: 0 }).imageUrl).toBe('tk');
    expect(tokenFromCharacter({ ...CHARACTER_KAREN, avatarUrl: 'a' }, 'o', 'sc-1', { x: 0, y: 0 }).imageUrl).toBe('a');
    expect(tokenFromCharacter(CHARACTER_KAREN, null, 'sc-1', { x: 0, y: 0 }).imageUrl).toBeNull();
  });
  it('tokenFromBestiary: hidden by default, keeps the catalog id and copies resistance into state', () => {
    const t = tokenFromBestiary({ id: 'mutant', label: 'catalog.bestiary.mutant.name', data: { resistance: 12, protection: 2 } }, 'Mutante', 'c1', 'sc-1', { x: 5, y: 5 });
    expect(t).toMatchObject({ bestiaryRef: 'mutant', name: 'Mutante', visible: false, controlledBy: null, characterId: null, state: { resistance: 12 } });
    expect(tokenFromBestiary({ id: 'x', label: 'x' }, 'X', 'c1', 'sc-1', { x: 0, y: 0 }).state).toEqual({});
  });
  it('initials and diacritics-insensitive search', () => {
    expect(initialsOf('Karen «K»')).toBe('KK');
    expect(initialsOf('Padre Vidal')).toBe('PV');
    expect(initialsOf('')).toBe('?');
    const items = [{ n: 'Mutante' }, { n: 'Ogro' }, { n: 'Padre Vidal' }];
    expect(filterEntries(items, 'mut', i => i.n)).toEqual([{ n: 'Mutante' }]);
    expect(filterEntries(items, 'VIDÁL', i => i.n)).toEqual([{ n: 'Padre Vidal' }]);
    expect(filterEntries(items, '  ', i => i.n)).toHaveLength(3);
  });
});

// ── slice 2: openings, light and fog ─────────────────────────────────────────
describe('openings — walls, doors and windows', () => {
  const wall = { ...WALL_1 };
  const door = { ...WALL_1, kind: 'door' as const };
  const window = { ...WALL_1, kind: 'window' as const, blocksSight: false };

  it('the three types are two flags, not a switch', () => {
    expect(WALL_FLAGS.wall).toEqual({ blocksSight: true, blocksMove: true });
    expect(WALL_FLAGS.door).toEqual({ blocksSight: true, blocksMove: true });
    expect(WALL_FLAGS.window).toEqual({ blocksSight: false, blocksMove: true });
  });
  it('a new segment always takes the flags of its type — the picker can never make an incoherent wall', () => {
    expect(WALL_KINDS).toEqual(['wall', 'door', 'window']);
    expect(newWallOf('wall')).toEqual({ kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false });
    expect(newWallOf('door')).toEqual({ kind: 'door', blocksSight: true, blocksMove: true, isOpen: false });
    // a window that cut sight would be the invariant the DB does not enforce yet — this is where it is held
    expect(newWallOf('window')).toEqual({ kind: 'window', blocksSight: false, blocksMove: true, isOpen: false });
  });
  it('only doors and windows open; a closed door cuts sight, an open one does not, a window never does', () => {
    expect([wall, door, window].map(canOpen)).toEqual([false, true, true]);
    expect(blocksSightNow(door)).toBe(true);
    expect(blocksSightNow({ ...door, isOpen: true })).toBe(false);
    expect(blocksSightNow(window)).toBe(false);
    expect(blocksMoveNow(window)).toBe(true);
    expect(blocksMoveNow({ ...window, isOpen: true })).toBe(false);
  });
  it('hitWall picks the nearest segment within tolerance and nothing when the click is away', () => {
    // WALL_1 runs vertically at x = 270 between y = 216 and y = 540
    expect(hitWall([WALL_1], { x: 273, y: 300 })?.id).toBe('w-1');
    expect(hitWall([WALL_1], { x: 320, y: 300 })).toBeNull();
  });
  it('openingGeometry puts a jamb across each end and swings the leaf out of the first one', () => {
    const g = openingGeometry({ x1: 0, y1: 0, x2: 0, y2: 100 }, 10);
    expect(g.jambA).toEqual([{ x: 10, y: 0 }, { x: -10, y: 0 }]);
    expect(g.jambB).toEqual([{ x: 10, y: 100 }, { x: -10, y: 100 }]);
    expect(g.leaf).toEqual([{ x: 0, y: 0 }, { x: -100, y: 0 }]);
  });
});

describe('light and fog helpers', () => {
  it('day has no radius; night converts metres to px with the system’s metres per cell', () => {
    expect(sceneRadiusPx(SCENE_WAREHOUSE)).toBeNull();
    expect(sceneRadiusPx({ ...SCENE_WAREHOUSE, lighting: 'night', nightRadiusM: 10 })).toBeCloseTo((10 / METRES_PER_CELL) * 27);
    expect(nightLabelM({ nightRadiusM: 10.04 })).toBe('10');
  });
  it('the brush radius grows with the size, in scene px', () => {
    expect(brushRadius(3, 27)).toBe(81);
  });
  it('polygons and explored cells become SVG payloads', () => {
    expect(polygonPoints([[0, 0], [10, 5]])).toBe('0,0 10,5');
    expect(cellsPath([[0, 0], [2, 1]], 27)).toBe('M0 0h27v27h-27zM54 27h27v27h-27z');
    expect(cellsPath([], 27)).toBe('');
  });
  it('the fog brush tools are the ones that paint, and nothing is «próximamente» any more', () => {
    expect(isBrush('reveal')).toBe(true);
    expect(isBrush('hide')).toBe(true);
    expect(isBrush('pencil')).toBe(false);
    expect(TOOLS_NOT_YET).toEqual([]);
  });
});
