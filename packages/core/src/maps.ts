// ─── Maps (H7) — shared contract between the API (which computes vision) and the
// web client (which only draws what it is given). No geometry lives here: the
// algorithm is server-only on purpose, because the client never receives the
// walls it is not allowed to see (specs/modules/maps/SPEC.md § «Rules & limits»).

/** A point of a vision polygon, in scene px. */
export type VisionPoint = [number, number];
/** Closed polygon of what a viewer can see right now, in scene px. */
export type VisionPolygon = VisionPoint[];
/** An explored grid cell `[x, y]` (cell coordinates, not px). */
export type FogCell = [number, number];

/** What `POST /scenes/:id/vision` and `POST /scenes/:id/fog` answer, for whoever asked. */
export interface SceneVision {
  /** Current line of sight, one polygon per token the caller controls. Empty for the DM and for `manual`/`off` fog. */
  vision: VisionPolygon[];
  /** Remembered cells: the caller's own for a player, the union of everyone's for the DM. */
  explored: FogCell[];
  /** Sight radius applied, in scene px; `null` when unlimited (day). */
  radiusPx: number | null;
  /**
   * Dónde puede estar de verdad el token que se está arrastrando, en CASILLAS, cuando la escena tiene las
   * paredes sólidas: la posición pedida ya corregida contra TODOS los muros — también los secretos, que al
   * navegador de un jugador no le llegan. `null` cuando no se preguntó por ninguna posición provisional o
   * cuando la escena no tiene la física encendida.
   */
  corrected?: { tokenId: string; x: number; y: number } | null;
}

/**
 * Metres per grid cell, used to turn a scene's `night_radius_m` into px and to label the measure tool.
 *
 * ⚠ DEUDA CONOCIDA: 1 casilla ≈ 1,5 m es una regla de **Plenilunio**, no de la plataforma. Vivía suelta en
 * `mapRules` de `apps/web`; se sube aquí porque con la luz nocturna el servidor necesita el mismo número y
 * duplicarlo sería peor. La rebanada 3 la mueve al puerto `GameSystem` y este export desaparece.
 */
export const METRES_PER_CELL = 1.5;

/** Sight radius in scene px for a scene's lighting, or `null` when the geometry is the only limit. */
export function sightRadiusPx(
  lighting: 'day' | 'night',
  nightRadiusM: number,
  gridSize: number,
  metresPerCell = METRES_PER_CELL,
): number | null {
  if (lighting !== 'night') return null;
  return (nightRadiusM / metresPerCell) * gridSize;
}

// ─── Física de tokens (rebanada 4) ───────────────────────────────────────────
/** Un punto de la escena, en px. */
export interface ScenePoint { x: number; y: number }
/** Un segmento que corta el paso, en px de escena. */
export type BlockSegment = readonly [number, number, number, number];

/** Distancia de un punto al segmento `a`–`b`. */
function pointSegDist(p: ScenePoint, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2));
  return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

/**
 * Lo más cerca que llegan a estar dos segmentos; 0 si se cruzan.
 *
 * Es lo que convierte «¿este token cabe por aquí?» en una cuenta: el cuerpo del token es un círculo, su
 * recorrido es un segmento y el muro es otro — si lo más cerca que pasan es menos que el radio, no cabe.
 */
export function segSegDist(a1: ScenePoint, a2: ScenePoint, b1: ScenePoint, b2: ScenePoint): number {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y, d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) > 1e-9) {
    const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / den;
    const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    pointSegDist(a1, b1.x, b1.y, b2.x, b2.y), pointSegDist(a2, b1.x, b1.y, b2.x, b2.y),
    pointSegDist(b1, a1.x, a1.y, a2.x, a2.y), pointSegDist(b2, a1.x, a1.y, a2.x, a2.y),
  );
}

/**
 * Dónde acaba de verdad un círculo de radio `radius` que quiere ir de `from` a `to` sin cruzar `blockers`.
 *
 * **Vive aquí, en `core`, y no en una de las dos orillas**, porque la usan las DOS y no pueden discrepar: el
 * navegador para que el arrastre se sienta al instante, y el servidor —que es el único que tiene TODOS los
 * muros, incluidos los secretos— para tener la última palabra. Misma lección que `ownDiceForStat`.
 *
 * Se mira el CAMINO y no el punto de llegada: comprobar sólo dónde acabas deja pasar el peor caso, un
 * arrastre rápido de un lado al otro del muro que acaba lejos de él por los dos lados y se cuela.
 *
 * Y RESBALA: al topar se prueba el movimiento descompuesto en sus dos ejes y se queda con lo que sí cabe, así
 * que empujando en diagonal contra una pared el círculo sigue avanzando pegado a ella.
 */
export function slideCircle(from: ScenePoint, to: ScenePoint, radius: number, blockers: readonly BlockSegment[]): ScenePoint {
  const clear = (a: ScenePoint, b: ScenePoint): boolean =>
    !blockers.some(([x1, y1, x2, y2]) => segSegDist(a, b, { x: x1, y: y1 }, { x: x2, y: y2 }) < radius);
  // Si YA estabas dentro de un muro —la escena acaba de volverse sólida, o el director te dejó ahí— no se te
  // encierra: se te deja mover hasta que salgas. Capar la salida sería peor que el problema.
  if (blockers.some(([x1, y1, x2, y2]) => pointSegDist(from, x1, y1, x2, y2) < radius)) return to;
  if (clear(from, to)) return to;
  const onlyX = { x: to.x, y: from.y };
  if (onlyX.x !== from.x && clear(from, onlyX)) return onlyX;
  const onlyY = { x: from.x, y: to.y };
  if (onlyY.y !== from.y && clear(from, onlyY)) return onlyY;
  return from;
}
