import { snapStep, type Point } from './mapRules';

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
 * LO MÁS PEQUEÑO QUE PUEDE SER CUALQUIER COSA LEVANTADA AQUÍ, en casillas.
 *
 * Fallo suyo del 2026-09-04: «*si hago click para crear un muro muy cerca de otro muro no me deja ponerlo, es
 * como que hay un límite que has puesto*». Lo había. Un tabique mide una fracción de casilla —el grosor de la
 * escena ronda un quinto— así que pedirle una casilla entera era pedirle que no fuera un muro.
 *
 * Sigue habiendo un mínimo, porque un clic sin arrastre es un resbalón del ratón y no un tabique; sólo que el
 * mínimo es el grosor de un muro y no una casilla entera.
 */
export const MIN_FILL_CELLS = 0.1;

/**
 * …Y UNA SALA MIDE LO MISMO QUE UN MURO. Decisión suya del 2026-09-04, con el fallo delante: se le enseñó que
 * una sala tenía que ocupar UNA casilla entera de lado y que por debajo de eso no aparecía nada ni se le
 * avisaba, y eligió «*tan pequeña como un Muro*» sabiendo lo que cuesta —un resbalón puede dejarle una sala
 * diminuta que tendrá que borrar—. Antes valía 1, y por eso un hueco estrecho entre dos salas no se podía
 * rellenar con otra sala.
 *
 * Es el MISMO número a propósito: dos constantes distintas para la misma regla es cómo vuelve el fallo.
 */
export const MIN_ROOM_CELLS = MIN_FILL_CELLS;

/**
 * El lado del rectángulo que va de `a` a `b`, pegado a la rejilla y siempre bien orientado — se dibuje de la
 * esquina que se dibuje. Los cuatro lados se devuelven en orden, dando la vuelta: arriba, derecha, abajo,
 * izquierda. Cerrar el circuito importa, porque una sala con un lado suelto no detiene ni la vista ni el paso.
 *
 * Con el candado abierto (`step` a 0) no se redondea nada; `grid` sigue siendo el metro con el que se mide si
 * la sala es demasiado pequeña, que eso no depende del candado.
 */
function rectSides(a: Point, b: Point, grid: number, step: number, min: number): RoomSide[] {
  const x1 = snapStep(Math.min(a.x, b.x), step);
  const y1 = snapStep(Math.min(a.y, b.y), step);
  const x2 = snapStep(Math.max(a.x, b.x), step);
  const y2 = snapStep(Math.max(a.y, b.y), step);
  if (x2 - x1 < grid * min || y2 - y1 < grid * min) return [];
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
 * para que dos círculos del mismo tamaño salgan idénticos y encajen entre sí. Con el candado abierto el radio
 * es el que salga del gesto.
 */
function circleSides(center: Point, edge: Point, grid: number, step: number, min: number): RoomSide[] {
  const radius = snapStep(Math.hypot(edge.x - center.x, edge.y - center.y), step);
  if (radius < grid * min) return [];
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
export function roomSides(kind: RoomKind, a: Point, b: Point, grid: number, step: number = grid, min: number = MIN_ROOM_CELLS): RoomSide[] {
  return kind === 'circle' ? circleSides(a, b, grid, step, min) : rectSides(a, b, grid, step, min);
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
 * LAS DOS MANERAS DE TRABAJAR, Y CONVIVEN (diseño v3 · `rolvium.pen` frames `ePNCc` y `zpsjH`).
 *
 * `photo` = marcar los muros ENCIMA de una foto que ya trae el suelo pintado. `draw` = levantar aquí la sala.
 * Es lo primero del panel porque mezclarlas fue el fallo de la sesión anterior: se le preguntaba por salas
 * mientras él marcaba muros sobre una foto («*estás mezclando estas dos opciones*», 2026-09-03).
 *
 * ⚠️ Hoy el interruptor NO cambia lo que hacen muro, puerta, ventana ni las formas: en el diseño son iguales
 * en los dos modos. Lo que cambia es qué OFRECE el panel — los preajustes y las dos texturas base sólo tienen
 * sentido dibujando aquí, porque marcando sobre una foto el suelo ya lo pone la foto. Esas secciones están sin
 * construir a propósito (piden tabla de habitaciones + migración + DBA), y este interruptor es su sitio.
 */
export type BuilderMode = 'photo' | 'draw';
export const BUILDER_MODES: BuilderMode[] = ['photo', 'draw'];

/**
 * LAS FORMAS DE BUILDER (corrección suya del 2026-09-02: «rectángulos y círculos te quedas corto: ¿y si
 * quiero poner una pared inclinada?»).
 *
 * `segment` es el Builder de siempre —clic a clic, encadenando— y NO pasa por este motor: se queda tal cual
 * está, que es lo que él pidió que no se tocara. Las otras cuatro sí montan la sala de una vez.
 */
export type RoomShape = 'segment' | 'line' | 'rect' | 'circle' | 'poly' | 'free';
/**
 * En el orden del diseño v3, que se lee en dos filas de tres: a mano · recta · rectángulo, y debajo
 * círculo · polígono · a pulso.
 */
export const ROOM_SHAPES: RoomShape[] = ['segment', 'line', 'rect', 'circle', 'poly', 'free'];
/** Se dibujan arrastrando de un punto a otro y sale una SALA (cerrada). */
export const isDragShape = (s: RoomShape): s is 'rect' | 'circle' => s === 'rect' || s === 'circle';
/**
 * LA RECTA SUELTA — la sexta forma del diseño, y la única que no monta una sala: sale UN muro y sólo uno.
 *
 * Es la hermana de «a mano»: lo mismo, pero de un tirón en vez de clic a clic. Existe porque una pared sola
 * —el tabique de un pasillo, la valla de un corral— no es una habitación, y encadenar a clics para poner un
 * único muro obliga a acordarse de cortar la cadena con Escape.
 */
export const isLineShape = (s: RoomShape): s is 'line' => s === 'line';
/** Se dibujan encadenando puntos: el polígono a clics, el pulso arrastrando. */
export const isPathShape = (s: RoomShape): s is 'poly' | 'free' => s === 'poly' || s === 'free';

/** Menos de tres vértices no encierran nada: son una línea, y una línea no es una habitación. */
export const MIN_RING_POINTS = 3;

/**
 * Lo más corto que puede ser una recta suelta, en casillas. Por debajo de media casilla no es una pared: es
 * un resbalón del ratón, y un muro de tres píxeles sólo deja basura que hay que buscar para borrar.
 */
export const MIN_LINE_CELLS = 0.5;

/**
 * LA RECTA SUELTA, en un muro. `a` y `b` llegan YA resueltos por el candado (`snapRules.builderPoint`), igual
 * que los dos clics del Builder de siempre: aquí sólo se decide si el gesto da para una pared.
 *
 * Devuelve `null` si es demasiado corta, así que quien llame a esto no tiene que acordarse de comprobarlo —
 * y un clic sin arrastre no ensucia la escena.
 */
export function lineSide(a: Point, b: Point, grid: number, min: number = MIN_LINE_CELLS): RoomSide | null {
  if (Math.hypot(b.x - a.x, b.y - a.y) < grid * min) return null;
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

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
function enclosesArea(ring: Point[], grid: number, min: number): boolean {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    twice += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twice) / 2 >= grid * grid * min;
}

/**
 * POLÍGONO — la habitación de N lados, y la respuesta a su «¿y si quiero poner una pared inclinada?».
 *
 * ⚠️ **HOY NO LLEGA NINGUNA PANTALLA AQUÍ, y es a propósito.** El 2026-09-10 él mandó que el botón «Polígono»
 * pasara a ser el TRAZO LIBRE CERRADO —«*quiero que lo que hoy es a pulso lo pongas en polígono*»—, así que
 * los vértices a clics ya no se ponen desde ninguna parte. El motor se queda porque es la única forma de
 * volver a ofrecer ese gesto el día que lo pida, y porque sus tests son lo que impide que se pudra.
 *
 * Los VÉRTICES se pegan a la rejilla (con el candado cerrado); los LADOS no. Así una pared puede ir a cualquier ángulo (que es lo que
 * él pedía) y a la vez dos salas contiguas encajan sin dejar rendijas de medio píxel por donde se cuela la
 * visión — que es para lo que servía pegarse a la rejilla.
 */
export function polygonSides(points: Point[], grid: number, step: number = grid, min: number = MIN_ROOM_CELLS): RoomSide[] {
  const ring = dedupe(points.map(p => ({ x: snapStep(p.x, step), y: snapStep(p.y, step) })), grid / 2);
  if (ring.length < MIN_RING_POINTS || !enclosesArea(ring, grid, min)) return [];
  return ringSides(ring);
}

/**
 * A PULSO — se arrastra y la sala sale con la forma de la mano.
 *
 * Aquí NO se pega a la rejilla: la gracia de dibujar a pulso es justamente no estar cuadriculado, y un trazo
 * libre pegado a la rejilla sale como una escalera. Lo que sí se hace es limpiar el temblor: el ratón manda
 * cientos de puntos y cada uno sería un muro más que calcular en cada refresco de la visión.
 */
export function freehandSides(points: Point[], grid: number, min: number = MIN_ROOM_CELLS): RoomSide[] {
  const ring = simplifyRing(dedupe(points, grid / 4), grid / 3);
  if (ring.length < MIN_RING_POINTS || !enclosesArea(ring, grid, min)) return [];
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

/**
 * QUÉ LEVANTA EL GESTO EN EL MODO «DIBUJAR AQUÍ» (petición suya del 2026-09-04: «*así como genero
 * habitaciones necesito generar muros para corregir o lo que sea*»).
 *
 * 🔑 Y la clave es suya, literal: «*hoy tomamos como que las habitaciones son huecos en el muro, entonces los
 * muros serán relleno de esos huecos*». Así que son las mismas formas con el signo cambiado:
 *
 *  · `room`   — EXCAVA. Abre el hueco por el que se ve el suelo. Es lo que había hasta hoy.
 *  · `wall`   — RELLENA. Devuelve roca: un tabique, un pilar, o corregir un borde que quedó torcido.
 *  · `door` / `window` — abren un VANO sobre el contorno, con el mismo gesto de siempre.
 *
 * En «sobre una foto» esta lista no aparece: allí manda `WALL_KINDS`, que no se ha tocado.
 */
export type BuildKind = 'room' | 'wall' | 'door' | 'window';
export const BUILD_KINDS: BuildKind[] = ['room', 'wall', 'door', 'window'];
/** Los dos que abren un hueco en una pared que ya existe, en vez de levantar geometría nueva. */
export const isOpeningKind = (k: BuildKind): k is 'door' | 'window' => k === 'door' || k === 'window';

/**
 * UN MURO DIBUJADO DE UN TRAZO, como forma que rellena.
 *
 * Una raya no encierra nada, así que no puede rellenar por sí sola: se le da el grosor del muro de la escena y
 * sale el rectángulo que de verdad tapa. `t` es ese grosor en px, el mismo con el que se pinta el canto — así
 * el tabique que él dibuja mide lo mismo que las paredes que ya había.
 *
 * Devuelve la lista vacía si el gesto es demasiado corto para ser una pared, igual que `lineSide`.
 */
export function wallStripe(a: Point, b: Point, t: number, grid: number): [number, number][] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  // 🐞 El mínimo de un RELLENO, no el de una recta marcada sobre una foto (2026-09-04). Aquí seguía el de la
  // foto —media casilla— y por eso un tabique corto seguía sin poder dibujarse aunque el mínimo de las formas
  // ya se hubiera bajado: la raya se caía antes, en este `return []`, y sin decir nada.
  if (len < grid * MIN_FILL_CELLS) return [];
  const nx = (-dy / len) * (t / 2), ny = (dx / len) * (t / 2);
  return [
    [a.x + nx, a.y + ny],
    [b.x + nx, b.y + ny],
    [b.x - nx, b.y - ny],
    [a.x - nx, a.y - ny],
  ];
}

/**
 * QUÉ FORMAS TIENEN SENTIDO PARA LO QUE SE ESTÁ LEVANTANDO (pega suya del 2026-09-04, mirando el panel con
 * SALA elegida: «*esto, a mano, pulso y recta aquí no hace falta, ¿no?*»).
 *
 * Tenía razón en lo que importa: **una raya no encierra nada, así que no puede ser una sala**. Enseñar el
 * botón igualmente es prometer un gesto que no va a hacer nada.
 *
 *  · `room` — sólo las CUATRO que encierran área: rectángulo, círculo, polígono y a pulso. «A mano» y «recta»
 *    no cierran, así que se caen.
 *  · `wall` — LAS SEIS. Una raya sí es un muro (se le da el grosor de la escena, `wallStripe`) y un área es un
 *    bloque de roca. Es donde «a mano» y «recta» son de verdad útiles: corregir un borde, cerrar un pasillo.
 *  · `door` / `window` — sólo las dos que TRAZAN una raya: un vano se abre cruzando la pared, no rodeándola.
 */
export function shapesFor(kind: BuildKind): RoomShape[] {
  if (isOpeningKind(kind)) return ['segment', 'line'];
  if (kind === 'wall') return ROOM_SHAPES;
  return ['rect', 'circle', 'poly', 'free'];
}

/** La forma con la que arranca cada cosa, y a la que se cae si la elegida deja de tener sentido. */
export const defaultShapeFor = (kind: BuildKind): RoomShape => (isOpeningKind(kind) ? 'line' : 'rect');

// ── EL PINCEL QUE CONSTRUYE (rebanada 10) ────────────────────────────────────

/**
 * EL ANCHO DEL PINCEL, EN CASILLAS. Los mismos topes que el pincel de la rebanada 9, y por lo mismo: por
 * debajo de un quinto de casilla el trazo no se ve, y por encima de seis un brochazo tapa media escena.
 */
export const BRUSH_MIN_CELLS = 0.2;
export const BRUSH_MAX_CELLS = 6;

/**
 * Cuántos puntos tiene el redondeo de una esquina o de una punta. Ocho por media vuelta basta: el anillo se
 * guarda en la base y cada vértice es un lado contra el que el motor de visión traza rayos.
 */
const CAP_STEPS = 8;

/**
 * A PARTIR DE QUÉ GIRO SE PARTE EL BROCHAZO EN DOS PIEZAS.
 *
 * 🔑 Y por qué se parte, que es lo único no obvio de todo esto. Un brochazo se guarda como UN anillo: el
 * trazo engordado a un lado y al otro. En un giro más cerrado que el propio ancho del pincel, el lado de
 * DENTRO se cruza consigo mismo, y `pointInRing` cuenta cruces —par o impar—, así que ese cruce sale como un
 * AGUJERO de roca dentro del brochazo. Un lunar de pared en medio de un pasillo, que se lee como un fallo.
 *
 * Partir en la esquina lo evita sin ninguna geometría fina: salen dos piezas que se solapan en el codo, y
 * fundirse al solaparse es exactamente lo que el motor de salas ya hace desde la rebanada 8.
 */
const SPLIT_ANGLE = Math.PI / 2;

const norm = (dx: number, dy: number): Point => {
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
};

/**
 * Los puntos del semicírculo que cierra una punta del trazo. Sale del lado IZQUIERDO —el offset a `+90°` de
 * la marcha— y gira **hacia atrás en ángulo**, para pasar por delante de la punta y morir en el lado derecho.
 *
 * 🐞 Girando al revés el arco pasa por DETRÁS: el anillo se cruza consigo mismo como un lazo y el trazo deja
 * de encerrar su propio camino. Lo sujeta el test «el anillo ENVUELVE el trazo».
 */
function cap(centre: Point, r: number, forward: number): Point[] {
  const from = forward + Math.PI / 2;
  return Array.from({ length: CAP_STEPS + 1 }, (_, i) => {
    const a = from - (Math.PI * i) / CAP_STEPS;
    return { x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r };
  });
}

/** Un solo tramo de trazo, ya sin codos cerrados, engordado a `r` por cada lado y cerrado por las puntas. */
function ringOfRun(run: Point[], r: number): Point[] {
  if (run.length < 2) {
    // Un toque sin arrastre es un disco: se pinta igual que en cualquier programa de dibujo.
    const c = run[0]!;
    return [...cap(c, r, 0), ...cap(c, r, Math.PI)];
  }
  const izq: Point[] = [], der: Point[] = [];
  for (let i = 0; i < run.length - 1; i++) {
    const a = run[i]!, b = run[i + 1]!;
    const n = norm(-(b.y - a.y), b.x - a.x);
    for (const p of [a, b]) {
      izq.push({ x: p.x + n.x * r, y: p.y + n.y * r });
      der.push({ x: p.x - n.x * r, y: p.y - n.y * r });
    }
  }
  const first = run[0]!, last = run[run.length - 1]!;
  const aIni = Math.atan2(first.y - run[1]!.y, first.x - run[1]!.x);
  const aFin = Math.atan2(last.y - run[run.length - 2]!.y, last.x - run[run.length - 2]!.x);
  // Ida por un lado, media vuelta en la punta, vuelta por el otro, y media vuelta en el arranque.
  return [...izq, ...cap(last, r, aFin), ...der.reverse(), ...cap(first, r, aIni)];
}

/**
 * EL TRAZO DEL PINCEL, CONVERTIDO EN FORMAS (§ «Rebanada 10»).
 *
 * Devuelve **uno o varios anillos**, en las mismas coordenadas de escena que cualquier otra forma de
 * `maps_rooms`. Varios sólo cuando el trazo dobla más cerrado que su propio ancho — ver `SPLIT_ANGLE`.
 *
 * El trazo se limpia antes: se quitan los puntos pegados y se simplifica contra la cuerda del tramo, que es
 * lo que evita que un arrastre a pulso deje cientos de vértices. Cada vértice de estos anillos acaba siendo
 * un lado contra el que el servidor traza rayos en cada refresco de visión, para cada jugador.
 */
export function brushRings(path: Point[], widthCells: number, grid: number): [number, number][][] {
  if (path.length === 0) return [];
  const r = (Math.min(BRUSH_MAX_CELLS, Math.max(BRUSH_MIN_CELLS, widthCells)) * grid) / 2;
  const limpio = simplifyPath(dedupe(path, r / 2), r / 2);
  if (limpio.length === 1) return [ringOfRun(limpio, r).map(p => [p.x, p.y] as [number, number])];

  // Se corta en los codos cerrados: cada trozo comparte el vértice con el siguiente, así que se solapan y
  // el motor de salas los funde en el codo.
  const runs: Point[][] = [];
  let run: Point[] = [limpio[0]!];
  for (let i = 1; i < limpio.length; i++) {
    run.push(limpio[i]!);
    const prev = limpio[i - 1]!, cur = limpio[i]!, next = limpio[i + 1];
    if (!next) break;
    const a = norm(cur.x - prev.x, cur.y - prev.y);
    const b = norm(next.x - cur.x, next.y - cur.y);
    const giro = Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y)));
    if (giro > SPLIT_ANGLE) { runs.push(run); run = [cur]; }
  }
  runs.push(run);
  return runs.filter(x => x.length > 0).map(x => ringOfRun(x, r).map(p => [p.x, p.y] as [number, number]));
}

// ── LOS COLORES CON LOS QUE SE PINTA (§ «Rebanada 10») ──
//
// 🔴 Aquí vivían además `BuildTarget`, `BRUSH_PAINTS`, `BRUSH_ON` y `isBuildOn`: la lista de «sobre qué» y
// «con qué» del pincel que EXCAVABA. Él lo paró en pantalla el 2026-09-10 («*eso es cavar con construir, que
// no es lo que te pedí*») y esa mitad se mudó al Builder, donde la elección de siempre —muro o habitación—
// ya existía. Se quitaron al mudarlas para que nadie las vuelva a cablear a un pincel: **este pincel no
// levanta mapa**. La lista del pincel de hoy vive en `paintRules.ts`.

/**
 * LA PALETA BASE DE LA CASA (`rolvium.pen` · `M9zw2t` § «EL COLOR»): doce, en dos filas de seis.
 *
 * Son DATO y no tema: se guardan tal cual en `maps_rooms.floor_color` y se ven sobre la MESA, que va con los
 * `--sys-*` del sistema de juego y no con los tokens de la app. Mismo caso —y mismo porqué— que
 * `STROKE_COLORS`, `BG_COLORS` y `DOOR_COLORS`.
 *
 * El orden es el del diseño: los grises de piedra, las maderas y tierras, y al final los tres que cantan —
 * musgo, agua y sangre—, que son los que se usan para marcar algo, no para levantar una sala entera.
 *
 * ⚠️ Los colores que él se INVENTE no viven aquí: ésos son fila de `maps_colors`, por campaña.
 */
export const BRUSH_COLORS = [
  { hex: '#8a8f98', name: 'steel' },
  { hex: '#5c6470', name: 'slate' },
  { hex: '#2f3338', name: 'coal' },
  { hex: '#1a1c1f', name: 'obsidian' },
  { hex: '#b08d57', name: 'sand' },
  { hex: '#8b5a2b', name: 'leather' },
  { hex: '#4a3524', name: 'earth' },
  { hex: '#6e5a3a', name: 'mud' },
  { hex: '#5f8f6a', name: 'moss' },
  { hex: '#4a7fc0', name: 'water' },
  { hex: '#7fd4d0', name: 'ice' },
  { hex: '#b8452c', name: 'blood' },
] as const;

/** Con qué color arranca el pincel: la arena del diseño, que es la que se ve en la lámina aprobada. */
export const DEFAULT_BRUSH_COLOR = '#b08d57';

/**
 * Un color escrito a mano vale si es un hex de seis. Se comprueba antes de guardarlo porque la base NO lo
 * comprueba —a propósito, igual que en `bg_color` y `door_color`: un patrón allí sólo serviría para rechazar
 * un color válido escrito de otra manera— así que el filtro tiene que estar donde se teclea.
 */
export const isHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);

/** Cómo se llama un color de la paleta base, si es uno de ellos. `null` = se lo inventó él. */
export const brushColorName = (hex: string): string | null =>
  BRUSH_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? null;

