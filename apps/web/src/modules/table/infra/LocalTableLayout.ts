import type { LayoutMemoryPort } from '../domain/ports/LayoutMemoryPort';
import { clampSideWidth } from '../domain/useCases/layoutRules';

/** Sin campaña: «lo ancho que me gusta el carril» es de quien mira, no de la mesa que mira. */
const SIDE_WIDTH_KEY = 'rolvium_table_side_width';

/**
 * EN EL NAVEGADOR, y a propósito: es una preferencia de SU pantalla (ver `LayoutMemoryPort`).
 *
 * Todo va envuelto en `try`: en una ventana privada, o con el almacenamiento bloqueado, `localStorage` puede
 * lanzar al leer Y al escribir. Que no se pueda recordar el ancho no puede tumbar la mesa.
 */
export const localTableLayout: LayoutMemoryPort = {
  sideWidth(): number | null {
    try {
      const raw = localStorage.getItem(SIDE_WIDTH_KEY);
      if (raw === null) return null;
      const px = Number(raw);
      // Guardado a mano, de otra versión o de una pantalla más grande: se recorta, no se cree a ciegas.
      return Number.isFinite(px) ? clampSideWidth(px) : null;
    } catch { return null; }
  },
  rememberSideWidth(px: number): void {
    try { localStorage.setItem(SIDE_WIDTH_KEY, String(clampSideWidth(px))); } catch { /* no disponible */ }
  },
};
