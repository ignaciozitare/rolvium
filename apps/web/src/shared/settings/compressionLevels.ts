import type { CompressionLevel } from '@rolvium/ui';

/**
 * El nivel de compresión de imágenes, uno por tipo (textura · objeto · fondo), que elige un admin en Ajustes
 * (spec: `specs/core/images/SPEC.md`). Cambiarlo no reconvierte nada retroactivo: sólo afecta a lo que se suba
 * después. Avatar y token no tienen nivel — van fijos por `IMAGE_TARGETS`.
 */
export interface CompressionLevels {
  texture: CompressionLevel;
  prop: CompressionLevel;
  background: CompressionLevel;
}

export const DEFAULT_COMPRESSION_LEVELS: CompressionLevels = { texture: 'balanced', prop: 'balanced', background: 'balanced' };

/** La clave del ajuste de plataforma donde vive (`app_settings.key`). */
export const COMPRESSION_LEVELS_KEY = 'images.compression_levels';

const VALID_LEVELS: readonly CompressionLevel[] = ['light', 'balanced', 'max'];

/**
 * Lo leído de la base, saneado a la forma que entendemos. Cada clave que no traiga un nivel válido cae en el
 * valor de serie de ESA clave — igual de defensivo que `parseToolbarOrder`.
 */
export function parseCompressionLevels(value: unknown): CompressionLevels {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const pick = (key: keyof CompressionLevels): CompressionLevel => {
    const raw = v[key];
    return (VALID_LEVELS as readonly string[]).includes(raw as string) ? (raw as CompressionLevel) : DEFAULT_COMPRESSION_LEVELS[key];
  };
  return { texture: pick('texture'), prop: pick('prop'), background: pick('background') };
}
