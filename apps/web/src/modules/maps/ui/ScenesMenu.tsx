import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { useDialog, Tooltip } from '@rolvium/ui';
import type { Scene } from '../domain/entities/Scene';

/** Hueco entre los tres puntos y el menú, y lo mínimo que se deja con el borde de la ventana. */
const MENU_GAP = 4;

interface Props {
  scenes: Scene[];
  selectedId: string | null;
  activeSceneId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onToggleVisible: (id: string, visible: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * DM scene rail: a collapsible column at the left of the canvas, one row per scene with its miniature, its name and
 * a gold dot on the one the players are seeing. «+ Escena» at the bottom; the selected row opens the options menu
 * (activar · visible · renombrar · eliminar).
 *
 * It replaces the chip dropdown that used to live in the scene header: choosing a scene went from two clicks to one,
 * and the header itself is gone (rolvium.pen · «Escena · Director», specs/modules/maps/SPEC.md § «Rebanada 3»).
 * Collapsed it keeps only the miniatures, to give the map back its width.
 *
 * 🔑 LOS TRES PUNTOS (suyo, 2026-09-09, repetido el 11: «*quiero que los 3 puntitos para modificar las escenas
 * se vean y que el modal quede por encima, que no se tape*»). Eran DOS fallos: no había ningún botón —el menú
 * sólo salía pinchando OTRA VEZ la escena elegida, y eso no hay forma de adivinarlo— y el menú vivía dentro de
 * la lista, que se desplaza y recortaba todo lo que asomara. Ahora cada escena lleva sus tres puntos, y el
 * menú flota FIJO a la ventana, igual que el tooltip escapó del mismo recorte
 * (`tests/regression/tooltip-escapa-el-recorte.test.tsx`). Pinchar la escena elegida lo sigue abriendo.
 */
export function ScenesMenu(p: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** Dónde flota el menú, en px de VENTANA. Lo calcula el efecto de abajo, que es quien ya sabe cuánto mide. */
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  /** Los tres puntos de cada escena: son el ancla del menú, lo abra quien lo abra. */
  const kebabs = useRef(new Map<string, HTMLButtonElement>());
  const cerrar = useCallback(() => { setMenuFor(null); setMenuAt(null); }, []);
  const abrir = (id: string): void => { if (menuFor === id) cerrar(); else setMenuFor(id); };

  /**
   * EL SITIO DEL MENÚ: debajo de sus tres puntos y hacia el mapa. Si no cabe debajo se abre hacia ARRIBA —con
   * la última escena de una lista larga se saldría por el borde de la ventana—. Va antes de pintar, así que
   * nunca se ve en el sitio equivocado.
   */
  useLayoutEffect(() => {
    const m = menuRef.current, k = menuFor ? kebabs.current.get(menuFor) : undefined;
    if (!m || !k) return;
    const r = k.getBoundingClientRect(), h = m.getBoundingClientRect().height;
    const top = r.bottom + MENU_GAP + h <= window.innerHeight ? r.bottom + MENU_GAP : Math.max(MENU_GAP, r.top - MENU_GAP - h);
    setMenuAt({ top, left: r.left });
  }, [menuFor]);

  /**
   * Se cierra al pinchar fuera y con Escape, como el menú de las texturas. Y al desplazar o cambiar la ventana:
   * va fijo a ella, así que se quedaría flotando lejos de su escena.
   */
  useEffect(() => {
    if (!menuFor) return undefined;
    const fuera = (e: MouseEvent): void => {
      const el = e.target as Element;
      if (menuRef.current?.contains(el)) return;
      // Los tres puntos y la escena elegida abren y cierran solos: si esto cerrase antes, su clic lo reabriría.
      if ([...kebabs.current.values()].some(k => k.contains(el)) || el.closest?.('.mp-rail-item.on')) return;
      cerrar();
    };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    document.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
      document.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [menuFor, cerrar]);
  // Plegar el rail esconde los tres puntos: el menú no puede quedarse flotando sin ancla.
  useEffect(() => { if (p.collapsed) cerrar(); }, [p.collapsed, cerrar]);

  const create = async () => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.new') }); if (name?.trim()) await p.onCreate(name.trim()); };
  const rename = async (s: Scene) => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.rename'), defaultValue: s.name }); if (name?.trim() && name.trim() !== s.name) await p.onRename(s.id, name.trim()); cerrar(); };
  const remove = async (s: Scene) => { if (await dialog.confirm(t('maps.scenes.deleteConfirm', { name: s.name }), { title: t('maps.scenes.delete'), danger: true, confirmLabel: t('common.delete') })) await p.onRemove(s.id); cerrar(); };
  const thumb = (s: Scene) => ({ background: s.bgImageUrl ? `${s.bgColor} url(${s.bgImageUrl}) center/cover` : s.bgColor });

  return (
    <div className={`mp-rail ${p.collapsed ? 'collapsed' : ''}`} role="group" aria-label={t('maps.scenes.title')}>
      <div className="mp-rail-head">
        {!p.collapsed && <span className="tb-rotulo">{t('maps.scenes.title')}</span>}
        <Tooltip label={p.collapsed ? t('maps.scenes.expand') : t('maps.scenes.collapse')} placement="right">
          <button type="button" className="mp-rail-fold" aria-expanded={!p.collapsed} aria-label={p.collapsed ? t('maps.scenes.expand') : t('maps.scenes.collapse')} onClick={p.onToggleCollapsed}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{p.collapsed ? 'left_panel_open' : 'left_panel_close'}</span>
          </button>
        </Tooltip>
      </div>
      <ul className="mp-rail-list">
        {p.scenes.map(s => {
          const on = s.id === p.selectedId, active = s.id === p.activeSceneId;
          const row = (
            <button type="button" className={`mp-rail-item ${on ? 'on' : ''}`} aria-pressed={on} aria-label={t('maps.scenes.select', { name: s.name })}
              onClick={() => (on && !p.collapsed ? abrir(s.id) : (p.onSelect(s.id), cerrar()))}>
              <span className="mp-rail-thumb" aria-hidden style={thumb(s)} />
              {!p.collapsed && <span className="mp-rail-name">{s.name}</span>}
              {active && <span className="mp-scene-active" aria-label={t('maps.scenes.active')} />}
            </button>
          );
          return (
            <li key={s.id} className="mp-rail-row">
              {p.collapsed ? <Tooltip label={s.name}>{row}</Tooltip> : row}
              {/* Hermano de la fila y no dentro: un botón no puede ir dentro de otro. Abre el menú de ESTA escena sin cambiar la que se mira. */}
              {!p.collapsed && (
                <button type="button" className={`mp-rail-kebab ${on ? 'on' : ''}`} aria-haspopup="menu" aria-expanded={menuFor === s.id}
                  aria-label={t('maps.scenes.menuFor', { name: s.name })} onClick={() => abrir(s.id)}
                  ref={el => { if (el) kebabs.current.set(s.id, el); else kebabs.current.delete(s.id); }}>
                  <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>more_vert</span>
                </button>
              )}
              {menuFor === s.id && !p.collapsed && (
                <div className="mp-pop mp-scene-menu" role="menu" aria-label={t('maps.scenes.menu')} ref={menuRef}
                  style={menuAt ? { top: menuAt.top, left: menuAt.left } : undefined}>
                  <button type="button" role="menuitem" className="mp-menu-item" disabled={active} onClick={() => { void p.onActivate(s.id); cerrar(); }}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>play_arrow</span>{t('maps.scenes.activate')}</button>
                  <button type="button" role="menuitemcheckbox" aria-checked={s.visiblePlayers} className="mp-menu-item" onClick={() => void p.onToggleVisible(s.id, !s.visiblePlayers)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{s.visiblePlayers ? 'check_box' : 'check_box_outline_blank'}</span>{t('maps.scenes.visible')}</button>
                  <button type="button" role="menuitem" className="mp-menu-item" onClick={() => void rename(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>edit</span>{t('maps.scenes.rename')}</button>
                  <button type="button" role="menuitem" className="mp-menu-item danger" onClick={() => void remove(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>delete</span>{t('maps.scenes.delete')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Tooltip label={t('maps.scenes.add')} placement="right">
        <button type="button" className="mp-rail-add" onClick={() => void create()} aria-label={t('maps.scenes.add')}>
          {p.collapsed ? <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>add</span> : t('maps.scenes.add')}
        </button>
      </Tooltip>
    </div>
  );
}
