// ─── Maps (H7) · Rebanada 8 — EL MOTOR DE UNIÓN DE LAS SALAS ─────────────────
// specs/modules/maps/SPEC.md § «Cómo se levanta una sala».
//
// 🔑 LO QUE HAY QUE ENTENDER ANTES DE LEER UNA LÍNEA: las salas SE FUNDEN, nunca
// se apilan («*si hago otro rectángulo y se solapa que se fusione dando la nueva
// forma… si se tocan se solapan*», dueño 2026-09-04). El muro compartido
// DESAPARECE, y el muro de verdad es el CONTORNO DE LA UNIÓN.
//
// Y cada forma se sigue recordando por separado —elección suya—, así que la
// unión se CALCULA y no se destruye: se puede coger un rectángulo, moverlo o
// borrarlo, y las demás recuperan su forma.
//
// ⚠️ POR QUÉ ESTO VIVE EN `@rolvium/core` Y NO EN EL NAVEGADOR: lo necesitan los
// DOS lados y tienen que sacar EXACTAMENTE el mismo contorno. El navegador, para
// pintar la roca, el suelo y el muro; el servidor, para la visión, las
// colisiones y el recorte de las luces (§ «Los muros de una sala NO son los
// muros de siempre»). Dos implementaciones parecidas darían una sala que se ve
// de una forma y tapa de otra, y ese fallo no se ve hasta que alguien juega.
//
// POR QUÉ NO ES UN «BOOLEAN OP» COMPLETO NI HACE FALTA QUE LO SEA: no se
// necesita el POLÍGONO de la unión, sólo su BORDE — y para pintar, el SVG ya
// funde solo (una máscara con N formas en blanco es su unión, superpuestas o
// no). El borde sale de una regla de tres pasos, corta y comprobable:
//
//   1 · se parte cada lado por donde lo cruza —o lo toca— cualquier otro;
//   2 · un trozo que cae DENTRO de otra forma no es borde (está tapado);
//   3 · un trozo que COINCIDE con el de otra forma tampoco (es el tabique
//       compartido de dos salas pegadas, y por ahí se pasa).
//
// Lo que sobrevive es exactamente el contorno de la unión. Sin barridos, sin
// árboles de eventos y sin las mil esquinas donde un algoritmo general se rompe
// con un trazo a pulso que se cruza a sí mismo.

import type { BlockSegment, ScenePoint } from './maps';

/** El anillo de una forma, en px de escena. Cerrado implícitamente: el último punto vuelve al primero. */
export type RoomRing = readonly ScenePoint[];

/**
 * UNA FORMA DEL MAPA, con lo único que la distingue: si EXCAVA o si RELLENA.
 *
 * 🔑 Y VAN EN ORDEN DE LLEGADA, que es la parte que importa. Un mapa se construye como se pinta: cada forma
 * manda sobre lo que ya había debajo. Excavar una sala encima de un muro la abre; levantar un muro encima de
 * una sala la tapa. Resolverlo como «todo lo excavado menos todo lo rellenado» hacía que un muro ganara
 * SIEMPRE, dibujara él lo que dibujara después — y eso no es lo que hace ninguna herramienta de dibujo.
 */
export interface RoomPart { ring: RoomRing; dig: boolean }

/** Atajos para escribir una lista de formas a mano (tests, y quien construya un mapa de una tacada). */
export const digs = (...rings: RoomRing[]): RoomPart[] => rings.map(ring => ({ ring, dig: true }));
export const fills = (...rings: RoomRing[]): RoomPart[] => rings.map(ring => ({ ring, dig: false }));

/** Un vano anotado SOBRE el contorno: de dónde a dónde, y qué es. No parte ninguna fila — no hay fila. */
export interface RoomOpeningSpan {
  /**
   * De qué vano salió, para que quien pinta pueda recuperar CÓMO es esa puerta (hojas, bisagra, lado,
   * color). Opcional: el cálculo de visión no lo necesita y quien sólo quiere muros no tiene que inventarlo.
   */
  id?: string;
  x1: number; y1: number; x2: number; y2: number;
  kind: 'door' | 'window';
  isOpen: boolean;
}

/**
 * Un tramo del contorno ya resuelto: o es muro, o es el vano que él abrió encima.
 * `kind: 'wall'` es la roca; los otros dos son la puerta y la ventana, con el mismo significado de siempre.
 */
export interface RoomWall {
  seg: BlockSegment;
  kind: 'wall' | 'door' | 'window';
  isOpen: boolean;
  /** El vano del que salió este tramo, si salió de uno. La roca entre dos vanos no lleva ninguno. */
  openingId?: string;
  /**
   * Una PUERTA que NO cae sobre el contorno sino que CIERRA UN PASO, de una pared a la de enfrente (§ `roomWalls`).
   * Tapa y frena como cualquier otra, pero no es un tramo de pared: quien dibuja el contorno no lo pinta como roca.
   */
  offOutline?: true;
}

/**
 * La tolerancia con la que dos puntos son «el mismo punto», en px de escena.
 *
 * No es un epsilon de coma flotante (sería 1e-9): es un epsilon de DIBUJO. Dos rectángulos que él pega uno
 * al lado del otro con el candado cerrado caen en la misma coordenada exacta, pero uno trazado a pulso cae
 * a un cuarto de píxel — y si eso no cuenta como «se tocan», el tabique compartido no desaparece y la sala
 * fundida sale con una pared en medio. Medio píxel es más fino que cualquier cosa que se vea en pantalla y
 * más grueso que cualquier resbalón del ratón.
 */
export const ROOM_EPS = 0.5;

const near = (a: number, b: number, eps = ROOM_EPS): boolean => Math.abs(a - b) <= eps;
const samePoint = (a: ScenePoint, b: ScenePoint, eps = ROOM_EPS): boolean => near(a.x, b.x, eps) && near(a.y, b.y, eps);

interface Edge { ring: number; a: ScenePoint; b: ScenePoint }

/**
 * El área con signo (fórmula del cordón de zapato). No interesa el área: interesa el SIGNO, que dice hacia
 * qué lado da la vuelta el anillo.
 */
function signedArea(ring: RoomRing): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
    twice += p.x * q.y - q.x * p.y;
  }
  return twice / 2;
}

/**
 * TODOS LOS ANILLOS DAN LA VUELTA EN EL MISMO SENTIDO, y de eso depende el paso 3.
 *
 * Un rectángulo dibujado de la esquina de arriba y otro de la de abajo salen recorridos al revés, y él los
 * dibuja como le viene. Puestos del mismo lado, la dirección de un lado deja de ser un capricho del gesto y
 * pasa a decir algo: **por dónde queda el interior**. Con eso, dos tramos que coinciden se distinguen —y hay
 * que distinguirlos, porque significan cosas opuestas:
 *
 *  - EN SENTIDOS CONTRARIOS = las dos salas están una a cada lado → es un TABIQUE, y por ahí se pasa: fuera.
 *  - EN EL MISMO SENTIDO = las dos están del mismo lado → es el techo común de dos salas solapadas, y eso SÍ
 *    es el borde de la mazmorra: se queda (una sola vez, no dos).
 *
 * Sin esta distinción, dos rectángulos solapados perdían el trozo de techo que compartían y la roca se
 * colaba por dentro de la habitación.
 *
 * 🎨 Y SE EXPORTA porque el DIBUJO lo necesita igual que el cálculo. La máscara SVG que abre los agujeros en
 * la roca mete todas las formas en un mismo camino, y la regla de relleno de SVG cuenta vueltas: dos anillos
 * recorridos al revés se ANULAN donde se solapan y ahí reaparecería un islote de roca dentro de la
 * habitación. Un rectángulo siempre sale bien orientado, pero un polígono o un trazo a pulso salen como él
 * los haya dibujado — así que quien pinta tiene que enderezarlos con esta misma función, no con otra.
 *
 * Menos de tres puntos no encierran nada y se devuelven tal cual: no hay sentido que enderezar.
 */
export const orientRing = (ring: RoomRing): RoomRing =>
  (ring.length >= 3 && signedArea(ring) < 0 ? [...ring].reverse() : ring);

/** Los lados de un anillo, en orden y cerrando contra el primero. Un anillo abierto no encierra nada. */
function ringEdges(ring: RoomRing, index: number): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (!samePoint(a, b, 1e-6)) out.push({ ring: index, a, b });
  }
  return out;
}

/** Distancia de un punto al SEGMENTO `a`-`b` (no a su recta): en un extremo manda el extremo. */
function distToSegment(p: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Dónde cae `p` a lo largo de `a`→`b`, de 0 a 1. Sin recortar: quien llame decide si se sale. */
function paramOf(p: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  return len2 < 1e-12 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

/**
 * ¿Está `p` DENTRO del anillo? Rayo horizontal, y se cuentan las VUELTAS que da el anillo alrededor del punto.
 *
 * 🐞 Antes contaba cruces —par o impar— y así NO pinta SVG, que rellena cada forma por vueltas (su regla de
 * serie). En un anillo normal da igual: cero vueltas o una. Pero un trazo «A pulso» que se CRUZA consigo mismo
 * da DOS vueltas sobre el cruce: SVG lo pintaba de suelo, aquí salía roca, y alrededor del cruce quedaban muros
 * dentro del suelo (suyo, 2026-09-11: «*quedan estas líneas cruzadas, eso no debería pasar*»). Se contesta como
 * se pinta.
 *
 * Devuelve `false` para un punto que esté justo ENCIMA del borde, y eso es a propósito: sobre el borde la
 * cuenta de cruces es una moneda al aire —depende de qué lado del vértice caiga el rayo— y quien pregunta ya
 * ha comprobado antes que el punto no roza el contorno. Aquí sólo se contesta lo que está claramente dentro.
 */
export function pointInRing(p: ScenePoint, ring: RoomRing): boolean {
  let vueltas = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    const crosses = (a.y > p.y) !== (b.y > p.y);
    // El lado va de `b` a `a`: según hacia dónde cruce el rayo, suma una vuelta o la resta.
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) vueltas += a.y > b.y ? 1 : -1;
  }
  return vueltas !== 0;
}

/** ¿Roza `p` el contorno del anillo? Es la pregunta que hace estable a `pointInRing`. */
function onRing(p: ScenePoint, ring: RoomRing, eps = ROOM_EPS): boolean {
  for (let i = 0; i < ring.length; i++) {
    if (distToSegment(p, ring[i]!, ring[(i + 1) % ring.length]!) <= eps) return true;
  }
  return false;
}

/**
 * PASO 1 — por dónde hay que partir este lado.
 *
 * Dos motivos, y hacen falta los dos: donde lo CRUZA un lado de otra forma (dos salas solapadas), y donde cae
 * un VÉRTICE de otra forma (dos salas que se tocan sin cruzarse, o una esquina apoyada en mitad de una
 * pared). Sin el segundo, dos rectángulos pegados por una cara no se parten por los extremos de la cara
 * compartida y el paso 3 no puede reconocer que ese tramo está repetido — el tabique se quedaría puesto.
 *
 * 🐞 Y donde lo cruza un lado de la MISMA forma: un trazo «A pulso» que se cruza consigo mismo (2026-09-11).
 * Sin partir ahí, un lado que entra en el cruce es de muro por una punta y de suelo por la otra, y el paso 2 lo
 * juzga entero por su punto medio: se quedaba un trozo de muro dentro del suelo.
 */
function cutPoints(edge: Edge, others: readonly Edge[]): number[] {
  const ts: number[] = [0, 1];
  const push = (t: number): void => { if (t > 1e-9 && t < 1 - 1e-9) ts.push(t); };
  for (const o of others) {
    if (o === edge) continue;
    // Cruce propio de dos rectas.
    const d1x = edge.b.x - edge.a.x, d1y = edge.b.y - edge.a.y;
    const d2x = o.b.x - o.a.x, d2y = o.b.y - o.a.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) > 1e-12) {
      const ex = o.a.x - edge.a.x, ey = o.a.y - edge.a.y;
      const t = (ex * d2y - ey * d2x) / den;
      const u = (ex * d1y - ey * d1x) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9) push(t);
    }
    // De la misma forma sólo cuenta el cruce: sus vértices los comparten los lados vecinos, y eso no parte nada.
    if (o.ring === edge.ring) continue;
    // Vértices del otro lado que se apoyan en éste (incluye el caso colineal, que es el del tabique).
    for (const p of [o.a, o.b]) {
      if (distToSegment(p, edge.a, edge.b) <= ROOM_EPS) push(paramOf(p, edge.a, edge.b));
    }
  }
  return [...new Set(ts.map(t => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
}

/**
 * ¿Están estos dos tramos UNO ENCIMA DEL OTRO, y en qué sentido? Es la pregunta del paso 3.
 *
 * `null` = no se pisan. Se compara con la tolerancia de DIBUJO (`ROOM_EPS`), no con un epsilon de coma
 * flotante, por lo mismo de siempre: dos salas pegadas a pulso no caen en la misma coordenada exacta.
 */
function overlay(a: BlockSegment, b: BlockSegment): 'forward' | 'reverse' | null {
  const [ax1, ay1, ax2, ay2] = a, [bx1, by1, bx2, by2] = b;
  if (near(ax1, bx1) && near(ay1, by1) && near(ax2, bx2) && near(ay2, by2)) return 'forward';
  if (near(ax1, bx2) && near(ay1, by2) && near(ax2, bx1) && near(ay2, by1)) return 'reverse';
  return null;
}

/**
 * EL CONTORNO — lo que de verdad es el muro de una sala.
 *
 * 🔑 UN MAPA ES UNA LISTA ORDENADA DE FORMAS, cada una excavando o rellenando. Suyo, 2026-09-04: «*hoy
 * tomamos como que las habitaciones son huecos en el muro, entonces los muros serán relleno de esos huecos*».
 * Es la misma idea de siempre llevada hasta el final: la roca lo cubre todo, una sala le quita un trozo y un
 * muro se lo devuelve — y la última que se dibujó manda, como en cualquier herramienta de dibujo.
 *
 * Le entran los anillos de todas las formas de la escena y devuelve los tramos que quedan a la vista. Dos
 * salas solapadas devuelven la silueta de las dos; dos pegadas por una cara devuelven la silueta sin esa
 * cara — que es lo que hace que se lean como una sola habitación y no como dos con un tabique en medio.
 *
 * El coste es el de comparar cada lado con todos los demás. Con las salas que caben en un mapa (decenas de
 * formas, un puñado de lados cada una) son unos miles de comparaciones: nada. Y no crece con el tamaño de la
 * sala, sólo con cuántas hay — un rectángulo de media pantalla sigue teniendo cuatro lados.
 */
export function roomOutline(parts: readonly RoomPart[]): BlockSegment[] {
  const formas = parts.filter(f => f.ring.length >= 3);
  if (!formas.some(f => f.dig)) return [];
  const edges = formas.map(f => f.ring).flatMap(ringEdges);

  /**
   * ¿ESTÁ ESTE PUNTO EN EL VACÍO? Con esta pregunta se define TODO el mapa, y se contesta **como se pinta**:
   * se recorren las formas en el orden en que él las dibujó y manda **la última que lo contiene**. Excavar
   * encima de un muro abre; rellenar encima de una sala tapa.
   *
   * Y hacia qué lado dio la vuelta a cada forma da igual: `pointInRing` no mira el sentido.
   */
  const vacio = (p: ScenePoint): boolean => {
    let dentro = false;
    for (const f of formas) if (pointInRing(p, f.ring)) dentro = f.dig;
    return dentro;
  };

  const kept: BlockSegment[] = [];
  for (const edge of edges) {
    const ts = cutPoints(edge, edges);
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const at = (t: number): ScenePoint => ({ x: edge.a.x + (edge.b.x - edge.a.x) * t, y: edge.a.y + (edge.b.y - edge.a.y) * t });
      const p0 = at(t0), p1 = at(t1);
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      /**
       * PASO 2 — SE PREGUNTA A LOS DOS LADOS, y es toda la regla que queda: un trozo es MURO si a un lado hay
       * vacío y al otro roca. Si los dos lados son iguales no es un borde de nada — da igual que sea el
       * tabique entre dos salas pegadas (vacío a los dos lados), la parte de una sala que otra se tragó, o el
       * lado de un relleno metido en plena roca.
       *
       * Sustituye a las dos reglas que había antes —«tirar lo tapado» y «resolver el montón de repetidos por
       * su sentido»— y hace lo mismo con menos: aquéllas no sabían nada de rellenos y no se podían estirar a
       * ellos sin volver a repartir casos.
       *
       * Tras partir por todos los cruces, un trozo está entero a un lado o entero al otro de cada forma, así
       * que basta mirar su punto medio. Se mira medio píxel a cada lado: más fino que nada que se vea y más
       * grueso que cualquier ruido de coma flotante.
       */
      const mid = at((t0 + t1) / 2);
      const nx = (-dy / len) * ROOM_EPS, ny = (dx / len) * ROOM_EPS;
      if (vacio({ x: mid.x + nx, y: mid.y + ny }) !== vacio({ x: mid.x - nx, y: mid.y - ny })) {
        kept.push([p0.x, p0.y, p1.x, p1.y]);
      }
    }
  }

  /**
   * PASO 3 — el mismo trozo puede llegar por DOS formas a la vez (el techo común de dos salas solapadas), y
   * las dos lo ven igual de bien. Se pinta y se calcula UNA vez: dos copias exactas encima no cambian lo que
   * tapa, pero sí doblan el trabajo del motor de visión en cada refresco.
   */
  const out: BlockSegment[] = [];
  for (const seg of kept) if (!out.some(o => overlay(o, seg))) out.push(seg);
  return out;
}

/**
 * EL CONTORNO CON SUS VANOS (§ «Ninguna puerta automática»).
 *
 * Él abre las puertas con el mismo disco de siempre; lo que cambia es dónde se guarda el agujero — no parte
 * una fila de muro, porque no hay fila: es un TRAMO anotado sobre el contorno. Aquí se cruzan las dos cosas y
 * sale el muro ya troceado: roca · vano · roca.
 *
 * Que el vano se guarde como un tramo en px de escena (y no como «el lado nº 7 de la sala») es lo que lo hace
 * aguantar: él mueve una forma, el contorno se recalcula entero y la puerta sigue donde la puso.
 */
export function roomWalls(parts: readonly RoomPart[], openings: readonly RoomOpeningSpan[] = []): RoomWall[] {
  const outline = roomOutline(parts);
  if (openings.length === 0) return outline.map(seg => ({ seg, kind: 'wall' as const, isOpen: false }));

  const out: RoomWall[] = [];
  /** Los vanos que cayeron SOBRE algún lado. Los demás se miran al final, por si cierran un paso. */
  const sobreUnLado = new Set<RoomOpeningSpan>();
  for (const seg of outline) {
    const a = { x: seg[0], y: seg[1] }, b = { x: seg[2], y: seg[3] };
    /** Los tramos de este lado que un vano se lleva, en parámetro 0→1 y ya recortados al lado. */
    const spans: { t0: number; t1: number; o: RoomOpeningSpan }[] = [];
    for (const o of openings) {
      const p = { x: o.x1, y: o.y1 }, q = { x: o.x2, y: o.y2 };
      // El vano tiene que estar SOBRE este lado: si sus dos puntas no lo rozan, es de otra pared.
      if (distToSegment(p, a, b) > ROOM_EPS * 4 || distToSegment(q, a, b) > ROOM_EPS * 4) continue;
      const t0 = Math.max(0, Math.min(paramOf(p, a, b), paramOf(q, a, b)));
      const t1 = Math.min(1, Math.max(paramOf(p, a, b), paramOf(q, a, b)));
      if (t1 - t0 > 1e-6) { spans.push({ t0, t1, o }); sobreUnLado.add(o); }
    }
    if (spans.length === 0) { out.push({ seg, kind: 'wall', isOpen: false }); continue; }
    spans.sort((x, y) => x.t0 - y.t0);
    const at = (t: number): ScenePoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const piece = (t0: number, t1: number, kind: RoomWall['kind'], isOpen: boolean, openingId?: string): void => {
      if (t1 - t0 <= 1e-6) return;
      const p0 = at(t0), p1 = at(t1);
      out.push({ seg: [p0.x, p0.y, p1.x, p1.y], kind, isOpen, ...(openingId ? { openingId } : {}) });
    };
    let cursor = 0;
    for (const s of spans) {
      /*
       * VANOS PISADOS: manda el primero. Pero lo que el segundo SOBRESALE del primero vuelve a ser pared: antes
       * el cursor saltaba sin poner nada y quedaba un agujero por el que pasaban la vista y las fichas (🐞 suyo,
       * 2026-09-09: «*en producción puedes traspasar la puerta con el token*»). Metido del todo dentro, nada.
       */
      if (s.t0 < cursor) { piece(cursor, s.t1, 'wall', false); cursor = Math.max(cursor, s.t1); continue; }
      piece(cursor, s.t0, 'wall', false);
      piece(s.t0, s.t1, s.o.kind, s.o.isOpen, s.o.id);
      cursor = s.t1;
    }
    piece(cursor, 1, 'wall', false);
  }

  /*
   * 🐞 LA PUERTA QUE CIERRA UN PASO (suyo, 2026-09-11: «*dejan pasar la visión y no colisionas con ellas*»).
   * Él la pone de una pared a la de enfrente, cruzando el pasillo —«*sobre un muro o un pasillo*», su encargo del
   * 2026-09-07—, así que no cae SOBRE ningún lado y arriba no sale: se dibujaba, pero ni tapaba ni frenaba.
   * Con sus DOS puntas apoyadas en la pared y el centro en el SUELO es un tramo propio: cerrada tapa y frena,
   * abierta deja pasar, como cualquier puerta. Se alarga `GAP_REACH` por cada punta para que no quede una rendija
   * entre ella y la pared.
   *
   * Una que flota en mitad del suelo —la del tabique fundido— no cierra nada y sigue sin tapar. Y una que atraviesa
   * el GROSOR de un muro también va de pared a pared, pero por dentro de la roca: ahí no hay paso que cerrar (test
   * «un vano se abre igual en un muro de relleno»).
   *
   * Dos más que tampoco cierran nada (revisión del 2026-09-11):
   *  - Una TUMBADA A LO LARGO de una pared, con el centro pegado a ella: sus dos puntas también «se apoyan», pero no
   *    cruza ningún paso. La que se pasaba unos px de la esquina metía un trozo de puerta en la boca del pasillo de
   *    al lado, y sólo en las paredes de la izquierda y de arriba (`pointInRing` resuelve el borde por un lado).
   *  - Una VENTANA: fuera del contorno no se dibuja —el repesque de `roomsLayer` es sólo de puertas— y frenar sin
   *    verse sería un muro invisible en mitad del pasillo.
   */
  for (const o of openings) {
    if (o.kind !== 'door' || sobreUnLado.has(o)) continue;
    const p = { x: o.x1, y: o.y1 }, q = { x: o.x2, y: o.y2 };
    const largo = Math.hypot(q.x - p.x, q.y - p.y);
    if (largo <= ROOM_EPS) continue;
    const apoyada = (pt: ScenePoint): boolean =>
      outline.some(s => distToSegment(pt, { x: s[0], y: s[1] }, { x: s[2], y: s[3] }) <= GAP_REACH);
    const centro = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    if (!apoyada(p) || !apoyada(q) || apoyada(centro)) continue;
    // ¿Suelo o roca? Manda la ÚLTIMA forma que cubre el centro, igual que al pintar; ninguna = roca.
    let enSuelo = false;
    for (const part of parts) if (pointInRing(centro, part.ring)) enSuelo = part.dig;
    if (!enSuelo) continue;
    const ux = ((q.x - p.x) / largo) * GAP_REACH, uy = ((q.y - p.y) / largo) * GAP_REACH;
    out.push({
      seg: [p.x - ux, p.y - uy, q.x + ux, q.y + uy], kind: o.kind, isOpen: o.isOpen, offOutline: true,
      ...(o.id ? { openingId: o.id } : {}),
    });
  }
  return out;
}

/**
 * Cuánto puede quedarse corta —o pasarse— la punta de una puerta que cierra un paso para contar como APOYADA en
 * la pared, en px de escena. Las dos con las que él lo vio (2026-09-11) quedaban a 0,3 y a 3 px: con el candado
 * abierto nada pega la punta a la pared, y la mano no es exacta. La del tabique fundido queda a 20 y sigue sin tapar.
 */
const GAP_REACH = ROOM_EPS * 12;

/**
 * Lo que CORTA LA VISTA de un contorno. Mismo criterio que un muro de los de siempre, para que la niebla no
 * tenga que saber de dónde vino la geometría: la roca siempre; una puerta sólo cerrada; una ventana nunca —
 * es de cristal, y eso ya era así antes de que las salas existieran.
 */
export const roomSightSegments = (walls: readonly RoomWall[]): BlockSegment[] =>
  walls.filter(w => w.kind !== 'window' && !w.isOpen).map(w => w.seg);

/**
 * Lo que FRENA A UNA FICHA (paredes sólidas, rebanada 4). Una ventana sí para: se ve a través, no se pasa.
 * Una puerta abierta deja pasar, que es para lo que se abre.
 */
export const roomMoveSegments = (walls: readonly RoomWall[]): BlockSegment[] =>
  walls.filter(w => !w.isOpen).map(w => w.seg);
