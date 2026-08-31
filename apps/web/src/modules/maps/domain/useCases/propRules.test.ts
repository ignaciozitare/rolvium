import { describe, it, expect } from 'vitest';
import { SCENE_WAREHOUSE } from '../../../../../tests/helpers/fakes';
import type { Prop, SceneProp } from '../entities/Scene';
import {
  MAX_SCALE, MIN_SCALE, PROP_CATEGORIES, clampScale, duplicateProp, filterProps, footprintOf,
  isAppProp, matchesQuery, plantProp, propPath, scaleChanged, scaleOfWidth,
} from './propRules';

const OAK: Prop = {
  id: 'pr-oak', campaignId: 'c1', name: 'Roble', category: 'vegetation',
  imageUrl: 'https://x/oak.webp', naturalWidth: 200, naturalHeight: 300, defaultScale: 1,
  defaultBlocksSight: false, defaultBlocksMove: false, defaultBlockShape: 'rect',
  uploadedBy: 'u-gm', createdAt: '', updatedAt: '',
};
const COLUMN: Prop = {
  ...OAK, id: 'pr-col', name: 'Columna', category: 'furniture', naturalWidth: 100, naturalHeight: 100,
  defaultBlocksSight: true, defaultBlocksMove: true, defaultBlockShape: 'circle',
};
/** Una del catálogo de la app: sin campaña. */
const APP_CHAIR: Prop = { ...OAK, id: 'pr-chair', campaignId: null, name: 'Silla', category: 'furniture' };

describe('propRules — la escala que se recuerda (§ 6.4)', () => {
  it('la huella sale del tamaño natural por la escala, y la proporción no se puede romper', () => {
    expect(footprintOf(OAK, 1)).toEqual({ width: 200, height: 300 });
    const grande = footprintOf(OAK, 1.5);
    expect(grande).toEqual({ width: 300, height: 450 });
    // Un solo número para los dos lados: la proporción se conserva sola.
    expect(grande.width / grande.height).toBeCloseTo(OAK.naturalWidth / OAK.naturalHeight);
  });

  it('del ancho se saca la escala de vuelta: es lo que permite RECORDAR lo que se hizo con el ratón', () => {
    expect(scaleOfWidth(OAK, 300)).toBeCloseTo(1.5);
    expect(scaleOfWidth(OAK, 200)).toBeCloseTo(1);
  });

  it('la escala se acota por los dos lados: ni un roble de un kilómetro ni una mota invisible', () => {
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(-3)).toBe(MIN_SCALE);
    expect(footprintOf(OAK, 1e6).width).toBe(200 * MAX_SCALE);
  });

  it('sólo se reescribe la biblioteca cuando la escala ha cambiado de verdad', () => {
    expect(scaleChanged(1, 1)).toBe(false);
    expect(scaleChanged(1, 1.00001)).toBe(false);   // el ruido de un arrastre que vuelve donde empezó
    expect(scaleChanged(1, 1.2)).toBe(true);
  });
});

describe('propRules — plantar y duplicar (§ 6.3, § 6.5)', () => {
  it('plantar copia la foto y el nombre: es lo que hace que sobreviva a borrar la pieza de la biblioteca', () => {
    const planted = plantProp(OAK, { x: 120, y: 340 }, SCENE_WAREHOUSE);
    expect(planted).toMatchObject({
      sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId, propId: OAK.id,
      imageUrl: OAK.imageUrl, name: OAK.name, x: 120, y: 340, rotation: 0, layerId: null,
    });
  });

  it('plantar usa la escala que la pieza recuerda, y la que se le pase manda sobre ella', () => {
    expect(plantProp({ ...OAK, defaultScale: 2 }, { x: 0, y: 0 }, SCENE_WAREHOUSE)).toMatchObject({ width: 400, height: 600 });
    expect(plantProp({ ...OAK, defaultScale: 2 }, { x: 0, y: 0 }, SCENE_WAREHOUSE, null, 0.5)).toMatchObject({ width: 100, height: 150 });
  });

  it('el estorbo nace con lo que diga la biblioteca, cubriendo la huella entera', () => {
    const arbol = plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE);
    expect(arbol).toMatchObject({ blocksSight: false, blocksMove: false, blockShape: 'rect', blockW: 200, blockH: 300, blockDx: 0, blockDy: 0 });
    // En círculo manda el lado mayor: rodea el dibujo en vez de dejarle las esquinas fuera.
    const col = plantProp({ ...COLUMN, naturalWidth: 100, naturalHeight: 260 }, { x: 0, y: 0 }, SCENE_WAREHOUSE);
    expect(col).toMatchObject({ blocksSight: true, blocksMove: true, blockShape: 'circle', blockW: 260, blockH: 260 });
  });

  it('planta en la capa que se le diga; sin decir nada, en su capa natural', () => {
    expect(plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE).layerId).toBeNull();
    expect(plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE, 'ly-7').layerId).toBe('ly-7');
  });

  it('duplicar conserva giro y tamaño: plantar de nuevo perdería lo que se acaba de ajustar a mano', () => {
    const puesta: SceneProp = {
      ...plantProp(OAK, { x: 10, y: 10 }, SCENE_WAREHOUSE), id: 'sp-1', createdAt: 't', updatedAt: 't',
      width: 333, height: 499, rotation: 42, blocksSight: true, blockW: 50, blockDx: 7,
    };
    const copia = duplicateProp(puesta, { x: 500, y: 600 });
    expect(copia).toMatchObject({ x: 500, y: 600, width: 333, height: 499, rotation: 42, blocksSight: true, blockW: 50, blockDx: 7 });
    expect(copia).not.toHaveProperty('id');
  });
});

describe('propRules — encontrar una pieza entre doscientas (§ 6.1)', () => {
  it('son seis categorías, cerradas', () => {
    expect(PROP_CATEGORIES).toEqual(['furniture', 'vegetation', 'floors', 'doors', 'markers', 'misc']);
  });

  it('el buscador ignora mayúsculas y acentos, y vacío no filtra nada', () => {
    expect(matchesQuery({ name: 'Árbol viejo' }, 'arbol')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, 'VIEJO')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, '  ')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, 'mesa')).toBe(false);
  });

  it('la categoría y el buscador filtran a la vez', () => {
    const all = [OAK, COLUMN, APP_CHAIR];
    expect(filterProps(all, null, '').map(p => p.id)).toEqual(['pr-oak', 'pr-col', 'pr-chair']);
    expect(filterProps(all, 'furniture', '').map(p => p.id)).toEqual(['pr-col', 'pr-chair']);
    expect(filterProps(all, 'furniture', 'sil').map(p => p.id)).toEqual(['pr-chair']);
    expect(filterProps(all, 'doors', '')).toEqual([]);
  });

  it('una pieza sin campaña es del catálogo de la app: es lo que prepara el catálogo de serie', () => {
    expect(isAppProp(APP_CHAIR)).toBe(true);
    expect(isAppProp(OAK)).toBe(false);
  });
});

describe('propRules — dónde vive la foto', () => {
  it('va al bucket de fondos que ya existe, bajo la carpeta de la campaña', () => {
    expect(propPath('c1', 'pr-oak')).toBe('c1/props/pr-oak.webp');
  });
});
