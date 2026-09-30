/**
 * Reglas puras de la disposición de la mesa (sin React y sin navegador): sólo números.
 */

/** El de serie, y el que tenía la mesa antes de poderse arrastrar. */
export const SIDE_WIDTH_DEFAULT = 264;
/**
 * Los topes. Por debajo de 200 px el Registro y las pastillas del chat dejan de poderse leer; por encima de
 * 560 px el carril se come la mesa, que es lo que se ha venido a mirar. Un ancho fuera de rango —de una
 * pantalla anterior más grande, o de un almacenamiento manoseado— se recorta en vez de romper la mesa.
 */
export const SIDE_WIDTH_MIN = 200;
export const SIDE_WIDTH_MAX = 560;
/** Lo que se mueve con cada flecha del teclado: el carril también se ajusta sin ratón. */
export const SIDE_WIDTH_STEP = 16;

/** Deja el ancho dentro de lo usable. Lo que no sea un número se cambia por el de serie, nunca por `NaN`. */
export function clampSideWidth(px: number): number {
  if (!Number.isFinite(px)) return SIDE_WIDTH_DEFAULT;
  return Math.max(SIDE_WIDTH_MIN, Math.min(SIDE_WIDTH_MAX, Math.round(px)));
}
