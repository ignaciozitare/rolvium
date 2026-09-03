import type { Point } from './mapRules';
import type { Wall } from '../entities/Scene';

/**
 * EL GRUPO — los muros de un gesto son UNA cosa (specs/modules/maps/SPEC.md § «EL GRUPO»).
 *
 * Petición del dueño del 2026-09-03, con la herramienta del círculo puesta sobre una foto de mapa:
 * «*debería poder seleccionarlo entero y luego con doble clic por pedacitos, si no, cuando esté en medio de
 * otras cosas no se podrá mover*» y «*cuando lo seleccione debería poder escalarlo*».
 *
 * 🔑 **NO son habitaciones.** Marcando sobre una foto no hay suelo, ni textura, ni preajuste: hay muros. Un
 * círculo son once muros que para él son una cosa, y puede acabar siendo el contorno de una sala, un pilar o
 * un estanque — al grupo le da igual, y por eso no se llama sala. La habitación con su suelo es la pregunta 6
 * del spec y va por su lado.
 *
 * 🟡 Aquí sólo hay geometría y conjuntos: ni pantalla ni base de datos. Un rectángulo que encierra once muros
 * los encierra se pinte el tirador como se pinte, así que esto se puede probar entero sin abrir el navegador.
 */

/** El rectángulo que envuelve algo, en px de escena. `w`/`h` nunca son negativos. */
export interface Rect { x: number; y: number; w: number; h: number }

/** La geometría de un muro, que es lo único que mover y escalar cambian. */
export interface WallAt { id: string; x1: number; y1: number; x2: number; y2: number }

/**
 * Los ocho tiradores: las cuatro esquinas y los cuatro medios de los lados. Las esquinas escalan en las dos
 * direcciones a la vez; los medios, sólo en la suya — que es lo que uno espera al agarrar el lado de algo.
 */
export type HandleKey = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';
export const HANDLE_KEYS: HandleKey[] = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];

/**
 * Lo más pequeño que puede quedar un grupo al estrujarlo, en px. Sin tope, arrastrar un tirador más allá del
 * lado de enfrente deja el grupo del revés o aplastado a nada, y recuperarlo a mano es imposible.
 */
export const MIN_GROUP_PX = 8;

/** Por debajo de esto un lado es cero: escalar dividiendo por él daría infinito. */
const EPS = 0.001;

/** El rectángulo que envuelve a estos muros. Con la lista vacía no hay nada que envolver. */
export function wallBounds(walls: Wall[]): Rect | null {
  if (!walls.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Dónde cae un tirador sobre el marco. */
export function handleAt(r: Rect, k: HandleKey): Point {
  const x = k === 'tl' || k === 'l' || k === 'bl' ? r.x : k === 't' || k === 'b' ? r.x + r.w / 2 : r.x + r.w;
  const y = k === 'tl' || k === 't' || k === 'tr' ? r.y : k === 'l' || k === 'r' ? r.y + r.h / 2 : r.y + r.h;
  return { x, y };
}

/**
 * El marco nuevo al arrastrar un tirador hasta `to`. El lado de enfrente queda clavado —es el ancla— y sólo se
 * mueve el que se agarra.
 *
 * 🔒 **LAS ESQUINAS GUARDAN LAS PROPORCIONES** (dueño, 2026-09-03: «*los nodos de las esquinas deberían
 * escalarlo manteniendo proporciones*»). Una esquina agarra las dos direcciones a la vez, así que estirar
 * libre por ahí deforma la sala sin querer — y un círculo deformado deja de ser un círculo. Manda el eje que
 * más se ha arrastrado, y el otro le sigue. Los tiradores de EN MEDIO sí estiran libre en su única dirección,
 * que es justo para lo que están: agarrar el lado derecho ensancha y deja la altura como estaba.
 */
export function resizeRect(r: Rect, k: HandleKey, to: Point): Rect {
  const west = k === 'tl' || k === 'l' || k === 'bl';
  const east = k === 'tr' || k === 'r' || k === 'br';
  const north = k === 'tl' || k === 't' || k === 'tr';
  const south = k === 'bl' || k === 'b' || k === 'br';
  let w = west ? r.x + r.w - to.x : east ? to.x - r.x : r.w;
  let h = north ? r.y + r.h - to.y : south ? to.y - r.y : r.h;
  if ((west || east) && (north || south) && r.w > EPS && r.h > EPS) {
    const sx = w / r.w;
    const sy = h / r.h;
    // El eje que más se ha movido manda; el tope mínimo se aplica al conjunto, o la proporción se rompería.
    const seguido = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
    const factor = Math.max(seguido, MIN_GROUP_PX / r.w, MIN_GROUP_PX / r.h);
    w = r.w * factor;
    h = r.h * factor;
  } else {
    w = Math.max(w, MIN_GROUP_PX);
    h = Math.max(h, MIN_GROUP_PX);
  }
  return { x: west ? r.x + r.w - w : r.x, y: north ? r.y + r.h - h : r.y, w, h };
}

/**
 * Los muros llevados del marco viejo al nuevo. Cada punta se mueve en proporción a dónde estaba dentro del
 * marco, que es lo que hace que la forma se conserve al estirar.
 *
 * Un grupo plano —todos sus muros en la misma vertical, por ejemplo— tiene un lado de cero. Ahí no se escala
 * en ese eje, se traslada: escalar sería dividir por cero y mandar los muros al infinito.
 */
export function scaleWallsTo(walls: Wall[], from: Rect, to: Rect): WallAt[] {
  const fx = from.w > EPS ? to.w / from.w : 1;
  const fy = from.h > EPS ? to.h / from.h : 1;
  const at = (x: number, y: number): Point => ({
    x: to.x + (from.w > EPS ? (x - from.x) * fx : x - from.x),
    y: to.y + (from.h > EPS ? (y - from.y) * fy : y - from.y),
  });
  return walls.map(w => {
    const a = at(w.x1, w.y1);
    const b = at(w.x2, w.y2);
    return { id: w.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** Los muros movidos en bloque. Es escalar sin cambiar de tamaño, pero merece nombre propio: se usa más. */
export function moveWalls(walls: Wall[], dx: number, dy: number): WallAt[] {
  return walls.map(w => ({ id: w.id, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy }));
}

/**
 * Los muros que caen dentro del área arrastrada. Hace falta que quepan **enteros**, las dos puntas dentro: si
 * bastara con rozarlos, un muro largo que sólo cruza la esquina del área se vendría también, y cogerías cosas
 * que no querías. La regla es «coges lo que rodeas del todo», que se explica en una frase.
 */
export function wallsInRect(walls: Wall[], a: Point, b: Point): Wall[] {
  const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  const inside = (x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  return walls.filter(w => inside(w.x1, w.y1) && inside(w.x2, w.y2));
}

/**
 * Un grupo se coge entero o no se coge. Si el área pilló tres muros de un círculo de once, se vienen los once:
 * el grupo es UNA cosa, y media cosa cogida no es nada que él pueda mover con sentido.
 */
export function withWholeGroups(all: Wall[], picked: Wall[]): Wall[] {
  const groups = new Set(picked.map(w => w.groupId).filter((g): g is string => !!g));
  if (!groups.size) return picked;
  const ids = new Set(picked.map(w => w.id));
  return [...picked, ...all.filter(w => w.groupId && groups.has(w.groupId) && !ids.has(w.id))];
}

/** Los muros del grupo de este muro. Sin grupo, él solo: un muro suelto es un conjunto de uno. */
export function groupOf(all: Wall[], wall: Wall): Wall[] {
  return wall.groupId ? all.filter(w => w.groupId === wall.groupId) : [wall];
}

/** Un identificador de grupo nuevo. Va aquí para que la pantalla no tenga que saber de qué forma es. */
export function newGroupId(): string {
  return crypto.randomUUID();
}
