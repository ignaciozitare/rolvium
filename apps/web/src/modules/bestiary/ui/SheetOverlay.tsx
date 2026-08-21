import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';

interface Props {
  /** Rótulo ALL-CAPS del filete superior — «Titulo Texto» de `PL/Hoja`. */
  title: string;
  /** Texto pequeño a la derecha del filete — «Titulo Derecha» de `PL/Hoja` (origen, página del manual…). */
  note?: string;
  /** Ancho máximo de la hoja; el del frame del `.pen` (la ficha del encuentro es 820). */
  width?: number;
  /** Sin relleno: para la caja de la foto, que va a sangre. */
  noPadding?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Hoja de pergamino a pantalla completa — el contenedor de las fichas del bestiario.
 *
 * **Por qué no es el `Modal` de `@rolvium/ui`.** Las fichas se diseñaron en `rolvium.pen` como pergamino
 * (componente `PL/Hoja`, frame «Ficha del encuentro»): papel `--sys-card` sobre la piedra `--sys-bg` con su
 * textura, filete de `--sys-border` y sombra. El `Modal` es chrome de la plataforma — panel `var(--sf)` sobre
 * un scrim negro al 60 % — así que metía una hoja de juego dibujada en papel dentro de una caja negra y sin
 * textura. Con `--sys-card` traslúcido (50 % de alfa) encima de ese negro, el papel salía sucio y el texto
 * ilegible: los dos motivos por los que el dueño rechazó la pantalla el 2026-08-21.
 *
 * La solución NO es tocar `Modal` — lo usa toda la plataforma y ahí está bien. Es no usarlo dentro de la
 * mesa. Mismo precedente que `EncounterMenu`, `DiceRoller` y `BackgroundPopover`, que ya son overlays
 * locales por exactamente esta razón.
 *
 * El fondo es el de la mesa (`--sys-bg` + `--sys-bg-image`), no un velo oscuro: sobre un velo el papel
 * traslúcido volvería a ensuciarse. La profundidad la da la sombra de la hoja, como en el `.pen`.
 */
export function SheetOverlay({ title, note, width = 820, noPadding = false, onClose, children }: Props): JSX.Element {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // El foco entra en la hoja al abrirla y vuelve a donde estaba al cerrarla: si no, el teclado se queda
  // detrás, en el catálogo, y Escape cierra una ficha que el lector de pantalla nunca anunció.
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  const onScrimClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div className="bs-ov" onClick={onScrimClick}>
      <div className="bs-ov-sheet" style={{ maxWidth: width }} role="dialog" aria-modal="true"
           aria-label={title} tabIndex={-1} ref={panel}>
        <div className="bs-ov-head">
          <h3 className="bs-ov-title">{title}</h3>
          {note && <span className="bs-ov-note">{note}</span>}
          <button type="button" className="bs-ov-x" aria-label={t('common.close')} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span>
          </button>
        </div>
        <div className={noPadding ? 'bs-ov-body bs-ov-bleed' : 'bs-ov-body'}>{children}</div>
      </div>
    </div>
  );
}
