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

/**
 * El charco de luz de UNA luz, en px de escena: la forma que alumbra de verdad una vez descontados los muros
 * y lo que quien pregunta no alcanza a ver. `id` es el de `maps_lights`, para poder recortar su resplandor.
 */
export interface LitLight { id: string; parts: VisionPolygon[] }

/** What `POST /scenes/:id/vision` and `POST /scenes/:id/fog` answer, for whoever asked. */
export interface SceneVision {
  /** Current line of sight, one polygon per token the caller controls. Empty for the DM and for `manual`/`off` fog. */
  vision: VisionPolygon[];
  /** Remembered cells: the caller's own for a player, the union of everyone's for the DM. */
  explored: FogCell[];
  /** Sight radius applied, in scene px; `null` when unlimited (day). */
  radiusPx: number | null;
  /**
   * Lo que ALUMBRA cada luz de la escena, ya recortado contra los muros (§ 7.2 «Las luces iluminan de
   * verdad»). Se calcula en el servidor y NUNCA se manda entero: lo que viaja ya viene cortado también por
   * la línea de vista de quien pregunta, así que la silueta de un muro secreto no se cuela por la forma de
   * su sombra. Al director, que conoce todos los muros, se le manda la luz completa.
   *
   * Cada luz trae VARIOS trozos porque el corte contra la vista puede partirla en dos (una columna en medio
   * del charco de luz). Se pintan como un solo `path`, no como polígonos sueltos: trozos que se tocan,
   * pintados por separado sobre una máscara, dejan una costura clara en el borde compartido.
   *
   * Una lista VACÍA y el campo AUSENTE no son lo mismo, y el navegador actúa distinto en cada uno: vacía es
   * «se calculó, y a ti no te alcanza ninguna» y apaga todos los resplandores; ausente es «esta escena no
   * tiene luces / todavía no hay respuesta» y los pinta enteros.
   */
  lit?: LitLight[];
  /**
   * Dónde puede estar de verdad el token que se está arrastrando, en CASILLAS, cuando la escena tiene las
   * paredes sólidas: la posición pedida ya corregida contra TODOS los muros — también los secretos, que al
   * navegador de un jugador no le llegan. `null` cuando no se preguntó por ninguna posición provisional o
   * cuando la escena no tiene la física encendida.
   */
  corrected?: { tokenId: string; x: number; y: number } | null;
  /**
   * Holgura LIBRE alrededor de la posición contestada, en CASILLAS: hasta esa distancia, en cualquier
   * dirección, el centro del token puede moverse sin tocar ningún muro — también los secretos. El navegador
   * no pinta nunca más allá de ese disco: así el token no puede meterse en un muro que no ve mientras espera
   * la siguiente respuesta (~7/s), que era el «rebote» que vio el dueño (2026-08-22). `null` cuando la
   * física está apagada o no se preguntó por ninguna posición. No revela geometría: es un solo número, y es
   * lo mismo que el jugador aprendería a topetazos.
   */
  clearance?: number | null;
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
 * Y RESBALA de verdad: primero se AVANZA hasta el punto de contacto (bisección sobre el camino — alargar un
 * segmento sólo puede acercarlo al muro, así que «cabe hasta aquí» es monótono y la bisección vale), y el
 * movimiento que sobra se proyecta A LO LARGO del muro tocado, con hasta dos rebotes para las esquinas.
 *
 * La primera versión descomponía el movimiento en los dos EJES desde el origen, sin avanzar nunca: empujar de
 * frente contra un muro devolvía el punto de SALIDA —el dueño vio al token saltar a su posición inicial en la
 * app (2026-08-22)— y contra un muro en diagonal no resbalaba jamás.
 *
 * `SLIDE_GAP`: el frenazo deja el cuerpo a medio px del muro, no a cero. Al soltar, la posición se redondea a
 * la centésima de casilla (`round2` en el navegador) y ese redondeo puede empujar HACIA el muro; sin holgura
 * dejaría al token dentro, y la vía de escape de «ya estabas dentro» le abriría la pared al arrastre siguiente.
 */
const SLIDE_GAP = 0.5;

export function slideCircle(from: ScenePoint, to: ScenePoint, radius: number, blockers: readonly BlockSegment[]): ScenePoint {
  if (blockers.length === 0) return to;
  const distAt = (p: ScenePoint): number => Math.min(...blockers.map(([x1, y1, x2, y2]) => pointSegDist(p, x1, y1, x2, y2)));
  // Si YA estabas dentro de un muro —la escena acaba de volverse sólida, o el director te dejó ahí— no se te
  // encierra: se te deja mover hasta que salgas. Capar la salida sería peor que el problema.
  const start = distAt(from);
  if (start < radius) return to;
  // Quien ya está pegado (a menos de la holgura entera) no puede exigirla, o no podría ni moverse: su listón
  // es la separación que ya trae — puede resbalar a lo largo y alejarse, nunca acercarse más.
  const pad = Math.max(radius, Math.min(radius + SLIDE_GAP, start - 1e-9));
  const clear = (a: ScenePoint, b: ScenePoint): boolean =>
    !blockers.some(([x1, y1, x2, y2]) => segSegDist(a, b, { x: x1, y: y1 }, { x: x2, y: y2 }) < pad);
  const lerp = (a: ScenePoint, b: ScenePoint, t: number): ScenePoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  let pos = from;
  let target = to;
  for (let bounce = 0; bounce < 3; bounce++) {
    if (clear(pos, target)) return target;
    // hasta dónde SÍ cabe por el camino recto
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (clear(pos, lerp(pos, target, mid))) lo = mid; else hi = mid;
    }
    const stop = lerp(pos, target, lo);
    // el muro contra el que se ha topado: el más cercano al punto de contacto
    const wall = blockers.reduce((a, b) => (pointSegDist(stop, b[0], b[1], b[2], b[3]) < pointSegDist(stop, a[0], a[1], a[2], a[3]) ? b : a));
    const len = Math.hypot(wall[2] - wall[0], wall[3] - wall[1]);
    if (len < 1e-9) return stop;
    const ux = (wall[2] - wall[0]) / len, uy = (wall[3] - wall[1]) / len;
    const along = (target.x - stop.x) * ux + (target.y - stop.y) * uy;
    if (Math.abs(along) < 1e-6) return stop; // empujón de frente: pegado al muro, y ahí se queda
    pos = stop;
    target = { x: stop.x + ux * along, y: stop.y + uy * along };
  }
  return pos;
}

/**
 * Cuánto puede moverse el CENTRO de un círculo de radio `radius` desde `center`, en cualquier dirección, sin
 * que `slideCircle` tuviera nada que recortar (se descuenta la misma holgura `SLIDE_GAP`). `Infinity` sin
 * muros. El disco es convexo: cualquier camino que no salga de él es legal entero, no sólo su punto final.
 */
export function circleClearance(center: ScenePoint, radius: number, blockers: readonly BlockSegment[]): number {
  if (blockers.length === 0) return Infinity;
  const d = Math.min(...blockers.map(([x1, y1, x2, y2]) => pointSegDist(center, x1, y1, x2, y2)));
  return Math.max(0, d - radius - SLIDE_GAP);
}
