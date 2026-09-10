import { describe, it, expect } from 'vitest';
import { brushAlphaAt, brushPlateau, roughOutline, roughRadii, roughReach, ROUGH_MAX_BITE, ROUGH_POINTS } from './brush';

/** Un azar SEMBRADO: la forma del brochazo es aleatoria a propósito, así que probarla exige poder repetirla. */
const seeded = (seed: number) => (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('la forma de un brochazo', () => {
  /**
   * 🔑 EL CONTORNO NUNCA CRECE HACIA FUERA. Si creciera, el brochazo pintaría más ancho que el círculo que el
   * director ve en el cursor —pintaría donde no apunta— y dentro de una sala se saldría del suelo.
   */
  it('el borde roto sólo muerde hacia dentro, y como mucho la mitad del radio', () => {
    const radii = roughRadii(1, seeded(7));
    expect(radii).toHaveLength(ROUGH_POINTS);
    for (const r of radii) {
      expect(r).toBeLessThanOrEqual(1);
      expect(r).toBeGreaterThanOrEqual(1 - ROUGH_MAX_BITE);
    }
  });

  it('sin nada de roto el contorno es el círculo entero', () => {
    expect(roughRadii(0, seeded(3))).toEqual(Array.from({ length: ROUGH_POINTS }, () => 1));
  });

  /** El azar entra POR PARÁMETRO: es lo único que hace que esto se pueda probar en vez de creérselo. */
  it('el mismo azar da el mismo contorno, y otro azar da otro', () => {
    expect(roughRadii(0.8, seeded(11))).toEqual(roughRadii(0.8, seeded(11)));
    expect(roughRadii(0.8, seeded(11))).not.toEqual(roughRadii(0.8, seeded(12)));
  });

  // ── el contorno como puntos ───────────────────────────────────────────────
  it('el contorno da un punto por vértice, dando la vuelta al centro', () => {
    const pts = roughOutline(100, 50, 10, [1, 1, 1, 1]);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 110, y: 50 });
    expect(pts[1]!.x).toBeCloseTo(100, 5);
    expect(pts[1]!.y).toBeCloseTo(60, 5);
  });

  it('un vértice mordido acerca su punto al centro, y ninguno se sale del radio', () => {
    const pts = roughOutline(0, 0, 10, [0.5, 1, 1, 1]);
    expect(Math.hypot(pts[0]!.x, pts[0]!.y)).toBeCloseTo(5, 5);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(10 + 1e-9);
  });

  /**
   * `roughReach` es la MISMA forma leída en un ángulo cualquiera: el lienzo dibuja el polígono, pero la
   * niebla pregunta casilla a casilla y una casilla cae donde cae. Si las dos no coincidieran, el pincel
   * tendría una forma en una capa y otra en la niebla siendo el mismo mando.
   */
  it('en un vértice exacto, el alcance es el del vértice', () => {
    const radii = [0.5, 0.8, 1, 0.6];
    expect(roughReach(radii, 0)).toBeCloseTo(0.5, 6);
    expect(roughReach(radii, Math.PI / 2)).toBeCloseTo(0.8, 6);
    expect(roughReach(radii, Math.PI)).toBeCloseTo(1, 6);
  });

  it('entre dos vértices interpola, y da la vuelta entera sin costura', () => {
    const radii = [0.5, 1, 1, 1];
    expect(roughReach(radii, Math.PI / 4)).toBeCloseTo(0.75, 6);
    // El último vértice es vecino del PRIMERO: sin eso se ve el corte por donde se cierra el contorno.
    expect(roughReach(radii, 2 * Math.PI - 0.001)).toBeCloseTo(roughReach(radii, -0.001), 6);
    expect(roughReach(radii, 7 * Math.PI / 4)).toBeCloseTo(0.75, 6);
  });

  it('sin contorno, el alcance es el radio entero', () => {
    expect(roughReach([], 1.23)).toBe(1);
  });

  // ── el perfil de opacidad ─────────────────────────────────────────────────
  /**
   * El MISMO perfil que el degradado del lienzo, escrito como número porque la niebla va por casillas y no
   * puede usar un degradado. Los dos salen de aquí para que no puedan discrepar.
   */
  it('el disco opaco llega hasta la dureza y de ahí se desvanece', () => {
    expect(brushAlphaAt(0, 0.6, 0.4)).toBeCloseTo(0.6, 6);
    expect(brushAlphaAt(0.4, 0.6, 0.4)).toBeCloseTo(0.6, 6);
    expect(brushAlphaAt(0.7, 0.6, 0.4)).toBeCloseTo(0.3, 6);
    expect(brushAlphaAt(1, 0.6, 0.4)).toBe(0);
  });

  /** A dureza máxima sigue quedando un pelo de degradado: un canto del todo duro deja el recorte a tijera. */
  it('ni a tope corta del todo a filo', () => {
    expect(brushPlateau(1)).toBe(0.98);
    expect(brushPlateau(9)).toBe(0.98);
    expect(brushAlphaAt(0.97, 1, 1)).toBe(1);
    expect(brushAlphaAt(0.99, 1, 1)).toBeGreaterThan(0);
    expect(brushAlphaAt(0.99, 1, 1)).toBeLessThan(1);
  });

  it('aguanta basura sin romperse', () => {
    expect(brushAlphaAt(0, Number.NaN, Number.NaN)).toBe(0);
    expect(roughRadii(Number.NaN, seeded(1))).toEqual(Array.from({ length: ROUGH_POINTS }, () => 1));
  });
});
