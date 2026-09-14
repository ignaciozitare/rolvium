import { describe, it, expect } from 'vitest';
import { IMAGE_CHAPEL, IMAGE_MARKET } from '../../../../../tests/helpers/fakes';
import type { Texture } from '../entities/Scene';
import {
  backgroundItems, backgroundPlace, canManageBackground, CAMPAIGN_GROUP, fromImage, fromTexture,
} from './backgroundRules';

const ROCA: Texture = {
  id: 'tx-roca', name: 'Roca gris', category: 'stone', url: 'https://x/roca.png', tileCells: 2,
  uploadedBy: 'u-gm', createdAt: '2026-09-01', updatedAt: '',
};

describe('backgroundRules — el fondo sale de dos sitios (§ EL FONDO DEL MAPA)', () => {
  it('los suyos viven en el grupo de la campaña y las texturas en su categoría: por eso salen en ese orden', () => {
    // El catálogo pinta primero los GRUPOS y luego las secciones DE SERIE, así que esto es lo que pone
    // sus fondos ARRIBA de las texturas, que es como él lo pidió.
    expect(backgroundPlace(fromImage(IMAGE_CHAPEL))).toEqual({ group: CAMPAIGN_GROUP, builtIn: null });
    expect(backgroundPlace(fromTexture(ROCA))).toEqual({ group: null, builtIn: 'stone' });
  });

  it('un fondo suyo y una textura se ven con la misma forma, cada uno con lo suyo', () => {
    expect(fromImage(IMAGE_CHAPEL)).toEqual({
      id: 'img-1', name: 'Capilla', url: IMAGE_CHAPEL.url, createdAt: IMAGE_CHAPEL.createdAt,
      uploadedBy: null, mine: true, category: null,
    });
    expect(fromTexture(ROCA)).toEqual({
      id: 'tx-roca', name: 'Roca gris', url: ROCA.url, createdAt: ROCA.createdAt,
      uploadedBy: 'u-gm', mine: false, category: 'stone',
    });
  });

  it('el catálogo enseña las dos bibliotecas juntas, y los suyos van delante', () => {
    const todo = backgroundItems([IMAGE_CHAPEL, IMAGE_MARKET], [ROCA]);
    expect(todo!.map(b => b.id)).toEqual(['img-1', 'img-2', 'tx-roca']);
    expect(todo!.filter(b => b.mine)).toHaveLength(2);
  });

  it('mientras falte CUALQUIERA de las dos listas no hay nada que enseñar: no es lo mismo vacío que sin llegar', () => {
    expect(backgroundItems(null, [ROCA])).toBeNull();
    expect(backgroundItems([IMAGE_CHAPEL], null)).toBeNull();
    expect(backgroundItems([], [])).toEqual([]);
  });

  it('sus fondos los ordena SIEMPRE él; una textura pide el permiso de texturas', () => {
    const suyo = fromImage(IMAGE_CHAPEL);
    const textura = fromTexture(ROCA);
    expect(canManageBackground(suyo, false)).toBe(true);
    expect(canManageBackground(suyo, true)).toBe(true);
    expect(canManageBackground(textura, false)).toBe(false);
    expect(canManageBackground(textura, true)).toBe(true);
  });
});
