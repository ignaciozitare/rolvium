import { describe, expect, it } from 'vitest';
import type { VisionPolygon } from '@rolvium/core';
import { ARC_RAYS, arcRays, arcSafeReach, boundsSegments, lightPolygon, nearestHit, rayHit, trimCollinear, visionPolygon, type Point, type Segment } from './vision.js';

/**
 * ⏱ LA LÍNEA DE VISTA SÓLO MIRA LO QUE TIENE AL ALCANCE (specs/modules/maps/SPEC.md, § del mismo nombre, 2026-09-11).
 *
 * Suyo: «*esto tiene que ir rapido rapido*». Con su «Dungeon» (2.323 paredes) sólo 12 estaban al alcance del ojo y
 * aun así cada ficha costaba 161 ms y un polígono de 14.010 puntos. La promesa es que LO QUE SE VE NO CAMBIA, y
 * la única forma honrada de sujetarla es poner al lado el motor de antes y comparar muchas escenas al azar:
 *
 *  - la rejilla (`nearestHit`) devuelve EXACTAMENTE el mismo choque que probar contra todas las paredes;
 *  - de día (sin límite) el polígono es el MISMO, número a número;
 *  - con alcance, cada vértice de antes que caía al alcance sigue estando SOBRE el borde de ahora.
 */

// ── EL MOTOR DE ANTES (`vision.ts` en `4d6d31f`): todos los rayos contra todas las paredes. Sólo para comparar ──
const CORNER_NUDGE = 1e-4;
const EPS = 1e-9;

function visionPolygonDeAntes(origin: Point, segments: Segment[], radius = Infinity): VisionPolygon {
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
    if (!Number.isFinite(best)) continue;
    points.push([origin.x + dx * best, origin.y + dy * best]);
  }
  return points;
}

type Luz = Parameters<typeof lightPolygon>[0];
function wrapPi(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}
function shapeReach(light: Luz, angle: number): number {
  if (light.shape !== 'square') return light.radius;
  return light.radius / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)), EPS);
}
function lightPolygonDeAntes(light: Luz, segments: Segment[]): VisionPolygon {
  if (!(light.radius > 0)) return [];
  const full = light.shape !== 'cone' || light.coneAngle >= 360;
  const half = full ? Math.PI : (Math.min(360, Math.max(1, light.coneAngle)) * Math.PI) / 360;
  const centre = (light.rotation * Math.PI) / 180;
  const rel: number[] = [];
  const keep = (r: number): void => { if (full || Math.abs(r) <= half) rel.push(r); };
  for (const s of segments) {
    for (const p of [s.a, s.b]) {
      const base = wrapPi(Math.atan2(p.y - light.origin.y, p.x - light.origin.x) - centre);
      keep(base - CORNER_NUDGE); keep(base); keep(base + CORNER_NUDGE);
    }
  }
  const steps = Math.max(8, Math.round((ARC_RAYS * half) / Math.PI));
  for (let i = 0; i <= steps; i++) keep(-half + (2 * half * i) / steps);
  rel.sort((a, b) => a - b);
  const points: VisionPolygon = [];
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

/** El choque a mano: todas las paredes, la más cercana. */
function nearestHitDeAntes(segments: Segment[], o: Point, dx: number, dy: number, limit: number): number {
  let best = limit;
  for (const s of segments) {
    const t = rayHit(o, dx, dy, s);
    if (t !== null && t < best) best = t;
  }
  return best;
}

// ── ESCENAS AL AZAR, con semilla: las mismas en cada pasada ──────────────────────────────────────────────────
type Azar = () => number;
function azar(semilla: number): Azar {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Una escena como las suyas: el borde, un puñado de muros largos, y racimos de paredes cortas (un trazo con borde
 * roto son cientos de tramos de 3–8 px), más alguna pared en vertical u horizontal exacto y alguna repetida.
 */
function escena(semilla: number): { segs: Segment[]; w: number; h: number } {
  const r = azar(semilla);
  const w = 300 + Math.floor(r() * 1700), h = 300 + Math.floor(r() * 1000);
  const segs: Segment[] = [...boundsSegments(w, h)];
  const largos = 1 + Math.floor(r() * 6);
  for (let i = 0; i < largos; i++) {
    const a = { x: r() * w, y: r() * h };
    const ang = r() * Math.PI * 2, len = 50 + r() * 600;
    segs.push({ a, b: { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len } });
  }
  const racimos = 1 + Math.floor(r() * 5);
  for (let i = 0; i < racimos; i++) {
    let p = { x: r() * w, y: r() * h };
    const n = 20 + Math.floor(r() * 120);
    let ang = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      ang += (r() - 0.5) * 1.2;
      const q = { x: p.x + Math.cos(ang) * (3 + r() * 5), y: p.y + Math.sin(ang) * (3 + r() * 5) };
      segs.push({ a: p, b: q });
      p = q;
    }
  }
  // Rectas exactas, que caen justo en la raya de una casilla o pasan por el ojo.
  segs.push({ a: { x: Math.round(w / 2), y: 0 }, b: { x: Math.round(w / 2), y: h * 0.4 } });
  segs.push({ a: { x: 0, y: Math.round(h / 3) }, b: { x: w * 0.3, y: Math.round(h / 3) } });
  if (r() < 0.3) segs.push({ ...segs[5]! });
  return { segs, w, h };
}

const ORIGENES = (r: Azar, w: number, h: number): Point[] => [
  { x: r() * w, y: r() * h }, { x: r() * w, y: r() * h }, { x: r() * w, y: r() * h },
  { x: 0, y: 0 }, { x: w / 2, y: h / 2 },                      // el origen de la rejilla y su centro
  { x: -50 - r() * 200, y: r() * h }, { x: r() * w, y: h + 30 + r() * 300 },  // FUERA del mapa, y también fuera de la rejilla
  { x: w / 48, y: h / 48 * 3 },                                 // justo en la raya entre casillas
];

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
function distToSegment(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len2 = dx * dx + dy * dy;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2));
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/**
 * HASTA DÓNDE LLEGA un polígono de visión desde su origen en cada ángulo. Es una estrella: cada vértice está sobre
 * su rayo y van en orden de ángulo, así que en cada ángulo el borde es la cuerda entre los dos vértices que lo
 * encajonan. Los vértices pegados al origen (un ojo sobre una esquina) no tienen ángulo y se saltan.
 */
function radial(poly: VisionPolygon, o: Point): (theta: number) => number {
  const vs = poly.map(([x, y], i) => ({ x, y, i, a: Math.atan2(y - o.y, x - o.x) })).filter(v => dist(v, o) > 1e-9)
    .sort((p, q) => p.a - q.a || p.i - q.i);
  const n = vs.length;
  return theta => {
    if (n < 2) return 0;
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (vs[mid]!.a > theta) hi = mid; else lo = mid + 1; }
    const dx = Math.cos(theta), dy = Math.sin(theta);
    let best = Infinity;
    for (let k = -2; k <= 1; k++) {
      const j = ((lo + k) % n + n) % n, i = (j + 1) % n;
      const t = rayHit(o, dx, dy, { a: vs[j]!, b: vs[i]! });
      if (t !== null && t < best) best = t;
    }
    return Number.isFinite(best) ? best : 0;
  };
}

/** El área de lo que se ve con uno y no con el otro, integrando por ángulos entre cada par de vértices. */
function areaDistinta(a: VisionPolygon, b: VisionPolygon, o: Point): { distinta: number; total: number } {
  const ra = radial(a, o), rb = radial(b, o);
  const angulos = [...new Set([...a, ...b].map(([x, y]) => Math.atan2(y - o.y, x - o.x)))].sort((p, q) => p - q);
  let distinta = 0, total = 0;
  for (let i = 0; i < angulos.length; i++) {
    const t0 = angulos[i]!, t1 = i + 1 < angulos.length ? angulos[i + 1]! : angulos[0]! + 2 * Math.PI;
    const dt = t1 - t0;
    if (dt <= 0) continue;
    for (const f of [1 / 6, 1 / 2, 5 / 6]) {
      const th = t0 + dt * f, x = ra(th), y = rb(th);
      distinta += 0.5 * Math.abs(x * x - y * y) * (dt / 3);
      total += 0.5 * x * x * (dt / 3);
    }
  }
  return { distinta, total };
}

/**
 * LA VERDAD en cada ángulo: hasta dónde llega un rayo desde el ojo antes de chocar, o el alcance. `nearestHit` ya
 * está probado idéntico al recorrido a mano de todas las paredes (primer `describe`), así que sirve de vara.
 */
const verdad = (segs: Segment[], o: Point, reach: (theta: number) => number) => (theta: number): number => {
  const t = nearestHit(segs, o, Math.cos(theta), Math.sin(theta), reach(theta));
  return Number.isFinite(t) ? t : 0;
};

/** Lo que el polígono ve de más o de menos que la verdad, mirando en cada ángulo de sus vértices y entre ellos, y cada 0,25°. */
function areaContraLaVerdad(poly: VisionPolygon, o: Point, real: (theta: number) => number): { distinta: number; total: number } {
  const rp = radial(poly, o);
  const finos = Array.from({ length: 1440 }, (_, i) => -Math.PI + (i / 1440) * 2 * Math.PI);
  const angulos = [...new Set([...poly.map(([x, y]) => Math.atan2(y - o.y, x - o.x)), ...finos])].sort((p, q) => p - q);
  let distinta = 0, total = 0;
  for (let i = 0; i < angulos.length; i++) {
    const t0 = angulos[i]!, t1 = i + 1 < angulos.length ? angulos[i + 1]! : angulos[0]! + 2 * Math.PI;
    const dt = t1 - t0;
    if (dt <= 0) continue;
    for (const f of [1 / 6, 1 / 2, 5 / 6]) {
      const th = t0 + dt * f, x = rp(th), y = real(th);
      distinta += 0.5 * Math.abs(x * x - y * y) * (dt / 3);
      total += 0.5 * y * y * (dt / 3);
    }
  }
  return { distinta, total };
}

/**
 * EL POLÍGONO ES LA VERDAD, salvo dos cosas que no se ven: el arco (una cuerda cada pocos grados, a menos de
 * `ARC_SAGITTA` = 0,1 px del círculo: como mucho ⅔·0,1·2πR px² en total) y las AGUJAS de una diezmilésima de radián
 * en alguna esquina (`CORNER_NUDGE`), que no llegan a un píxel cuadrado cada una.
 *
 * Es una vara MÁS exigente que «igual que el motor de antes»: aquél cortaba con una cuerda el rincón donde una pared
 * sale del círculo y donde dos paredes se cruzan en X, y sólo lo disimulaba a base de miles de rayos de más.
 */
function comoLaVerdad(poly: VisionPolygon, o: Point, real: (theta: number) => number, alcance: number, nombre: string): void {
  const { distinta, total } = areaContraLaVerdad(poly, o, real);
  const arco = Number.isFinite(alcance) ? (2 / 3) * 0.1 * 2 * Math.PI * alcance : 0;
  expect(distinta, `${nombre}: ${distinta.toFixed(2)} px² distintos de ${total.toFixed(0)} px²`).toBeLessThanOrEqual(arco + total * 1e-4 + 1);
}

/**
 * DE DÍA no hay alcance ni arco, y los rayos son los mismos de antes: el polígono coincide con el de antes salvo las
 * agujas que aquél dejaba al fallar una esquina por redondeo (ahora el rayo para EN la esquina).
 */
function mismaVista(antes: VisionPolygon, ahora: VisionPolygon, origen: Point, nombre: string): void {
  const { distinta, total } = areaDistinta(antes, ahora, origen);
  // Cada aguja son unos px² (largo × una diezmilésima de radián × distancia); en una escena de 1.400 esquinas caben decenas.
  expect(distinta, `${nombre}: ${distinta.toFixed(2)} px² distintos de ${total.toFixed(0)} px²`).toBeLessThanOrEqual(total * 1e-3 + 1);
}
/**
 * La comparación de áreas pide un ojo DENTRO del mapa y lejos de las paredes: fuera, el polígono no cierra
 * alrededor del ojo (los rayos que no miran al mapa no chocan con nada) y pegado a una pared hay rayos que chocan
 * a distancia cero. Ninguno de los dos es un ojo de verdad —una ficha y la sonda están siempre dentro—; los rayos
 * desde ahí los cubre igual el test de `nearestHit`.
 */
const lejosDeParedes = (o: Point, segs: Segment[], w: number, h: number): boolean =>
  o.x > 0 && o.x < w && o.y > 0 && o.y < h && segs.every(s => distToSegment(o, s) > 1);

describe('nearestHit — la rejilla da EXACTAMENTE el mismo choque que probar contra todas las paredes', () => {
  it('80 escenas × 8 orígenes × 36 direcciones × 3 alcances, incluidos rayos en vertical y horizontal exactos', () => {
    for (let s = 1; s <= 80; s++) {
      const { segs, w, h } = escena(s);
      const r = azar(1000 + s);
      for (const o of ORIGENES(r, w, h)) {
        for (let k = 0; k < 36; k++) {
          // Un tercio de los rayos va en ángulos redondos: 0°, 90°, 180°, 270° y sus vecinos.
          const ang = k % 3 === 0 ? (Math.floor(k / 3) * Math.PI) / 2 : r() * Math.PI * 2;
          const dx = Math.cos(ang), dy = Math.sin(ang);
          for (const limit of [Infinity, 20 + r() * 400, 1 + r() * 5]) {
            expect(nearestHit(segs, o, dx, dy, limit), `escena ${s}, origen (${o.x.toFixed(1)}, ${o.y.toFixed(1)}), ángulo ${ang.toFixed(4)}, límite ${limit}`)
              .toBe(nearestHitDeAntes(segs, o, dx, dy, limit));
          }
        }
      }
    }
  });

  it('sin paredes no hay rejilla ni choque: devuelve el límite', () => {
    expect(nearestHit([], { x: 0, y: 0 }, 1, 0, Infinity)).toBe(Infinity);
    expect(nearestHit([], { x: 0, y: 0 }, 1, 0, 40)).toBe(40);
  });

  it('con una coordenada que no es un número se prueba contra todas, como antes', () => {
    const segs = [{ a: { x: NaN, y: 0 }, b: { x: 10, y: 0 } }, { a: { x: 50, y: -10 }, b: { x: 50, y: 10 } }];
    expect(nearestHit(segs, { x: 0, y: 0 }, 1, 0, Infinity)).toBe(nearestHitDeAntes(segs, { x: 0, y: 0 }, 1, 0, Infinity));
  });
});

describe('visionPolygon — lo que se ve no cambia', () => {
  it('DE DÍA (sin límite) se ve lo mismo que antes, y con muchos menos puntos', () => {
    let antes = 0, ahora = 0;
    for (let s = 1; s <= 60; s++) {
      const { segs, w, h } = escena(s);
      const r = azar(2000 + s);
      for (const o of ORIGENES(r, w, h)) {
        if (!lejosDeParedes(o, segs, w, h)) continue;
        const a = visionPolygonDeAntes(o, segs), b = visionPolygon(o, segs);
        mismaVista(a, b, o, `escena ${s}, día`);
        antes += a.length; ahora += b.length;
      }
    }
    expect(ahora).toBeLessThan(antes / 2);
  });

  it('CON ALCANCE el polígono es la verdad —rayo a rayo, hasta el alcance— con una fracción de los puntos', () => {
    let antes = 0, ahora = 0;
    for (let s = 1; s <= 60; s++) {
      const { segs, w, h } = escena(s);
      const r = azar(3000 + s);
      for (const o of ORIGENES(r, w, h)) {
        const alcance = 30 + r() * 300;
        if (!lejosDeParedes(o, segs, w, h)) continue;
        const b = visionPolygon(o, segs, alcance);
        comoLaVerdad(b, o, verdad(segs, o, () => alcance), alcance, `escena ${s}, alcance ${alcance.toFixed(0)}`);
        antes += visionPolygonDeAntes(o, segs, alcance).length; ahora += b.length;
      }
    }
    expect(ahora).toBeLessThan(antes / 4);
  });

  it('el rayo que va justo a una esquina para EN la esquina, aunque el redondeo la falle', () => {
    // Un muro que empieza en una esquina en diagonal: el rayo hacia ella puede caer un pelo fuera del muro.
    const esquina = { x: 468.65596365509555, y: 348.3122343895957 };
    const muro = { a: esquina, b: { x: 599.3169847190148, y: 419.0618744365777 } };
    const o = { x: 300.8932938654907, y: 259.57732047652826 };
    const poly = visionPolygon(o, [muro, ...boundsSegments(1200, 900)], 298);
    expect(poly.some(([x, y]) => dist({ x, y }, esquina) <= 1e-6)).toBe(true);
  });

  it('donde una pared SALE del círculo hay un vértice justo ahí: el borde no lo redondea', () => {
    const muro = { a: { x: -1000, y: 50 }, b: { x: 1000, y: 50 } };
    const poly = visionPolygon({ x: 0, y: 0 }, [muro, ...boundsSegments(2000, 2000).map(s => ({ a: { x: s.a.x - 1000, y: s.a.y - 1000 }, b: { x: s.b.x - 1000, y: s.b.y - 1000 } }))], 100);
    const cruce = { x: Math.sqrt(100 * 100 - 50 * 50), y: 50 };
    expect(poly.some(([x, y]) => dist({ x, y }, cruce) <= 1e-6)).toBe(true);
    expect(poly.some(([x, y]) => dist({ x, y }, { x: -cruce.x, y: 50 }) <= 1e-6)).toBe(true);
  });

  it('el alcance seguro para recortar deja toda cuerda del arco fuera del alcance pedido', () => {
    for (const reach of [10, 180, 500, 3000]) {
      expect(arcSafeReach(reach) * Math.cos((2 * Math.PI) / ARC_RAYS)).toBeGreaterThanOrEqual(reach);
    }
    expect(arcSafeReach(Infinity)).toBe(Infinity);
  });

  it('el borde redondo nunca se aparta más de una décima de píxel de un círculo, a cualquier alcance', () => {
    for (const reach of [1, 50, 180, 500, 1000, 5000]) {
      const n = arcRays(reach);
      expect(n).toBeGreaterThanOrEqual(ARC_RAYS);
      expect(reach * (1 - Math.cos(Math.PI / n))).toBeLessThanOrEqual(0.1 + 1e-9);
    }
    expect(arcRays(Infinity)).toBe(ARC_RAYS);
    // Y de noche a 180 px de alcance, con muro delante y detrás, el polígono sigue siendo de cientos de puntos.
    expect(visionPolygon({ x: 100, y: 100 }, boundsSegments(1000, 1000), 180).length).toBeLessThan(200);
  });
});

describe('lightPolygon — lo que se alumbra no cambia', () => {
  const luces = (r: Azar, w: number, h: number): Luz[] => [
    { origin: { x: r() * w, y: r() * h }, radius: 20 + r() * 300, shape: 'radius', rotation: 0, coneAngle: 60, castsShadow: true },
    { origin: { x: r() * w, y: r() * h }, radius: 20 + r() * 300, shape: 'square', rotation: 0, coneAngle: 60, castsShadow: true },
    { origin: { x: r() * w, y: r() * h }, radius: 20 + r() * 300, shape: 'cone', rotation: r() * 360, coneAngle: 15 + r() * 300, castsShadow: true },
  ];

  /** Hasta dónde llega la FORMA de la luz en una dirección: el círculo, o el cuadrado (más lejos en diagonal). */
  const forma = (luz: Luz) => (theta: number): number =>
    (luz.shape === 'square' ? luz.radius / Math.max(Math.abs(Math.cos(theta)), Math.abs(Math.sin(theta)), 1e-9) : luz.radius);

  it('con sombra, redonda o cuadrada, el charco es la verdad: cada rayo se para en la primera pared o en la forma', () => {
    for (let s = 1; s <= 60; s++) {
      const { segs, w, h } = escena(s);
      const r = azar(4000 + s);
      for (const luz of luces(r, w, h)) {
        if (luz.shape === 'cone' || !lejosDeParedes(luz.origin, segs, w, h)) continue;
        comoLaVerdad(lightPolygon(luz, segs), luz.origin, verdad(segs, luz.origin, forma(luz)), luz.radius * (luz.shape === 'square' ? Math.SQRT2 : 1), `escena ${s}, ${luz.shape}`);
      }
    }
  });

  /**
   * Un cono no es una estrella entera (se cierra por la luz), así que se mira vértice a vértice: cada uno está
   * dentro de la apertura y a la distancia que dice la verdad, y los dos bordes rectos están (el rayo de cada lado).
   */
  it('con sombra, un cono alumbra su sector y cada vértice está donde dice la verdad', () => {
    for (let s = 1; s <= 60; s++) {
      const { segs, w, h } = escena(s);
      const r = azar(4000 + s);
      const luz = luces(r, w, h)[2]!;
      const real = verdad(segs, luz.origin, () => luz.radius);
      const half = (luz.coneAngle * Math.PI) / 360, centre = (luz.rotation * Math.PI) / 180;
      const poly = lightPolygon(luz, segs);
      expect(poly[0]).toEqual([luz.origin.x, luz.origin.y]);
      const bordes = new Set<string>();
      const esEsquina = (v: Point): boolean => segs.some(sg => dist(sg.a, v) <= 1e-6 || dist(sg.b, v) <= 1e-6);
      for (const [x, y] of poly.slice(1)) {
        const v = { x, y };
        const d = dist(v, luz.origin), theta = Math.atan2(y - luz.origin.y, x - luz.origin.x);
        const rel = Math.atan2(Math.sin(theta - centre), Math.cos(theta - centre));
        expect(Math.abs(rel), `escena ${s}: un vértice fuera del cono`).toBeLessThanOrEqual(half + 1e-9);
        const tol = 2 * CORNER_NUDGE * luz.radius + 1e-6;
        // Un vértice PUESTO EN UNA ESQUINA puede quedar más cerca que el rayo «verdad»: es el rayo el que falla la
        // esquina por redondeo y sigue hasta la pared de detrás. Nunca más lejos.
        if (esEsquina(v)) expect(d, `escena ${s}: una esquina más allá de la verdad`).toBeLessThanOrEqual(real(theta) + tol);
        else expect(Math.abs(d - real(theta)), `escena ${s}: vértice a ${d.toFixed(2)} px donde la verdad dice ${real(theta).toFixed(2)}`).toBeLessThanOrEqual(tol);
        if (Math.abs(Math.abs(rel) - half) <= 1e-9) bordes.add(rel > 0 ? '+' : '-');
      }
      expect([...bordes].sort(), `escena ${s}: faltan los bordes rectos del cono`).toEqual(['+', '-']);
    }
  });

  it('sin sombra no hace falta ningún rayo hacia las esquinas: la forma sale entera del arco', () => {
    const { segs } = escena(7);
    const luz: Luz = { origin: { x: 100, y: 100 }, radius: 80, shape: 'radius', rotation: 0, coneAngle: 60, castsShadow: false };
    const poly = lightPolygon(luz, segs);
    expect(poly.length).toBeLessThanOrEqual(ARC_RAYS + 1);
    for (const [x, y] of poly) expect(dist({ x, y }, luz.origin)).toBeCloseTo(80, 6);
  });
});

describe('trimCollinear — quita los puntos de más sin cambiar la forma', () => {
  it('los puntos en mitad de un lado recto sobran; las esquinas se quedan', () => {
    expect(trimCollinear([[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [0, 100]])).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
  });

  it('un punto repetido sobra', () => {
    expect(trimCollinear([[0, 0], [100, 0], [100, 0], [100, 100], [0, 100]])).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
  });

  it('un triángulo se queda como está, y con menos de cuatro puntos no se toca nada', () => {
    expect(trimCollinear([[0, 0], [100, 0], [0, 100]])).toEqual([[0, 0], [100, 0], [0, 100]]);
    expect(trimCollinear([])).toEqual([]);
  });

  it('un punto que se sale de la recta por más de un millonésimo de píxel se queda', () => {
    expect(trimCollinear([[0, 0], [50, 0.001], [100, 0], [100, 100], [0, 100]])).toHaveLength(5);
  });
});
