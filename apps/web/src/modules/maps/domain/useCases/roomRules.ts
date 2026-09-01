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
