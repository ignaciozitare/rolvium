import { brushAlphaAt, roughReach } from '@rolvium/core';
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
/** Extra evenly spaced rays, so a radius-limited view has a round edge and not a star. Never fewer than these. */
export const ARC_RAYS = 72;
/** Cuánto puede apartarse el borde redondo de un círculo perfecto, en px de escena: nada que se vea. */
const ARC_SAGITTA = 0.1;

/**
 * ⏱ Cuántos rayos van al arco de un alcance dado: los justos para que ninguna cuerda se aparte más de `ARC_SAGITTA`
 * del círculo. Antes eran 72 fijos y el borde salía más fino sólo porque los miles de rayos hacia esquinas lejanas lo
 * rellenaban sin querer; ahora que ésos no se lanzan, el arco se cuida solo: 72 hasta ~130 px de alcance, 94 a 180,
 * 222 a 1.000. Sin límite no hay arco que cuidar.
 */
export const arcRays = (reach: number): number =>
  (Number.isFinite(reach) && reach > ARC_SAGITTA ? Math.max(ARC_RAYS, Math.ceil(Math.PI / Math.acos(1 - ARC_SAGITTA / reach))) : ARC_RAYS);

/**
 * Hasta dónde hay que calcular una vista para que TODO lo que quede a `reach` o menos salga exacto: el arco es una
 * cuerda cada 360°/`ARC_RAYS` como mucho, y una cuerda entre dos puntos a distancia `d` se acerca hasta
 * `d·cos(ese ángulo)`. Con este margen ninguna cuerda del borde muerde por dentro de `reach`.
 */
export const arcSafeReach = (reach: number): number => (Number.isFinite(reach) ? reach / Math.cos((2 * Math.PI) / ARC_RAYS) + 1 : reach);

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

/** Distancia de un punto al SEGMENTO (no a su recta): en un extremo manda el extremo. */
function distToSegment(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2));
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/**
 * ⏱ HACIA DÓNDE SE LANZAN LOS RAYOS (specs/modules/maps/SPEC.md § «La línea de vista sólo mira lo que tiene al
 * alcance»). Suyo, 2026-09-11: «*esto tiene que ir rapido rapido*». Con su «Dungeon» sólo 12 de 2.323 paredes
 * estaban al alcance del ojo y aun así se lanzaban tres rayos hacia cada esquina del mapa: 161 ms por ficha y un
 * polígono de 14.010 puntos que el navegador pintaba en cada tirón.
 *
 * Una pared a más de `reach` del origen no puede parar un rayo antes de `reach`: su choque caería más lejos que el
 * alcance, y el rayo se recorta ahí igual. Así que sus esquinas no merecen rayo. De las que SÍ están al alcance
 * salen los tres de siempre por esquina y, además, uno hacia cada punto donde la pared SALE del círculo: es donde
 * el borde deja de seguir la pared y pasa a ser arco, y con un vértice justo ahí el polígono no lo redondea.
 *
 * Sin límite (`reach` infinito, la vista de día) se lanzan hacia todas, como siempre.
 */
/**
 * Un rayo: hacia dónde, y —si va hacia un punto concreto— a qué distancia está ese punto (`cap`). El rayo que va
 * JUSTO a una esquina puede fallarla por redondeo y seguir hasta la pared de detrás; con la distancia a mano, el
 * choque se corta en la esquina, que es donde está el borde de verdad. Los rayos «un pelo al lado» no llevan tope.
 */
interface Ray { angle: number; cap?: number }

function cornerAngles(origin: Point, segments: Segment[], reach: number, push: (ray: Ray) => void, crossings: (s: Segment) => Point[] = s => circleCrossings(origin, reach, s)): void {
  const limited = Number.isFinite(reach);
  const keptIdx: number[] = [];
  if (limited) segments.forEach((s, i) => { if (distToSegment(origin, s) <= reach) keptIdx.push(i); });
  const kept = limited ? keptIdx.map(i => segments[i]!) : segments;
  const towards = (p: Point): void => push({ angle: Math.atan2(p.y - origin.y, p.x - origin.x), cap: Math.hypot(p.x - origin.x, p.y - origin.y) });
  for (const s of kept) {
    for (const p of [s.a, s.b]) {
      const base = Math.atan2(p.y - origin.y, p.x - origin.x);
      push({ angle: base - CORNER_NUDGE }); towards(p); push({ angle: base + CORNER_NUDGE });
    }
    if (limited) crossings(s).forEach(towards);
  }
  if (!limited) return;
  /**
   * Y donde dos paredes al alcance SE CRUZAN EN X: ahí el borde salta de una a la otra sin que haya esquina, y sin un
   * rayo justo en el cruce el polígono lo cortaba con una cuerda (el motor de antes también, sólo que sus miles de
   * rayos de más lo disimulaban). Sólo se miran las que están al alcance, y POR LA REJILLA: dos paredes que se cruzan
   * comparten la casilla del cruce, así que basta mirar, para cada pared al alcance, las que comparten alguna de sus
   * casillas. Probarlas todas contra todas costaba nada de noche (12 paredes), pero una luz de 30 m alcanza la
   * mazmorra entera y eran 2,7 millones de parejas: 24 ms por luz y por ojo, medido; con la rejilla, un milisegundo.
   */
  const cruce = (s: Segment, t: Segment): void => {
    const p = segmentCrossing(s, t);
    if (p && Math.hypot(p.x - origin.x, p.y - origin.y) <= reach) towards(p);
  };
  const rej = rejillaDe(segments);
  if (rej) {
    const alAlcance = new Uint8Array(segments.length);
    for (const i of keptIdx) alAlcance[i] = 1;
    // Una pareja que comparte varias casillas se prueba una sola vez.
    const vistas = new Set<number>();
    for (const i of keptIdx) {
      const [ax, bx, ay, by] = casillasDe(rej, segments[i]!);
      for (let ix = ax; ix <= bx; ix++) {
        for (let iy = ay; iy <= by; iy++) {
          const lista = rej.celdas[iy * rej.nx + ix];
          if (!lista) continue;
          for (const j of lista) {
            if (j <= i || !alAlcance[j]) continue;
            const pareja = i * segments.length + j;
            if (vistas.has(pareja)) continue;
            vistas.add(pareja);
            cruce(segments[i]!, segments[j]!);
          }
        }
      }
    }
    return;
  }
  // Sin rejilla (alguna coordenada que no es un número): todas contra todas, descartando por sus cajas.
  const cajas = kept.map(s => [Math.min(s.a.x, s.b.x), Math.min(s.a.y, s.b.y), Math.max(s.a.x, s.b.x), Math.max(s.a.y, s.b.y)] as const);
  for (let i = 0; i < kept.length; i++) {
    const [ax0, ay0, ax1, ay1] = cajas[i]!;
    for (let j = i + 1; j < kept.length; j++) {
      const [bx0, by0, bx1, by1] = cajas[j]!;
      if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) continue;
      cruce(kept[i]!, kept[j]!);
    }
  }
}

/** Por dónde se cruzan dos segmentos, si se cruzan. */
function segmentCrossing(s: Segment, t: Segment): Point | null {
  const d1x = s.b.x - s.a.x, d1y = s.b.y - s.a.y, d2x = t.b.x - t.a.x, d2y = t.b.y - t.a.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return null;
  const ex = t.a.x - s.a.x, ey = t.a.y - s.a.y;
  const u = (ex * d2y - ey * d2x) / den, v = (ex * d1y - ey * d1x) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { x: s.a.x + d1x * u, y: s.a.y + d1y * u } : null;
}

/** Por dónde cruza el segmento el CUADRADO de lado `2·half` centrado en `c` (la forma de una luz cuadrada). */
function squareCrossings(c: Point, half: number, s: Segment): Point[] {
  const esquinas = [{ x: c.x - half, y: c.y - half }, { x: c.x + half, y: c.y - half }, { x: c.x + half, y: c.y + half }, { x: c.x - half, y: c.y + half }];
  const out: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const p = segmentCrossing(s, { a: esquinas[i]!, b: esquinas[(i + 1) % 4]! });
    if (p) out.push(p);
  }
  return out;
}

/** Por dónde cruza el segmento el círculo de radio `r` centrado en `c`: cero, uno o dos puntos. */
function circleCrossings(c: Point, r: number, s: Segment): Point[] {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const fx = s.a.x - c.x, fy = s.a.y - c.y;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  if (A < 1e-12) return [];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  const out: Point[] = [];
  for (const t of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) {
    if (t >= 0 && t <= 1) out.push({ x: s.a.x + dx * t, y: s.a.y + dy * t });
  }
  return out;
}

/**
 * ⏱ LA REJILLA DE LAS PAREDES: cada rayo sólo mira las de las casillas que cruza, de cerca a lejos, y se para en la
 * primera que le sale al paso. El choque que devuelve es EXACTAMENTE el de probar contra todas —la misma pared, el
 * mismo `t`—: una pared que cortara el rayo más cerca estaría en una casilla que el rayo cruza antes.
 *
 * Se construye una vez por lista de paredes y se recuerda por ella (`rejillas`): en una petición la misma lista
 * sirve para todas las fichas y para todas las luces.
 */
interface Rejilla {
  x0: number; y0: number; celda: number; nx: number; ny: number;
  /** Los índices de las paredes que tocan cada casilla; `undefined` = ninguna. */
  celdas: (number[] | undefined)[];
  /** Para no probar dos veces la misma pared en un rayo que la cruza por dos casillas. */
  vista: Int32Array; pregunta: number;
}
/** Cuántas casillas por lado del mapa. Con su «Dungeon» (1600 px) salen casillas de 33 px con ~2 paredes cada una. */
const CASILLAS_POR_LADO = 48;
/** Una pared se apunta también en la casilla de al lado si roza su borde: un choque justo en la raya no se pierde. */
const MARGEN_CASILLA = 1e-6;
const rejillas = new WeakMap<Segment[], Rejilla | null>();

function rejillaDe(segments: Segment[]): Rejilla | null {
  const hecha = rejillas.get(segments);
  if (hecha !== undefined) return hecha;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segments) {
    for (const p of [s.a, s.b]) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
  }
  const celda = Math.max(1, Math.max(x1 - x0, y1 - y0) / CASILLAS_POR_LADO);
  const nx = Math.floor((x1 - x0) / celda) + 1, ny = Math.floor((y1 - y0) / celda) + 1;
  // Sin paredes, o con alguna coordenada que no es un número: no hay rejilla que valga y se prueba contra todas.
  if (!(Number.isFinite(celda) && nx > 0 && ny > 0 && nx * ny <= 4 * CASILLAS_POR_LADO * CASILLAS_POR_LADO)) { rejillas.set(segments, null); return null; }
  const celdas: (number[] | undefined)[] = new Array<number[] | undefined>(nx * ny);
  const marco = { x0, y0, celda, nx, ny };
  segments.forEach((s, i) => {
    const [ax, bx, ay, by] = casillasDe(marco, s);
    for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) (celdas[iy * nx + ix] ??= []).push(i);
  });
  const rejilla: Rejilla = { ...marco, celdas, vista: new Int32Array(segments.length), pregunta: 0 };
  rejillas.set(segments, rejilla);
  return rejilla;
}

/**
 * Qué casillas toca una pared, por su caja y con `MARGEN_CASILLA`: `[ix0, ix1, iy0, iy1]`. Es UNA sola cuenta a
 * propósito, la misma al apuntar la pared en la rejilla y al buscar con quién comparte casilla: dos paredes que se
 * cruzan tienen el cruce en la caja de las dos, y con la misma cuenta caen en la misma casilla.
 */
function casillasDe(r: Pick<Rejilla, 'x0' | 'y0' | 'celda' | 'nx' | 'ny'>, s: Segment): [number, number, number, number] {
  const cx = (x: number): number => Math.min(r.nx - 1, Math.max(0, Math.floor((x - r.x0) / r.celda)));
  const cy = (y: number): number => Math.min(r.ny - 1, Math.max(0, Math.floor((y - r.y0) / r.celda)));
  return [
    cx(Math.min(s.a.x, s.b.x) - MARGEN_CASILLA), cx(Math.max(s.a.x, s.b.x) + MARGEN_CASILLA),
    cy(Math.min(s.a.y, s.b.y) - MARGEN_CASILLA), cy(Math.max(s.a.y, s.b.y) + MARGEN_CASILLA),
  ];
}

/**
 * El primer choque del rayo `o` + t·(dx, dy), o `limit` si no choca antes. Recorre las casillas en el orden en que
 * el rayo las cruza (Amanatides & Woo) y se para en cuanto la siguiente casilla empieza más lejos que el mejor
 * choque que ya tiene: nada de lo que quede por mirar puede estar más cerca.
 */
export function nearestHit(segments: Segment[], o: Point, dx: number, dy: number, limit: number): number {
  const rej = rejillaDe(segments);
  let best = limit;
  if (!rej) {
    for (const s of segments) {
      const t = rayHit(o, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
  const { x0, y0, celda, nx, ny, celdas } = rej;
  const X1 = x0 + nx * celda, Y1 = y0 + ny * celda;
  // Si el origen cae fuera de la rejilla, se entra por donde el rayo la alcanza; si no la alcanza, no choca.
  let t0 = 0, ex = o.x, ey = o.y;
  if (ex < x0 || ex > X1 || ey < y0 || ey > Y1) {
    let tin = 0, tout = Infinity;
    for (const [p, d, lo, hi] of [[ex, dx, x0, X1], [ey, dy, y0, Y1]] as const) {
      if (d === 0) { if (p < lo || p > hi) return best; continue; }
      const t1 = (lo - p) / d, t2 = (hi - p) / d;
      tin = Math.max(tin, Math.min(t1, t2)); tout = Math.min(tout, Math.max(t1, t2));
    }
    if (tin > tout || tin >= best) return best;
    t0 = tin; ex += dx * tin; ey += dy * tin;
  }
  let ix = Math.min(nx - 1, Math.max(0, Math.floor((ex - x0) / celda)));
  let iy = Math.min(ny - 1, Math.max(0, Math.floor((ey - y0) / celda)));
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  let tMaxX = dx === 0 ? Infinity : t0 + (x0 + (ix + (dx > 0 ? 1 : 0)) * celda - ex) / dx;
  let tMaxY = dy === 0 ? Infinity : t0 + (y0 + (iy + (dy > 0 ? 1 : 0)) * celda - ey) / dy;
  const tDeltaX = dx === 0 ? Infinity : celda / Math.abs(dx), tDeltaY = dy === 0 ? Infinity : celda / Math.abs(dy);
  const pregunta = ++rej.pregunta;
  for (;;) {
    const lista = celdas[iy * nx + ix];
    if (lista) {
      for (const i of lista) {
        if (rej.vista[i] === pregunta) continue;
        rej.vista[i] = pregunta;
        const t = rayHit(o, dx, dy, segments[i]!);
        if (t !== null && t < best) best = t;
      }
    }
    const next = Math.min(tMaxX, tMaxY);
    if (next >= best) return best;
    if (tMaxX < tMaxY) { ix += stepX; tMaxX += tDeltaX; if (ix < 0 || ix >= nx) return best; }
    else { iy += stepY; tMaxY += tDeltaY; if (iy < 0 || iy >= ny) return best; }
  }
}

/** Por debajo de esto, tres puntos seguidos están en línea recta: la esquina de en medio no dibuja nada. */
const COLLINEAR_EPS = 1e-6;

/**
 * ⏱ El polígono SIN los puntos de más: uno que cae en línea recta entre sus dos vecinos no cambia la forma. Los
 * rayos hacia esquinas distintas chocan muchas veces contra la misma pared, y cada choque era un vértice que el
 * navegador tenía que pintar en cada tirón.
 */
export function trimCollinear(poly: VisionPolygon): VisionPolygon {
  if (poly.length < 4) return poly;
  // Primero los REPETIDOS seguidos (también el último con el primero): un rayo que sale del propio vértice de
  // una pared choca a distancia cero y deja el mismo punto muchas veces. Se hace aparte a propósito: mirarlos con
  // la regla de la recta se llevaba por delante la esquina de verdad que había entre ellos.
  const same = (a: VisionPoint, b: VisionPoint): boolean => Math.abs(a[0] - b[0]) <= COLLINEAR_EPS && Math.abs(a[1] - b[1]) <= COLLINEAR_EPS;
  const uniq: VisionPolygon = [];
  for (const p of poly) if (uniq.length === 0 || !same(p, uniq[uniq.length - 1]!)) uniq.push(p);
  while (uniq.length > 1 && same(uniq[0]!, uniq[uniq.length - 1]!)) uniq.pop();
  if (uniq.length < 4) return uniq;
  const out: VisionPolygon = [];
  for (let i = 0; i < uniq.length; i++) {
    const p = out.length > 0 ? out[out.length - 1]! : uniq[uniq.length - 1]!;
    const q = uniq[i]!, r = uniq[(i + 1) % uniq.length]!;
    const cross = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (Math.abs(cross) <= COLLINEAR_EPS * Math.hypot(r[0] - p[0], r[1] - p[1])) continue;
    out.push(q);
  }
  return out;
}

/**
 * Visibility polygon from `origin` against `segments`, clipped to `radius` (Infinity = only the geometry limits it).
 * One ray per corner within reach (± a nudge) plus a fixed arc, sorted by angle — the classic sweep. Each ray
 * walks the wall grid (`nearestHit`) instead of testing every wall, so a token move stays cheap on a big map.
 */
export function visionPolygon(origin: Point, segments: Segment[], radius = Infinity): VisionPolygon {
  const rays: Ray[] = [];
  cornerAngles(origin, segments, radius, r => rays.push(r));
  const arc = arcRays(radius);
  for (let i = 0; i < arc; i++) rays.push({ angle: (i / arc) * 2 * Math.PI - Math.PI });
  rays.sort((a, b) => a.angle - b.angle);

  const points: VisionPolygon = [];
  for (const { angle, cap } of rays) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const best = Math.min(nearestHit(segments, origin, dx, dy, radius), cap ?? Infinity);
    if (!Number.isFinite(best)) continue; // no bounds given and nothing hit: skip rather than emit Infinity
    points.push([origin.x + dx * best, origin.y + dy * best]);
  }
  return trimCollinear(points);
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

/**
 * LA FORMA DEL PINCEL EN LA NIEBLA (rebanada 9 — «el pincel»).
 *
 * La niebla no se guarda como una imagen sino como CASILLAS, así que aquí no se puede estampar un degradado:
 * hay que preguntar casilla a casilla si le toca. Tres cosas cambian respecto al disco de siempre:
 *
 *  · **el contorno**, si viene `edge` — el borde roto (`roughRadii` en el navegador, que es quien tira el
 *    dado; aquí sólo se lee). ⚠️ Se verá **a resolución de casilla**: dentado a lo bruto, no finamente
 *    desgarrado, y así está avisado en la barra y en el spec (§ 9.2).
 *  · **la transparencia**, que en un almacén de sí-o-no sólo puede ser COBERTURA: cada casilla entra con la
 *    probabilidad que le da el brochazo en ese punto. A media fuerza la niebla se abre a manchas y una
 *    segunda pasada abre más, en vez de destaparlo todo de golpe — que es la queja de «tapa o destapa a
 *    saco». A fuerza máxima no queda nada al azar y sale el disco de siempre.
 *  · **el borde**, la misma dureza que en las capas.
 *
 * El azar entra por `rnd` para poder probarla, y **muere aquí**: lo que se guarda son las casillas
 * resultantes, no la tirada.
 */
export interface BrushShape {
  /** 0..1 — cuánto destapa o tapa cada pasada. Ausente = 1, el disco entero y sin azar. */
  strength?: number;
  /** 0..1 — el borde: 0 se difumina, 1 corta a filo. Ausente = 1. */
  hardness?: number;
  /** El contorno roto: un multiplicador de radio por vértice dando la vuelta. Ausente o vacío = círculo. */
  edge?: number[];
  rnd?: () => number;
}

export function cellsInBrush(centre: Point, radius: number, grid: number, width: number, height: number, shape: BrushShape = {}): FogCell[] {
  const edge = shape.edge ?? [];
  const strength = shape.strength ?? 1;
  const hardness = shape.hardness ?? 1;
  // Sin nada que lo cambie es el pincel de siempre, letra por letra: un mapa suyo pintado antes de esto se
  // sigue pintando igual, y no hay que fiarse de que dos caminos coincidan.
  if (edge.length === 0 && strength >= 1 && hardness >= 1) return cellsInDisc(centre, radius, grid, width, height);
  const rnd = shape.rnd ?? Math.random;
  const out: FogCell[] = [];
  const cols = Math.ceil(width / grid), rows = Math.ceil(height / grid);
  const c0 = Math.max(0, Math.floor((centre.x - radius) / grid)), c1 = Math.min(cols - 1, Math.floor((centre.x + radius) / grid));
  const r0 = Math.max(0, Math.floor((centre.y - radius) / grid)), r1 = Math.min(rows - 1, Math.floor((centre.y + radius) / grid));
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = r0; cy <= r1; cy++) {
      const dx = (cx + 0.5) * grid - centre.x, dy = (cy + 0.5) * grid - centre.y;
      const dist = Math.hypot(dx, dy);
      // El borde roto sólo MUERDE hacia dentro, nunca crece: el brochazo no puede pasarse del radio que el
      // director ve en el cursor.
      const reach = radius * (edge.length > 0 ? roughReach(edge, Math.atan2(dy, dx)) : 1);
      if (reach <= 0 || dist > reach) continue;
      const alpha = brushAlphaAt(dist / reach, strength, hardness);
      if (alpha >= 1 || rnd() < alpha) out.push([cx, cy]);
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
  const rel: Ray[] = [];
  const keep = (r: number, cap?: number): void => { if (full || Math.abs(r) <= half) rel.push(cap === undefined ? { angle: r } : { angle: r, cap }); };
  // Sin sombra ninguna pared para la luz: no hace falta rayo hacia ninguna esquina, la forma sale entera del arco.
  // Con sombra, sólo hacia las paredes que la luz alcanza (un cuadrado llega más lejos en diagonal: √2).
  if (light.castsShadow) {
    // El borde de la forma es donde una pared deja de mandar: un vértice justo ahí, en el círculo o en el cuadrado.
    const square = light.shape === 'square';
    cornerAngles(light.origin, segments, square ? light.radius * Math.SQRT2 : light.radius, r => keep(wrapPi(r.angle - centre), r.cap),
      square ? s => squareCrossings(light.origin, light.radius, s) : undefined);
  }
  // Un cuadrado tiene cuatro esquinas de verdad, y ningún arco cae justo en ellas: un rayo a cada una, a √2 del centro.
  if (light.shape === 'square') for (let k = 0; k < 4; k++) keep(wrapPi(Math.PI / 4 + (k * Math.PI) / 2 - centre), light.radius * Math.SQRT2);
  // Un arco proporcional a la apertura, para que el borde salga redondo y no en estrella.
  const steps = Math.max(8, Math.round((arcRays(light.radius) * half) / Math.PI));
  for (let i = 1; i < steps; i++) keep(-half + (2 * half * i) / steps);
  // Los dos BORDES del cono van a pelo, sin pasar por `keep`: calculados como los de en medio, el redondeo de
  // coma flotante los dejaba un pelo fuera de la apertura y el cono perdía su lado recto hasta el rayo anterior.
  rel.push({ angle: -half }, { angle: half });
  rel.sort((a, b) => a.angle - b.angle);

  const points: VisionPolygon = [];
  // Un cono es un trozo de tarta y se cierra POR LA LUZ; si no, sus dos lados rectos no existirían.
  if (!full) points.push([light.origin.x, light.origin.y]);
  for (const { angle: r, cap } of rel) {
    const angle = centre + r;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const reach = shapeReach(light, angle);
    const best = light.castsShadow ? Math.min(nearestHit(segments, light.origin, dx, dy, reach), cap ?? Infinity) : reach;
    points.push([light.origin.x + dx * best, light.origin.y + dy * best]);
  }
  return trimCollinear(points);
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
