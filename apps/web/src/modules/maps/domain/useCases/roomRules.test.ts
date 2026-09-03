import { describe, it, expect } from 'vitest';
import { circleSegments, freehandSides, isClosed, isDragShape, isPathShape, MIN_RING_POINTS, MIN_ROOM_CELLS, polygonSides, roomSides, ROOM_KINDS, ROOM_SHAPES, simplifyRing } from './roomRules';

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

/**
 * 🆕 LAS FORMAS QUE FALTABAN (corrección suya del 2026-09-02: «rectángulos y círculos te quedas corto: ¿y si
 * quiero poner una pared inclinada?»).
 */
describe('polígono — la habitación de N lados', () => {
  it('cuatro vértices son cuatro lados, y encierran', () => {
    const sides = polygonSides([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }, { x: 0, y: 90 }], G);
    expect(sides).toHaveLength(4);
    expect(isClosed(sides)).toBe(true);
  });

  /** 🔒 ESTO es lo que él pedía: los vértices en la rejilla, pero el LADO a cualquier ángulo. */
  it('deja poner una pared inclinada', () => {
    const sides = polygonSides([{ x: 0, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 120 }], G);
    expect(sides).toHaveLength(3);
    const inclinado = sides.find(s => s.x1 !== s.x2 && s.y1 !== s.y2);
    expect(inclinado).toBeDefined();
  });

  it('los vértices se pegan a la rejilla, para que dos salas contiguas encajen sin rendijas', () => {
    const sides = polygonSides([{ x: 4, y: 7 }, { x: 118, y: 3 }, { x: 61, y: 92 }], G);
    for (const s of sides) for (const v of [s.x1, s.y1, s.x2, s.y2]) expect(v % G).toBe(0);
  });

  it('dos clics en el mismo sitio no son dos vértices', () => {
    const sides = polygonSides([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 120, y: 0 }, { x: 120, y: 90 }], G);
    expect(sides).toHaveLength(3);
  });

  it('menos de tres vértices, o tres en línea recta, no montan nada', () => {
    expect(polygonSides([{ x: 0, y: 0 }, { x: 120, y: 0 }], G)).toEqual([]);
    expect(polygonSides([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 0 }], G)).toEqual([]);
  });
});

describe('a pulso — la sala sale con la forma de la mano', () => {
  /** Un cuadrado trazado a mano: cientos de puntos con el temblor del ratón. */
  const aPulso = (): { x: number; y: number }[] => {
    const pts: { x: number; y: number }[] = [];
    const jitter = (i: number): number => ((i * 37) % 7) - 3;
    for (let x = 0; x <= 150; x += 5) pts.push({ x, y: jitter(x) });
    for (let y = 5; y <= 150; y += 5) pts.push({ x: 150 + jitter(y), y });
    for (let x = 145; x >= 0; x -= 5) pts.push({ x, y: 150 + jitter(x) });
    for (let y = 145; y >= 5; y -= 5) pts.push({ x: jitter(y), y });
    return pts;
  };

  it('limpia el temblor: no deja un muro por cada punto del ratón', () => {
    const puntos = aPulso();
    const sides = freehandSides(puntos, G);
    expect(puntos.length).toBeGreaterThan(100);
    expect(sides.length).toBeLessThan(20);
    expect(sides.length).toBeGreaterThanOrEqual(MIN_RING_POINTS);
  });

  it('cierra el circuito: si no, no detiene ni la vista ni el paso', () => {
    expect(isClosed(freehandSides(aPulso(), G))).toBe(true);
  });

  /** 🔒 A pulso NO se pega a la rejilla: pegado saldría una escalera, y la gracia es que no lo sea. */
  it('no se pega a la rejilla', () => {
    const sides = freehandSides(aPulso(), G);
    expect(sides.some(s => s.x1 % G !== 0 || s.y1 % G !== 0)).toBe(true);
  });

  it('un garabato más pequeño que una casilla no monta ninguna sala', () => {
    expect(freehandSides([{ x: 0, y: 0 }, { x: 3, y: 2 }, { x: 1, y: 4 }, { x: 0, y: 0 }], G)).toEqual([]);
  });
});

/**
 * 🔒 EL TRAZO REDONDEADO — el agujero por el que se coló un fallo real (2026-09-03).
 *
 * El único trazo que se probaba aquí era un CUADRADO: lados rectos, donde hasta un filtro malo acierta. Las
 * CURVAS, que son justamente para lo que existe «a pulso», no se probaban nunca — y en una curva el filtro
 * viejo (cada punto contra la cuerda de sus dos vecinos inmediatos) no descartaba nada, devolvía el trazo
 * crudo entero y un círculo a mano escribía del orden de cien muros permanentes, cada uno una fila contra la
 * que el motor de visión traza rayos en cada refresco, para cada jugador.
 */
describe('a pulso, con curvas — que es para lo que existe', () => {
  const CX = 400;
  const CY = 400;
  /** Un círculo trazado con la mano: muestreado fino, como manda el ratón, y con el temblor del pulso. */
  const circuloAPulso = (radius: number): { x: number; y: number }[] => {
    const n = Math.round((2 * Math.PI * radius) / 3);
    return Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      const temblor = ((i * 37) % 9) / 10 - 0.4;
      return { x: CX + (radius + temblor) * Math.cos(t), y: CY + (radius + temblor) * Math.sin(t) };
    });
  };

  it('un círculo a pulso NO deja un muro por cada punto del ratón', () => {
    const puntos = circuloAPulso(G * 4);
    const sides = freehandSides(puntos, G);
    expect(puntos.length).toBeGreaterThan(200);
    expect(sides.length).toBeGreaterThanOrEqual(MIN_RING_POINTS);
    expect(sides.length).toBeLessThanOrEqual(20);
  });

  /** Y sigue siendo un círculo: simplificar no puede convertir la sala en un triángulo. */
  it('la sala conserva la forma: los vértices siguen sobre el trazo, y encierra casi la misma superficie', () => {
    const radius = G * 4;
    const sides = freehandSides(circuloAPulso(radius), G);
    expect(isClosed(sides)).toBe(true);
    for (const s of sides) expect(Math.abs(Math.hypot(s.x1 - CX, s.y1 - CY) - radius)).toBeLessThan(1);
    let doble = 0;
    for (const s of sides) doble += (s.x1 - CX) * (s.y2 - CY) - (s.x2 - CX) * (s.y1 - CY);
    expect(Math.abs(doble) / 2).toBeGreaterThan(Math.PI * radius * radius * 0.85);
  });

  /** Una sala enorme lleva más lados que una pequeña, pero ni de lejos uno por punto. */
  it('cuanto más grande la sala más lados, pero acotados', () => {
    const pequeno = freehandSides(circuloAPulso(G * 4), G).length;
    const grande = freehandSides(circuloAPulso(G * 15), G).length;
    expect(grande).toBeGreaterThan(pequeno);
    expect(grande).toBeLessThan(circuloAPulso(G * 15).length / 4);
  });

  /**
   * 🔒 El fallo, pinchado en el propio filtro: en una curva suave TIENE que quitar puntos. El filtro viejo se
   * quedaba sin ninguno y, por la red de seguridad, devolvía el trazo crudo tal cual — la guarda que debía
   * acotar los muros era justo lo que los dejaba sin acotar.
   */
  it('simplifyRing simplifica de verdad una curva, y no devuelve el trazo crudo', () => {
    const arco = circuloAPulso(G * 4);
    const simple = simplifyRing(arco, G / 3);
    expect(simple.length).toBeLessThan(arco.length / 5);
    expect(simple.length).toBeGreaterThanOrEqual(MIN_RING_POINTS);
    // Cada vértice que sobrevive es un punto del trazo original, no uno inventado.
    for (const p of simple) expect(arco.some(q => q.x === p.x && q.y === p.y)).toBe(true);
  });

  /**
   * 🔒 Y al revés: lo que se resuelve en menos de tres vértices es una RAYA, y sale rechazado. Antes se
   * devolvía el trazo crudo «por si acaso», que era el origen del problema.
   */
  it('un trazo de ida y vuelta es una raya: se queda en menos de tres vértices y no monta sala', () => {
    const raya = [
      ...Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 0 })),
      ...Array.from({ length: 40 }, (_, i) => ({ x: 390 - i * 10, y: 0.2 })),
    ];
    expect(simplifyRing(raya, G / 3).length).toBeLessThan(MIN_RING_POINTS);
    expect(freehandSides(raya, G)).toEqual([]);
  });
});

describe('qué forma se dibuja cómo', () => {
  it('rectángulo y círculo se arrastran; polígono y pulso encadenan puntos; segmento no pasa por el motor', () => {
    expect(ROOM_SHAPES).toEqual(['segment', 'rect', 'circle', 'poly', 'free']);
    expect(ROOM_SHAPES.filter(isDragShape)).toEqual(['rect', 'circle']);
    expect(ROOM_SHAPES.filter(isPathShape)).toEqual(['poly', 'free']);
    expect(isDragShape('segment')).toBe(false);
    expect(isPathShape('segment')).toBe(false);
  });
});
