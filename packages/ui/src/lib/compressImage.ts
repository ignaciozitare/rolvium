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

export type ImageTarget = 'avatar' | 'token' | 'background' | 'prop' | 'texture';

/** Qué tan agresivo comprimir. Lo elige un admin en Ajustes, por separado para cada destino de abajo. */
export type CompressionLevel = 'light' | 'balanced' | 'max';
export const DEFAULT_COMPRESSION_LEVEL: CompressionLevel = 'balanced';

export interface TargetSpec {
  /** Lado máximo en píxeles. `Infinity` = nunca reduce resolución. */
  max: number;
  quality: number;
}

/** Avatar y token: tamaño fijo, sin nivel — se pintan a 64 px o a una casilla, no hay margen que ganar ahí. */
export const IMAGE_TARGETS: Record<'avatar' | 'token', TargetSpec> = {
  avatar: { max: 512, quality: 0.85 },
  token:  { max: 512, quality: 0.85 },
};

/**
 * Textura, objeto (`prop`) y fondo: dependen del nivel elegido en Admin → Ajustes (uno por tipo). Números
 * probados de verdad el 2026-09-14 sobre una textura, un objeto y un fondo reales, antes de que él los aprobara
 * (spec: `specs/core/images/SPEC.md`).
 */
export const LEVELED_TARGETS: Record<'texture' | 'prop' | 'background', Record<CompressionLevel, TargetSpec>> = {
  texture: {
    light:    { max: 1280, quality: 0.85 },
    balanced: { max: 1024, quality: 0.82 },
    max:      { max: 800,  quality: 0.80 },
  },
  prop: {
    light:    { max: 1024, quality: 0.85 },
    balanced: { max: 768,  quality: 0.80 },
    max:      { max: 640,  quality: 0.75 },
  },
  background: {
    light:    { max: Infinity, quality: 0.95 },
    balanced: { max: Infinity, quality: 0.90 },
    max:      { max: Infinity, quality: 0.82 },
  },
};

function specFor(target: ImageTarget, level: CompressionLevel): TargetSpec {
  if (target === 'avatar' || target === 'token') return IMAGE_TARGETS[target];
  return LEVELED_TARGETS[target][level];
}

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
  /**
   * EL CANAL DE TRANSPARENCIA de la imagen ya descodificada, sólo si se pide (`opts.alpha`). Un byte por
   * píxel, fila a fila. Es lo que permite sacar la silueta de un objeto (mapas § 6.9) **sin volver a bajar ni
   * a descodificar la imagen**: aquí ya está abierta.
   *
   * Este fichero NO sabe qué es una silueta ni qué es un objeto — devuelve opacidad en crudo y la geometría la
   * pone quien la pide. Por eso la biblioteca de componentes no depende del motor de juego.
   */
  alpha?: AlphaMap | null;
}

/** Opacidad en crudo, fila a fila: `data[y * width + x]`, de 0 (transparente) a 255 (opaco). */
export interface AlphaMap { data: Uint8ClampedArray; width: number; height: number }

/**
 * A qué tamaño se lee la opacidad. Pequeño a propósito: la silueta son 24 rayos, y a 256 px de lado un rayo
 * recorre 128 muestras — de sobra para el contorno, y evita guardar en memoria el mapa entero de una imagen
 * grande mientras se sube un lote de cien.
 */
export const ALPHA_SIDE = 256;

export interface CompressOptions {
  /** Traer también el canal de transparencia (`result.alpha`). De serie no: sólo lo usan los objetos. */
  alpha?: boolean;
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
  /** La opacidad de la imagen ya abierta. Opcional: sin esto se devuelve `alpha: null` y no se rompe nada. */
  alpha?(source: CanvasImageSource, width: number, height: number): AlphaMap | null;
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
  /*
   * La imagen ya está abierta, así que esto es UN dibujado más y una lectura de píxeles — no una segunda
   * descarga ni una segunda descodificación, que es justo lo que pedía el spec de la silueta.
   *
   * `willReadFrequently` le dice al navegador que este lienzo es para leerlo: sin eso Chrome lo sube a la
   * tarjeta gráfica y cada `getImageData` obliga a bajarlo otra vez.
   */
  alpha(source, width, height) {
    const side = fitDimensions(width, height, ALPHA_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = side.width;
    canvas.height = side.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, side.width, side.height);
    let px: ImageData;
    try { px = ctx.getImageData(0, 0, side.width, side.height); } catch { return null; }
    const data = new Uint8ClampedArray(side.width * side.height);
    for (let i = 0; i < data.length; i++) data[i] = px.data[i * 4 + 3] ?? 0;
    return { data, width: side.width, height: side.height };
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
export async function compressImage(
  file: File | Blob,
  target: ImageTarget,
  level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL,
  deps: CompressDeps = browserDeps,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const type = file.type;
  if (!(ACCEPTED_MIME as readonly string[]).includes(type)) throw new CompressError('mime', type || 'sin tipo');
  if (file.size > MAX_INPUT_BYTES) throw new CompressError('input-too-large', `${file.size} > ${MAX_INPUT_BYTES}`);

  const spec = specFor(target, level);

  let decoded: { width: number; height: number; source: CanvasImageSource };
  try {
    decoded = await deps.decode(file);
  } catch (e) {
    throw new CompressError('decode', e instanceof Error ? e.message : String(e));
  }

  /*
   * La opacidad se lee AQUÍ, con la imagen abierta y ANTES de codificar: es la única pasada en la que existe
   * descodificada. Si el navegador no sabe darla (lienzo manchado, sin contexto), sale `null` y quien la pidió
   * se queda con la forma que ya tenía — subir una imagen nunca puede fallar por esto.
   */
  const alpha = opts.alpha ? deps.alpha?.(decoded.source, decoded.width, decoded.height) ?? null : null;

  const size = fitDimensions(decoded.width, decoded.height, spec.max);
  const out = await deps.encode(decoded.source, size.width, size.height, spec.quality);

  // Sin WebP no se bloquea la subida: se sube el original, pero sigue valiendo el tope de salida.
  if (!out) {
    if (file.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(file.size));
    return { blob: file, originalBytes: file.size, bytes: file.size, compressed: false, width: decoded.width, height: decoded.height, alpha };
  }

  // Comprimir puede engordar una imagen ya optimizada y pequeña: en ese caso se queda el original.
  if (out.size >= file.size) {
    if (file.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(file.size));
    return { blob: file, originalBytes: file.size, bytes: file.size, compressed: false, width: decoded.width, height: decoded.height, alpha };
  }

  if (out.size > MAX_OUTPUT_BYTES) throw new CompressError('output-too-large', String(out.size));
  return { blob: out, originalBytes: file.size, bytes: out.size, compressed: true, width: size.width, height: size.height, alpha };
}

/** «2,4 MB», «180 KB» — para poder enseñar cuánto ha adelgazado. Locale del usuario para el separador decimal. */
export function formatBytes(bytes: number, locale?: string): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}
