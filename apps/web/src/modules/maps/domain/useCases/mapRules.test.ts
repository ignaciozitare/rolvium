import { describe, it, expect } from 'vitest';
import type { Drawing } from '../entities/Scene';
import { CHARACTER_KAREN, DRAWING_MINE, DRAWING_OTHER, SCENE_TUNNELS, SCENE_WAREHOUSE, TOKEN_ELIAS, TOKEN_KAREN, TOKEN_MUTANT, WALL_1 } from '../../../../../tests/helpers/fakes';
import {
  canEraseDrawing, canMoveToken, canvasToScene, centerOn, clampZoom, distanceCells, distanceLabel, filterEntries, fitView, hitDrawing, hitTest, initialsOf,
  MAX_ZOOM, MIN_ZOOM, sceneToCanvas, sceneVisibleTo, shapeData, snap, cellOf, tokenCellAt, tokenCenter, tokenFromBestiary, tokenFromCharacter, toolsFor, visibleTokens, zoomAt,
  blocksMoveNow, blocksSightNow, brushRadius, unionCells, canOpen, cellsPath, hitOpening, hitWall, isBrush, METRES_PER_CELL, midpoint, newWallOf, nightLabelM, openingGeometry, planOpening, polygonPoints, polygonsPath, sceneRadiusPx, TOOLS_NOT_YET, wallDragTo, wallPiece, WALL_FLAGS, WALL_KINDS, splitWallAt, pointOnWall, snapStep, drawingBounds, drawingsInRect, rectFrom, tokensInRect, isDraw, PLAYER_TOOLS, DEFAULT_TOKEN_CELLS, tokenPointAt, slideToken, moveBlockers, tokenRadiusPx, tokenGapCells, translateDrawing, canMoveDrawing,
} from './mapRules';
import { plenilunio } from '@rolvium/system-plenilunio';

/**
 * Prueba del dueño 2026-08-21: los tokens estaban «demasiado pequeños y pegados a la grilla». Dos cosas
 * distintas, y las dos se fijan aquí:
 *  · el ancho — «un 50% más para tamaño normal, y escalados por el tamaño de la ficha» (p.25);
 *  · el sitio — «que el movimiento no dependa de la grilla».
 */
/**
 * Paredes sólidas (rebanada 4, spec § «Rebanada 4»). El dueño pidió «un poco de física, que los tokens no
 * puedan traspasar las paredes», y eligió: choca TODO EL CUERPO (no el centro) y al topar RESBALA.
 */
describe('tokenGapCells — la distancia de un ataque (p.92/p.95)', () => {
  /**
   * El libro mide entre personajes «lo suficientemente cerca como para tocarse» (p.92) / «a más de tres
   * pasos» (p.95): tocarse es cosa de los CUERPOS. De centro a centro, dos tokens de 1,5 casillas con la
   * misma separación visual que antes era cuerpo a cuerpo salían «a corta distancia» y el aviso de defensa
   * no saltaba (regresión del 2026-08-22, cazada por el dueño con el Lunar pegado a Karen).
   */
  it('mide el HUECO entre los cuerpos, no entre los centros', () => {
    const karen = { x: 10, y: 11, size: 1.5 };
    // pegados: hueco 0, midan lo que midan los cuerpos → siempre cuerpo a cuerpo
    expect(tokenGapCells(karen, { x: 11.5, y: 11, size: 1.5 }, 27)).toBeCloseTo(0, 6);
    // LA REGRESIÓN: centros a 2,1 casillas (3,15 m — «corta» midiendo centros) pero cuerpos a 0,6 (0,9 m)
    expect(tokenGapCells(karen, { x: 12.1, y: 11, size: 1.5 }, 27)).toBeCloseTo(0.6, 6);
    // solapados: nunca negativo
    expect(tokenGapCells(karen, karen, 27)).toBe(0);
    // y de verdad lejos, sigue lejos: 12 casillas de centro, cuerpos de 1,5 → 10,5 de hueco
    expect(tokenGapCells(karen, { x: 22, y: 11, size: 1.5 }, 27)).toBeCloseTo(10.5, 6);
  });
});

describe('paredes sólidas: `slideToken`, `moveBlockers`, `tokenRadiusPx`', () => {
  /** Un muro vertical en x = 100, de y 0 a 200. */
  const muro = { id: 'w', sceneId: 's', campaignId: 'c', x1: 100, y1: 0, x2: 100, y2: 200, visiblePlayers: true, kind: 'wall' as const, blocksSight: true, blocksMove: true, isOpen: false, groupId: null };
  const R = 10;

  it('cruzar el muro avanza hasta quedarse PEGADO a este lado; sin muros pasa entero', () => {
    // de (50,100) a (150,100): al otro lado. Avanza hasta el contacto (100 − 10 − 0,5 de holgura) y ahí se
    // queda — NO vuelve al punto de salida, que era el salto que vio el dueño en la app (2026-08-22).
    const r = slideToken({ x: 50, y: 100 }, { x: 150, y: 100 }, R, [muro]);
    expect(r.x).toBeCloseTo(89.5, 3);
    expect(r.y).toBeCloseTo(100, 6);
    // sin muros no hay física que valga
    expect(slideToken({ x: 50, y: 100 }, { x: 150, y: 100 }, R, [])).toEqual({ x: 150, y: 100 });
  });

  it('RESBALA: empujando en diagonal contra el muro, sigue bajando pegado a él', () => {
    // quiere ir a (150, 160) — cruzando. Avanza hasta tocar y el resto baja a lo largo de la pared.
    const r = slideToken({ x: 50, y: 100 }, { x: 150, y: 160 }, R, [muro]);
    expect(r.x).toBeCloseTo(89.5, 3);
    expect(r.y).toBeCloseTo(160, 3);
  });

  it('choca TODO EL CUERPO: el gato pasa por el hueco por el que el ogro no cabe', () => {
    // Dos muros con un hueco de 40 px entre ellos (de y=80 a y=120), y se cruza por el medio.
    const arriba = { ...muro, id: 'a', y1: 0, y2: 80 };
    const abajo = { ...muro, id: 'b', y1: 120, y2: 200 };
    const cruzar = (radio: number) => slideToken({ x: 60, y: 100 }, { x: 140, y: 100 }, radio, [arriba, abajo]);
    expect(cruzar(8)).toEqual({ x: 140, y: 100 });     // gato: cabe
    const ogro = cruzar(30);                           // ogro: no cabe — llega hasta tocar y ahí se queda
    expect(ogro.x).toBeLessThan(100 - 20);
    expect(ogro.x).toBeGreaterThan(60);
    expect(ogro.y).toBeCloseTo(100, 6);
  });

  /**
   * El reparto: `moveBlockers` decide QUÉ bloquea (mira `blocksMove` y `isOpen`, y el interruptor de la
   * escena) y `slideToken` bloquea lo que le den. Por eso la puerta abierta se prueba de punta a punta.
   */
  it('una puerta ABIERTA deja pasar, y una cerrada no', () => {
    const puerta = (abierta: boolean) => ({ ...muro, kind: 'door' as const, isOpen: abierta });
    const cruzar = (abierta: boolean) => slideToken({ x: 50, y: 100 }, { x: 150, y: 100 }, R, moveBlockers([puerta(abierta)], { solidWalls: true }));
    expect(cruzar(true)).toEqual({ x: 150, y: 100 });
    const cerrada = cruzar(false); // contra la puerta cerrada te quedas pegado, no vuelves atrás
    expect(cerrada.x).toBeCloseTo(89.5, 3);
    expect(cerrada.y).toBeCloseTo(100, 6);
    expect(moveBlockers([puerta(true)], { solidWalls: true })).toEqual([]);
    expect(moveBlockers([puerta(false)], { solidWalls: true })).toHaveLength(1);
    // Una ventana corta el paso aunque NO corte la vista (p.ej. una cristalera).
    expect(moveBlockers([{ ...muro, kind: 'window', blocksSight: false }], { solidWalls: true })).toHaveLength(1);
  });

  it('con el interruptor apagado no bloquea NADA: la escena se comporta como siempre', () => {
    expect(moveBlockers([muro], { solidWalls: false })).toEqual([]);
    expect(slideToken({ x: 50, y: 100 }, { x: 150, y: 100 }, R, moveBlockers([muro], { solidWalls: false }))).toEqual({ x: 150, y: 100 });
  });

  /**
   * Si ya estabas DENTRO de un muro —la escena acaba de volverse sólida, o el director te dejó ahí— no se te
   * encierra: te puedes mover hasta salir. Encerrar a alguien sería peor que el problema que se arregla.
   */
  it('quien ya estaba dentro de un muro no se queda encerrado', () => {
    expect(slideToken({ x: 100, y: 100 }, { x: 105, y: 100 }, R, [muro])).toEqual({ x: 105, y: 100 });
  });

  it('el radio del cuerpo sale del ancho del token en casillas', () => {
    expect(tokenRadiusPx({ size: 1.5 }, 27)).toBe(20.25);
    expect(tokenRadiusPx({ size: 0.5 }, 27)).toBe(6.75);
    expect(tokenRadiusPx({ size: 7 }, 27)).toBe(94.5);
  });
});

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
  /** Los charcos de luz llegan partidos (§ 7.2) y van en UN path: dos polígonos sueltos dejan costura. */
  it('varios polígonos caben en un solo path, y los degenerados se caen', () => {
    expect(polygonsPath([[[0, 0], [10, 0], [10, 10]], [[20, 20], [30, 20], [30, 30]]]))
      .toBe('M0 0L10 0L10 10ZM20 20L30 20L30 30Z');
    expect(polygonsPath([[[0, 0], [10, 0]]])).toBe('');
    expect(polygonsPath([])).toBe('');
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
    expect(plan.splits[0]!.host.id).toBe('w-host');
    expect(plan.splits[0]!.pieces).toEqual([
      { x1: 0, y1: 54, x2: 81, y2: 54 },
      { x1: 135, y1: 54, x2: 270, y2: 54 },
    ]);
  });
  it('la abertura se proyecta sobre la recta del muro: nunca queda un pelo torcida', () => {
    // dibujada 3 px por debajo y desbordando por la izquierda — se pega al muro y se recorta contra su extremo
    const plan = planOpening([host], { x: -40, y: 57 }, { x: 108, y: 51 }, 'window');
    expect(plan.opening).toEqual({ x1: 0, y1: 54, x2: 108, y2: 54 });
    expect(plan.splits[0]!.pieces).toEqual([{ x1: 108, y1: 54, x2: 270, y2: 54 }]); // el trozo de longitud cero no se guarda
  });
  it('sin muro debajo se crea suelta, como hasta ahora', () => {
    const plan = planOpening([host], { x: 0, y: 500 }, { x: 54, y: 500 }, 'door');
    expect(plan).toEqual({ opening: { x1: 0, y1: 500, x2: 54, y2: 500 }, splits: [] });
  });
  it('un muro nunca parte a otro, y una abertura no parte a otra abertura', () => {
    expect(planOpening([host], { x: 81, y: 54 }, { x: 135, y: 54 }, 'wall').splits).toEqual([]);
    const door = { ...host, id: 'w-d', kind: 'door' as const };
    expect(planOpening([door], { x: 81, y: 54 }, { x: 135, y: 54 }, 'window').splits).toEqual([]);
  });
  it('rozar un extremo o un punto no parte nada; una abertura de longitud cero tampoco', () => {
    expect(planOpening([host], { x: -54, y: 54 }, { x: 0, y: 54 }, 'door').splits).toEqual([]);
    expect(planOpening([host], { x: 81, y: 54 }, { x: 81, y: 54 }, 'door').splits).toEqual([]);
  });
  it('parte el muro sobre el que más se apoya, aunque haya varios candidatos', () => {
    const short = { ...host, id: 'w-short', x1: 81, y1: 56, x2: 135, y2: 56 };
    const plan = planOpening([short, host], { x: 27, y: 54 }, { x: 216, y: 54 }, 'door');
    expect(plan.splits[0]!.host.id).toBe('w-host');
  });
  it('el trozo que no se guarda se lo queda la abertura: partir nunca deja una rendija de nada en el extremo', () => {
    // el sobrante de la izquierda mide 0,4 px — por debajo del mínimo, así que no se guarda
    const plan = planOpening([host], { x: 0.4, y: 54 }, { x: 135, y: 54 }, 'door');
    expect(plan.splits[0]!.pieces).toEqual([{ x1: 135, y1: 54, x2: 270, y2: 54 }]);
    // …y la abertura llega hasta el extremo del muro, no hasta donde se dibujó
    expect(plan.opening).toEqual({ x1: 0, y1: 54, x2: 135, y2: 54 });
  });
  it('también corta un muro en diagonal, sobre su propia recta', () => {
    const diag = { ...WALL_1, id: 'w-diag', x1: 0, y1: 0, x2: 100, y2: 100 };
    const plan = planOpening([diag], { x: 20, y: 20 }, { x: 40, y: 40 }, 'door');
    expect(plan.opening).toEqual({ x1: 20, y1: 20, x2: 40, y2: 40 });
    expect(plan.splits[0]!.pieces).toEqual([{ x1: 0, y1: 0, x2: 20, y2: 20 }, { x1: 40, y1: 40, x2: 100, y2: 100 }]);
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

/**
 * 🐞 EL FALLO DE LA PUERTA (dueño, 2026-09-01): «ahí está la puerta abierta y no puede ver».
 *
 * En su escena hay TRES segmentos en la misma recta vertical x=621: una puerta ABIERTA de y=405 a y=540, y
 * dos muros macizos, 405→513 y 513→540, que tapan EXACTAMENTE el hueco de la puerta. `sightSegments` filtra
 * bien (`blocksSight && !isOpen`): el fallo está en quien creó esos muros, no en la niebla.
 *
 * Estos dos tests reproducen los dos caminos que, desde la interfaz, dejan un muro macizo encima de una
 * abertura. Son los datos reales de su mapa.
 */
describe('planOpening — una abertura NUNCA puede quedar tapada por un muro macizo (fallo del 2026-09-01)', () => {
  const solid = (id: string, y1: number, y2: number) => ({ ...WALL_1, id, x1: 621, y1, x2: 621, y2 });
  /** ¿Queda algún muro macizo pisando el hueco? Es la única pregunta que importa aquí. */
  const covers = (w: { y1: number; y2: number }, op: { y1: number; y2: number }): boolean =>
    Math.min(w.y1, w.y2) < Math.max(op.y1, op.y2) && Math.max(w.y1, w.y2) > Math.min(op.y1, op.y2);

  it('una puerta dibujada sobre DOS muros seguidos sólo parte uno: el resto del hueco se encoge en silencio', () => {
    const a = solid('w-a', 405, 513), b = solid('w-b', 513, 540);
    const plan = planOpening([a, b], { x: 621, y: 405 }, { x: 621, y: 540 }, 'door');
    // Se dibujó una puerta de 405 a 540 y eso es lo que tiene que salir, no una recortada al muro más largo.
    expect(plan.opening).toEqual({ x1: 621, y1: 405, x2: 621, y2: 540 });
    // Lo que queda macizo después del corte: los trozos que sobreviven a cada muro partido, más los que nadie tocó.
    const cut = new Set(plan.splits.map(s => s.host.id));
    const solidAfter = [...plan.splits.flatMap(s => s.pieces), ...[a, b].filter(w => !cut.has(w.id))];
    expect(solidAfter.filter(w => covers(w, plan.opening))).toEqual([]);
  });

  /**
   * 📌 ANCLA DE UN FALLO CONOCIDO, NO ARREGLADO — `it.fails` pasa mientras el fallo siga vivo y REVIENTA el día
   * que alguien lo arregle, que es justo el aviso que hace falta. Es el camino que explica los datos reales de
   * su escena: la puerta de 405 a 540 sigue entera y encima hay dos muros macizos.
   *
   * No se arregla aquí porque **no es un fallo de cálculo, es una decisión de producto** y es del dueño: al
   * dibujar un muro sobre una puerta, o el muro se parte contra el vano, o se rechaza el trazo, o se queda como
   * hoy. Hasta que él elija, `planOpening` conserva su regla escrita en la spec: «un muro nunca parte a otro».
   */
  it.fails('🔴 SIN ARREGLAR: un muro dibujado ENCIMA de una puerta ya existente la deja ciega sin avisar', () => {
    const door = { ...WALL_1, id: 'w-door', kind: 'door' as const, isOpen: true, x1: 621, y1: 405, x2: 621, y2: 540 };
    const plan = planOpening([door], { x: 621, y: 405 }, { x: 621, y: 513 }, 'wall');
    expect(covers(plan.opening, door)).toBe(false);
  });
});

/** La memoria de la sonda la une el NAVEGADOR mientras está puesta (§ 7.3), así que este helper vive aquí. */
describe('unionCells', () => {
  it('une sin repetir y conserva el orden de llegada', () => {
    expect(unionCells([[0, 0], [1, 0]], [[1, 0], [2, 0]])).toEqual([[0, 0], [1, 0], [2, 0]]);
  });
  it('con una sola lista la devuelve tal cual, y sin listas devuelve vacío', () => {
    expect(unionCells([[3, 4]])).toEqual([[3, 4]]);
    expect(unionCells()).toEqual([]);
  });
  it('no confunde (1,10) con (11,0): la clave lleva separador', () => {
    expect(unionCells([[1, 10]], [[11, 0]])).toHaveLength(2);
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


/**
 * ✏️ MOVER Y BORRAR UN TRAZO (dueño, 2026-09-02: «los textos líneas formas etc deberían poder seleccionarse y
 * mover y borrarse como cualquier cosa»). Cada forma guarda sus puntos a su manera, así que se traducen una
 * por una: lo que se mueve tiene que quedar MOVIDO en la base, o al recargar vuelve a su sitio.
 */
describe('mover un trazo', () => {
  it('un garabato mueve todos sus puntos', () => {
    const d = { kind: 'stroke' as const, data: { points: [[10, 20], [30, 40]] as [number, number][] } };
    expect(translateDrawing(d, 5, -3)).toEqual({ points: [[15, 17], [35, 37]] });
  });

  it('una línea y una caja mueven sus dos esquinas, sin cambiar de tamaño', () => {
    const d = { kind: 'rect' as const, data: { x1: 0, y1: 0, x2: 10, y2: 20 } };
    expect(translateDrawing(d, 3, 4)).toEqual({ x1: 3, y1: 4, x2: 13, y2: 24 });
  });

  it('un círculo mueve su centro y CONSERVA el radio', () => {
    const d = { kind: 'circle' as const, data: { cx: 100, cy: 100, r: 25 } };
    expect(translateDrawing(d, -10, 10)).toEqual({ cx: 90, cy: 110, r: 25 });
  });

  it('un texto mueve su sitio y conserva lo que dice', () => {
    const d = { kind: 'text' as const, data: { x: 5, y: 5, text: 'Trampa' } };
    expect(translateDrawing(d, 1, 2)).toEqual({ x: 6, y: 7, text: 'Trampa' });
  });

  /**
   * 🔒 Mover es SÓLO del director, y no por gusto de la interfaz: la RLS de `maps_drawings` sólo deja
   * actualizar al director. Dejar que un jugador arrastre su propio trazo para que la base se lo rechace
   * sería mentirle. Borrar es otra cosa y sigue su regla de siempre: el tuyo, o cualquiera si eres director.
   */
  it('mover es del director; borrar sigue siendo «el mío o el de cualquiera si mando yo»', () => {
    const mio = { authorId: 'u-pip' };
    expect(canMoveDrawing(mio, 'u-pip', false)).toBe(false);
    expect(canMoveDrawing(mio, 'u-pip', true)).toBe(true);
    expect(canEraseDrawing(mio, 'u-pip', false)).toBe(true);
    expect(canEraseDrawing({ authorId: 'u-nix' }, 'u-pip', false)).toBe(false);
  });
});

/**
 * AÑADIR UN NODO — «*si tengo un vector y le hago doble click en alguna parte de la linea tiene que agregar
 * otro nodo*» (dueño, 2026-09-03). Partir un muro por un punto, reaprovechando `wallPiece`.
 */
describe('splitWallAt — el nodo nuevo parte el muro en dos', () => {
  /** Un muro horizontal de 100 px, para que las cuentas se lean de un vistazo. */
  const muro = { ...WALL_1, x1: 0, y1: 0, x2: 100, y2: 0 };

  it('parte por donde se pinchó: el viejo se acorta y el trozo nuevo sigue desde ahí', () => {
    const plan = splitWallAt(muro, { x: 40, y: 0 });
    expect(plan).not.toBeNull();
    expect(plan!.keep).toEqual({ x1: 0, y1: 0, x2: 40, y2: 0 });
    expect(plan!.piece).toMatchObject({ x1: 40, y1: 0, x2: 100, y2: 0 });
  });

  /** El doble clic nunca cae exactamente sobre la línea: el nodo nace SOBRE el muro, no donde apuntó el ratón. */
  it('el punto se proyecta sobre la línea: pinchando al lado, el nodo cae en el muro', () => {
    const plan = splitWallAt(muro, { x: 40, y: 7 });
    expect(plan!.keep).toEqual({ x1: 0, y1: 0, x2: 40, y2: 0 });
    expect(plan!.piece).toMatchObject({ x1: 40, y1: 0 });
  });

  /** 🔑 Partir un lado de una sala no puede echarlo de la sala: el trozo nuevo hereda el grupo. */
  it('el trozo nuevo hereda el grupo, el tipo y si lo ven los jugadores', () => {
    const puerta = { ...muro, kind: 'door' as const, isOpen: true, visiblePlayers: true, groupId: 'g-sala' };
    const plan = splitWallAt(puerta, { x: 50, y: 0 });
    expect(plan!.piece).toMatchObject({ kind: 'door', isOpen: true, visiblePlayers: true, groupId: 'g-sala' });
  });

  it('pegado a una punta no parte nada: ahí ya hay un nodo', () => {
    expect(splitWallAt(muro, { x: 1, y: 0 })).toBeNull();
    expect(splitWallAt(muro, { x: 99.5, y: 0 })).toBeNull();
  });

  it('un muro de largo cero no se parte', () => {
    expect(splitWallAt({ ...muro, x2: 0, y2: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('pointOnWall acota a los extremos: apuntando más allá del final, el punto es el final', () => {
    expect(pointOnWall(muro, { x: 500, y: 30 })).toEqual({ x: 100, y: 0 });
    expect(pointOnWall(muro, { x: -500, y: 30 })).toEqual({ x: 0, y: 0 });
  });
});

/**
 * EL CANDADO abierto llega hasta el nodo que se arrastra. Con `step` a 0 no se redondea nada; sin pasarlo,
 * `wallDragTo` sigue haciendo exactamente lo de siempre (los tests de arriba lo sujetan).
 */
describe('wallDragTo y snapStep con el candado abierto', () => {
  it('snapStep sin paso devuelve el valor tal cual; con paso redondea como `snap`', () => {
    expect(snapStep(100.4, 0)).toBe(100.4);
    expect(snapStep(100.4, -1)).toBe(100.4);
    expect(snapStep(100, 27)).toBe(108);
  });

  it('con el candado abierto la punta cae donde la sueltas, sin tirón a la casilla', () => {
    const origin = { x1: 27, y1: 54, x2: 135, y2: 54 };
    expect(wallDragTo(origin, 'a', { x: 27, y: 54 }, { x: 31, y: 57 }, 27, 0))
      .toEqual({ x1: 31, y1: 57, x2: 135, y2: 54 });
  });
});

/**
 * ✏️ EL ÁREA COGE TAMBIÉN LOS TRAZOS — «*el arrastrar y seleccionar no funciona con las formas simples de
 * líneas, texto, círculo y cuadrado*» (dueño, 2026-09-03). Cogía fichas y muros; los trazos se quedaban fuera.
 */
describe('drawingBounds y drawingsInRect — el área coge los trazos', () => {
  const d = (id: string, kind: Drawing['kind'], data: Drawing['data']): Drawing =>
    ({ ...DRAWING_MINE, id, kind, data });

  it('mide cada forma por su cuenta, que cada una guarda sus datos a su manera', () => {
    expect(drawingBounds(d('l', 'line', { x1: 10, y1: 40, x2: 60, y2: 20 }))).toEqual({ x: 10, y: 20, w: 50, h: 20 });
    expect(drawingBounds(d('r', 'rect', { x1: 60, y1: 40, x2: 10, y2: 20 }))).toEqual({ x: 10, y: 20, w: 50, h: 20 });
    expect(drawingBounds(d('c', 'circle', { cx: 50, cy: 50, r: 20 }))).toEqual({ x: 30, y: 30, w: 40, h: 40 });
    expect(drawingBounds(d('s', 'stroke', { points: [[10, 10], [30, 5], [20, 40]] }))).toEqual({ x: 10, y: 5, w: 20, h: 35 });
  });

  it('un garabato vacío no ocupa nada, y no revienta', () => {
    expect(drawingBounds(d('s', 'stroke', { points: [] }))).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  /** Se coge lo que cae ENTERO dentro, igual que con los muros: rozar media línea no es elegirla. */
  it('coge lo que cae entero dentro, y deja fuera lo que sólo asoma', () => {
    const dentro = d('dentro', 'line', { x1: 20, y1: 20, x2: 60, y2: 60 });
    const asoma = d('asoma', 'line', { x1: 60, y1: 60, x2: 400, y2: 400 });
    const ids = drawingsInRect([dentro, asoma], { x: 0, y: 0 }, { x: 100, y: 100 }).map(x => x.id);
    expect(ids).toEqual(['dentro']);
  });

  it('el marco vale dibujado desde cualquier esquina', () => {
    const uno = d('uno', 'circle', { cx: 50, cy: 50, r: 10 });
    expect(drawingsInRect([uno], { x: 100, y: 100 }, { x: 0, y: 0 })).toHaveLength(1);
  });

  it('coge las cuatro formas simples de una tacada — que es justo lo que él echaba en falta', () => {
    const todos = [
      d('linea', 'line', { x1: 10, y1: 10, x2: 40, y2: 40 }),
      d('caja', 'rect', { x1: 50, y1: 10, x2: 90, y2: 40 }),
      d('circulo', 'circle', { cx: 50, cy: 70, r: 15 }),
      d('texto', 'text', { x: 10, y: 60, text: 'Trampa' }),
    ];
    const ids = drawingsInRect(todos, { x: 0, y: 0 }, { x: 200, y: 200 }).map(x => x.id);
    expect(ids).toEqual(['linea', 'caja', 'circulo', 'texto']);
  });
});
