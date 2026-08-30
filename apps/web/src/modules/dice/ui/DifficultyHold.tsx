import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { DIFFICULTIES } from '@rolvium/system-plenilunio';

interface Props {
  /** El texto del botón (la característica, ya traducida). */
  label: string;
  /** El desplegable está abierto. Lo controla el padre: así «abrir uno cierra el anterior». */
  open: boolean;
  onOpen: (open: boolean) => void;
  /** Se eligió una dificultad (soltando encima o con clic): la acción sale, sin botón de confirmar. */
  onPick: (difficulty: number) => void;
  disabled?: boolean;
  /** Traductor del sistema, para las etiquetas de dificultad (`roll.difficulty.*`). */
  ts: (key: string) => string;
}

/**
 * El gesto del `.pen` (columna 4), compartido entre pedir tiradas y los encuentros: MANTIENES PULSADA la
 * característica, el desplegable de dificultad sale pegado a ella, y SUELTAS encima de la opción — la
 * acción sale sin botón de confirmar. Con ratón también vale pulsar y luego pulsar la dificultad.
 *
 * El desplegable se cierra al clicar FUERA DE ÉL (corrección del dueño, 2026-08-23): antes el cierre sólo
 * saltaba fuera del panel entero, y un clic en cualquier otra zona del panel lo dejaba abierto. Ahora
 * cierra todo clic que no caiga en un desplegable o en un botón de característica (pulsar OTRA
 * característica abre la suya por su propio pointerDown), y también Escape.
 */
export function DifficultyHold({ label, open, onOpen, onPick, disabled = false, ts }: Props): JSX.Element {
  const releaseOver = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if ((e.currentTarget as HTMLElement).setPointerCapture && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    const el = typeof document !== 'undefined' && document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const opt = el?.closest?.('[data-ask-diff]') as HTMLElement | null;
    if (opt?.dataset['askDiff']) onPick(Number(opt.dataset['askDiff']));
  };
  const press = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Captura de puntero: con ratón, el pointerup de «soltar encima» tiene que llegar a ESTE botón
    // (la captura implícita es sólo del táctil) — sin ella el gesto estrella no dispara (review, 6.ª ronda).
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onOpen(true);
  };

  /**
   * El cierre es POR INSTANCIA (todo clic fuera de MI slot me cierra), no por clase: comprobar
   * `.dc-ask-stat`/`.dc-ask-menu` a secas dejaba vivo el menú de un padre al pulsar una característica del
   * OTRO (el chip ajeno también lleva esas clases) — con el panel de pedir y una criatura desplegada
   * quedaban DOS menús abiertos a la vez (cazado en la revisión del 2026-08-23). Pulsar otra característica
   * del MISMO padre ya cerraba por el estado del padre; esto sólo añade el cierre cruzado y el de «cualquier
   * otra zona», que es la corrección del dueño. Sólo la instancia ABIERTA escucha en `document`, y se
   * desengancha al cerrar — con 14 montadas no se acumula nada.
   */
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) onOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open, onOpen]);

  return (
    <span className="dc-ask-stat-slot" ref={root}>
      <button type="button" className={`dc-ask-stat ${open ? 'on' : ''}`} disabled={disabled}
              onPointerDown={press} onPointerUp={releaseOver}>
        {label}
      </button>
      {open && (
        <span className="dc-ask-menu" role="menu">
          {DIFFICULTIES.map(d => (
            <button key={d.id} type="button" role="menuitem" data-ask-diff={d.value} onClick={() => onPick(d.value)}>
              {ts(`roll.difficulty.${d.id}`)} · {d.value}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
