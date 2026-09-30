/**
 * EL CONTRATO DEL ARRASTRE de una foto a la escena (H13, rebanada 4).
 *
 * Orden suya del 2026-09-24: «*asegurate que pueda arrastrar las fotos a la escena y no que solo sea con el
 * boton*». Quien lo suelta es `maps` y quien lo coge es `photos`, así que el contrato no puede vivir en
 * ninguno de los dos sin que uno dependa del otro: vive aquí, y los dos leen lo mismo.
 *
 * Va el TAMAÑO NATURAL además del id porque el mapa tiene que saber la huella **en el momento de soltar**,
 * sin ir a preguntar a la base: si esperase, la foto aparecería un instante después y en otro sitio.
 */

/** El tipo propio del arrastre. `dragover` sólo puede leer los TIPOS, no el contenido, y con esto basta. */
export const PHOTO_DRAG_MIME = 'application/x-rolvium-photo';

export interface PhotoDrag {
  id: string;
  /** Tamaño natural de la foto ya comprimida, en px. */
  width: number;
  height: number;
}

export function encodePhotoDrag(photo: PhotoDrag): string {
  return JSON.stringify({ id: photo.id, width: photo.width, height: photo.height });
}

/**
 * Lo que llega de un arrastre NO es de fiar: puede venir de otra pestaña, de otra versión de la herramienta o
 * de nada. Cualquier cosa que no sea exactamente la forma esperada se queda en `null` y no se planta nada.
 */
export function decodePhotoDrag(raw: string | null | undefined): PhotoDrag | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { id, width, height } = v as Record<string, unknown>;
    if (typeof id !== 'string' || !id) return null;
    if (typeof width !== 'number' || typeof height !== 'number') return null;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return null;
    return { id, width, height };
  } catch {
    return null;
  }
}

/** ¿Este arrastre trae una foto? Lo único que se puede mirar durante `dragover`. */
export function isPhotoDrag(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false;
  return [...(types as readonly string[])].includes(PHOTO_DRAG_MIME);
}
