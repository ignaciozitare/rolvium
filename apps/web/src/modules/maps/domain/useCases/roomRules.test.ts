import { describe, it, expect } from 'vitest';
import { BAND_ROUGH_MAX_POINTS, BRUSH_COLORS, BRUSH_MAX_CELLS, BRUSH_MIN_CELLS, brushColorName, brushRings, BUILDER_MODES, DEFAULT_BRUSH_COLOR, isHexColor, shapesFor, circleSegments, freehandSides, isClosed, isDragShape, isLineShape, isPathShape, lineSide, MIN_FILL_CELLS, MIN_RING_POINTS, MIN_ROOM_CELLS, polygonSides, roomSides, ROOM_KINDS, ROOM_SHAPES, simplifyRing, wallStripe } from './roomRules';
import { digs, pointInRing, roomOutline } from '@rolvium/core';

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
   * 🔒 Un clic sin arrastre NO monta nada — pero UNA SALA PUEDE SER TAN ESTRECHA COMO UN MURO.
   *
   * Decisión suya del 2026-09-04, con el fallo delante: el mínimo era una casilla entera de lado, así que un
   * hueco estrecho entre dos salas no se podía rellenar y no aparecía nada ni se le avisaba. Eligió bajarlo
   * al grosor de un muro sabiendo el precio —un resbalón puede dejarle una sala diminuta que borrar—.
   */
  it('un clic sin arrastre no monta nada, pero una sala del grosor de un muro sí', () => {
    expect(roomSides('rect', { x: 0, y: 0 }, { x: 0, y: 0 }, G)).toEqual([]);
    // Un quinto de casilla ES una sala desde su decisión: antes esto devolvía la lista vacía, en silencio.
    // Con el candado ABIERTO, que es como arranca la escena (`step` a 0).
    expect(roomSides('rect', { x: 0, y: 0 }, { x: 5, y: 5 }, G, 0)).toHaveLength(4);
    /**
     * 🔒 …y con el candado CERRADO sigue sin poder existir, a propósito: cuadrando a la rejilla las dos
     * esquinas caen en la misma línea, así que una sala más estrecha que una casilla no cabe en el mundo que
     * describe el candado. No es el mínimo, es el candado — el segundo sospechoso del fallo, y resultó ser
     * comportamiento correcto. Por eso el aviso en pantalla importa: si no, esto pasa en silencio.
     */
    expect(roomSides('rect', { x: 0, y: 0 }, { x: 5, y: 5 }, G)).toEqual([]);
    // Justo en el mínimo sí monta: el tope es «menos que el mínimo», no «el mínimo».
    expect(roomSides('rect', { x: 0, y: 0 }, { x: G * MIN_ROOM_CELLS, y: G * MIN_ROOM_CELLS }, G, 0)).toHaveLength(4);
    // Y por debajo del mínimo sigue sin montar: el resbalón de verdad se para igual.
    expect(roomSides('rect', { x: 0, y: 0 }, { x: G * MIN_ROOM_CELLS * 0.5, y: G * MIN_ROOM_CELLS * 0.5 }, G, 0)).toEqual([]);
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
  it('rectángulo y círculo se arrastran; polígono y pulso encadenan puntos; segmento y recta no pasan por el motor de salas', () => {
    // El orden es el del diseño v3, y se lee en dos filas de tres.
    expect(ROOM_SHAPES).toEqual(['segment', 'line', 'rect', 'circle', 'poly', 'free']);
    expect(ROOM_SHAPES.filter(isDragShape)).toEqual(['rect', 'circle']);
    expect(ROOM_SHAPES.filter(isPathShape)).toEqual(['poly', 'free']);
    expect(ROOM_SHAPES.filter(isLineShape)).toEqual(['line']);
    for (const s of ['segment', 'line'] as const) {
      expect(isDragShape(s)).toBe(false);
      expect(isPathShape(s)).toBe(false);
    }
  });
});

/**
 * LA RECTA SUELTA — la sexta forma del diseño v3, pedida por él el 2026-09-03. La única que NO monta una
 * sala: sale un muro y sólo uno, por el camino de siempre.
 */
describe('lineSide — la recta suelta', () => {
  it('un arrastre da un muro, tal cual, de un punto al otro', () => {
    expect(lineSide({ x: 27, y: 54 }, { x: 135, y: 54 }, 27)).toEqual({ x1: 27, y1: 54, x2: 135, y2: 54 });
  });

  it('vale en diagonal: una pared puede ir a cualquier ángulo', () => {
    expect(lineSide({ x: 0, y: 0 }, { x: 54, y: 27 }, 27)).toEqual({ x1: 0, y1: 0, x2: 54, y2: 27 });
  });

  it('un clic sin arrastre no deja nada: eso es un resbalón, no una pared', () => {
    expect(lineSide({ x: 27, y: 54 }, { x: 27, y: 54 }, 27)).toBeNull();
    expect(lineSide({ x: 27, y: 54 }, { x: 32, y: 54 }, 27)).toBeNull();
  });

  it('media casilla ya cuenta: es el tope, no un mínimo generoso', () => {
    expect(lineSide({ x: 0, y: 0 }, { x: 14, y: 0 }, 27)).toEqual({ x1: 0, y1: 0, x2: 14, y2: 0 });
  });
});

/**
 * EL CANDADO llega a las formas por el `step`. Sin pasarlo, todo se comporta igual que siempre — que es la
 * primera condición del dueño: cerrado, Builder no cambia.
 */
describe('las formas con el candado abierto', () => {
  it('el rectángulo deja de cuadrar a la casilla, pero sigue midiendo el mínimo en casillas', () => {
    const libre = roomSides('rect', { x: 10, y: 10 }, { x: 100, y: 70 }, 27, 0);
    expect(libre[0]).toEqual({ x1: 10, y1: 10, x2: 100, y2: 10 });
    // Y el mínimo sigue midiéndose en casillas, candado o no candado: un clic sin arrastre no monta nada.
    expect(roomSides('rect', { x: 10, y: 10 }, { x: 10, y: 10 }, 27, 0)).toEqual([]);
    // Con el candado abierto la sala estrecha sale exactamente donde se pinchó, sin cuadrar a nada.
    expect(roomSides('rect', { x: 10, y: 10 }, { x: 20, y: 20 }, 27, 0)[0]).toEqual({ x1: 10, y1: 10, x2: 20, y2: 10 });
  });

  it('el círculo se queda con el radio del gesto en vez de redondearlo', () => {
    const libre = roomSides('circle', { x: 0, y: 0 }, { x: 40, y: 0 }, 27, 0);
    expect(Math.hypot(libre[0]!.x1, libre[0]!.y1)).toBeCloseTo(40, 6);
    // Cerrado (lo de siempre): 40 redondea a 27, la casilla más cercana.
    const pegado = roomSides('circle', { x: 0, y: 0 }, { x: 40, y: 0 }, 27);
    expect(Math.hypot(pegado[0]!.x1, pegado[0]!.y1)).toBeCloseTo(27, 6);
  });

  it('los vértices del polígono se quedan donde se pincharon', () => {
    const pts = [{ x: 5, y: 5 }, { x: 95, y: 8 }, { x: 50, y: 90 }];
    expect(polygonSides(pts, 27, 0)[0]).toEqual({ x1: 5, y1: 5, x2: 95, y2: 8 });
  });

  it('sin pasar `step` todo sigue pegado a la rejilla: el candado nace cerrado', () => {
    expect(roomSides('rect', { x: 10, y: 10 }, { x: 100, y: 70 }, 27)[0]).toEqual({ x1: 0, y1: 0, x2: 108, y2: 0 });
    expect(polygonSides([{ x: 5, y: 5 }, { x: 95, y: 8 }, { x: 50, y: 90 }], 27)[0]).toEqual({ x1: 0, y1: 0, x2: 108, y2: 0 });
  });
});

describe('las dos maneras de trabajar, y conviven', () => {
  it('son exactamente dos: sobre una foto y dibujar aquí', () => {
    expect(BUILDER_MODES).toEqual(['photo', 'draw']);
  });
});

/**
 * 🐞 UN MURO DE RELLENO NO MIDE LO QUE UNA RECTA MARCADA SOBRE UNA FOTO, y eso era la otra mitad del fallo
 * del 2026-09-04. El mínimo de las FORMAS ya se había bajado al grosor de un muro, pero la raya se caía antes
 * —dentro de `wallStripe`, con el mínimo de la foto— y por eso un tabique corto seguía sin poder dibujarse.
 */
describe('el mínimo de un muro de relleno', () => {
  const G2 = 27;
  const GROSOR = 6;

  it('un tabique más corto que media casilla SÍ se puede levantar: es un relleno, no una recta sobre foto', () => {
    // 8 px = menos de media casilla (13,5) y más que el grosor de un muro (2,7): antes salía la lista vacía.
    expect(wallStripe({ x: 0, y: 0 }, { x: 8, y: 0 }, GROSOR, G2)).toHaveLength(4);
  });

  it('…pero un clic sin arrastre sigue sin levantar nada', () => {
    expect(wallStripe({ x: 0, y: 0 }, { x: 0, y: 0 }, GROSOR, G2)).toEqual([]);
    expect(wallStripe({ x: 0, y: 0 }, { x: 2, y: 0 }, GROSOR, G2)).toEqual([]);
  });

  it('el tabique corto conserva el grosor de la escena, que es lo que lo hace un muro', () => {
    const tira = wallStripe({ x: 0, y: 0 }, { x: 8, y: 0 }, GROSOR, G2);
    expect(Math.abs(tira[0]![1] - tira[3]![1])).toBeCloseTo(GROSOR, 6);
  });

  it('lineSide acepta el mínimo del relleno sin cambiar el de siempre', () => {
    // Con el de siempre (media casilla) una raya de 8 px no es nada…
    expect(lineSide({ x: 0, y: 0 }, { x: 8, y: 0 }, G2)).toBeNull();
    // …y con el del relleno sí, que es lo que pasa dibujando aquí.
    expect(lineSide({ x: 0, y: 0 }, { x: 8, y: 0 }, G2, MIN_FILL_CELLS)).toEqual({ x1: 0, y1: 0, x2: 8, y2: 0 });
  });
});

/**
 * ── EL PINCEL QUE CONSTRUYE (rebanada 10) ──
 * Un brochazo es UNA FORMA MÁS de `maps_rooms`: de ahí sale gratis fundirse, cortar la vista y frenar a las
 * fichas. Lo único nuevo de verdad es esto — convertir un trazo en un anillo.
 */
describe('brushRings — el trazo se convierte en forma', () => {
  const G = 30;
  const pts = (ring: [number, number][]) => ring.map(([x, y]) => ({ x, y }));

  it('un toque sin arrastre deja un disco del ancho del pincel', () => {
    const [ring] = brushRings([{ x: 100, y: 100 }], 2, G);
    expect(ring).toBeDefined();
    const r = G;   // 2 casillas de ancho = 1 de radio
    for (const p of pts(ring!)) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(r, 4);
  });

  /** El ancho es el ancho: un brochazo no puede pintar más allá del círculo que el director ve en el cursor. */
  it('un trazo recto sale del ancho pedido, ni más ni menos', () => {
    const [ring] = brushRings([{ x: 0, y: 300 }, { x: 400, y: 300 }], 2, G);
    const p = pts(ring!);
    const ys = p.map(q => q.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2 * G, 3);
    // Y no se pasa de largo más que el redondeo de las puntas.
    const xs = p.map(q => q.x);
    expect(Math.min(...xs)).toBeCloseTo(-G, 3);
    expect(Math.max(...xs)).toBeCloseTo(400 + G, 3);
  });

  it('el ancho se recorta a los topes, y una basura no revienta el anillo', () => {
    const anchoDe = (cells: number) => {
      const [ring] = brushRings([{ x: 0, y: 300 }, { x: 400, y: 300 }], cells, G);
      const ys = pts(ring!).map(q => q.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(anchoDe(900)).toBeCloseTo(BRUSH_MAX_CELLS * G, 3);
    expect(anchoDe(0)).toBeCloseTo(BRUSH_MIN_CELLS * G, 3);
  });

  it('el anillo ENVUELVE el trazo: todo punto del camino cae dentro', () => {
    const camino = [{ x: 60, y: 60 }, { x: 200, y: 90 }, { x: 340, y: 200 }];
    const [ring] = brushRings(camino, 2, G);
    for (const p of camino) expect(pointInRing(p, pts(ring!))).toBe(true);
    // Y un punto claramente fuera, fuera.
    expect(pointInRing({ x: 60, y: 400 }, pts(ring!))).toBe(false);
  });

  /**
   * 🔑 EL CODO CERRADO SE PARTE, y es lo único no obvio de toda la rebanada. Sin partir, el anillo une los dos
   * lados de FUERA del giro con una recta, y en un giro más cerrado que un ángulo recto esa recta se come la punta
   * del codo: pared donde tendría que haber suelo. Partiendo salen dos piezas con su punta redonda que se solapan
   * en el codo, y fundirse al solaparse ya lo hace el motor de salas.
   */
  it('un codo cerrado sale en dos piezas, no en un anillo que se cruza', () => {
    const enV = [{ x: 300, y: 60 }, { x: 300, y: 300 }, { x: 320, y: 60 }];
    expect(brushRings(enV, 2, G)).toHaveLength(2);
    // Una curva suave del mismo largo NO se parte: partir de más multiplica las filas sin motivo.
    const suave = [{ x: 60, y: 300 }, { x: 200, y: 260 }, { x: 340, y: 300 }];
    expect(brushRings(suave, 2, G)).toHaveLength(1);
  });

  it('las dos piezas de un codo se SOLAPAN, que es lo que hace que se fundan sin hueco', () => {
    const codo = [{ x: 300, y: 60 }, { x: 300, y: 300 }, { x: 320, y: 60 }];
    const [a, b] = brushRings(codo, 2, G);
    // El vértice del codo cae dentro de las dos: por ahí se cosen.
    expect(pointInRing({ x: 300, y: 300 }, pts(a!))).toBe(true);
    expect(pointInRing({ x: 300, y: 300 }, pts(b!))).toBe(true);
  });

  /**
   * 🐞 EL TRAZO QUE SE CRUZA CONSIGO MISMO (suyo, 2026-09-11: «*hago que se crucen trazos, quedan estas líneas
   * cruzadas*»). Un lazo de giros suaves no se parte, así que el cruce queda dentro de UN anillo, con dos vueltas
   * encima. SVG lo pinta de suelo, y el motor tiene que verlo igual: ni un tramo de muro con suelo a los dos lados.
   * El «¿es suelo?» se cuenta aquí a mano, por vueltas como SVG, para que el test no se dé la razón a sí mismo.
   */
  it('un trazo que se cruza consigo mismo no deja muros dentro del suelo', () => {
    const lazo = Array.from({ length: 240 }, (_, i) => {
      const t = -1.6 + (3.2 * i) / 239;
      return { x: 400 + 200 * (t * t - 1), y: 350 + 200 * (t * t * t - t) };
    });
    const rings = brushRings(lazo, 2, G).map(r => pts(r));
    expect(rings).toHaveLength(1);
    const vueltas = (p: { x: number; y: number }, ring: { x: number; y: number }[]) => {
      let w = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
        const lado = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
        if (a.y <= p.y && b.y > p.y && lado > 0) w++;
        else if (a.y > p.y && b.y <= p.y && lado < 0) w--;
      }
      return w;
    };
    const suelo = (p: { x: number; y: number }) => rings.some(r => vueltas(p, r) !== 0);
    const muros = roomOutline(digs(...rings));
    expect(muros.length).toBeGreaterThan(0);
    for (const [x1, y1, x2, y2] of muros) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const nx = (-(y2 - y1) / len) * 2, ny = ((x2 - x1) / len) * 2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      expect(suelo({ x: mx + nx, y: my + ny }) && suelo({ x: mx - nx, y: my - ny })).toBe(false);
    }
  });

  /**
   * ── EL BORDE ROTO DE «A PULSO» (§ 10B.4) ──
   * Sin borde roto sale LO MISMO que siempre. Con él el canto sale irregular y distinto en cada trazo, pero
   * nunca crece más allá del ancho elegido, nunca se parte ni deja agujeros, y tiene tope de esquinas.
   * Sobre una recta, para que la simplificación del trazo no mueva el camino contra el que se mide.
   */
  describe('el borde roto', () => {
    // Dos puntos y nada más: así el camino del que sale la banda es EXACTAMENTE éste, puntas incluidas.
    const recta = [{ x: 60, y: 300 }, { x: 591, y: 300 }];
    const distAlCamino = (p: { x: number; y: number }) => Math.hypot(p.x - Math.min(591, Math.max(60, p.x)), p.y - 300);

    it('con «Limpio» —o sin nada de roto— el trazo sale exactamente como siempre', () => {
      const siempre = brushRings(recta, 2, G);
      expect(brushRings(recta, 2, G, undefined)).toEqual(siempre);
      expect(brushRings(recta, 2, G, { roughness: 0, seed: 7 })).toEqual(siempre);
    });

    it('muerde hacia dentro y nunca crece más allá del ancho que él eligió', () => {
      const [roto] = brushRings(recta, 2, G, { roughness: 1, seed: 7 });
      const ds = pts(roto!).map(distAlCamino);
      expect(Math.max(...ds)).toBeLessThanOrEqual(G + 1e-6);
      expect(Math.min(...ds)).toBeLessThan(G * 0.9);
    });

    it('por muy roto que se ponga, no se parte ni deja agujeros: el camino y su franja central siguen dentro', () => {
      const [roto] = brushRings(recta, 2, G, { roughness: 1, seed: 11 });
      const anillo = pts(roto!);
      expect(Math.min(...anillo.map(distAlCamino))).toBeGreaterThanOrEqual(G * 0.5);
      for (let x = 60; x <= 591; x += 7) for (const dy of [-G / 3, 0, G / 3]) expect(pointInRing({ x, y: 300 + dy }, anillo)).toBe(true);
    });

    it('cada trazo sale distinto, y el mismo trazo sale igual en el previo y al soltar', () => {
      expect(brushRings(recta, 2, G, { roughness: 0.6, seed: 7 })).toEqual(brushRings(recta, 2, G, { roughness: 0.6, seed: 7 }));
      expect(brushRings(recta, 2, G, { roughness: 0.6, seed: 8 })).not.toEqual(brushRings(recta, 2, G, { roughness: 0.6, seed: 7 }));
    });

    it('un trazo larguísimo reparte las esquinas en vez de pasar del tope', () => {
      const larga = Array.from({ length: 60 }, (_, i) => ({ x: i * 400, y: 300 }));
      const [siempre] = brushRings(larga, 2, G);
      const [roto] = brushRings(larga, 2, G, { roughness: 1, seed: 3 });
      expect(roto!.length).toBeGreaterThan(siempre!.length);
      expect(roto!.length).toBeLessThanOrEqual(siempre!.length + BAND_ROUGH_MAX_POINTS);
    });

    /** 🐞 El tope es POR TRAZO (§ 10B.4): un zigzag de codos cerrados sale en muchos trozos, y el tope no se multiplica por ellos. */
    it('un zigzag partido en muchos trozos reparte el tope entre todos', () => {
      // Codos de 120°: cada uno parte el trazo (`SPLIT_ANGLE`), así que salen diez trozos. Antes: 780 esquinas de más.
      const zig: { x: number; y: number }[] = [{ x: 100, y: 400 }];
      let rumbo = 0;
      for (let i = 0; i < 10; i++) {
        const p = zig[zig.length - 1]!;
        zig.push({ x: p.x + 60 * Math.cos(rumbo), y: p.y + 60 * Math.sin(rumbo) });
        rumbo += ((i % 2 ? -1 : 1) * 2 * Math.PI) / 3;
      }
      const esquinas = (rings: [number, number][][]) => rings.reduce((s, x) => s + x.length, 0);
      const siempre = brushRings(zig, BRUSH_MIN_CELLS, G);
      const roto = brushRings(zig, BRUSH_MIN_CELLS, G, { roughness: 1, seed: 3 });
      expect(roto.length).toBeGreaterThan(1);
      expect(esquinas(roto)).toBeGreaterThan(esquinas(siempre));
      expect(esquinas(roto) - esquinas(siempre)).toBeLessThanOrEqual(BAND_ROUGH_MAX_POINTS);
    });
  });

  /**
   * Un arrastre a pulso llega con cientos de puntos, y CADA vértice del anillo acaba siendo un lado contra el
   * que el servidor traza rayos en cada refresco de visión, para cada jugador. Sin simplificar, un brochazo
   * cuesta lo que costaban las 318 paredes de un círculo a mano alzada (§ «Rebanada 8»).
   */
  it('un trazo a pulso se simplifica: un brochazo no deja cientos de lados', () => {
    const aPulso = Array.from({ length: 400 }, (_, i) => ({ x: 60 + i, y: 300 + Math.sin(i / 40) * 2 }));
    const rings = brushRings(aPulso, 2, G);
    const lados = rings.reduce((n, r) => n + r.length, 0);
    expect(lados).toBeLessThan(80);
    expect(rings.length).toBeLessThanOrEqual(2);
  });

  it('sin trazo no hay forma', () => {
    expect(brushRings([], 2, G)).toEqual([]);
  });
});

/**
 * ── EL PINCEL QUE CONSTRUYE · LO QUE SE ELIGE ANTES DE PINTAR (§ «Rebanada 10») ──
 *
 * Reglas pequeñas, pero cada una sujeta una decisión suya que se pierde fácil al retocar el panel.
 */
/**
 * ── QUÉ FORMAS TIENEN SENTIDO PARA LO QUE SE LEVANTA ──
 *
 * Pega suya del 2026-09-04 mirando el panel con SALA elegida: «*esto, a mano, pulso y recta aquí no hace
 * falta, ¿no?*». Una raya no encierra nada, así que no puede ser una sala.
 */
describe('qué formas puede levantar cada cosa', () => {
  it('una sala sólo admite las cuatro que encierran área', () => {
    expect(shapesFor('room')).toEqual(['rect', 'circle', 'poly', 'free']);
  });

  /** Un muro admite las seis: una raya sí es un muro, y un área es un bloque de roca. */
  it('un muro admite las seis', () => {
    expect(shapesFor('wall')).toEqual(ROOM_SHAPES);
  });

  /** Un vano se abre CRUZANDO la pared, no rodeándola: sólo las dos que trazan una raya. */
  it('una puerta y una ventana sólo se trazan de A a B', () => {
    expect(shapesFor('door')).toEqual(['segment', 'line']);
    expect(shapesFor('window')).toEqual(['segment', 'line']);
  });
});

/**
 * 🔴 LO QUE ERA «lo que se elige antes de pintar» SE MUDÓ AL BUILDER el 2026-09-10, y con ello sus tests: la
 * lista de «suelo o muro» y la de «textura, color o borrar» eran del pincel que EXCAVABA, que él paró en
 * pantalla. Lo que se elige HOY antes de pintar vive en `paintRules.test.ts`; lo que se elige antes de
 * LEVANTAR, en el panel de Builder y en `SceneTab.test.tsx`.
 */
describe('los colores con los que se pinta', () => {
  /** Doce, que es lo que cabe en las dos filas de seis del diseño. */
  it('la paleta de la casa son doce colores, todos distintos y todos hex de seis', () => {
    expect(BRUSH_COLORS).toHaveLength(12);
    expect(new Set(BRUSH_COLORS.map(c => c.hex.toLowerCase())).size).toBe(12);
    expect(BRUSH_COLORS.every(c => isHexColor(c.hex))).toBe(true);
  });

  /**
   * La base NO comprueba el formato del color a propósito —igual que en `bg_color` y `door_color`— así que
   * el filtro tiene que estar donde se teclea, o una escena se queda con «rojo» metido en una columna de
   * color y nada se pinta.
   */
  it('un color escrito a mano vale sólo si es un hex de seis', () => {
    expect(isHexColor('#b08d57')).toBe(true);
    expect(isHexColor('#B08D57')).toBe(true);
    expect(isHexColor('#b08')).toBe(false);
    expect(isHexColor('b08d57')).toBe(false);
    expect(isHexColor('rojo')).toBe(false);
    expect(isHexColor('#b08d5g')).toBe(false);
  });

  /** Un color de la casa se llama por su nombre; el que él se inventa no tiene ninguno, y eso es el `null`. */
  it('un color de la paleta trae su nombre; uno inventado, ninguno', () => {
    expect(brushColorName('#b08d57')).toBe('sand');
    expect(brushColorName('#B08D57')).toBe('sand');
    expect(brushColorName('#123456')).toBeNull();
  });

  /** Con el pincel arrancado en un color de la casa, la muestra de la lámina se lee tal cual. */
  it('el color de serie es uno de la paleta, no uno suelto', () => {
    expect(brushColorName(DEFAULT_BRUSH_COLOR)).not.toBeNull();
  });
});
