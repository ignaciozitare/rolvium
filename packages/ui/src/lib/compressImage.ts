/**
 * Compresor de imágenes — spec: specs/core/images/SPEC.md
 *
 * Un solo camino para que ninguna imagen pese más de lo necesario. Se comprime **en el navegador**, en la
 * pestaña del propio usuario: no cuesta ni una función de servidor ni una cuota de Vercel.
 *
 * Devuelve un `Blob` y **no sabe de Supabase**: quién lo sube es el adaptador de cada módulo. Por eso vive aquí
 * y no dentro de un módulo — lo quieren los avatares, los tokens del bestiario y los fondos de escena.
 *
 * No se ocupa de recortar ni encuadrar: para eso está `ImagePicker`, que ya lo hace. Este escala la imagen
 * entera y la codifica.
 */

export type ImageTarget = 'avatar' | 'token' | 'background';

export interface TargetSpec {
  /** Lado máximo en píxeles. */
  max: number;
  quality: number;
}

/** Tamaños y calidad por destino (spec §Rules & limits). */
export const IMAGE_TARGETS: Record<ImageTarget, TargetSpec> = {
  avatar:     { max: 512,  quality: 0.85 },   // se pinta a 64 px como mucho
  token:      { max: 512,  quality: 0.85 },   // una casilla del mapa
  background: { max: 2560, quality: 0.82 },   // pantalla completa y con zoom
};

/** Tope duro de ENTRADA: por encima se rechaza, ni se intenta comprimir. */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Tope de SALIDA: si tras comprimir sigue pasándose, se rechaza en vez de subir un ladrillo. */
export const MAX_OUTPUT_BYTES = Math.round(1.5 * 1024 * 1024);

export const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type CompressErrorCode = 'mime' | 'input-too-large' | 'output-too-large' | 'decode';

/** Error con código para que quien llama elija la clave i18n; el mensaje es para el log, no para la pantalla. */
export class CompressError extends Error {
  constructor(public readonly code: CompressErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'CompressError';
  }
}

export interface CompressResult {
  blob: Blob;
  /** Bytes del fichero original, para poder decir «2,4 MB → 180 KB». */
  originalBytes: number;
  bytes: number;
  /** `false` cuando se devuelve el original tal cual (el navegador no sabe generar WebP). */
  compressed: boolean;
  width: number;
  height: number;
}

/**
 * Cuánto hay que escalar para que el lado mayor quepa en `max`.
 * **Nunca agranda**: una imagen pequeña se sube tal cual, que estirarla sólo añade peso y borrosidad.
 */
export function fitDimensions(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const k = max / longest;
  // Redondeo a la baja con mínimo 1: un lado a 0 daría un canvas inválido.
  return { width: Math.max(1, Math.floor(width * k)), height: Math.max(1, Math.floor(height * k)) };
}

/** Lo que el compresor necesita del navegador, aparte para poder probarlo sin navegador. */
export interface CompressDeps {
  decode(file: Blob): Promise<{ width: number; height: number; source: CanvasImageSource }>;
  encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob | null>;
}

const browserDeps: CompressDeps = {
  async decode(file) {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, source: bitmap };
  },
  async encode(source, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, width, height);
    return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/webp', quality));
  },
};

/**
 * Comprime a WebP para el destino dado.
 *
 * Si el navegador no sabe generar WebP (Safari viejo), **devuelve el original**: la subida no puede depender de
 * una optimización. Se reconoce porque `compressed` es `false`.
 *
 * Un GIF animado se aplana al primer fotograma, que es lo que devuelve el decodificador.
 */
export async function compressImage(file: File | Blob, target: ImageTarget, deps: CompressDeps = browserDeps): Promise<CompressResult> {
  const type = file.type;
  if (!(ACCEPTED_MIME as readonly string[]).includes(type)) throw new CompressError('mime', type || 'sin tipo');
  if (file.size > MAX_INPUT_BYTES) throw new CompressError('input-too-large', `${file.size} > ${MAX_INPUT_BYTES}`);

  const spec = IMAGE_TARGETS[target];

  let decoded: { width: number; height: number; source: CanvasImageSource };
  try {
    decoded = await deps.decode(file);
  } catch (e) {
    throw new CompressError('decode', e instanceof Error ? e.message : String(e));
  }

  const size = fitDimensions(decoded.width, decoded.height, spec.max);
  const out = await deps.encode(decoded.source, size.width, size.height, spec.quality);

  // Sin WebP no se bloquea la subida: se sube el original, pero sigue valiendo el tope de salida.
  if (!out) {
    if (file.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(file.size));
    return { blob: file, originalBytes: file.size, bytes: file.size, compressed: false, width: decoded.width, height: decoded.height };
  }

  // Comprimir puede engordar una imagen ya optimizada y pequeña: en ese caso se queda el original.
  if (out.size >= file.size) {
    if (file.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(file.size));
    return { blob: file, originalBytes: file.size, bytes: file.size, compressed: false, width: decoded.width, height: decoded.height };
  }

  if (out.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(out.size));
  return { blob: out, originalBytes: file.size, bytes: out.size, compressed: true, width: size.width, height: size.height };
}

/** «2,4 MB», «180 KB» — para poder enseñar cuánto ha adelgazado. Locale del usuario para el separador decimal. */
export function formatBytes(bytes: number, locale?: string): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}
