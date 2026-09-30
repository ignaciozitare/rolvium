import { describe, it, expect } from 'vitest';
import { clampSideWidth, SIDE_WIDTH_DEFAULT, SIDE_WIDTH_MAX, SIDE_WIDTH_MIN } from './layoutRules';

/**
 * EL ANCHO DEL CARRIL (suyo, 2026-09-28: «*la barra lateral donde esta el registro y eso deberia poder
 * cambiarse el tamaño arrastrando el borde*»). Lo que se fija aquí son los topes: un carril de 20 px no se
 * lee, y uno de 900 px se come la mesa, que es lo que se ha venido a mirar.
 */
describe('clampSideWidth', () => {
  it('un ancho normal se respeta tal cual', () => {
    expect(clampSideWidth(320)).toBe(320);
    expect(clampSideWidth(SIDE_WIDTH_DEFAULT)).toBe(SIDE_WIDTH_DEFAULT);
  });

  it('por debajo del mínimo se recorta: el Registro tiene que poder leerse', () => {
    expect(clampSideWidth(20)).toBe(SIDE_WIDTH_MIN);
    expect(clampSideWidth(-500)).toBe(SIDE_WIDTH_MIN);
  });

  it('por encima del máximo también: el carril no se come la mesa', () => {
    expect(clampSideWidth(4000)).toBe(SIDE_WIDTH_MAX);
  });

  it('los topes son alcanzables, no exclusivos', () => {
    expect(clampSideWidth(SIDE_WIDTH_MIN)).toBe(SIDE_WIDTH_MIN);
    expect(clampSideWidth(SIDE_WIDTH_MAX)).toBe(SIDE_WIDTH_MAX);
  });

  it('se queda en píxeles enteros: medio píxel deja el borde borroso', () => {
    expect(clampSideWidth(320.6)).toBe(321);
  });

  it('🔑 lo que no es un número vuelve al de serie, nunca a NaN', () => {
    // Un `localStorage` manoseado o de otra versión no puede dejar la mesa con `width: NaNpx`.
    expect(clampSideWidth(NaN)).toBe(SIDE_WIDTH_DEFAULT);
    expect(clampSideWidth(Infinity)).toBe(SIDE_WIDTH_DEFAULT);
    expect(clampSideWidth(Number('hola'))).toBe(SIDE_WIDTH_DEFAULT);
  });
});
