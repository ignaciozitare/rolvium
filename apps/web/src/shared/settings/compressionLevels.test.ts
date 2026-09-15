import { describe, it, expect } from 'vitest';
import { COMPRESSION_LEVELS_KEY, DEFAULT_COMPRESSION_LEVELS, parseCompressionLevels } from './compressionLevels';

/**
 * 🧲 El nivel de compresión de imágenes, uno por tipo (textura · objeto · fondo), que pone un admin en Ajustes
 * PARA TODOS (spec `specs/core/images/SPEC.md`). Estas reglas son las que impiden que un valor guardado a mano,
 * a medias, o de una versión vieja rompa la subida: cada clave que no traiga un nivel válido cae en el valor de
 * serie de ESA clave — igual de defensivo que `parseToolbarOrder`.
 */
describe('compressionLevels — parseCompressionLevels', () => {
  it('nada guardado (null, un número, un texto, una lista) sale con los valores de serie', () => {
    expect(parseCompressionLevels(null)).toEqual(DEFAULT_COMPRESSION_LEVELS);
    expect(parseCompressionLevels(undefined)).toEqual(DEFAULT_COMPRESSION_LEVELS);
    expect(parseCompressionLevels(7)).toEqual(DEFAULT_COMPRESSION_LEVELS);
    expect(parseCompressionLevels('balanced')).toEqual(DEFAULT_COMPRESSION_LEVELS);
    expect(parseCompressionLevels(['light', 'balanced', 'max'])).toEqual(DEFAULT_COMPRESSION_LEVELS);
  });

  it('un objeto vacío sale con los valores de serie', () => {
    expect(parseCompressionLevels({})).toEqual(DEFAULT_COMPRESSION_LEVELS);
  });

  it('lo guardado manda cuando el nivel es válido, clave por clave', () => {
    expect(parseCompressionLevels({ texture: 'light', prop: 'max', background: 'balanced' }))
      .toEqual({ texture: 'light', prop: 'max', background: 'balanced' });
  });

  it('un nivel inválido en UNA clave cae en el de serie de esa clave, sin tocar las otras', () => {
    expect(parseCompressionLevels({ texture: 'max', prop: 'nope', background: 'light' }))
      .toEqual({ texture: 'max', prop: DEFAULT_COMPRESSION_LEVELS.prop, background: 'light' });
  });

  it('varias claves inválidas a la vez caen cada una en su valor de serie', () => {
    expect(parseCompressionLevels({ texture: 7, prop: null, background: 'ultra' }))
      .toEqual(DEFAULT_COMPRESSION_LEVELS);
  });

  it('claves de más (basura o de otro ajuste) se ignoran; faltar una clave cae en su valor de serie', () => {
    expect(parseCompressionLevels({ texture: 'light', otraCosa: 'x' }))
      .toEqual({ texture: 'light', prop: DEFAULT_COMPRESSION_LEVELS.prop, background: DEFAULT_COMPRESSION_LEVELS.background });
  });

  it('la clave del ajuste en `app_settings` es la esperada', () => {
    expect(COMPRESSION_LEVELS_KEY).toBe('images.compression_levels');
  });
});
