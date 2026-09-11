import { describe, expect, it } from 'vitest';
import { pointInRing, roomOutline, sameRoomInput, type RoomOpeningSpan, type RoomPart, type RoomRing } from './rooms';
import type { BlockSegment, ScenePoint } from './maps';

/**
 * ⏱ «NO COMPARAR LO QUE ESTÁ LEJOS» NO PUEDE CAMBIAR EL MAPA (specs/modules/maps/SPEC.md § «Las paredes no se
 * recalculan en cada movimiento», 2026-09-11).
 *
 * Suyo: «*esta recontra super lento*». Su «Dungeon» —256 formas, 8.648 esquinas— tardaba ~2,5 s en sacar las
 * paredes, porque cada lado se comparaba con todos los del mapa; ahora sólo con los que tiene cerca. La promesa es
 * que salen las mismas paredes, y la única forma honrada de sujetarla es poner al lado el motor de antes y comparar
 * muchas escenas al azar de todo tipo: en todas éstas, los mismos tramos, con los mismos números y en el mismo orden.
 * (Con lados paralelos hasta el ruido de coma flotante y a más de 90 px —de laboratorio, a mano no sale— el de antes
 * partía un tramo en dos de más: la misma pared, un trozo más. Por eso esas escenas no están aquí.)
 */

// ── EL MOTOR DE ANTES, todos contra todos (`rooms.ts` en `8206cf0`). Sólo para comparar ─────────────────────
const EPS = 0.5;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;
interface Lado { ring: number; a: ScenePoint; b: ScenePoint }

function distToSegment(p: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function paramOf(p: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  return len2 < 1e-12 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

function cutPointsDeAntes(edge: Lado, others: readonly Lado[]): number[] {
  const ts: number[] = [0, 1];
  const push = (t: number): void => { if (t > 1e-9 && t < 1 - 1e-9) ts.push(t); };
  for (const o of others) {
    if (o === edge) continue;
    const d1x = edge.b.x - edge.a.x, d1y = edge.b.y - edge.a.y;
    const d2x = o.b.x - o.a.x, d2y = o.b.y - o.a.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) > 1e-12) {
      const ex = o.a.x - edge.a.x, ey = o.a.y - edge.a.y;
      const t = (ex * d2y - ey * d2x) / den;
      const u = (ex * d1y - ey * d1x) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9) push(t);
    }
    if (o.ring === edge.ring) continue;
    for (const p of [o.a, o.b]) {
      if (distToSegment(p, edge.a, edge.b) <= EPS) push(paramOf(p, edge.a, edge.b));
    }
  }
  return [...new Set(ts.map(t => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
}

const overlay = (a: BlockSegment, b: BlockSegment): boolean =>
  (near(a[0], b[0]) && near(a[1], b[1]) && near(a[2], b[2]) && near(a[3], b[3])) ||
  (near(a[0], b[2]) && near(a[1], b[3]) && near(a[2], b[0]) && near(a[3], b[1]));

function roomOutlineDeAntes(parts: readonly RoomPart[]): BlockSegment[] {
  const formas = parts.filter(f => f.ring.length >= 3);
  if (!formas.some(f => f.dig)) return [];
  const edges: Lado[] = formas.flatMap((f, ring) => f.ring.flatMap((a, i) => {
    const b = f.ring[(i + 1) % f.ring.length]!;
    return Math.abs(a.x - b.x) <= 1e-6 && Math.abs(a.y - b.y) <= 1e-6 ? [] : [{ ring, a, b }];
  }));
  const vacio = (p: ScenePoint): boolean => {
    let dentro = false;
    for (const f of formas) if (pointInRing(p, f.ring)) dentro = f.dig;
    return dentro;
  };
  const kept: BlockSegment[] = [];
  for (const edge of edges) {
    const ts = cutPointsDeAntes(edge, edges);
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const at = (t: number): ScenePoint => ({ x: edge.a.x + (edge.b.x - edge.a.x) * t, y: edge.a.y + (edge.b.y - edge.a.y) * t });
      const p0 = at(t0), p1 = at(t1);
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const mid = at((t0 + t1) / 2);
      const nx = (-dy / len) * EPS, ny = (dx / len) * EPS;
      if (vacio({ x: mid.x + nx, y: mid.y + ny }) !== vacio({ x: mid.x - nx, y: mid.y - ny })) kept.push([p0.x, p0.y, p1.x, p1.y]);
    }
  }
  const out: BlockSegment[] = [];
  for (const seg of kept) if (!out.some(o => overlay(o, seg))) out.push(seg);
  return out;
}

// ── ESCENAS AL AZAR, con semilla: las mismas en cada pasada, para que un fallo se pueda repetir ────────────
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
const entero = (r: Azar, n: number): number => Math.floor(r() * n);
const G = 27;

/** Un rectángulo pegado a la rejilla: salen lados colineales y salas que se tocan por una cara (el tabique). */
const rejilla = (r: Azar, ancho: number): RoomRing => {
  const x = G * entero(r, ancho / G), y = G * entero(r, ancho / G), w = G * (1 + entero(r, 6)), h = G * (1 + entero(r, 6));
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
};
/** Un contorno redondo y MELLADO, como un trazo con borde roto: muchas esquinas cortas. */
const mellado = (r: Azar, ancho: number): RoomRing => {
  const cx = r() * ancho, cy = r() * ancho, radio = 10 + r() * 90, n = 12 + entero(r, 60);
  return Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * 2 * Math.PI, d = radio * (0.6 + 0.4 * r());
    return { x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d };
  });
};
/** Unos puntos sueltos en una caja: casi siempre un lazo que se CRUZA consigo mismo. */
const lazo = (r: Azar, ancho: number): RoomRing => {
  const cx = r() * ancho, cy = r() * ancho, n = 4 + entero(r, 9);
  return Array.from({ length: n }, () => ({ x: cx + (r() - 0.5) * 160, y: cy + (r() - 0.5) * 160 }));
};
/** Un polígono ENORME con lados larguísimos en diagonal: no se reparte en casillas y se mira siempre. */
const enorme = (r: Azar, ancho: number): RoomRing => [
  { x: r() * ancho * 0.2, y: r() * ancho * 0.2 }, { x: ancho * (0.8 + r() * 0.2), y: ancho * r() * 0.3 },
  { x: ancho * (0.7 + r() * 0.3), y: ancho * (0.8 + r() * 0.2) }, { x: ancho * r() * 0.3, y: ancho * (0.7 + r() * 0.3) },
];
const FORMAS = [rejilla, rejilla, mellado, lazo] as const;

function escena(semilla: number, cuantas: number, ancho: number): RoomPart[] {
  const r = azar(semilla);
  const parts: RoomPart[] = [];
  for (let i = 0; i < cuantas; i++) {
    let ring = FORMAS[entero(r, FORMAS.length)]!(r, ancho);
    if (r() < 0.1) ring = [...ring].reverse();          // dibujada al revés
    if (r() < 0.05) ring = [ring[0]!, ...ring];         // una esquina repetida
    parts.push({ ring, dig: r() < 0.75 });              // tres de cada cuatro excavan; el resto rellena
    if (r() < 0.05) parts.push({ ring, dig: true });    // la misma forma otra vez, justo encima
  }
  return parts;
}

describe('roomOutline — sin comparar lo lejano sale EXACTAMENTE lo mismo que antes', () => {
  it('200 escenas densas: salas pegadas a la rejilla, trazos mellados, lazos que se cruzan y rellenos', () => {
    for (let s = 1; s <= 200; s++) {
      const parts = escena(s, 2 + (s % 20), 400);
      expect(roomOutline(parts), `escena ${s}`).toEqual(roomOutlineDeAntes(parts));
    }
  });

  it('escenas DISPERSAS por un mapa grande, con un polígono enorme que no cabe en ninguna casilla', () => {
    for (let s = 1; s <= 20; s++) {
      const r = azar(1000 + s);
      const parts = [...escena(2000 + s, 30, 4000), { ring: enorme(r, 4000), dig: r() < 0.5 }];
      expect(roomOutline(parts), `escena ${s}`).toEqual(roomOutlineDeAntes(parts));
    }
  });

  it('una mazmorra de ~3.000 esquinas: la misma salida', () => {
    const parts = escena(77, 200, 1500);
    expect(parts.reduce((n, p) => n + p.ring.length, 0)).toBeGreaterThan(2000);
    expect(roomOutline(parts)).toEqual(roomOutlineDeAntes(parts));
  });

  it('una forma absurdamente lejos (10^18 px) no deja colgado el cálculo: sale lo mismo que antes', () => {
    // 🐞 Revisión 2026-09-11: con casillas más allá de 2^53, `ix++` ya no avanzaba y el bucle no acababa nunca (el
    // motor de antes lo sacaba en 2 ms). La forma lejana va DOS veces para que el paso 3 tenga allí un repetido que quitar.
    const cuadro = (x: number, y: number, lado: number): RoomRing => [{ x, y }, { x: x + lado, y }, { x: x + lado, y: y + lado }, { x, y: y + lado }];
    const lejos = cuadro(1e18, 0, 4096);
    const parts = [...Array.from({ length: 30 }, (_, i) => cuadro(i * 30, 0, 10)), lejos, lejos].map(ring => ({ ring, dig: true }));
    const antes = roomOutlineDeAntes(parts);
    expect(antes.some(s => s[0] >= 1e18)).toBe(true);
    expect(roomOutline(parts)).toEqual(antes);
  });
});

describe('sameRoomInput — ¿sale el mismo contorno?', () => {
  const formas = () => [
    { kind: 'room', points: [[0, 0], [100, 0], [100, 60]] as [number, number][] },
    { kind: 'fill', points: [[10, 10], [20, 10], [20, 20]] as [number, number][] },
  ];
  const vanos = (): RoomOpeningSpan[] => [{ id: 'o1', x1: 0, y1: 0, x2: 40, y2: 0, kind: 'door', isOpen: false }];
  const base = () => ({ rooms: formas(), openings: vanos() });

  it('listas NUEVAS con lo mismo dentro dicen que sí: es lo que trae el eco de la base', () => {
    expect(sameRoomInput(base(), base())).toBe(true);
  });

  it('lo que no entra en el cálculo no cuenta: el suelo pintado de una sala no mueve ninguna pared', () => {
    expect(sameRoomInput(base(), { ...base(), rooms: formas().map(f => ({ ...f, floorPaintUrl: 'pintura.png' })) })).toBe(true);
  });

  it('un punto movido, aunque sea una milésima: no', () => {
    const otra = base();
    otra.rooms[0]!.points[2] = [100, 60.001];
    expect(sameRoomInput(base(), otra)).toBe(false);
  });

  it('una forma que pasa de excavar a rellenar: no', () => {
    const otra = base();
    otra.rooms[0]!.kind = 'fill';
    expect(sameRoomInput(base(), otra)).toBe(false);
  });

  it('las mismas formas en otro orden: no — la última dibujada manda', () => {
    expect(sameRoomInput(base(), { ...base(), rooms: formas().reverse() })).toBe(false);
  });

  it('una forma o un vano de más o de menos: no', () => {
    expect(sameRoomInput(base(), { ...base(), rooms: formas().slice(1) })).toBe(false);
    expect(sameRoomInput(base(), { ...base(), openings: [] })).toBe(false);
  });

  it('abrir la puerta, moverla, cambiarla de tipo o por otra: no', () => {
    for (const cambio of [{ isOpen: true }, { x2: 41 }, { kind: 'window' as const }, { id: 'o2' }]) {
      expect(sameRoomInput(base(), { ...base(), openings: [{ ...vanos()[0]!, ...cambio }] }), JSON.stringify(cambio)).toBe(false);
    }
  });
});
