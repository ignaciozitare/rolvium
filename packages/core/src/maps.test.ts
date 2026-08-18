import { describe, it, expect } from 'vitest';
import { METRES_PER_CELL, sightRadiusPx } from './maps';

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
