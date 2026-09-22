import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Una línea del menú. `checked` la pinta como una opción de «elige una» (el estado de la aventura). */
export interface MenuEntry {
  key: string;
  icon: string;
  label: string;
  /** Una línea en cursiva debajo, para lo que no se entiende sólo con el nombre («Marcar EN CURSO»). */
  hint?: string | undefined;
  danger?: boolean | undefined;
  disabled?: boolean | undefined;
  checked?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  /** Abre AL LADO una segunda lista: a qué aventura se lleva una escena. */
  submenu?: { label: string; entries: readonly SubEntry[] } | undefined;
}

/** Una aventura en la lista de al lado: su número del carril, su título y su estado. */
export interface SubEntry { key: string; n: string; label: string; sub: string; onSelect: () => void }

export type MenuRow = MenuEntry | 'separator';

/** Hueco entre el menú y lo que lo abre, y lo mínimo que se deja con el borde de la ventana. */
const GAP = 4;

interface Rect { top: number; bottom: number; left: number; right: number }

/**
 * DÓNDE FLOTA, en px de ventana. `right` = al lado de los tres puntos, hacia el documento (el carril está pegado
 * a la izquierda); `below` = debajo, como el desplegable del estado. Si no cabe, se da la vuelta o se sube: con
 * la última fila de un carril largo se saldría por abajo.
 */
export function placeMenu(anchor: Rect, size: { w: number; h: number }, view: { w: number; h: number }, placement: 'right' | 'below'): { top: number; left: number } {
  let top = placement === 'right' ? anchor.top - GAP : anchor.bottom + GAP;
  let left = placement === 'right' ? anchor.right + GAP : anchor.left;
  if (top + size.h > view.h - GAP) top = placement === 'below' && anchor.top - GAP - size.h >= GAP ? anchor.top - GAP - size.h : view.h - GAP - size.h;
  if (left + size.w > view.w - GAP) left = placement === 'right' ? anchor.left - GAP - size.w : view.w - GAP - size.w;
  return { top: Math.max(GAP, top), left: Math.max(GAP, left) };
}

function usePlacement(anchor: HTMLElement | null, placement: 'right' | 'below') {
  const ref = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || !anchor) return;
    const box = m.getBoundingClientRect();
    setAt(placeMenu(anchor.getBoundingClientRect(), { w: box.width, h: box.height }, { w: window.innerWidth, h: window.innerHeight }, placement));
  }, [anchor, placement]);
  return { ref, style: at ?? undefined };
}

interface Props {
  /** Lo que lo abrió (los tres puntos, o el estado de la cabecera): es su ancla y adonde vuelve el foco. */
  anchor: HTMLElement;
  label: string;
  rows: readonly MenuRow[];
  placement: 'right' | 'below';
  onClose: () => void;
}

/**
 * EL MENÚ DE LOS TRES PUNTOS del carril de AVENTURAS, y el desplegable del estado.
 * Diseño: `rolvium.pen` § 4 · «Aventuras/Carril · MENÚ DE UNA AVENTURA y el ESTADO» y «… MENÚ DE UNA ESCENA».
 *
 * Flota FIJO a la ventana, no dentro del carril: el carril se desplaza y recortaría lo que asomara — es la misma
 * lección que el menú de las escenas de la mesa (`maps/ui/ScenesMenu.tsx`, «*que el modal quede por encima, que
 * no se tape*»). Se cierra al pinchar fuera, con Escape, y al desplazar o cambiar la ventana, porque se quedaría
 * flotando lejos de su fila.
 */
export function RailMenu({ anchor, label, rows, placement, onClose }: Props): JSX.Element {
  const main = usePlacement(anchor, placement);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const subAnchors = useRef(new Map<string, HTMLButtonElement>());
  const subEntry = rows.find((r): r is MenuEntry => r !== 'separator' && r.key === openSub);
  const sub = usePlacement(openSub ? subAnchors.current.get(openSub) ?? null : null, 'right');

  useEffect(() => {
    main.ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [main.ref]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const el = e.target as Node;
      // Los tres puntos abren y cierran solos: si esto cerrase antes, su clic lo volvería a abrir.
      if (main.ref.current?.contains(el) || sub.ref.current?.contains(el) || anchor.contains(el)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    document.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
      document.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose, main.ref, sub.ref]);

  const pick = (fn: () => void) => { onClose(); fn(); };

  return (
    <>
      <div className="av-pop" role="menu" aria-label={label} ref={main.ref} style={main.style}>
        {rows.map((row, i) => {
          if (row === 'separator') return <div key={`sep-${i}`} className="av-pop-sep" role="separator" />;
          const radio = row.checked !== undefined;
          const on = row.submenu !== undefined && openSub === row.key;
          return (
            <button
              key={row.key} type="button" disabled={row.disabled}
              role={radio ? 'menuitemradio' : 'menuitem'} aria-checked={radio ? row.checked : undefined}
              aria-haspopup={row.submenu ? 'menu' : undefined} aria-expanded={row.submenu ? on : undefined}
              className={`av-pop-item${row.danger ? ' danger' : ''}${row.checked ? ' on' : ''}${on ? ' open' : ''}`}
              ref={el => { if (el && row.submenu) subAnchors.current.set(row.key, el); }}
              onClick={() => (row.submenu ? setOpenSub(k => (k === row.key ? null : row.key)) : row.onSelect && pick(row.onSelect))}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {radio ? (row.checked ? 'radio_button_checked' : 'radio_button_unchecked') : row.icon}
              </span>
              <span className="av-pop-text">
                <span>{row.label}</span>
                {row.hint && <span className="av-pop-hint">{row.hint}</span>}
              </span>
              {row.submenu && <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>}
            </button>
          );
        })}
      </div>
      {subEntry?.submenu && (
        <div className="av-pop" role="menu" aria-label={subEntry.submenu.label} ref={sub.ref} style={sub.style}>
          <span className="av-pop-label" aria-hidden="true">{subEntry.submenu.label}</span>
          {subEntry.submenu.entries.map(entry => (
            <button key={entry.key} type="button" role="menuitem" className="av-pop-item" onClick={() => pick(entry.onSelect)}>
              <span className="av-pop-n" aria-hidden="true">{entry.n}</span>
              <span className="av-pop-text">
                <span className="av-pop-title">{entry.label}</span>
                <span className="av-pop-hint">{entry.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
