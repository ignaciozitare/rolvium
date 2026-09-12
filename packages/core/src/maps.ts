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

/**
 * El punto del segmento `a`–`b` más cercano a `p`, y en qué parte del segmento cae (`t`: 0 en `a`, 1 en `b`).
 * `t` en un extremo quiere decir que lo más cercano es una PUNTA, no el cuerpo — y eso cambia cómo se resbala.
 */
function closestOnSeg(p: ScenePoint, ax: number, ay: number, bx: number, by: number): ScenePoint & { t: number } {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

/** Distancia de un punto al segmento `a`–`b`. */
function pointSegDist(p: ScenePoint, ax: number, ay: number, bx: number, by: number): number {
  const c = closestOnSeg(p, ax, ay, bx, by);
  return Math.hypot(p.x - c.x, p.y - c.y);
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

/**
 * El punto legal más cercano a `p`: el sitio al que se puede llevar de verdad un cuerpo de `pad` de radio
 * cuando el DEDO se ha metido dentro de una pared.
 *
 * 🐞 De aquí salía el trabón de la esquina (suyo, 2026-09-08: «*si toco una esquina se pega y sólo se
 * destraba si muevo el puntero en la dirección contraria*»). El bucle de rebotes de `slideCircle` proyectaba
 * el movimiento sobrante «a lo largo del muro más cercano al punto de contacto», y **en una esquina los dos
 * muros están a la misma distancia**: el desempate cogía siempre el mismo —el primero de la lista— así que
 * una de las dos salidas de CADA esquina quedaba muerta. Medido: aparcado en la esquina de una sala, con el
 * dedo metido en el muro izquierdo, bajar 300 px movía la ficha 0 px; hacia el otro lado resbalaba bien.
 * Para desatascarla había que sacar el puntero de la pared, o sea moverlo en la dirección contraria.
 *
 * Preguntándole al dedo «¿cuál es el sitio legal más cercano a donde estás?» antes de barrer, la esquina
 * deja de depender de ese desempate: se barre hacia un destino que YA es legal.
 *
 * Se resuelve empujando fuera del muro más violado y repitiendo: en una esquina las dos condiciones se
 * turnan y convergen al vértice en un par de pasadas. Si el dedo cae justo ENCIMA de la línea no hay lado
 * que deducir, así que se sale por el lado en el que está el cuerpo (`side`) — nunca al otro, que sería
 * teletransportarlo a través de la pared.
 */
function nearestFree(p: ScenePoint, pad: number, blockers: readonly BlockSegment[], side: ScenePoint): ScenePoint {
  let q = p;
  for (let pass = 0; pass < 8; pass++) {
    let worst = 1e-9;
    let hit: ScenePoint | null = null;
    for (const [x1, y1, x2, y2] of blockers) {
      const c = closestOnSeg(q, x1, y1, x2, y2);
      const gap = pad - Math.hypot(q.x - c.x, q.y - c.y);
      if (gap > worst) { worst = gap; hit = c; }
    }
    if (!hit) return q;
    let nx = q.x - hit.x, ny = q.y - hit.y;
    let n = Math.hypot(nx, ny);
    if (n < 1e-9) { nx = side.x - hit.x; ny = side.y - hit.y; n = Math.hypot(nx, ny); }
    if (n < 1e-9) return q; // ni dedo ni cuerpo dan un lado: se deja como estaba y que decida el barrido
    q = { x: hit.x + (nx / n) * pad, y: hit.y + (ny / n) * pad };
  }
  return q;
}

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
  // El destino que se persigue es el punto legal más cercano al dedo, no el dedo a pelo: ver `nearestFree`.
  // Con el dedo en sitio libre esto devuelve el dedo tal cual y no cambia ni un píxel de lo de antes.
  let target = nearestFree(to, pad, blockers, from);
  for (let bounce = 0; bounce < 3; bounce++) {
    if (clear(pos, target)) return target;
    // hasta dónde SÍ cabe por el camino recto
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (clear(pos, lerp(pos, target, mid))) lo = mid; else hi = mid;
    }
    const stop = lerp(pos, target, lo);
    /**
     * 🐞 LA SEGUNDA MITAD DEL TRABÓN DE LA ESQUINA. Aquí había un `reduce` que se quedaba con UN muro, «el
     * más cercano al punto de contacto» — y en una esquina los dos están a la MISMA distancia, así que el
     * desempate cogía siempre el primero de la lista. Si ése era el muro equivocado, la proyección salía
     * contra el otro, el rebote no avanzaba ni un píxel, la vuelta siguiente volvía a elegir el mismo, y la
     * ficha se quedaba clavada: exactamente lo que él contó (2026-09-08, «*si toco una esquina se pega y
     * sólo se destraba si muevo el puntero en la dirección contraria*»).
     *
     * `nearestFree` sólo tapa una parte de eso: sirve cuando el dedo está DENTRO de la sala pero pisando el
     * cuerpo del muro. En cuanto el dedo se pasa al otro lado —que es lo que ocurre al empujar contra una
     * pared y seguir tirando— el destino vuelve a ser ilegal y el desempate manda otra vez. Medido en una
     * sala de 600×600 con ficha de radio 35: de 288 direcciones probadas en las cuatro esquinas, 64 dejaban
     * la ficha clavada pudiendo moverse; con `nearestFree` solo seguían clavadas 56.
     *
     * Así que no se elige un muro: se prueban TODOS los que empatan a distancia mínima del contacto y se
     * sigue el que de verdad deja avanzar más. Con eso las 288 salen. Y no es más lento donde importa —en
     * una sala de 44 muros el arrastre normal baja de 4,4 a 3,2 µs por evento, porque perseguir un destino
     * ya legal ahorra bisecciones—; la biseción extra sólo corre en el empate, o sea estando en una esquina.
     */
    const wallDist = (w: BlockSegment): number => pointSegDist(stop, w[0], w[1], w[2], w[3]);
    let nearest = Infinity;
    for (const w of blockers) { const d = wallDist(w); if (d < nearest) nearest = d; }
    let best = null as { target: ScenePoint; reach: number } | null;
    /**
     * Un rumbo por el que intentar resbalar: se sigue hasta donde de verdad cabe, y gana el que más avanza.
     *
     * Un rumbo que NO MUEVE NADA no cuenta. Antes se aceptaba (a falta de otro) y el rebote siguiente salía a
     * perseguir ese destino fantasma; con las proyecciones a lo largo del muro era inofensivo, pero rodeando
     * puntas no: empujada de frente contra las dos esquinas de un hueco estrecho, la ficha tocaba las dos, no
     * podía rodear ninguna, y aun así el segundo rebote la escurría 4 px HACIA ATRÁS. Si no se ha resbalado
     * nada, no hay movimiento que continuar.
     */
    const probar = (ux: number, uy: number): void => {
      const along = (target.x - stop.x) * ux + (target.y - stop.y) * uy;
      if (Math.abs(along) < 1e-6) return; // empujón de frente contra ÉSTE: por aquí no se sale
      const candidate = { x: stop.x + ux * along, y: stop.y + uy * along };
      let a = 0, b = 1;
      for (let i = 0; i < 16; i++) { const mid = (a + b) / 2; if (clear(stop, lerp(stop, candidate, mid))) a = mid; else b = mid; }
      const reach = a * Math.abs(along);
      if (reach < 1e-3) return; // bloqueado nada más salir: por aquí tampoco
      if (!best || reach > best.reach) best = { target: candidate, reach };
    };
    for (const w of blockers) {
      if (wallDist(w) > nearest + 1e-6) continue; // no es uno de los muros que se han tocado
      const len = Math.hypot(w[2] - w[0], w[3] - w[1]);
      if (len < 1e-9) continue;
      probar((w[2] - w[0]) / len, (w[3] - w[1]) / len);
      /**
       * 🦷 Y SI LO QUE SE TOCA ES UNA PUNTA —el vértice de un diente del borde roto (§ 10B.4), o la esquina de
       * una sala vista desde FUERA—, «a lo largo del muro» no saca a nadie: las dos caras del diente cierran en
       * ángulo y ninguna de las dos proyecciones avanza, así que la ficha se quedaba clavada en cada diente (él,
       * 2026-09-12: «*has desecho el tema de que no se pegue en las esquinas*» — no se había deshecho nada: con
       * el borde roto las paredes salen DENTADAS, y la víspera no se notaba porque cada movimiento tardaba
       * segundos). Un cuerpo redondo RODEA una punta: se prueba además la tangente de su propio disco en el
       * contacto —la perpendicular a la recta punta→centro—, con la misma bisección y el mismo «gana el que más
       * avanza». Cada tramo sigue pasando por `clear`, así que sigue sin poder cruzar. Medido con su «Dungeon»
       * (22 trazos rotos, 180 pasadas rozando la pared): clavadas 18 → 6, ninguna posición final dentro de una
       * pared, mismo coste. Las 6 que quedan son dientes en zigzag donde la cara siguiente también cierra.
       */
      const c = closestOnSeg(stop, w[0], w[1], w[2], w[3]);
      if (c.t > 1e-6 && c.t < 1 - 1e-6) continue; // contacto con el cuerpo: la dirección del muro ya está probada
      const nx = stop.x - c.x, ny = stop.y - c.y, n = Math.hypot(nx, ny);
      if (n >= 1e-9) probar(-ny / n, nx / n);
    }
    if (!best) return stop; // ni un muro por el que resbalar: pegado a la pared, y ahí se queda
    pos = stop;
    target = best.target;
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
