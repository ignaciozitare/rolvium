import { useRef, useState, type FocusEvent, type ReactNode } from 'react';
import './tooltip.css';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** Already-translated text. Kept short: this is a name, not a help paragraph. */
  label: string;
  /** The trigger. It MUST keep its own `aria-label` — that is the accessible name; this is only the visual half. */
  children: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
}

/** Where the bubble goes, in viewport coordinates, for a trigger occupying `r`. */
function anchor(r: DOMRect, placement: TooltipPlacement): { top: number; left: number } {
  const gap = 8;
  if (placement === 'right') return { top: r.top + r.height / 2, left: r.right + gap };
  if (placement === 'left') return { top: r.top + r.height / 2, left: r.left - gap };
  if (placement === 'top') return { top: r.top - gap, left: r.left + r.width / 2 };
  return { top: r.bottom + gap, left: r.left + r.width / 2 };
}

/** El foco de TECLADO merece el rótulo; el que deja un clic, no. jsdom no conoce `:focus-visible`: ahí, no. */
function byKeyboard(el: EventTarget): boolean {
  try { return el instanceof Element && el.matches(':focus-visible'); } catch { return false; }
}

/**
 * Small label shown on hover and on keyboard focus (rolvium.pen `PL/Tooltip herramienta`).
 *
 * Why not the browser's `title`: it waits about a second, lands wherever it likes and ignores the system's
 * look. Icon-only buttons are unreadable without it — the owner could not tell what `fence` meant
 * (specs/modules/maps/SPEC.md § «Barra vertical de herramientas»).
 *
 * 🔧 **El globo va `position: fixed` y con las coordenadas puestas a mano, y eso NO es un capricho**
 * (dueño, 2026-09-01: «esta barra no tiene tooltips»). Colocado en absoluto dentro del envoltorio, cualquier
 * antepasado con `overflow` lo RECORTA — y la barra de herramientas y el panel de capas scrollean, así que
 * ahí no se veía ni uno. Un elemento fijo se coloca contra la ventana y se escapa de ese recorte.
 *
 * Y se enseña por estado, no con `:focus-within` en CSS: un clic también deja el foco puesto, así que el
 * rótulo se quedaba colgado después de pulsar («si hago click queda activado»). Ahora sale al pasar por
 * encima, sale al llegar con el teclado, y se va al salir.
 */
export function Tooltip({ label, children, placement = 'right', className }: TooltipProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const show = (): void => { const r = ref.current?.getBoundingClientRect(); if (r) setAt(anchor(r, placement)); };
  const hide = (): void => setAt(null);
  return (
    <span ref={ref} className={`rv-tip-wrap${className ? ` ${className}` : ''}`} data-tooltip={label}
      onPointerEnter={show} onPointerLeave={hide} onPointerDown={hide}
      onFocus={(e: FocusEvent) => byKeyboard(e.target) && show()} onBlur={hide}>
      {children}
      {/* `aria-hidden`: the trigger's own `aria-label` already carries this name, and announcing it twice is noise. */}
      <span className="rv-tip" data-placement={placement} aria-hidden="true" hidden={!at}
        style={at ? { top: at.top, left: at.left } : undefined}>{label}</span>
    </span>
  );
}
