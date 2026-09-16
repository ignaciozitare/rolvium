import { describe, it, expect, vi } from 'vitest';
import { ACCEPTED_MIME, CompressError, IMAGE_TARGETS, LEVELED_TARGETS, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, compressImage, fitDimensions, formatBytes } from './compressImage';
import type { CompressDeps } from './compressImage';

/** Un `Blob` de un tamaño concreto sin gastar memoria de verdad. */
const fakeFile = (bytes: number, type = 'image/png'): Blob => {
  const b = new Blob(['x'], { type });
  Object.defineProperty(b, 'size', { value: bytes });
  return b;
};

const deps = (over: Partial<CompressDeps> = {}, srcW = 2000, srcH = 1000, outBytes = 1000): CompressDeps => ({
  decode: vi.fn().mockResolvedValue({ width: srcW, height: srcH, source: {} as CanvasImageSource }),
  encode: vi.fn().mockResolvedValue(fakeFile(outBytes, 'image/webp')),
  ...over,
});

describe('fitDimensions', () => {
  it('escala por el lado mayor y conserva la proporción', () => {
    expect(fitDimensions(2000, 1000, 512)).toEqual({ width: 512, height: 256 });
    expect(fitDimensions(1000, 2000, 512)).toEqual({ width: 256, height: 512 });
  });

  /** Estirar una imagen pequeña sólo añade peso y borrosidad: si ya cabe, se deja como está. */
  it('nunca agranda', () => {
    expect(fitDimensions(64, 64, 512)).toEqual({ width: 64, height: 64 });
    expect(fitDimensions(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  /** Un lado a 0 daría un canvas inválido y la subida reventaría sin explicación. */
  it('una imagen larguísima y estrecha no deja el lado corto en 0', () => {
    expect(fitDimensions(10000, 3, 512).height).toBeGreaterThanOrEqual(1);
  });

  it('aguanta una imagen sin dimensiones sin dividir por cero', () => {
    expect(fitDimensions(0, 0, 512)).toEqual({ width: 0, height: 0 });
  });
});

describe('compressImage — lo que se rechaza antes de intentar nada', () => {
  it('un tipo que no es imagen no pasa', async () => {
    await expect(compressImage(fakeFile(100, 'application/pdf'), 'token', 'balanced', deps())).rejects.toMatchObject({ code: 'mime' });
  });

  it('un fichero sin tipo tampoco', async () => {
    await expect(compressImage(fakeFile(100, ''), 'token', 'balanced', deps())).rejects.toBeInstanceOf(CompressError);
  });

  /** Por encima de 8 MB se rechaza con aviso, NO se intenta: comprimir un fichero enorme cuelga la pestaña. */
  it('por encima del tope de entrada no se intenta comprimir', async () => {
    const d = deps();
    await expect(compressImage(fakeFile(MAX_INPUT_BYTES + 1), 'token', 'balanced', d)).rejects.toMatchObject({ code: 'input-too-large' });
    expect(d.decode).not.toHaveBeenCalled();
  });

  it('acepta los cuatro formatos del spec', () => {
    expect([...ACCEPTED_MIME]).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  });
});

describe('compressImage — el camino normal', () => {
  it('escala al tamaño del destino y devuelve el WebP con las dos medidas', async () => {
    const d = deps({}, 2000, 1000, 1000);
    const r = await compressImage(fakeFile(500_000), 'token', 'balanced', d);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 512, 256, IMAGE_TARGETS.token.quality);
    expect(r).toMatchObject({ compressed: true, bytes: 1000, originalBytes: 500_000, width: 512, height: 256 });
  });

  /** El fondo NUNCA reduce resolución, en ningún nivel: sólo cambia formato/calidad (condición suya original). */
  it('el fondo, en Equilibrado, no reduce resolución y usa calidad 0,90', async () => {
    const d = deps({}, 4000, 3000);
    await compressImage(fakeFile(500_000), 'background', 'balanced', d);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 4000, 3000, LEVELED_TARGETS.background.balanced.quality);
    expect(LEVELED_TARGETS.background.balanced).toEqual({ max: Infinity, quality: 0.90 });
  });

  it('el fondo no reduce resolución en NINGÚN nivel, ni con una imagen enorme', async () => {
    for (const level of ['light', 'balanced', 'max'] as const) {
      const d = deps({}, 6000, 4000);
      await compressImage(fakeFile(500_000), 'background', level, d);
      expect(d.encode).toHaveBeenCalledWith(expect.anything(), 6000, 4000, LEVELED_TARGETS.background[level].quality);
    }
  });

  /** Una PIEZA de la galería (maps, rebanada 6): más lado que un token, WebP conserva el alfa. */
  it('un objeto de la galería, en Equilibrado, va a 768 px de lado mayor y calidad 0,80', async () => {
    const d = deps({}, 3000, 1500);
    await compressImage(fakeFile(500_000), 'prop', 'balanced', d);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 768, 384, 0.80);
    expect(LEVELED_TARGETS.prop.balanced).toEqual({ max: 768, quality: 0.80 });
  });

  it('una textura, en los tres niveles, escala al lado y calidad de la tabla', async () => {
    const cases: Array<[level: 'light' | 'balanced' | 'max', max: number, quality: number]> = [
      ['light', 1280, 0.85],
      ['balanced', 1024, 0.82],
      ['max', 800, 0.80],
    ];
    for (const [level, max, quality] of cases) {
      const d = deps({}, 4000, 2000);
      await compressImage(fakeFile(500_000), 'texture', level, d);
      const size = fitDimensions(4000, 2000, max);
      expect(d.encode).toHaveBeenCalledWith(expect.anything(), size.width, size.height, quality);
      expect(LEVELED_TARGETS.texture[level]).toEqual({ max, quality });
    }
  });

  it('si no se puede leer la imagen, el error dice que fue al decodificar', async () => {
    const d = deps({ decode: vi.fn().mockRejectedValue(new Error('roto')) });
    await expect(compressImage(fakeFile(1000), 'avatar', 'balanced', d)).rejects.toMatchObject({ code: 'decode' });
  });
});

describe('compressImage — cuando comprimir no sale bien', () => {
  /**
   * Safari viejo no sabe generar WebP. La subida NO puede depender de una optimización: se sube el original.
   * Si esto se rompiera, esos usuarios se quedarían sin poder poner imagen y sin saber por qué.
   */
  it('sin WebP en el navegador, se sube el original', async () => {
    const original = fakeFile(300_000);
    const r = await compressImage(original, 'token', 'balanced', deps({ encode: vi.fn().mockResolvedValue(null) }));
    expect(r.compressed).toBe(false);
    expect(r.blob).toBe(original);
    expect(r.bytes).toBe(300_000);
  });

  /** Una imagen ya optimizada puede ENGORDAR al recomprimir. Quedarse con la gorda sería absurdo. */
  it('si el resultado pesa más que el original, se queda el original', async () => {
    const original = fakeFile(1000);
    const r = await compressImage(original, 'avatar', 'balanced', deps({ encode: vi.fn().mockResolvedValue(fakeFile(5000, 'image/webp')) }));
    expect(r.compressed).toBe(false);
    expect(r.blob).toBe(original);
  });

  it('si aun comprimido se pasa del tope de salida, se rechaza en vez de subir un ladrillo', async () => {
    const d = deps({ encode: vi.fn().mockResolvedValue(fakeFile(MAX_OUTPUT_BYTES + 1, 'image/webp')) });
    await expect(compressImage(fakeFile(MAX_INPUT_BYTES - 1), 'background', 'balanced', d)).rejects.toMatchObject({ code: 'output-too-large' });
  });

  /** El respaldo tampoco puede colar un fichero enorme por la puerta de atrás. */
  it('el respaldo sin WebP sigue respetando el tope de salida', async () => {
    const d = deps({ encode: vi.fn().mockResolvedValue(null) });
    await expect(compressImage(fakeFile(MAX_OUTPUT_BYTES + 1), 'background', 'balanced', d)).rejects.toMatchObject({ code: 'output-too-large' });
  });
});

describe('formatBytes', () => {
  it('dice el tamaño como lo diría una persona', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(180 * 1024)).toBe('180 KB');
    expect(formatBytes(Math.round(2.4 * 1024 * 1024), 'en')).toBe('2.4 MB');
  });
});

/**
 * LA OPACIDAD, para que los objetos puedan sacar su silueta (mapas § 6.9) sin volver a bajar ni descodificar
 * la imagen: se lee en la MISMA pasada, con el fichero ya abierto.
 */
describe('compressImage — el canal de transparencia', () => {
  const mapa = { data: new Uint8ClampedArray([0, 255, 255, 0]), width: 2, height: 2 };

  it('sólo se lee si se pide: de serie no se toca', async () => {
    const alpha = vi.fn().mockReturnValue(mapa);
    const r = await compressImage(fakeFile(5000), 'prop', 'balanced', deps({ alpha }));
    expect(alpha).not.toHaveBeenCalled();
    expect(r.alpha ?? null).toBeNull();
  });

  it('pedida, llega con el resultado', async () => {
    const alpha = vi.fn().mockReturnValue(mapa);
    const r = await compressImage(fakeFile(5000), 'prop', 'balanced', deps({ alpha }), { alpha: true });
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(r.alpha).toEqual(mapa);
  });

  it('🔑 si el navegador no sabe darla, se sube igual: la silueta es un extra, no un requisito', async () => {
    const sinAlpha = await compressImage(fakeFile(5000), 'prop', 'balanced', deps(), { alpha: true });
    expect(sinAlpha.alpha ?? null).toBeNull();
    expect(sinAlpha.blob).toBeInstanceOf(Blob);
    const falla = await compressImage(fakeFile(5000), 'prop', 'balanced', deps({ alpha: () => null }), { alpha: true });
    expect(falla.alpha).toBeNull();
  });

  it('y llega también cuando se devuelve el original sin comprimir', async () => {
    // El navegador no sabe hacer WebP: `encode` devuelve `null` y se sube el fichero tal cual.
    const r = await compressImage(fakeFile(5000), 'prop', 'balanced',
      deps({ encode: vi.fn().mockResolvedValue(null), alpha: () => mapa }), { alpha: true });
    expect(r.compressed).toBe(false);
    expect(r.alpha).toEqual(mapa);
  });
});
