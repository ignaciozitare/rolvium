import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../helpers/render';
import { LIGHT_SECRET, SCENE_WAREHOUSE } from '../helpers/fakes';
import { LightsLayer, lightFeather } from '@/modules/maps/ui/canvasLayers';
import { lightRadiusPx } from '@/modules/maps/domain/useCases/layerRules';

/**
 * Pin de dos quejas del dueño sobre el cono, la segunda de ellas repetida (2026-08-31 y 2026-09-01:
 * «las luces cónicas sigue teniendo el borde duro te pedí que ajustes eso»).
 *
 * 1. **El borde duro.** Se pintaba el cono y se le ponía encima su propia silueta difuminada como máscara.
 *    Multiplicar una forma por su propio borde borroso NO difumina: en el filo la máscara vale ~0,5 y por
 *    fuera no hay nada pintado, así que la luz saltaba de media a cero de golpe. Seguía siendo una raya.
 *    La regla que lo evita: **lo pintado tiene que ser más grande que la forma**, para que el apagón entero
 *    ocurra dentro de lo pintado y la máscara sea la única que decide dónde acaba.
 * 2. **El brillo en mitad del cono.** Un `radialGradient` se mide por omisión contra la CAJA del objeto, así
 *    que en un cono el punto brillante caía en el centro del triángulo —a media pared— en vez de en la
 *    antorcha. La regla: el degradado va en coordenadas de escena y nace en la luz.
 *
 * Las dos cosas se ven mirando la pantalla y ninguna la pilla el typecheck. De ahí este pin.
 */
describe('regresión · la luz cónica se apaga en el borde y nace en su vértice', () => {
  const mount = () => {
    const { container } = renderWithProviders(
      <svg><LightsLayer scene={SCENE_WAREHOUSE} lights={[LIGHT_SECRET]} /></svg>,
    );
    return container;
  };

  it('el brillo nace en la LUZ (el vértice del cono), no en el centro de su caja', () => {
    const g = mount().querySelector(`#mp-light-${LIGHT_SECRET.id}`)!;
    expect(g.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect(Number(g.getAttribute('cx'))).toBe(LIGHT_SECRET.x);
    expect(Number(g.getAttribute('cy'))).toBe(LIGHT_SECRET.y);
    // Y se apaga justo al llegar a su alcance: ni antes ni después.
    expect(Number(g.getAttribute('r'))).toBe(lightRadiusPx(LIGHT_SECRET, SCENE_WAREHOUSE.grid));
  });

  it('lo pintado desborda la forma, que es lo único que deja el borde apagarse de verdad', () => {
    const c = mount();
    const painted = c.querySelector('[data-testid="mp-light"]')!;
    const r = lightRadiusPx(LIGHT_SECRET, SCENE_WAREHOUSE.grid);
    const f = lightFeather(r);
    // Medio ancho de lo pintado, contra el radio del cono más lo que se lleva el desenfoque.
    const half = Number(painted.getAttribute('width')) / 2;
    expect(half).toBeGreaterThan(r + 3 * f);
    // La forma vive en la MÁSCARA, y es un cono: es ella la que recorta.
    expect(c.querySelector('[data-testid="mp-light-shape"]')!.tagName.toLowerCase()).toBe('path');
    expect(painted.getAttribute('mask')).toBe(`url(#mp-litmask-${LIGHT_SECRET.id})`);
  });

  it('el desenfoque se mide en px de ESCENA y con margen: si acabase en el filo de su región, se recortaría a sí mismo', () => {
    const filter = mount().querySelector(`#mp-lightblur-${LIGHT_SECRET.id}`)!;
    expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse');
    const r = lightRadiusPx(LIGHT_SECRET, SCENE_WAREHOUSE.grid);
    const f = lightFeather(r);
    expect(Number(filter.getAttribute('width')) / 2).toBeGreaterThan(r + 3 * f);
    expect(Number(filter.querySelector('feGaussianBlur')!.getAttribute('stdDeviation'))).toBe(f);
  });
});
