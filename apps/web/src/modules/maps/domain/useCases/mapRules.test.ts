import { describe, it, expect } from 'vitest';
import { CHARACTER_KAREN, DRAWING_MINE, DRAWING_OTHER, SCENE_TUNNELS, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1 } from '../../../../../tests/helpers/fakes';
import {
  canEraseDrawing, canMoveToken, canvasToScene, centerOn, clampZoom, distanceCells, distanceLabel, filterEntries, fitView, hitDrawing, hitTest, initialsOf,
  MAX_ZOOM, MIN_ZOOM, sceneToCanvas, sceneVisibleTo, shapeData, snap, cellOf, tokenCellAt, tokenCenter, tokenFromBestiary, tokenFromCharacter, toolsFor, visibleTokens, zoomAt,
  blocksMoveNow, blocksSightNow, brushRadius, canOpen, cellsPath, hitOpening, hitWall, isBrush, METRES_PER_CELL, midpoint, newWallOf, nightLabelM, openingGeometry, planOpening, polygonPoints, sceneRadiusPx, TOOLS_NOT_YET, wallDragTo, wallPiece, WALL_FLAGS, WALL_KINDS, rectFrom, tokensInRect, isDraw, PLAYER_TOOLS, DEFAULT_TOKEN_CELLS, tokenPointAt,
} from './mapRules';
import { plenilunio } from '@rolvium/system-plenilunio';

/**
 * Prueba del dueño 2026-08-21: los tokens estaban «demasiado pequeños y pegados a la grilla». Dos cosas
 * distintas, y las dos se fijan aquí:
 *  · el ancho — «un 50% más para tamaño normal, y escalados por el tamaño de la ficha» (p.25);
 *  · el sitio — «que el movimiento no dependa de la grilla».
 */
describe('tokens: lo ancho que son y dónde caen (dueño 2026-08-21)', () => {
  it('por defecto un token ocupa casilla y media, no una', () => {
    expect(DEFAULT_TOKEN_CELLS).toBe(1.5);
  });
  it('la escala sale de la tabla de tamaños del manual (p.25), y el mediano es el 1,5 del dueño', () => {
    expect(plenilunio.engine.tokenCells!({ size: 'tiny' })).toBe(0.5);
    expect(plenilunio.engine.tokenCells!({ size: 'small' })).toBe(0.75);
    expect(plenilunio.engine.tokenCells!({ size: 'medium' })).toBe(DEFAULT_TOKEN_CELLS);
    expect(plenilunio.engine.tokenCells!({ size: 'large' })).toBe(3.5);
    expect(plenilunio.engine.tokenCells!({ size: 'huge' })).toBe(7);
    // Las proporciones son las del libro: un grande mide 4 m y un mediano 1,7 → 2,35 veces. 3,5/1,5 = 2,33.
    expect(3.5 / 1.5).toBeCloseTo(4 / 1.7, 1);
    expect(7 / 1.5).toBeCloseTo(8 / 1.7, 1);
    // Una ficha que no diga de qué tamaño es no inventa nada: manda el del mapa.
    expect(plenilunio.engine.tokenCells!({})).toBeNull();
    expect(plenilunio.engine.tokenCells!({ size: 'colosal' })).toBeNull();
  });
  it('`tokenPointAt` CENTRA el token en el punto y devuelve fracciones (no se pega a la rejilla)', () => {
    // Centro de la casilla 2,3 con una huella de 1,5: la esquina queda a 0,75 de distancia.
    expect(tokenPointAt({ x: 2.5 * 27, y: 3.5 * 27 }, 27, 1.5)).toEqual({ x: 1.75, y: 2.75 });
    // Un punto cualquiera dentro de una casilla NO cae en su vértice: la fracción se conserva.
    const p = tokenPointAt({ x: 2 * 27 + 5, y: 3 * 27 + 5 }, 27, 1.5);
    expect(p.x).toBeCloseTo(1.435, 2);
    expect(p.y).toBeCloseTo(2.435, 2);
    // Un token grande se centra igual, y su esquina puede salirse por arriba: es correcto, ocupa 3,5 casillas.
    expect(tokenPointAt({ x: 27, y: 27 }, 27, 3.5)).toEqual({ x: -0.75, y: -0.75 });
    // Y sigue quedando centrado: `tokenCenter` devuelve el punto de partida.
    expect(tokenCenter({ ...tokenPointAt({ x: 100, y: 60 }, 27, 3.5), size: 3.5 }, 27)).toEqual({ x: 100, y: 60 });
  });
  /** `tokenCellAt` NO desaparece: sigue siendo lo que se usa cuando algo va de verdad por casillas. */
  it('`tokenCellAt` sigue redondeando a casilla, para lo que sí va por casillas', () => {
    expect(tokenCellAt({ x: 2 * 27 + 5, y: 3 * 27 + 5 }, 27)).toEqual({ x: 2, y: 3 });
  });
});

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
  /**
   * Un encuentro PROPIO del director (H5) sí tiene fila, así que su id va en `bestiaryEntryId` y NO en
   * `bestiaryRef`, que es para ids del catálogo. Mezclarlos dejaría el token apuntando a una criatura del
   * manual que no existe, y al borrar la plantilla nadie sabría qué instancias tocaban.
   */
  it('tokenFromBestiary: una entrada propia enlaza a su fila y se trae su imagen', () => {
    const t = tokenFromBestiary(
      { id: 'be-9', label: 'Ogro con antorcha', data: { resistance: 30, entryId: 'be-9', tokenUrl: 'https://x/o.webp' } },
      'Ogro con antorcha', 'c1', 'sc-1', { x: 2, y: 3 },
    );
    expect(t).toMatchObject({ bestiaryEntryId: 'be-9', bestiaryRef: null, imageUrl: 'https://x/o.webp' });
    expect(t.state).toEqual({ resistance: 30 });      // su Resistencia, no la de la plantilla
  });

  it('tokenFromBestiary: una criatura del manual no enlaza a ninguna fila', () => {
    const t = tokenFromBestiary({ id: 'ogre', label: 'l', data: { resistance: 30 } }, 'Ogro', 'c1', 'sc-1', { x: 0, y: 0 });
    expect(t).toMatchObject({ bestiaryRef: 'ogre', bestiaryEntryId: null, imageUrl: null });
  });

  /**
   * Cambiado el 2026-08-22: un encuentro nace VISIBLE y quien lo tapa es la niebla. Nacía oculto y había que
   * revelarlo a mano, así que un jugador con la criatura delante no la veía y no había forma de saber por qué
   * (dueño: «los encuentros el jugador no los ve, no sé por qué»). El ojo sigue estando para esconder algo a
   * propósito aunque lo tengas a la vista.
   */
  it('tokenFromBestiary: nace VISIBLE (lo tapa la niebla), guarda el id del catálogo y copia la Resistencia', () => {
    const t = tokenFromBestiary({ id: 'mutant', label: 'catalog.bestiary.mutant.name', data: { resistance: 12, protection: 2 } }, 'Mutante', 'c1', 'sc-1', { x: 5, y: 5 });
    expect(t).toMatchObject({ bestiaryRef: 'mutant', name: 'Mutante', visible: true, controlledBy: null, characterId: null, state: { resistance: 12 } });
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

describe('wallDragTo — mover un segmento o estirar un vértice', () => {
  const origin = { x1: 27, y1: 54, x2: 135, y2: 54 };
  it('agarrando el cuerpo mueve los dos extremos a la vez, ajustado a la rejilla', () => {
    expect(wallDragTo(origin, 'whole', { x: 50, y: 50 }, { x: 50 + 27, y: 50 + 27 }, 27)).toEqual({ x1: 54, y1: 81, x2: 162, y2: 81 });
  });
  it('agarrando un vértice mueve sólo ese extremo', () => {
    expect(wallDragTo(origin, 'a', { x: 27, y: 54 }, { x: 27, y: 54 + 27 }, 27)).toEqual({ x1: 27, y1: 81, x2: 135, y2: 54 });
    expect(wallDragTo(origin, 'b', { x: 135, y: 54 }, { x: 135 + 27, y: 54 }, 27)).toEqual({ x1: 27, y1: 54, x2: 162, y2: 54 });
  });
  it('un arrastre menor que media casilla no mueve nada: la rejilla lo absorbe', () => {
    expect(wallDragTo(origin, 'whole', { x: 50, y: 50 }, { x: 55, y: 52 }, 27)).toEqual(origin);
  });
});

describe('selección por área y herramienta de texto', () => {
  it('el rectángulo se normaliza se arrastre hacia donde se arrastre', () => {
    expect(rectFrom({ x: 100, y: 80 }, { x: 20, y: 10 })).toEqual({ x: 20, y: 10, w: 80, h: 70 });
  });
  it('atrapa los tokens cuyo centro cae dentro, y sólo esos', () => {
    // TOKEN_KAREN está en la celda (10,11) y TOKEN_ELIAS en la (8,12); rejilla de 27
    expect(tokensInRect([TOKEN_KAREN, TOKEN_ELIAS], { x: 7 * 27, y: 10 * 27 }, { x: 12 * 27, y: 13 * 27 }, 27)).toEqual(['tk-karen', 'tk-elias']);
    expect(tokensInRect([TOKEN_KAREN, TOKEN_ELIAS], { x: 9 * 27, y: 10 * 27 }, { x: 12 * 27, y: 13 * 27 }, 27)).toEqual(['tk-karen']);
    expect(tokensInRect([TOKEN_KAREN, TOKEN_ELIAS], { x: 0, y: 0 }, { x: 27, y: 27 }, 27)).toEqual([]);
  });
  it('Texto es herramienta de lienzo y la tiene también el jugador', () => {
    expect(isDraw('text')).toBe(true);
    expect(PLAYER_TOOLS).toContain('text');
  });
});

describe('planOpening — una puerta dibujada sobre un muro lo parte', () => {
  // Un muro horizontal de 10 casillas: de (0,54) a (270,54), rejilla de 27.
  const host = { ...WALL_1, id: 'w-host', x1: 0, y1: 54, x2: 270, y2: 54 };

  it('el tramo solapado se convierte en la abertura y el muro queda en los dos trozos que sobran', () => {
    const plan = planOpening([host], { x: 81, y: 54 }, { x: 135, y: 54 }, 'door');
    expect(plan.opening).toEqual({ x1: 81, y1: 54, x2: 135, y2: 54 });
    expect(plan.split!.host.id).toBe('w-host');
    expect(plan.split!.pieces).toEqual([
      { x1: 0, y1: 54, x2: 81, y2: 54 },
      { x1: 135, y1: 54, x2: 270, y2: 54 },
    ]);
  });
  it('la abertura se proyecta sobre la recta del muro: nunca queda un pelo torcida', () => {
    // dibujada 3 px por debajo y desbordando por la izquierda — se pega al muro y se recorta contra su extremo
    const plan = planOpening([host], { x: -40, y: 57 }, { x: 108, y: 51 }, 'window');
    expect(plan.opening).toEqual({ x1: 0, y1: 54, x2: 108, y2: 54 });
    expect(plan.split!.pieces).toEqual([{ x1: 108, y1: 54, x2: 270, y2: 54 }]); // el trozo de longitud cero no se guarda
  });
  it('sin muro debajo se crea suelta, como hasta ahora', () => {
    const plan = planOpening([host], { x: 0, y: 500 }, { x: 54, y: 500 }, 'door');
    expect(plan).toEqual({ opening: { x1: 0, y1: 500, x2: 54, y2: 500 }, split: null });
  });
  it('un muro nunca parte a otro, y una abertura no parte a otra abertura', () => {
    expect(planOpening([host], { x: 81, y: 54 }, { x: 135, y: 54 }, 'wall').split).toBeNull();
    const door = { ...host, id: 'w-d', kind: 'door' as const };
    expect(planOpening([door], { x: 81, y: 54 }, { x: 135, y: 54 }, 'window').split).toBeNull();
  });
  it('rozar un extremo o un punto no parte nada; una abertura de longitud cero tampoco', () => {
    expect(planOpening([host], { x: -54, y: 54 }, { x: 0, y: 54 }, 'door').split).toBeNull();
    expect(planOpening([host], { x: 81, y: 54 }, { x: 81, y: 54 }, 'door').split).toBeNull();
  });
  it('parte el muro sobre el que más se apoya, aunque haya varios candidatos', () => {
    const short = { ...host, id: 'w-short', x1: 81, y1: 56, x2: 135, y2: 56 };
    const plan = planOpening([short, host], { x: 27, y: 54 }, { x: 216, y: 54 }, 'door');
    expect(plan.split!.host.id).toBe('w-host');
  });
  it('el trozo que no se guarda se lo queda la abertura: partir nunca deja una rendija de nada en el extremo', () => {
    // el sobrante de la izquierda mide 0,4 px — por debajo del mínimo, así que no se guarda
    const plan = planOpening([host], { x: 0.4, y: 54 }, { x: 135, y: 54 }, 'door');
    expect(plan.split!.pieces).toEqual([{ x1: 135, y1: 54, x2: 270, y2: 54 }]);
    // …y la abertura llega hasta el extremo del muro, no hasta donde se dibujó
    expect(plan.opening).toEqual({ x1: 0, y1: 54, x2: 135, y2: 54 });
  });
  it('también corta un muro en diagonal, sobre su propia recta', () => {
    const diag = { ...WALL_1, id: 'w-diag', x1: 0, y1: 0, x2: 100, y2: 100 };
    const plan = planOpening([diag], { x: 20, y: 20 }, { x: 40, y: 40 }, 'door');
    expect(plan.opening).toEqual({ x1: 20, y1: 20, x2: 40, y2: 40 });
    expect(plan.split!.pieces).toEqual([{ x1: 0, y1: 0, x2: 20, y2: 20 }, { x1: 40, y1: 40, x2: 100, y2: 100 }]);
  });
  it('los trozos que sobran heredan todo lo que era el muro menos su geometría', () => {
    const visible = { ...host, visiblePlayers: true };
    expect(wallPiece(visible, { x1: 0, y1: 54, x2: 81, y2: 54 })).toEqual({
      sceneId: visible.sceneId, campaignId: visible.campaignId, visiblePlayers: true,
      kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false,
      x1: 0, y1: 54, x2: 81, y2: 54,
    });
  });
});

describe('el disco de abrir al pasar el ratón', () => {
  it('sólo responden las puertas y las ventanas, nunca un muro', () => {
    const door = { ...WALL_1, id: 'w-d', kind: 'door' as const };
    expect(hitOpening([door], { x: 273, y: 300 })?.id).toBe('w-d');
    expect(hitOpening([WALL_1], { x: 273, y: 300 })).toBeNull();
  });
  it('el disco se pone en el centro del vano', () => {
    expect(midpoint({ x1: 0, y1: 54, x2: 100, y2: 154 })).toEqual({ x: 50, y: 104 });
  });
});
