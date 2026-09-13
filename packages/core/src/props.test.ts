import { describe, it, expect } from 'vitest';
import { CIRCLE_SIDES, propBlockRing, propBlockSegments, propsGeometry, type PropBlock } from './props';

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
