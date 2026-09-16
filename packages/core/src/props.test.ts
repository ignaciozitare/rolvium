import { describe, it, expect } from 'vitest';
import { CIRCLE_SIDES, SILHOUETTE_POINTS, propBlockRing, propBlockSegments, propsGeometry, silhouetteRing, type PropBlock } from './props';

/** Una columna cuadrada de 40 px, sin desplazar ni girar, plantada en (100, 100). */
const COLUMN: PropBlock = { x: 100, y: 100, rotation: 0, blocksSight: true, blocksMove: true, blockShape: 'rect', blockW: 40, blockH: 40, blockDx: 0, blockDy: 0 };

describe('propBlockRing — la forma que estorba, en px de escena', () => {
  it('un rectángulo son sus cuatro esquinas alrededor del centro de la pieza', () => {
    expect(propBlockRing({ ...COLUMN, blockW: 40, blockH: 20 })).toEqual([
      { x: 80, y: 90 }, { x: 120, y: 90 }, { x: 120, y: 110 }, { x: 80, y: 110 },
    ]);
  });

  it('el desplazamiento mueve la forma sin mover la pieza', () => {
    const ring = propBlockRing({ ...COLUMN, blockDx: 10, blockDy: -5 });
    expect(ring[0]).toEqual({ x: 90, y: 75 });
    expect(ring[2]).toEqual({ x: 130, y: 115 });
  });

  it('gira con la pieza alrededor de SU centro, no del de la forma', () => {
    // Un rectángulo tumbado (40 × 20) girado 90° queda de pie (20 × 40).
    const ring = propBlockRing({ ...COLUMN, blockW: 40, blockH: 20, rotation: 90 });
    const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
    expect(Math.min(...xs)).toBeCloseTo(90);
    expect(Math.max(...xs)).toBeCloseTo(110);
    expect(Math.min(...ys)).toBeCloseTo(80);
    expect(Math.max(...ys)).toBeCloseTo(120);
    // …y con la forma desplazada, el desplazamiento también gira: (dx 10, dy 0) a 90° queda en (0, 10).
    const desplazada = propBlockRing({ ...COLUMN, blockDx: 10, rotation: 90 });
    const cx = desplazada.reduce((a, p) => a + p.x, 0) / 4, cy = desplazada.reduce((a, p) => a + p.y, 0) / 4;
    expect(cx).toBeCloseTo(100);
    expect(cy).toBeCloseTo(110);
  });

  it('un círculo son CIRCLE_SIDES puntos a la distancia del radio, y blockW es el DIÁMETRO', () => {
    const ring = propBlockRing({ ...COLUMN, blockShape: 'circle', blockW: 60, blockH: 5 });
    expect(ring).toHaveLength(CIRCLE_SIDES);
    for (const p of ring) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(30, 2);
  });

  it('una forma sin medida no estorba: ni rectángulo plano ni círculo de radio cero', () => {
    expect(propBlockRing({ ...COLUMN, blockW: 0 })).toEqual([]);
    expect(propBlockRing({ ...COLUMN, blockH: 0 })).toEqual([]);
    expect(propBlockRing({ ...COLUMN, blockShape: 'circle', blockW: 0 })).toEqual([]);
  });
});

describe('propBlockSegments / propsGeometry — lo que entienden la visión y el freno', () => {
  it('cierra el anillo: tantos lados como puntos, y el último vuelve al primero', () => {
    const segs = propBlockSegments(COLUMN);
    expect(segs).toHaveLength(4);
    expect(segs[0]).toEqual([80, 80, 120, 80]);
    expect(segs[3]).toEqual([80, 120, 80, 80]);
  });

  it('separa lo que corta la vista de lo que corta el paso, y se salta lo que no hace ninguna de las dos', () => {
    const cortina: PropBlock = { ...COLUMN, x: 300, blocksSight: true, blocksMove: false };
    const alfombra: PropBlock = { ...COLUMN, x: 500, blocksSight: false, blocksMove: false };
    const banco: PropBlock = { ...COLUMN, x: 700, blocksSight: false, blocksMove: true };
    const g = propsGeometry([COLUMN, cortina, alfombra, banco]);
    expect(g.sight).toHaveLength(8);   // columna + cortina
    expect(g.move).toHaveLength(8);    // columna + banco
    expect(g.sight.some(([x1]) => x1 === 680)).toBe(false);
    expect(g.move.some(([x1]) => x1 === 280)).toBe(false);
  });

  it('sin piezas, nada: la escena no paga por una galería vacía', () => {
    expect(propsGeometry([])).toEqual({ sight: [], move: [] });
  });
});

// ── LA SILUETA (§ 6.9) ───────────────────────────────────────────────────────

/**
 * Un mapa de transparencia de mentira: `dentro` dice qué píxeles son el objeto. Se prueba con formas que se
 * pueden comprobar a mano, no con un PNG de verdad — el algoritmo no sabe de imágenes, sólo de opacidad.
 */
const alphaDe = (width: number, height: number, dentro: (x: number, y: number) => boolean): Uint8ClampedArray => {
  const a = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) a[y * width + x] = dentro(x, y) ? 255 : 0;
  return a;
};

describe('silhouetteRing — la silueta sale del PNG (§ 6.9)', () => {
  it('una imagen opaca entera da el borde entero: la silueta cae en el marco', () => {
    const ring = silhouetteRing(alphaDe(64, 64, () => true), 64, 64);
    expect(ring).toHaveLength(SILHOUETTE_POINTS);
    // En fracciones de la huella, el borde es media imagen desde el centro.
    for (const p of ring) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeGreaterThan(0.45);
  });

  it('un objeto centrado y pequeño da una silueta pequeña, no la huella entera', () => {
    // Un disco de 10 px de radio en una imagen de 100: la silueta tiene que quedarse en su tamaño.
    const r = 10;
    const ring = silhouetteRing(alphaDe(100, 100, (x, y) => (x - 50) ** 2 + (y - 50) ** 2 <= r * r), 100, 100);
    expect(ring).toHaveLength(SILHOUETTE_POINTS);
    for (const p of ring) {
      const dist = Math.hypot(p.x * 100, p.y * 100);
      expect(dist).toBeGreaterThan(r - 2);
      expect(dist).toBeLessThan(r + 2);
    }
  });

  it('🔑 LO QUE ÉL PIDIÓ: un camión apaisado NO da un cuadrado — la silueta se ciñe a lo ancho', () => {
    // Una caja de 80×16 centrada en una imagen cuadrada de 100: el bloque de antes era la imagen entera.
    const ring = silhouetteRing(alphaDe(100, 100, (x, y) => x >= 10 && x < 90 && y >= 42 && y < 58), 100, 100);
    const altura = Math.max(...ring.map(p => Math.abs(p.y))) * 100 * 2;
    const ancho = Math.max(...ring.map(p => Math.abs(p.x))) * 100 * 2;
    expect(ancho).toBeGreaterThan(75);
    expect(altura).toBeLessThan(20);   // ni de lejos los 100 px del rectángulo de hoy
  });

  it('el corte de opacidad manda: lo medio transparente no cuenta como objeto', () => {
    const casi = new Uint8ClampedArray(32 * 32).fill(60);   // 24 % de opacidad en toda la imagen
    expect(silhouetteRing(casi, 32, 32)).toEqual([]);
    expect(silhouetteRing(casi, 32, 32, { alphaCut: 0.2 })).toHaveLength(SILHOUETTE_POINTS);
  });

  it('una imagen transparente entera no da silueta, y quien llama se queda con su forma de siempre', () => {
    expect(silhouetteRing(new Uint8ClampedArray(32 * 32), 32, 32)).toEqual([]);
    expect(silhouetteRing(new Uint8ClampedArray(0), 0, 0)).toEqual([]);
  });

  it('se puede pedir otro número de puntos, y nunca baja de tres', () => {
    const lleno = alphaDe(40, 40, () => true);
    expect(silhouetteRing(lleno, 40, 40, { points: 8 })).toHaveLength(8);
    expect(silhouetteRing(lleno, 40, 40, { points: 1 })).toHaveLength(3);
  });

  it('los rayos que no topan con nada NO inventan un pico: una media luna no cierra por el hueco', () => {
    // Sólo la mitad de arriba es objeto: los doce rayos de abajo salen vacíos.
    const ring = silhouetteRing(alphaDe(64, 64, (_x, y) => y < 30), 64, 64);
    expect(ring.length).toBeGreaterThanOrEqual(3);
    expect(ring.length).toBeLessThan(SILHOUETTE_POINTS);
    for (const p of ring) expect(p.y).toBeLessThanOrEqual(0);
  });
});

describe('propBlockRing con silueta — de fracciones a píxeles de escena', () => {
  /** Un triángulo de mentira, ya en fracciones de la huella. */
  const TRI = [{ x: 0, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }];

  it('estira la silueta a la huella de la pieza y la deja en px de escena', () => {
    const ring = propBlockRing({ ...COLUMN, blockShape: 'silhouette', blockW: 40, blockH: 20, silhouette: TRI });
    expect(ring).toEqual([{ x: 100, y: 90 }, { x: 120, y: 110 }, { x: 80, y: 110 }]);
  });

  it('gira con la pieza, como las otras dos formas', () => {
    const ring = propBlockRing({ ...COLUMN, blockShape: 'silhouette', silhouette: TRI, rotation: 90 });
    expect(ring[0]!.x).toBeCloseTo(120);
    expect(ring[0]!.y).toBeCloseTo(100);
  });

  it('🔑 sin silueta guardada se cae al RECTÁNGULO: una pieza vieja sigue estorbando como hasta hoy', () => {
    const vieja = propBlockRing({ ...COLUMN, blockShape: 'silhouette', silhouette: null });
    expect(vieja).toEqual(propBlockRing({ ...COLUMN, blockShape: 'rect' }));
    // Y con una lista que no llega a figura, lo mismo: nunca se queda sin estorbar en silencio.
    expect(propBlockRing({ ...COLUMN, blockShape: 'silhouette', silhouette: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }] }))
      .toEqual(propBlockRing({ ...COLUMN, blockShape: 'rect' }));
  });

  it('la silueta llega entera a la visión y al freno, como cualquier otra forma', () => {
    const pieza: PropBlock = { ...COLUMN, blockShape: 'silhouette', silhouette: TRI };
    const { sight, move } = propsGeometry([pieza]);
    expect(sight).toHaveLength(3);
    expect(move).toHaveLength(3);
    expect(propBlockSegments(pieza)).toHaveLength(3);
  });
});
