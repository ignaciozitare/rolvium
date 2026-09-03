import { snap, type Point } from './mapRules';

/**
 * EL MOTOR DE LAS HABITACIONES RÁPIDAS (specs/modules/maps/SPEC.md § «Rebanada 8»).
 *
 * Petición del dueño: «elegir tipo de habitación/mazmorra, dibujar cuadrados o círculos y que la monte sola»,
 * con una regla suya en mayúsculas — **las paredes generadas son OPACAS: no dejan pasar ni visión ni luz**.
 *
 * 🟡 Esto es SÓLO la geometría, y está aparte a propósito: la pantalla del generador no existe todavía porque
 * el spec está sin confirmar y no hay diseño en `rolvium.pen`. Lo que hay aquí no depende de ninguna de esas
 * decisiones —un rectángulo tiene cuatro lados se pinte el botón como se pinte—, así que se puede construir y
 * probar hoy sin comprometer nada de lo que él decida mañana.
 *
 * 🔑 **Una habitación NO es una entidad nueva: es un atajo que produce MUROS de los de siempre.** Un muro
 * normal ya es exactamente lo que pidió (`blocksSight` y `blocksMove` en cierto) y las luces ya se recortan
 * contra él, así que lo generado se edita, se abre, se parte y se borra con todo lo que ya existe — y no hace
 * falta ninguna tabla nueva ni ninguna migración.
 */

/** Un lado de una habitación, en px de escena. Es literalmente la forma de un muro de `maps_walls`. */
export interface RoomSide { x1: number; y1: number; x2: number; y2: number }

/** Las formas que sabe montar hoy. Si él pide más (pasillo, cruz…), se añaden aquí. */
export type RoomKind = 'rect' | 'circle';
export const ROOM_KINDS: RoomKind[] = ['rect', 'circle'];

/**
 * Lo más pequeño que puede ser una habitación, en casillas. Por debajo de una casilla no es una sala: es un
 * resbalón del ratón, y montar cuatro muros de dos píxeles sólo deja basura que hay que borrar a mano.
 */
export const MIN_ROOM_CELLS = 1;

/**
 * El lado del rectángulo que va de `a` a `b`, pegado a la rejilla y siempre bien orientado — se dibuje de la
 * esquina que se dibuje. Los cuatro lados se devuelven en orden, dando la vuelta: arriba, derecha, abajo,
 * izquierda. Cerrar el circuito importa, porque una sala con un lado suelto no detiene ni la vista ni el paso.
 */
function rectSides(a: Point, b: Point, grid: number): RoomSide[] {
  const x1 = snap(Math.min(a.x, b.x), grid);
  const y1 = snap(Math.min(a.y, b.y), grid);
  const x2 = snap(Math.max(a.x, b.x), grid);
  const y2 = snap(Math.max(a.y, b.y), grid);
  if (x2 - x1 < grid * MIN_ROOM_CELLS || y2 - y1 < grid * MIN_ROOM_CELLS) return [];
  return [
    { x1, y1, x2, y2: y1 },
    { x1: x2, y1, x2, y2 },
    { x1: x2, y1: y2, x2: x1, y2 },
    { x1, y1: y2, x2: x1, y2: y1 },
  ];
}

/**
 * Cuántos lados tiene un círculo. Un círculo de verdad no existe en un mapa de muros: se aproxima con un
 * polígono, y el número de lados sale del TAMAÑO, no de un número fijo — con lados fijos una sala pequeña
 * sale con esquinas de más (y cada muro cuesta en el cálculo de visión) y una enorme sale como un hexágono.
 * El criterio es que cada lado mida más o menos una casilla, con topes para no pasarse por ningún extremo.
 */
export function circleSegments(radius: number, grid: number): number {
  const bySize = Math.round((2 * Math.PI * radius) / grid);
  return Math.max(8, Math.min(48, bySize));
}

/**
 * El polígono de la habitación redonda. El radio se pega a la rejilla —no el centro, que es donde él pinchó—
 * para que dos círculos del mismo tamaño salgan idénticos y encajen entre sí.
 */
function circleSides(center: Point, edge: Point, grid: number): RoomSide[] {
  const radius = snap(Math.hypot(edge.x - center.x, edge.y - center.y), grid);
  if (radius < grid * MIN_ROOM_CELLS) return [];
  const n = circleSegments(radius, grid);
  const at = (i: number): Point => ({
    x: center.x + radius * Math.cos((2 * Math.PI * i) / n),
    y: center.y + radius * Math.sin((2 * Math.PI * i) / n),
  });
  return Array.from({ length: n }, (_, i) => {
    const p = at(i);
    const q = at((i + 1) % n);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  });
}

/**
 * LA HABITACIÓN, EN MUROS. `a` es donde empezó el gesto y `b` donde acabó: en un rectángulo son dos esquinas
 * opuestas; en un círculo, el centro y un punto del borde.
 *
 * Devuelve la lista vacía si el gesto es demasiado pequeño para ser una sala — quien llame a esto no tiene que
 * acordarse de comprobarlo, y así un clic sin arrastre no ensucia la escena con muros diminutos.
 */
export function roomSides(kind: RoomKind, a: Point, b: Point, grid: number): RoomSide[] {
  return kind === 'circle' ? circleSides(a, b, grid) : rectSides(a, b, grid);
}

/**
 * ¿Encierra de verdad? Una sala vale si sus lados forman un circuito cerrado: el final de cada uno es el
 * principio del siguiente, y el último vuelve al primero. Existe para que un test lo sujete — un hueco de un
 * píxel no se ve en pantalla, pero por ahí se cuela la visión y la habitación deja de ser una habitación.
 */
export function isClosed(sides: RoomSide[]): boolean {
  if (sides.length < 3) return false;
  const same = (ax: number, ay: number, bx: number, by: number): boolean => Math.abs(ax - bx) < 0.001 && Math.abs(ay - by) < 0.001;
  return sides.every((s, i) => {
    const next = sides[(i + 1) % sides.length]!;
    return same(s.x2, s.y2, next.x1, next.y1);
  });
}

/**
 * LAS FORMAS DE BUILDER (corrección suya del 2026-09-02: «rectángulos y círculos te quedas corto: ¿y si
 * quiero poner una pared inclinada?»).
 *
 * `segment` es el Builder de siempre —clic a clic, encadenando— y NO pasa por este motor: se queda tal cual
 * está, que es lo que él pidió que no se tocara. Las otras cuatro sí montan la sala de una vez.
 */
export type RoomShape = 'segment' | 'rect' | 'circle' | 'poly' | 'free';
export const ROOM_SHAPES: RoomShape[] = ['segment', 'rect', 'circle', 'poly', 'free'];
/** Se dibujan arrastrando de un punto a otro. */
export const isDragShape = (s: RoomShape): s is 'rect' | 'circle' => s === 'rect' || s === 'circle';
/** Se dibujan encadenando puntos: el polígono a clics, el pulso arrastrando. */
export const isPathShape = (s: RoomShape): s is 'poly' | 'free' => s === 'poly' || s === 'free';

/** Menos de tres vértices no encierran nada: son una línea, y una línea no es una habitación. */
export const MIN_RING_POINTS = 3;

/** El anillo de puntos, convertido en lados. El último cierra contra el primero — sin eso no es una sala. */
function ringSides(ring: Point[]): RoomSide[] {
  if (ring.length < MIN_RING_POINTS) return [];
  return ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  });
}

/** Quita los puntos repetidos seguidos: dos clics en el mismo sitio no son dos vértices. */
function dedupe(points: Point[], epsilon: number): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > epsilon) out.push(p);
  }
  // Cerrar es trabajo de `ringSides`: si el último coincide con el primero, sobra.
  while (out.length > 1 && Math.hypot(out[0]!.x - out[out.length - 1]!.x, out[0]!.y - out[out.length - 1]!.y) <= epsilon) out.pop();
  return out;
}

/** Distancia del punto `p` a la recta `a`-`b`. Sirve para saber si un vértice está de más. */
function distanceToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/**
 * ¿Encierra superficie? Tres puntos en línea recta pasan todas las comprobaciones de arriba y aun así no son
 * una habitación. El área del polígono (fórmula del cordón de zapato) lo dice de una vez.
 */
function enclosesArea(ring: Point[], grid: number): boolean {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    twice += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twice) / 2 >= grid * grid * MIN_ROOM_CELLS;
}

/**
 * POLÍGONO — la habitación de N lados, y la respuesta a su «¿y si quiero poner una pared inclinada?».
 *
 * Los VÉRTICES se pegan a la rejilla; los LADOS no. Así una pared puede ir a cualquier ángulo (que es lo que
 * él pedía) y a la vez dos salas contiguas encajan sin dejar rendijas de medio píxel por donde se cuela la
 * visión — que es para lo que servía pegarse a la rejilla.
 */
export function polygonSides(points: Point[], grid: number): RoomSide[] {
  const ring = dedupe(points.map(p => ({ x: snap(p.x, grid), y: snap(p.y, grid) })), grid / 2);
  if (ring.length < MIN_RING_POINTS || !enclosesArea(ring, grid)) return [];
  return ringSides(ring);
}

/**
 * A PULSO — se arrastra y la sala sale con la forma de la mano.
 *
 * Aquí NO se pega a la rejilla: la gracia de dibujar a pulso es justamente no estar cuadriculado, y un trazo
 * libre pegado a la rejilla sale como una escalera. Lo que sí se hace es limpiar el temblor: el ratón manda
 * cientos de puntos y cada uno sería un muro más que calcular en cada refresco de la visión.
 */
export function freehandSides(points: Point[], grid: number): RoomSide[] {
  const ring = simplifyRing(dedupe(points, grid / 4), grid / 3);
  if (ring.length < MIN_RING_POINTS || !enclosesArea(ring, grid)) return [];
  return ringSides(ring);
}

/**
 * RAMER–DOUGLAS–PEUCKER sobre una polilínea ABIERTA. Conserva los dos extremos y, entre ellos, sólo los
 * vértices que de verdad cambian la forma: se busca el punto que más se sale de la cuerda que une los
 * extremos, y si se sale menos de `flatness` TODO el tramo se sustituye por esa cuerda.
 *
 * 🔑 La diferencia con medir «contra los dos vecinos inmediatos» es justamente lo que hacía falta: en una
 * curva suave cada punto está casi encima de la recta que forman sus vecinos, así que ese criterio no quita
 * ninguno —o los quita todos— y el trazo entero se convierte en muros. Medido contra la cuerda del tramo
 * COMPLETO, una curva se resuelve en los pocos vértices que hacen falta para no deformarla.
 */
function simplifyPath(points: Point[], flatness: number): Point[] {
  if (points.length < 3) return [...points];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let farIndex = -1;
  let farDist = flatness;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToLine(points[i]!, first, last);
    if (d > farDist) { farDist = d; farIndex = i; }
  }
  if (farIndex < 0) return [first, last];
  const head = simplifyPath(points.slice(0, farIndex + 1), flatness);
  const tail = simplifyPath(points.slice(farIndex), flatness);
  // El punto lejano está en los dos tramos: es el final del primero y el principio del segundo.
  return [...head.slice(0, -1), ...tail];
}

/**
 * Quita los vértices que no cambian la forma. Sin esto, «a pulso» deja cientos de muros por sala: con la
 * rejilla en 27, un círculo de radio 4 casillas trazado a mano escribía 85 muros; de 15 casillas, 318. Y cada
 * muro es una fila permanente contra la que el motor de visión traza rayos en cada refresco, para cada jugador.
 *
 * Un ANILLO no tiene extremos, y RDP los necesita para tener contra qué medir. Se parte por dos anclas que la
 * simplificación no puede mover: el primer punto y el más lejano a él —los dos cabos de la forma—, y cada
 * mitad se simplifica por separado.
 *
 * ⚠️ Puede devolver menos de tres puntos, y debe: un trazo que se resuelve en dos vértices es una raya, no una
 * habitación, y `freehandSides` lo rechaza. Devolver aquí el trazo crudo «por si acaso» era precisamente lo
 * que dejaba sin tope el número de muros.
 */
export function simplifyRing(ring: Point[], flatness: number): Point[] {
  if (ring.length <= MIN_RING_POINTS) return ring;
  const start = ring[0]!;
  let farIndex = 0;
  let farDist = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i]!.x - start.x, ring[i]!.y - start.y);
    if (d > farDist) { farDist = d; farIndex = i; }
  }
  const head = simplifyPath(ring.slice(0, farIndex + 1), flatness);
  const tail = simplifyPath([...ring.slice(farIndex), start], flatness);
  // `head` acaba en el ancla lejana y `tail` vuelve al principio: se quitan los dos puntos repetidos.
  return [...head.slice(0, -1), ...tail.slice(0, -1)];
}
