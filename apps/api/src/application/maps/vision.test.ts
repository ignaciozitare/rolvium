import { describe, it, expect } from 'vitest';
import { allCells, boundsSegments, cellsInDisc, cellsInPolygons, clipToConvex, clipToStar, lightPolygon, pointInPolygon, rayHit, unionCells, subtractCells, visionPolygon } from './vision.js';

const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][];

describe('rayHit', () => {
  const seg = { a: { x: 50, y: -50 }, b: { x: 50, y: 50 } };
  it('returns the distance when the ray crosses the segment', () => {
    expect(rayHit({ x: 0, y: 0 }, 1, 0, seg)).toBeCloseTo(50);
  });
  it('ignores hits behind the origin and misses past the segment ends', () => {
    expect(rayHit({ x: 0, y: 0 }, -1, 0, seg)).toBeNull();
    expect(rayHit({ x: 0, y: 200 }, 1, 0, seg)).toBeNull();
  });
  it('ignores parallel segments', () => {
    expect(rayHit({ x: 0, y: 0 }, 0, 1, { a: { x: -10, y: 10 }, b: { x: 10, y: 10 } })).toBeCloseTo(10);
    expect(rayHit({ x: 0, y: 0 }, 1, 0, { a: { x: -10, y: 10 }, b: { x: 10, y: 10 } })).toBeNull();
  });
});

describe('visionPolygon', () => {
  const bounds = boundsSegments(270, 270);
  /** A wall that cuts the scene in two, exactly the «puerta cerrada» case. */
  const divider = { a: { x: 135, y: 0 }, b: { x: 135, y: 270 } };

  it('a blocking wall keeps the far side out of sight', () => {
    const poly = visionPolygon({ x: 60, y: 135 }, [divider, ...bounds]);
    expect(poly.length).toBeGreaterThan(3);
    expect(pointInPolygon({ x: 60, y: 135 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(false);
  });

  it('an opened door (segment removed) lets sight through', () => {
    const poly = visionPolygon({ x: 60, y: 135 }, bounds);
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(true);
  });

  it('night: the radius clips sight even with nothing in the way', () => {
    const poly = visionPolygon({ x: 135, y: 135 }, bounds, 40);
    expect(pointInPolygon({ x: 150, y: 135 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(false);
  });

  it('emits no Infinity when there is no geometry at all', () => {
    expect(visionPolygon({ x: 0, y: 0 }, [])).toEqual([]);
  });
});

describe('pointInPolygon', () => {
  it('is true inside, false outside, for a concave shape too', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, SQUARE)).toBe(false);
    const l = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]] as [number, number][];
    expect(pointInPolygon({ x: 20, y: 80 }, l)).toBe(true);
    expect(pointInPolygon({ x: 80, y: 80 }, l)).toBe(false);
  });
});

describe('cells', () => {
  it('cellsInPolygons keeps the cells whose centre is inside, deduplicated across polygons', () => {
    const cells = cellsInPolygons([SQUARE, SQUARE], 50, 200, 200);
    expect(cells).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });
  it('allCells covers the scene and cellsInDisc only the brush', () => {
    expect(allCells(27, 270, 270)).toHaveLength(100);
    const disc = cellsInDisc({ x: 135, y: 135 }, 30, 27, 270, 270);
    expect(disc.length).toBeGreaterThan(0);
    expect(disc.every(([x, y]) => Math.hypot((x + 0.5) * 27 - 135, (y + 0.5) * 27 - 135) <= 30)).toBe(true);
  });
  it('union deduplicates and subtract removes', () => {
    expect(unionCells([[1, 1], [2, 2]], [[2, 2], [3, 3]])).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(subtractCells([[1, 1], [2, 2]], [[2, 2]])).toEqual([[1, 1]]);
  });
});

// ── Rebanada 7 · § 7.2: las luces se recortan contra los muros ──────────────

const inAny = (p: { x: number; y: number }, parts: [number, number][][]): boolean => parts.some(poly => pointInPolygon(p, poly));

describe('lightPolygon', () => {
  const bounds = boundsSegments(270, 270);
  const divider = { a: { x: 135, y: 0 }, b: { x: 135, y: 270 } };
  const segments = [divider, ...bounds];
  const torch = { origin: { x: 100, y: 135 }, radius: 120, shape: 'radius' as const, rotation: 0, coneAngle: 60, castsShadow: true };

  it('proyectando sombra, la luz se para en el muro y no alumbra al otro lado', () => {
    const poly = lightPolygon(torch, segments);
    expect(pointInPolygon({ x: 120, y: 135 }, poly)).toBe(true);   // de este lado, dentro del alcance
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(false);  // al otro lado del muro: a oscuras
  });

  it('sin sombra atraviesa la pared: es el resplandor mágico, no la antorcha', () => {
    const poly = lightPolygon({ ...torch, castsShadow: false }, segments);
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(true);
  });

  it('el alcance manda aunque no haya ningún muro delante', () => {
    const poly = lightPolygon({ ...torch, radius: 40 }, segments);
    expect(pointInPolygon({ x: 130, y: 135 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 200, y: 135 }, poly)).toBe(false);
  });

  it('un cono sólo alumbra su sector, y hacia donde apunta', () => {
    const cone = lightPolygon({ ...torch, shape: 'cone', coneAngle: 60, rotation: 0, radius: 30 }, bounds);
    expect(pointInPolygon({ x: 125, y: 135 }, cone)).toBe(true);   // a la derecha: hacia donde mira
    expect(pointInPolygon({ x: 75, y: 135 }, cone)).toBe(false);   // a su espalda
    const back = lightPolygon({ ...torch, shape: 'cone', coneAngle: 60, rotation: 180, radius: 30 }, bounds);
    expect(pointInPolygon({ x: 75, y: 135 }, back)).toBe(true);
  });

  it('un cuadrado llega más lejos en diagonal que un círculo del mismo alcance', () => {
    const sq = lightPolygon({ ...torch, shape: 'square', radius: 40 }, bounds);
    expect(pointInPolygon({ x: 100 + 35, y: 135 + 35 }, sq)).toBe(true);   // la esquina existe
    const circle = lightPolygon({ ...torch, radius: 40 }, bounds);
    expect(pointInPolygon({ x: 100 + 35, y: 135 + 35 }, circle)).toBe(false); // 49 px > 40 de radio
  });

  it('sin alcance no hay charco', () => {
    expect(lightPolygon({ ...torch, radius: 0 }, segments)).toEqual([]);
  });
});

describe('clipToConvex / clipToStar', () => {
  it('clipToConvex deja sólo la parte del polígono que cae dentro del triángulo', () => {
    const tri: [number, number][] = [[0, 0], [100, 0], [0, 100]];
    const clipped = clipToConvex(SQUARE, tri);
    expect(pointInPolygon({ x: 10, y: 10 }, clipped)).toBe(true);
    expect(pointInPolygon({ x: 90, y: 90 }, clipped)).toBe(false);
  });

  it('clipToConvex devuelve vacío cuando no se tocan', () => {
    expect(clipToConvex(SQUARE, [[500, 500], [600, 500], [500, 600]])).toEqual([]);
  });

  /**
   * El caso que justifica todo el mecanismo: la luz está al otro lado de una esquina. Lo que se ve de ella
   * por el hueco viaja; lo que queda en su sombra, no — y ésa es la silueta del muro que no puede salir del
   * servidor.
   */
  it('clipToStar se queda con lo que la luz alumbra Y el ojo alcanza a ver', () => {
    const bounds = boundsSegments(270, 270);
    const halfWall = { a: { x: 135, y: 0 }, b: { x: 135, y: 150 } };   // deja un hueco de y=150 abajo
    const segments = [halfWall, ...bounds];
    const eye = { x: 60, y: 200 };
    const lamp = lightPolygon({ origin: { x: 200, y: 60 }, radius: 80, shape: 'radius', rotation: 0, coneAngle: 60, castsShadow: true }, segments);
    expect(pointInPolygon({ x: 200, y: 60 }, lamp)).toBe(true);        // la luz alumbra su propio sitio…

    const parts = clipToStar(lamp, eye, visionPolygon(eye, segments));
    expect(inAny({ x: 200, y: 60 }, parts)).toBe(false);               // …pero el ojo no lo ve: muro en medio
    expect(inAny({ x: 200, y: 130 }, parts)).toBe(true);               // esto sí, por el hueco de abajo
  });

  it('clipToStar no recorta nada cuando la luz cae entera a la vista', () => {
    const bounds = boundsSegments(270, 270);
    const eye = { x: 135, y: 135 };
    const lamp = lightPolygon({ origin: { x: 150, y: 135 }, radius: 30, shape: 'radius', rotation: 0, coneAngle: 60, castsShadow: true }, bounds);
    const parts = clipToStar(lamp, eye, visionPolygon(eye, bounds));
    expect(inAny({ x: 160, y: 135 }, parts)).toBe(true);
    expect(inAny({ x: 175, y: 135 }, parts)).toBe(true);
    expect(inAny({ x: 200, y: 135 }, parts)).toBe(false);              // fuera del alcance de la luz
  });
});
