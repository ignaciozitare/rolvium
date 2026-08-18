import type { FogCell, VisionPolygon } from '@rolvium/core';

/**
 * Line-of-sight geometry. Pure: no I/O, no framework, no game rules — it only knows points and segments.
 * Lives server-side because it needs EVERY wall, including the ones a player must never receive
 * (specs/modules/maps/SPEC.md § «Rules & limits»).
 */

export interface Point { x: number; y: number }
export interface Segment { a: Point; b: Point }

const EPS = 1e-9;
/** Rays are fired just off each corner so the polygon wraps around it instead of stopping on it. */
const CORNER_NUDGE = 1e-4;
/** Extra evenly spaced rays, so a radius-limited view has a round edge and not a star. */
const ARC_RAYS = 72;

/** The four sides of the scene, so every ray terminates even in an empty room. */
export function boundsSegments(width: number, height: number): Segment[] {
  const c: Point[] = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4]! }));
}

/**
 * Distance from `o` along direction `(dx, dy)` to segment `s`, or `null` when the ray misses it.
 * Solves `o + t·d = s.a + u·(s.b − s.a)` and keeps the hit only for `t ≥ 0`, `u ∈ [0, 1]`.
 */
export function rayHit(o: Point, dx: number, dy: number, s: Segment): number | null {
  const ex = s.b.x - s.a.x, ey = s.b.y - s.a.y;
  const det = ex * dy - dx * ey;
  if (Math.abs(det) < EPS) return null; // parallel (or a degenerate segment)
  const wx = s.a.x - o.x, wy = s.a.y - o.y;
  const t = (ex * wy - wx * ey) / det;
  const u = (dx * wy - wx * dy) / det;
  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}

/**
 * Visibility polygon from `origin` against `segments`, clipped to `radius` (Infinity = only the geometry limits it).
 * One ray per corner (± a nudge) plus a fixed arc, sorted by angle — the classic sweep, good enough for a scene
 * with a few dozen walls and cheap enough to run on every token move.
 */
export function visionPolygon(origin: Point, segments: Segment[], radius = Infinity): VisionPolygon {
  const angles: number[] = [];
  for (const s of segments) {
    for (const p of [s.a, s.b]) {
      const base = Math.atan2(p.y - origin.y, p.x - origin.x);
      angles.push(base - CORNER_NUDGE, base, base + CORNER_NUDGE);
    }
  }
  for (let i = 0; i < ARC_RAYS; i++) angles.push((i / ARC_RAYS) * 2 * Math.PI - Math.PI);
  angles.sort((a, b) => a - b);

  const points: VisionPolygon = [];
  for (const angle of angles) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let best = radius;
    for (const s of segments) {
      const t = rayHit(origin, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    if (!Number.isFinite(best)) continue; // no bounds given and nothing hit: skip rather than emit Infinity
    points.push([origin.x + dx * best, origin.y + dy * best]);
  }
  return points;
}

/** Even-odd ray casting: is `p` inside the (possibly concave) polygon? */
export function pointInPolygon(p: Point, poly: VisionPolygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Grid cells whose centre falls inside any of the polygons — what gets remembered as «explored».
 * Cells, not free polygons, because the union across a session is then a set operation, is bounded by the
 * scene size, and is exactly what the DM's brush paints.
 */
export function cellsInPolygons(polygons: VisionPolygon[], grid: number, width: number, height: number): FogCell[] {
  const cols = Math.ceil(width / grid), rows = Math.ceil(height / grid);
  const out: FogCell[] = [];
  const seen = new Set<string>();
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of poly) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const c0 = Math.max(0, Math.floor(minX / grid)), c1 = Math.min(cols - 1, Math.floor(maxX / grid));
    const r0 = Math.max(0, Math.floor(minY / grid)), r1 = Math.min(rows - 1, Math.floor(maxY / grid));
    for (let cx = c0; cx <= c1; cx++) {
      for (let cy = r0; cy <= r1; cy++) {
        const key = `${cx},${cy}`;
        if (seen.has(key)) continue;
        if (pointInPolygon({ x: (cx + 0.5) * grid, y: (cy + 0.5) * grid }, poly)) { seen.add(key); out.push([cx, cy]); }
      }
    }
  }
  return out;
}

/** Every cell of the scene — «revelar todo», and what `fog_mode = 'off'` means. */
export function allCells(grid: number, width: number, height: number): FogCell[] {
  const out: FogCell[] = [];
  for (let cx = 0; cx < Math.ceil(width / grid); cx++) for (let cy = 0; cy < Math.ceil(height / grid); cy++) out.push([cx, cy]);
  return out;
}

/** Cells within `radius` px of `centre` — the DM's reveal/hide brush. */
export function cellsInDisc(centre: Point, radius: number, grid: number, width: number, height: number): FogCell[] {
  const out: FogCell[] = [];
  const cols = Math.ceil(width / grid), rows = Math.ceil(height / grid);
  const c0 = Math.max(0, Math.floor((centre.x - radius) / grid)), c1 = Math.min(cols - 1, Math.floor((centre.x + radius) / grid));
  const r0 = Math.max(0, Math.floor((centre.y - radius) / grid)), r1 = Math.min(rows - 1, Math.floor((centre.y + radius) / grid));
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = r0; cy <= r1; cy++) {
      if (Math.hypot((cx + 0.5) * grid - centre.x, (cy + 0.5) * grid - centre.y) <= radius) out.push([cx, cy]);
    }
  }
  return out;
}

export const cellKey = (c: FogCell): string => `${c[0]},${c[1]}`;
/** Set union of explored cells (order is irrelevant; duplicates are dropped). */
export function unionCells(...lists: FogCell[][]): FogCell[] {
  const seen = new Set<string>();
  const out: FogCell[] = [];
  for (const list of lists) for (const c of list) { const k = cellKey(c); if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}
/** `base` minus `remove` — the «ocultar» half of the brush. */
export function subtractCells(base: FogCell[], remove: FogCell[]): FogCell[] {
  const gone = new Set(remove.map(cellKey));
  return base.filter(c => !gone.has(cellKey(c)));
}
