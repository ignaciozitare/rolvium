import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { Tooltip } from './Tooltip';
import './panel.css';

/**
 * Arrastrar un panel flotante por su cabecera, y **sacarlo del mapa si quiere** (dueño, 2026-09-03: «*los
 * modales de las herramientas están confinados dentro del mapa, deberían estar por donde quiera*»).
 *
 * Cómo se sale del mapa: el lienzo recorta lo que se sale de él, y eso no se puede quitar — es lo que impide
 * que el mapa se derrame sobre el resto de la pantalla. Así que el panel empieza colocado DENTRO, donde lo
 * pone el CSS de quien lo usa, y **en el momento en que se agarra se mide dónde está y se pasa a `fixed` en ese
 * mismo sitio**. Desde ahí se mueve por toda la ventana, sin recorte y sin un salto al empezar el gesto.
 *
 * Vivía en `modules/maps/ui/useDragPanel.ts`. Se mudó aquí con `FloatingPanel` el 2026-09-11.
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

export interface FloatingPanelProps {
  /** El nombre de la herramienta, en la cabecera. */
  title: string;
  /** Nombre del grupo para el lector de pantalla. De serie, el título. */
  ariaLabel?: string | undefined;
  /** El icono de la herramienta tal cual lo pinta quien lo usa: un Material Symbol, una máscara… */
  icon?: ReactNode;
  /** Lo que va en la cabecera antes de la X: otro botón (`PanelIconButton`), un «guardando…». */
  actions?: ReactNode;
  /** El `title` de la cabecera: dice que por ahí se arrastra. */
  moveLabel: string;
  closeLabel: string;
  onClose: () => void;
  /**
   * Escape cierra. Apagado de serie, y a propósito: en el Builder, dibujando un polígono, Escape es para
   * cancelar el polígono y no para cerrar el panel.
   */
  closeOnEscape?: boolean | undefined;
  /** Dónde va y cuánto mide es cosa de quien lo usa: su clase trae `top/left/right`, `z-index` y `width`. */
  className?: string | undefined;
  children: ReactNode;
}

/**
 * EL PANEL FLOTANTE DE LA MESA — la carcasa del Builder, del Pincel y del editor de luces (rolvium.pen · la
 * familia de `TlJot` y `ePNCc`): flota sobre el mapa, se agarra por la cabecera y se aparta, y la X lo cierra.
 *
 * Primitiva neutra, como `Tooltip` y `Sheet`: el aspecto entra SÓLO por las variables `--sys-*`, así que un
 * sistema de juego nuevo no lo copia — lo viste.
 */
export function FloatingPanel({
  title, ariaLabel, icon, actions, moveLabel, closeLabel, onClose, closeOnEscape = false, className, children,
}: FloatingPanelProps) {
  const { ref, style, handlers } = useDragPanel<HTMLDivElement>();
  useEffect(() => {
    if (!closeOnEscape) return undefined;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);

  return (
    <div className={`rv-fpanel${className ? ` ${className}` : ''}`} ref={ref} style={style}
      role="group" aria-label={ariaLabel ?? title}>
      <div className="rv-fpanel-head" title={moveLabel} {...handlers}>
        <span className="material-symbols-outlined rv-fpanel-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">drag_indicator</span>
        {icon}
        <span className="rv-fpanel-title">{title}</span>
        {actions}
        <PanelIconButton icon="close" label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </div>
  );
}

/** Un botón de sólo icono de la cabecera, con su tooltip: la X, borrar la luz… */
export function PanelIconButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <Tooltip label={label} placement="top">
      <button type="button" className="rv-fpanel-btn" aria-label={label} onClick={onClick}>
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>{icon}</span>
      </button>
    </Tooltip>
  );
}

/** Un bloque del panel con su rótulo en versalitas: «SOBRE QUÉ PINTO», «FORMA», «EL BROCHAZO». */
export function PanelSection({ label, className, testId, children }: {
  label: string;
  className?: string | undefined;
  testId?: string | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset className={`rv-fpanel-section${className ? ` ${className}` : ''}`} {...(testId ? { 'data-testid': testId } : {})}>
      <legend className="rv-fpanel-label">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * La línea de ayuda en cursiva, bajo lo que explica. `as="span"` cuando va dentro de algo que no admite un
 * párrafo, como el texto del color puesto en el Pincel.
 */
export function PanelHint({ as: Tag = 'p', children }: { as?: 'p' | 'span' | undefined; children: ReactNode }) {
  return <Tag className="rv-fpanel-hint">{children}</Tag>;
}

/** La nota con el icono de información, al pie del panel. */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="rv-fpanel-note">
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">info</span>
      {children}
    </p>
  );
}
