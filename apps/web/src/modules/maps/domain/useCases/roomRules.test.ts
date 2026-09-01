import { describe, it, expect } from 'vitest';
import { circleSegments, isClosed, MIN_ROOM_CELLS, roomSides, ROOM_KINDS } from './roomRules';

/**
 * 🏗 EL MOTOR DE LAS HABITACIONES RÁPIDAS (§ «Rebanada 8»). Sólo geometría: la pantalla no existe todavía
 * —el spec está sin confirmar y no hay diseño—, pero un rectángulo tiene cuatro lados se pinte el botón como
 * se pinte, así que esto se puede sujetar hoy.
 */
const G = 30;

describe('habitación rectangular', () => {
  it('son cuatro lados, y encierran de verdad', () => {
    const sides = roomSides('rect', { x: 0, y: 0 }, { x: 120, y: 90 }, G);
    expect(sides).toHaveLength(4);
    expect(isClosed(sides)).toBe(true);
  });

  it('da igual desde qué esquina se dibuje: la sala es la misma', () => {
    const desdeArriba = roomSides('rect', { x: 0, y: 0 }, { x: 120, y: 90 }, G);
    const desdeAbajo = roomSides('rect', { x: 120, y: 90 }, { x: 0, y: 0 }, G);
    const cruzada = roomSides('rect', { x: 0, y: 90 }, { x: 120, y: 0 }, G);
    expect(desdeAbajo).toEqual(desdeArriba);
    expect(cruzada).toEqual(desdeArriba);
  });

  it('se pega a la rejilla, como el resto de Builder', () => {
    const sides = roomSides('rect', { x: 7, y: 4 }, { x: 113, y: 86 }, G);
    for (const s of sides) {
      for (const v of [s.x1, s.y1, s.x2, s.y2]) expect(v % G).toBe(0);
    }
  });

  /**
   * 🔒 Un clic sin arrastre NO monta nada. Sin esto, un resbalón del ratón dejaba cuatro muros de dos píxeles
   * que luego hay que ir a buscar y borrar a mano.
   */
  it('un gesto más pequeño que una casilla no monta ninguna sala', () => {
    expect(roomSides('rect', { x: 0, y: 0 }, { x: 5, y: 5 }, G)).toEqual([]);
    expect(roomSides('rect', { x: 0, y: 0 }, { x: 0, y: 0 }, G)).toEqual([]);
    // Justo en el mínimo sí monta: el tope es «menos de una casilla», no «una casilla».
    expect(roomSides('rect', { x: 0, y: 0 }, { x: G * MIN_ROOM_CELLS, y: G * MIN_ROOM_CELLS }, G)).toHaveLength(4);
  });

  it('los lados van dando la vuelta, no en aspas', () => {
    const [arriba, derecha, abajo, izquierda] = roomSides('rect', { x: 0, y: 0 }, { x: 120, y: 90 }, G);
    expect(arriba).toEqual({ x1: 0, y1: 0, x2: 120, y2: 0 });
    expect(derecha).toEqual({ x1: 120, y1: 0, x2: 120, y2: 90 });
    expect(abajo).toEqual({ x1: 120, y1: 90, x2: 0, y2: 90 });
    expect(izquierda).toEqual({ x1: 0, y1: 90, x2: 0, y2: 0 });
  });
});

describe('habitación redonda', () => {
  it('se aproxima con un polígono cerrado', () => {
    const sides = roomSides('circle', { x: 300, y: 300 }, { x: 300 + G * 3, y: 300 }, G);
    expect(sides.length).toBeGreaterThanOrEqual(8);
    expect(isClosed(sides)).toBe(true);
  });

  /**
   * El número de lados sale del TAMAÑO. Con un número fijo, una sala pequeña sale con esquinas de más —y cada
   * muro cuesta en el cálculo de visión— y una enorme sale como un hexágono.
   */
  it('cuantos más metros, más lados — pero con topes por los dos extremos', () => {
    expect(circleSegments(G, G)).toBe(8);
    expect(circleSegments(G * 3, G)).toBeGreaterThan(8);
    expect(circleSegments(G * 3, G)).toBeLessThan(48);
    expect(circleSegments(G * 500, G)).toBe(48);
  });

  it('dos círculos del mismo tamaño salen idénticos aunque se dibujen a ojo', () => {
    const a = roomSides('circle', { x: 0, y: 0 }, { x: G * 2 + 4, y: 0 }, G);
    const b = roomSides('circle', { x: 0, y: 0 }, { x: G * 2 - 4, y: 0 }, G);
    expect(b).toEqual(a);
  });

  it('un círculo más pequeño que una casilla no monta nada', () => {
    expect(roomSides('circle', { x: 0, y: 0 }, { x: 3, y: 0 }, G)).toEqual([]);
  });
});

describe('el motor en general', () => {
  it('sabe hacer las formas que dice saber hacer', () => {
    for (const kind of ROOM_KINDS) {
      const sides = roomSides(kind, { x: 0, y: 0 }, { x: G * 4, y: G * 4 }, G);
      expect(sides.length).toBeGreaterThan(2);
      expect(isClosed(sides)).toBe(true);
    }
  });

  /**
   * 🔒 Lo que sale de aquí es la forma de un MURO de los de siempre — la misma que `maps_walls` guarda—, y por
   * eso no hace falta tabla nueva: lo generado se edita, se abre, se parte y se borra con lo que ya existe.
   */
  it('cada lado tiene la forma exacta de un muro: dos puntos y nada más', () => {
    const sides = roomSides('rect', { x: 0, y: 0 }, { x: G * 4, y: G * 4 }, G);
    for (const s of sides) expect(Object.keys(s).sort()).toEqual(['x1', 'x2', 'y1', 'y2']);
  });

  it('un circuito con un hueco NO se da por cerrado: por un hueco se cuela la visión', () => {
    const sides = roomSides('rect', { x: 0, y: 0 }, { x: 120, y: 90 }, G);
    expect(isClosed([...sides.slice(0, 3), { ...sides[3]!, x2: 5 }])).toBe(false);
    expect(isClosed(sides.slice(0, 2))).toBe(false);
  });
});
