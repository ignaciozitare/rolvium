import { describe, it, expect } from 'vitest';
import { placeMenu } from './RailMenu';

/**
 * DÓNDE FLOTA el menú de los tres puntos. En jsdom todo mide 0, así que el sitio se prueba aquí, con números:
 * el uso de verdad (abrir, elegir, cerrar con Escape) lo cubre `AdventuresTab.test.tsx`.
 */
describe('placeMenu', () => {
  const view = { w: 1000, h: 800 };
  const size = { w: 200, h: 150 };

  it('`right`: al lado de los tres puntos, a su altura', () => {
    expect(placeMenu({ top: 100, bottom: 120, left: 190, right: 204 }, size, view, 'right')).toEqual({ top: 96, left: 208 });
  });

  it('`below`: debajo de lo que lo abre, alineado a su izquierda', () => {
    expect(placeMenu({ top: 50, bottom: 66, left: 300, right: 380 }, size, view, 'below')).toEqual({ top: 70, left: 300 });
  });

  it('la última fila de un carril largo: se sube para no salirse por abajo', () => {
    expect(placeMenu({ top: 760, bottom: 780, left: 190, right: 204 }, size, view, 'right')).toEqual({ top: 646, left: 208 });
  });

  it('`below` sin sitio debajo se abre hacia arriba', () => {
    expect(placeMenu({ top: 700, bottom: 716, left: 300, right: 380 }, size, view, 'below')).toEqual({ top: 546, left: 300 });
  });

  it('sin sitio a la derecha se abre a la izquierda de los tres puntos', () => {
    expect(placeMenu({ top: 100, bottom: 120, left: 900, right: 914 }, size, view, 'right')).toEqual({ top: 96, left: 696 });
  });

  it('nunca se sale por arriba ni por la izquierda', () => {
    expect(placeMenu({ top: 0, bottom: 10, left: 0, right: 10 }, { w: 200, h: 900 }, view, 'right')).toEqual({ top: 4, left: 14 });
  });
});
