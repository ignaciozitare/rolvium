import type { FogCell, VisionPoint, VisionPolygon } from '@rolvium/core';

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

const cellKey = (c: FogCell): string => `${c[0]},${c[1]}`;
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

// ── Rebanada 7 · § 7.2: las luces se recortan contra los muros ──────────────

/**
 * Una luz como la ve la GEOMETRÍA: ni color, ni parpadeo, ni tipo. Sólo dónde está, hasta dónde llega y con
 * qué forma. Lo demás es pintura y vive en el navegador.
 */
export interface LightShape {
  origin: Point;
  /** Alcance en px de escena. */
  radius: number;
  shape: 'radius' | 'cone' | 'square';
  /** Hacia dónde apunta el cono, en grados (0 = a la derecha), igual que en el lienzo. */
  rotation: number;
  /** Apertura del cono, en grados. Se ignora en `radius` y en `square`. */
  coneAngle: number;
  /** Si la luz se corta contra los muros. Apagado atraviesa paredes: un resplandor mágico, no una antorcha. */
  castsShadow: boolean;
}

/** Ángulo equivalente en (−π, π], para poder comparar «está dentro del cono» sin el salto de −π a π. */
function wrapPi(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}

/** Hasta dónde llega la FORMA de la luz en una dirección, sin contar muros. */
function shapeReach(light: LightShape, angle: number): number {
  if (light.shape !== 'square') return light.radius;
  // Un cuadrado es un cuadrado: en diagonal alcanza más lejos que de frente, y así se pinta en el lienzo.
  return light.radius / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)), EPS);
}

/**
 * El charco que alumbra una luz: el MISMO barrido de rayos que `visionPolygon`, pero desde la luz y limitado
 * a su forma. Con `castsShadow` cada rayo se para en el primer muro —es lo que hace que la luz no pase al
 * otro lado de la pared—; sin él la forma sale entera.
 */
export function lightPolygon(light: LightShape, segments: Segment[]): VisionPolygon {
  if (!(light.radius > 0)) return [];
  const full = light.shape !== 'cone' || light.coneAngle >= 360;
  const half = full ? Math.PI : (Math.min(360, Math.max(1, light.coneAngle)) * Math.PI) / 360;
  const centre = (light.rotation * Math.PI) / 180;

  // Los ángulos se llevan RELATIVOS al centro del cono: así «cae dentro» es una comparación y no un caso
  // de borde cada vez que el sector cruza el −π.
  const rel: number[] = [];
  const keep = (r: number): void => { if (full || Math.abs(r) <= half) rel.push(r); };
  for (const s of segments) {
    for (const p of [s.a, s.b]) {
      const base = wrapPi(Math.atan2(p.y - light.origin.y, p.x - light.origin.x) - centre);
      keep(base - CORNER_NUDGE); keep(base); keep(base + CORNER_NUDGE);
    }
  }
  // Un arco proporcional a la apertura, para que el borde salga redondo y no en estrella.
  const steps = Math.max(8, Math.round((ARC_RAYS * half) / Math.PI));
  for (let i = 0; i <= steps; i++) keep(-half + (2 * half * i) / steps);
  rel.sort((a, b) => a - b);

  const points: VisionPolygon = [];
  // Un cono es un trozo de tarta y se cierra POR LA LUZ; si no, sus dos lados rectos no existirían.
  if (!full) points.push([light.origin.x, light.origin.y]);
  for (const r of rel) {
    const angle = centre + r;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let best = shapeReach(light, angle);
    if (light.castsShadow) {
      for (const s of segments) {
        const t = rayHit(light.origin, dx, dy, s);
        if (t !== null && t < best) best = t;
      }
    }
    points.push([light.origin.x + dx * best, light.origin.y + dy * best]);
  }
  return points;
}

/** Área con signo. Su valor absoluto descarta astillas; su signo dice hacia qué lado gira el polígono. */
function signedArea(poly: VisionPolygon): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  }
  return a / 2;
}

/** Corte de una arista con la recta del recorte, interpolando por la distancia con signo a esa recta. */
const crossing = (p: VisionPoint, q: VisionPoint, dp: number, dq: number): VisionPoint => {
  const t = dp / (dp - dq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
};

/**
 * Sutherland–Hodgman: recorta `subject` (de la forma que sea) contra `clip`, que **tiene que ser convexo**.
 * Aquí `clip` es siempre un triángulo, así que la condición se cumple por construcción.
 */
export function clipToConvex(subject: VisionPolygon, clip: VisionPolygon): VisionPolygon {
  if (subject.length < 3 || clip.length < 3) return [];
  const side = signedArea(clip) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0, j = clip.length - 1; i < clip.length && out.length > 0; j = i++) {
    const [ax, ay] = clip[j]!, [bx, by] = clip[i]!;
    const depth = (p: VisionPoint): number => side * ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax));
    const next: VisionPolygon = [];
    for (let k = 0, m = out.length - 1; k < out.length; m = k++) {
      const cur = out[k]!, prev = out[m]!;
      const dCur = depth(cur), dPrev = depth(prev);
      if (dCur >= 0) {
        if (dPrev < 0) next.push(crossing(prev, cur, dPrev, dCur));
        next.push(cur);
      } else if (dPrev >= 0) {
        next.push(crossing(prev, cur, dPrev, dCur));
      }
    }
    out = next;
  }
  return out;
}

/** Astillas por debajo de esto se tiran: son subpíxeles del propio redondeo, no trozos de luz. */
const MIN_PART_AREA = 1e-3;

const boxOf = (poly: VisionPolygon): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};
const boxesMiss = (a: [number, number, number, number], b: [number, number, number, number]): boolean =>
  a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];

/**
 * `subject` ∩ «lo que se ve desde `centre`», donde `star` es el polígono de visión desde ese punto.
 *
 * Un polígono de visión es una ESTRELLA alrededor de su origen —sus vértices salen ya ordenados por ángulo—,
 * así que los triángulos (origen, vértice, siguiente) lo embaldosan enteros, sin huecos ni solapes. Y un
 * triángulo es convexo, que es lo único que Sutherland–Hodgman necesita. De ahí que el corte salga exacto
 * sin traerse una librería de recorte de polígonos.
 *
 * Devuelve VARIOS trozos a propósito: la sombra de una columna parte el charco de luz en dos, y forzarlo a
 * ser uno solo lo cerraría por donde no toca.
 */
export function clipToStar(subject: VisionPolygon, centre: Point, star: VisionPolygon): VisionPolygon[] {
  if (subject.length < 3 || star.length < 3) return [];
  const box = boxOf(subject);
  const parts: VisionPolygon[] = [];
  for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
    const tri: VisionPolygon = [[centre.x, centre.y], star[j]!, star[i]!];
    // La luz suele abarcar un ángulo pequeño visto desde el ojo: casi todos los triángulos ni la rozan.
    if (boxesMiss(box, boxOf(tri))) continue;
    const piece = clipToConvex(subject, tri);
    if (piece.length >= 3 && Math.abs(signedArea(piece)) > MIN_PART_AREA) parts.push(piece);
  }
  return parts;
}
