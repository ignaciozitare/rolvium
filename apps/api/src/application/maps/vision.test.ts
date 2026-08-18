import { describe, it, expect } from 'vitest';
import { allCells, boundsSegments, cellsInDisc, cellsInPolygons, pointInPolygon, rayHit, unionCells, subtractCells, visionPolygon } from './vision.js';

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
