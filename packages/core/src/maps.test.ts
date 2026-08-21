import { describe, it, expect } from 'vitest';
import { METRES_PER_CELL, segSegDist, sightRadiusPx, slideCircle } from './maps';

describe('sightRadiusPx', () => {
  it('by day the geometry is the only limit: there is no radius', () => {
    expect(sightRadiusPx('day', 9, 27)).toBeNull();
    expect(sightRadiusPx('day', 0, 27)).toBeNull();
  });

  it('by night it turns metres into scene px through the grid', () => {
    // 9 m / 1,5 m per cell = 6 cells · 27 px = 162 px
    expect(sightRadiusPx('night', 9, 27)).toBe(162);
    expect(sightRadiusPx('night', 3, 40)).toBe(80);
  });

  it('a system with another scale passes its own metres per cell', () => {
    expect(sightRadiusPx('night', 9, 27, 3)).toBe(81);
    expect(sightRadiusPx('night', 9, 27, METRES_PER_CELL)).toBe(sightRadiusPx('night', 9, 27));
  });

  it('a night with no radius is total darkness, not unlimited sight', () => {
    expect(sightRadiusPx('night', 0, 27)).toBe(0);
  });
});

/**
 * La física de los tokens vive en `core` y no en una de las dos orillas porque la usan LAS DOS: el navegador
 * para que el arrastre se sienta al instante, y el servidor —el único que tiene los muros secretos— para
 * tener la última palabra. Si viviera en una sola, un día dirían cosas distintas.
 */
describe('slideCircle / segSegDist — paredes sólidas (rebanada 4)', () => {
  const MURO = [100, 0, 100, 200] as const;   // vertical en x = 100

  it('segSegDist da 0 cuando se cruzan, y la separación real cuando no', () => {
    expect(segSegDist({ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 0 }, { x: 100, y: 200 })).toBe(0);
    expect(segSegDist({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 })).toBe(50);
    // paralelos, que es donde el cálculo por intersección no sirve
    expect(segSegDist({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 30, y: 0 }, { x: 30, y: 100 })).toBe(30);
  });

  it('mira el CAMINO, no el punto de llegada: un arrastre rápido no atraviesa la pared', () => {
    // los DOS extremos están lejos del muro; sólo el camino lo cruza
    expect(slideCircle({ x: 50, y: 100 }, { x: 150, y: 100 }, 10, [MURO])).toEqual({ x: 50, y: 100 });
  });

  it('resbala pegado a la pared en vez de clavarse', () => {
    expect(slideCircle({ x: 50, y: 100 }, { x: 150, y: 160 }, 10, [MURO])).toEqual({ x: 50, y: 160 });
  });

  it('el cuerpo entero cuenta: el hueco por el que pasa un radio pequeño no deja pasar uno grande', () => {
    const hueco = [[100, 0, 100, 80], [100, 120, 100, 200]] as const;
    expect(slideCircle({ x: 60, y: 100 }, { x: 140, y: 100 }, 8, hueco)).toEqual({ x: 140, y: 100 });
    expect(slideCircle({ x: 60, y: 100 }, { x: 140, y: 100 }, 30, hueco)).toEqual({ x: 60, y: 100 });
  });

  it('sin muros que bloqueen, va donde le pidan', () => {
    expect(slideCircle({ x: 50, y: 100 }, { x: 150, y: 100 }, 10, [])).toEqual({ x: 150, y: 100 });
  });

  it('quien YA estaba dentro de un muro no se queda encerrado', () => {
    expect(slideCircle({ x: 100, y: 100 }, { x: 105, y: 100 }, 10, [MURO])).toEqual({ x: 105, y: 100 });
  });
});
