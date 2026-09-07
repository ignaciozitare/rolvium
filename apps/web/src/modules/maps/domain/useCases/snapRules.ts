import { snap, type Point } from './mapRules';
import type { Wall } from '../entities/Scene';

/**
 * EL CANDADO DE PEGAR A LA REJILLA (specs/modules/maps/SPEC.md § «Rebanada 8»).
 *
 * Aprobado por el dueño el 2026-09-03 —«*tira*»— con tres condiciones, y las tres viven aquí:
 *
 * 1. **Empieza ABIERTO.** Se le propuso lo contrario —empezar cerrado, para no cambiarle nada— y probándolo
 *    decidió al revés (2026-09-03: «*el pegado a la rejilla debería estar desactivado por defecto*»): marcando
 *    muros sobre una foto la rejilla no le sirve, porque los muros de la foto no caen en múltiplos de nada.
 *    Echando el candado, el comportamiento es el de siempre, sin una sola diferencia.
 * 2. **Vale para todo Builder**, no sólo para los nodos: los muros que se dibujan, los vértices del polígono
 *    y las puntas que se arrastran. Un candado que sólo valiera para una de las tres no serviría de nada.
 * 3. **Abierto, las puntas se pegan a las PUNTAS DE OTROS MUROS** que tengan cerca. Sin esto, «libre» acaba
 *    siendo «lleno de rendijas», y por una rendija de medio píxel se cuela la visión — que es justo lo que
 *    pegarse a la rejilla evitaba.
 *
 * 🚫 **Descartado afinar la rejilla**, y él lo aceptó: la rejilla ES el metro de la mesa —movimiento, tamaño
 * de ficha, alcance de una luz, la regla— y tocarla mueve todo el juego. Además no arreglaría nada: los muros
 * de una foto no caen en múltiplos de nada.
 *
 * ⚠️ «A pulso» NO pasa por aquí, a propósito: nunca se pegó a la rejilla porque un trazo libre cuadriculado
 * sale como una escalera (`roomRules.freehandSides`).
 */

/** La geometría de un segmento, sin la fila alrededor. */
export interface SegmentAt { x1: number; y1: number; x2: number; y2: number }

/** A cuánto tiene que estar la punta de otro muro para que se peguen, en px de escena. */
export const END_SNAP_PX = 12;

/**
 * Cuándo dos puntos son EL MISMO punto, en px de escena.
 *
 * 🐞 Existe por su fallo del 2026-09-04 —«*no me deja crear un muro muy cerca de otro*»—, y era el imán, no
 * el mínimo de tamaño: dibujando cerca de una punta ajena, el imán se tragaba las DOS puntas del gesto y las
 * dejaba encima de la misma, así que el muro salía de largo cero y se caía sin decir nada. Un imán que puede
 * anular el gesto que está ayudando a colocar no ayuda: por eso la segunda punta ya no puede pegarse a donde
 * se pegó la primera.
 */
export const SAME_POINT_PX = 0.001;

/** El paso al que se pega Builder: la rejilla con el candado cerrado, ninguno con el candado abierto. */
export const stepOf = (grid: number, locked: boolean): number => (locked ? grid : 0);

/**
 * La punta de muro más cercana a `p`, o `null` si no hay ninguna a tiro. `skipId` deja fuera el muro que se
 * está editando: pegar una punta suya a la otra lo dejaría del revés o del largo de cero.
 */
export function nearestEnd(walls: readonly Wall[], p: Point, tol = END_SNAP_PX, skipId?: string, avoid?: Point | null): Point | null {
  let best: Point | null = null;
  let bestD = tol;
  for (const w of walls) {
    if (w.id === skipId) continue;
    for (const q of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
      if (avoid && Math.hypot(q.x - avoid.x, q.y - avoid.y) < SAME_POINT_PX) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= bestD) { bestD = d; best = q; }
    }
  }
  return best;
}

/**
 * DÓNDE CAE DE VERDAD un punto de Builder. Es el único sitio que decide, y por eso el candado vale igual para
 * el muro, para el vértice del polígono y para el nodo: los tres preguntan aquí.
 */
export function builderPoint(
  p: Point,
  grid: number,
  locked: boolean,
  walls: readonly Wall[],
  tol = END_SNAP_PX,
  skipId?: string,
  avoid?: Point | null,
): Point {
  if (locked) return { x: snap(p.x, grid), y: snap(p.y, grid) };
  return nearestEnd(walls, p, tol, skipId, avoid) ?? p;
}

/**
 * La punta que se está arrastrando, pegada a la de otro muro si la tiene cerca.
 *
 * Moviendo el muro ENTERO no se toca nada: ahí las dos puntas viajan juntas, y pegar una sola torcería el
 * muro en vez de moverlo.
 */
export function anchorEnd(
  at: SegmentAt,
  grab: 'a' | 'b' | 'whole',
  walls: readonly Wall[],
  tol = END_SNAP_PX,
  skipId?: string,
): SegmentAt {
  if (grab === 'whole') return at;
  const p = grab === 'a' ? { x: at.x1, y: at.y1 } : { x: at.x2, y: at.y2 };
  const q = nearestEnd(walls, p, tol, skipId);
  if (!q) return at;
  return grab === 'a' ? { ...at, x1: q.x, y1: q.y } : { ...at, x2: q.x, y2: q.y };
}
