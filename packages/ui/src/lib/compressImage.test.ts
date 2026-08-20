import { describe, it, expect, vi } from 'vitest';
import { ACCEPTED_MIME, CompressError, IMAGE_TARGETS, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, compressImage, fitDimensions, formatBytes } from './compressImage';
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
    await expect(compressImage(fakeFile(100, 'application/pdf'), 'token', deps())).rejects.toMatchObject({ code: 'mime' });
  });

  it('un fichero sin tipo tampoco', async () => {
    await expect(compressImage(fakeFile(100, ''), 'token', deps())).rejects.toBeInstanceOf(CompressError);
  });

  /** Por encima de 8 MB se rechaza con aviso, NO se intenta: comprimir un fichero enorme cuelga la pestaña. */
  it('por encima del tope de entrada no se intenta comprimir', async () => {
    const d = deps();
    await expect(compressImage(fakeFile(MAX_INPUT_BYTES + 1), 'token', d)).rejects.toMatchObject({ code: 'input-too-large' });
    expect(d.decode).not.toHaveBeenCalled();
  });

  it('acepta los cuatro formatos del spec', () => {
    expect([...ACCEPTED_MIME]).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  });
});

describe('compressImage — el camino normal', () => {
  it('escala al tamaño del destino y devuelve el WebP con las dos medidas', async () => {
    const d = deps({}, 2000, 1000, 1000);
    const r = await compressImage(fakeFile(500_000), 'token', d);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 512, 256, IMAGE_TARGETS.token.quality);
    expect(r).toMatchObject({ compressed: true, bytes: 1000, originalBytes: 500_000, width: 512, height: 256 });
  });

  it('el fondo de escena admite mucho más lado que un token', async () => {
    const d = deps({}, 4000, 3000);
    await compressImage(fakeFile(500_000), 'background', d);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 2560, 1920, IMAGE_TARGETS.background.quality);
  });

  it('si no se puede leer la imagen, el error dice que fue al decodificar', async () => {
    const d = deps({ decode: vi.fn().mockRejectedValue(new Error('roto')) });
    await expect(compressImage(fakeFile(1000), 'avatar', d)).rejects.toMatchObject({ code: 'decode' });
  });
});

describe('compressImage — cuando comprimir no sale bien', () => {
  /**
   * Safari viejo no sabe generar WebP. La subida NO puede depender de una optimización: se sube el original.
   * Si esto se rompiera, esos usuarios se quedarían sin poder poner imagen y sin saber por qué.
   */
  it('sin WebP en el navegador, se sube el original', async () => {
    const original = fakeFile(300_000);
    const r = await compressImage(original, 'token', deps({ encode: vi.fn().mockResolvedValue(null) }));
    expect(r.compressed).toBe(false);
    expect(r.blob).toBe(original);
    expect(r.bytes).toBe(300_000);
  });

  /** Una imagen ya optimizada puede ENGORDAR al recomprimir. Quedarse con la gorda sería absurdo. */
  it('si el resultado pesa más que el original, se queda el original', async () => {
    const original = fakeFile(1000);
    const r = await compressImage(original, 'avatar', deps({ encode: vi.fn().mockResolvedValue(fakeFile(5000, 'image/webp')) }));
    expect(r.compressed).toBe(false);
    expect(r.blob).toBe(original);
  });

  it('si aun comprimido se pasa del tope de salida, se rechaza en vez de subir un ladrillo', async () => {
    const d = deps({ encode: vi.fn().mockResolvedValue(fakeFile(MAX_OUTPUT_BYTES + 1, 'image/webp')) });
    await expect(compressImage(fakeFile(MAX_INPUT_BYTES - 1), 'background', d)).rejects.toMatchObject({ code: 'output-too-large' });
  });

  /** El respaldo tampoco puede colar un fichero enorme por la puerta de atrás. */
  it('el respaldo sin WebP sigue respetando el tope de salida', async () => {
    const d = deps({ encode: vi.fn().mockResolvedValue(null) });
    await expect(compressImage(fakeFile(MAX_OUTPUT_BYTES + 1), 'background', d)).rejects.toMatchObject({ code: 'output-too-large' });
  });
});

describe('formatBytes', () => {
  it('dice el tamaño como lo diría una persona', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(180 * 1024)).toBe('180 KB');
    expect(formatBytes(Math.round(2.4 * 1024 * 1024), 'en')).toBe('2.4 MB');
  });
});
