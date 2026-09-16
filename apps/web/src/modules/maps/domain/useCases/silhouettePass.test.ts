import { describe, it, expect, vi } from 'vitest';
import { PROP_OAK, PROP_COLUMN } from '../../../../../tests/helpers/fakes';
import type { Prop } from '../entities/Scene';
import { needsSilhouette, runSilhouettePass, silhouettePatch, type SilhouettePassDeps } from './silhouettePass';

/**
 * 🎯 LA PASADA DE UNA VEZ (§ 6.9), su respuesta del 2026-09-16: «*hazlas de a una vez*».
 *
 * Lo que se prueba aquí es lo que puede salir mal en 133 objetos seguidos: que una foto que no se deja leer
 * pare la pasada, que se pise un óvalo que puso él a mano, que lo ya plantado se quede sin arreglar, y que
 * volver a lanzarla cueste otra vez lo mismo.
 */

/** Opacidad de mentira: un óvalo apaisado en una imagen cuadrada. */
const CAMION = (() => {
  const w = 48, h = 48, data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    data[y * w + x] = ((x - 24) / 22) ** 2 + ((y - 24) / 6) ** 2 <= 1 ? 255 : 0;
  }
  return { data, width: w, height: h };
})();
const VACIA = { data: new Uint8ClampedArray(16 * 16), width: 16, height: 16 };

const deps = (over: Partial<SilhouettePassDeps> = {}): SilhouettePassDeps => ({
  alphaOf: vi.fn().mockResolvedValue(CAMION),
  saveProp: vi.fn().mockResolvedValue(undefined),
  applyToPlanted: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('needsSilhouette / silhouettePatch', () => {
  it('entra en la pasada la que no la tiene, y sólo ésa', () => {
    expect(needsSilhouette(PROP_OAK)).toBe(true);
    expect(needsSilhouette({ ...PROP_OAK, defaultSilhouette: [{ x: 0, y: 0 }] })).toBe(false);
  });

  it('🔑 un ÓVALO puesto a mano no se pisa: se le guarda la silueta, pero la forma sigue siendo la suya', () => {
    const anillo = [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }];
    expect(silhouettePatch({ defaultBlockShape: 'rect' }, anillo))
      .toEqual({ defaultSilhouette: anillo, defaultBlockShape: 'silhouette' });
    expect(silhouettePatch({ defaultBlockShape: 'circle' }, anillo))
      .toEqual({ defaultSilhouette: anillo });
  });
});

describe('runSilhouettePass — los 133 de una vez', () => {
  const TRES: Prop[] = [PROP_OAK, { ...PROP_COLUMN, id: 'pr-2' }, { ...PROP_OAK, id: 'pr-3', name: 'Camión' }];

  it('le saca la silueta a cada una, la guarda y la lleva a lo ya plantado', async () => {
    const d = deps();
    const r = await runSilhouettePass(TRES, d);
    expect(r).toEqual({ hechas: 3, fallidas: 0, yaEstaban: 0 });
    expect(d.saveProp).toHaveBeenCalledTimes(3);
    // 🔑 Lo que él ve en sus mapas son COPIAS: sin esto no cambiaría una sola sombra de las que ya tiene puestas.
    expect(d.applyToPlanted).toHaveBeenCalledTimes(3);
    expect(vi.mocked(d.applyToPlanted).mock.calls[0]![0]).toBe(PROP_OAK.id);
    expect(vi.mocked(d.applyToPlanted).mock.calls[0]![1].length).toBeGreaterThanOrEqual(3);
  });

  it('🔑 una foto que no se deja bajar NO para la pasada: se cuenta y se sigue con las demás', async () => {
    const alphaOf = vi.fn()
      .mockResolvedValueOnce(null)      // red caída o CORS
      .mockResolvedValueOnce(VACIA)     // se baja, pero no hay nada opaco que contornear
      .mockResolvedValueOnce(CAMION);
    const d = deps({ alphaOf });
    const r = await runSilhouettePass(TRES, d);
    expect(r).toEqual({ hechas: 1, fallidas: 2, yaEstaban: 0 });
    expect(d.saveProp).toHaveBeenCalledTimes(1);
  });

  it('volver a lanzarla no vuelve a bajar lo que ya tiene silueta', async () => {
    const hecha = { ...PROP_OAK, defaultSilhouette: [{ x: 0, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }] };
    const d = deps();
    const r = await runSilhouettePass([hecha, { ...PROP_COLUMN, id: 'pr-2' }], d);
    expect(r).toEqual({ hechas: 1, fallidas: 0, yaEstaban: 1 });
    expect(d.alphaOf).toHaveBeenCalledTimes(1);
  });

  it('va diciendo por dónde va, para poder enseñarlo en pantalla', async () => {
    const pasos: string[] = [];
    await runSilhouettePass(TRES, deps(), p => pasos.push(`${p.done}/${p.total} ${p.name}`));
    expect(pasos[0]).toBe('0/3 Roble');
    expect(pasos.at(-1)).toBe('3/3 ');
  });

  it('una lista vacía no rompe nada ni toca la base', async () => {
    const d = deps();
    expect(await runSilhouettePass([], d)).toEqual({ hechas: 0, fallidas: 0, yaEstaban: 0 });
    expect(d.saveProp).not.toHaveBeenCalled();
  });
});
