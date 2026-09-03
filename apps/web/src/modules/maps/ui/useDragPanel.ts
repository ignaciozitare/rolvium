import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';

/**
 * Arrastrar un panel flotante por su cabecera, y **sacarlo del mapa si quiere** (dueño, 2026-09-03: «*los
 * modales de las herramientas están confinados dentro del mapa, deberían estar por donde quiera*»).
 *
 * 🔑 Cómo se sale del mapa. El lienzo recorta lo que se sale de él (`.mp-stage{overflow:hidden}`), y eso no se
 * puede quitar: es lo que impide que el mapa se derrame sobre el resto de la pantalla. Así que el panel
 * empieza colocado DENTRO del lienzo, donde lo pone el CSS, y **en el momento en que se agarra se mide dónde
 * está y se pasa a `fixed` en ese mismo sitio**. Desde ahí ya se mueve por toda la ventana, sin recorte y sin
 * un salto al empezar el gesto.
 *
 * Vivía dentro de `LightEditor`, con la nota de extraerlo «*el día que un segundo lo necesite, con dos
 * consumidores reales delante y no antes*». Ese día llegó con el panel de Builder.
 */
export function useDragPanel<T extends HTMLElement = HTMLDivElement>(): {
  /** Va en el PANEL (no en la cabecera): es lo que se mide y lo que se mueve. */
  ref: RefObject<T>;
  /** Va en el `style` del panel. Vacío hasta que se arrastra: hasta entonces manda el CSS. */
  style: CSSProperties;
  handlers: Record<string, (e: ReactPointerEvent<HTMLElement>) => void>;
} {
  const ref = useRef<T>(null);
  /** Dónde está el panel en la VENTANA. `null` = todavía no se ha tocado, lo coloca el CSS. */
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const from = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    // Los botones de la cabecera mandan sobre el arrastre: cerrar y borrar tienen que poder pulsarse.
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    // La primera vez se mide dónde lo dejó el CSS, para pasar a `fixed` sin que el panel dé un salto.
    const caja = ref.current?.getBoundingClientRect();
    const base = at ?? (caja ? { x: caja.left, y: caja.top } : { x: 0, y: 0 });
    setAt(base);
    from.current = { px: e.clientX, py: e.clientY, ox: base.x, oy: base.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const f = from.current;
    if (f) setAt({ x: f.ox + e.clientX - f.px, y: f.oy + e.clientY - f.py });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>): void => {
    from.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  /**
   * `right`/`bottom` a `auto` porque el CSS ancla algunos paneles por la derecha, y dejarlo puesto los
   * estiraría de lado a lado de la ventana. El `zIndex` alto es para que, ya fuera del mapa, no se meta
   * por debajo de la barra de arriba ni del rail de escenas.
   */
  const style: CSSProperties = at
    ? { position: 'fixed', left: at.x, top: at.y, right: 'auto', bottom: 'auto', zIndex: 60 }
    : {};
  return { ref, style, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}
