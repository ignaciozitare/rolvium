import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { useDialog, Tooltip } from '@rolvium/ui';
import type { Scene, SceneAdventure } from '../domain/entities/Scene';
import { showsAdventurePicker } from '../domain/useCases/sceneAdventureRules';

/** Hueco entre los tres puntos y el menú, y lo mínimo que se deja con el borde de la ventana. */
const MENU_GAP = 4;
/** La llave del desplegable de aventuras en el mapa de anclas: comparte el menú flotante con los tres puntos. */
const ADVENTURE_MENU = '__adventure';

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
  /** Las aventuras de la campaña (sin archivadas). Con dos o más, arriba sale el desplegable. */
  adventures?: readonly SceneAdventure[] | undefined;
  /** La que se enseña; las escenas del carril son sólo las suyas. */
  adventureId?: string | null | undefined;
  onPickAdventure?: ((id: string) => void) | undefined;
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

  /**
   * EL DESPLEGABLE DE AVENTURAS (orden suya, 2026-09-21; rolvium.pen § 5 · «PL/Escenas · rail · ELEGIR LA AVENTURA
   * arriba del todo»): arriba del todo, sin el rótulo ESCENAS, «+ Escena» justo debajo y luego sólo las escenas de
   * esa aventura. Con una sola aventura no sale, y el carril es el de siempre.
   */
  const byAdventure = showsAdventurePicker(p.adventures);
  // Plegado no hay desplegable, pero las miniaturas siguen siendo sólo las de la aventura elegida.
  const picker = byAdventure && !p.collapsed;
  const advs = p.adventures ?? [];
  const shownAdventure = advs.find(a => a.id === p.adventureId) ?? null;
  const shown = byAdventure ? p.scenes.filter(s => s.adventureId === p.adventureId) : p.scenes;
  const countOf = (id: string) => p.scenes.filter(s => s.adventureId === id).length;
  const addButton = (
    <Tooltip label={t('maps.scenes.add')} placement="right">
      <button type="button" className="mp-rail-add" onClick={() => void create()} aria-label={t('maps.scenes.add')}>
        {p.collapsed ? <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>add</span> : t('maps.scenes.add')}
      </button>
    </Tooltip>
  );
  const foldButton = (
    <Tooltip label={p.collapsed ? t('maps.scenes.expand') : t('maps.scenes.collapse')} placement="right">
      <button type="button" className="mp-rail-fold" aria-expanded={!p.collapsed} aria-label={p.collapsed ? t('maps.scenes.expand') : t('maps.scenes.collapse')} onClick={p.onToggleCollapsed}>
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{p.collapsed ? 'left_panel_open' : 'left_panel_close'}</span>
      </button>
    </Tooltip>
  );

  return (
    <div className={`mp-rail ${p.collapsed ? 'collapsed' : ''}`} role="group" aria-label={t('maps.scenes.title')}>
      {picker
        ? (
          <>
            <div className="mp-rail-top">
              <button
                type="button" className="mp-rail-adv" aria-haspopup="menu" aria-expanded={menuFor === ADVENTURE_MENU}
                aria-label={`${t('maps.scenes.pickAdventure')}: ${shownAdventure?.title ?? ''}`} onClick={() => abrir(ADVENTURE_MENU)}
                ref={el => { if (el) kebabs.current.set(ADVENTURE_MENU, el); else kebabs.current.delete(ADVENTURE_MENU); }}
              >
                <span className="mp-rail-adv-label">{t('maps.scenes.adventure')}</span>
                <span className="mp-rail-adv-row">
                  <span className="mp-rail-adv-n">{shownAdventure ? advs.indexOf(shownAdventure) + 1 : ''}</span>
                  <span className="mp-rail-adv-title">{shownAdventure?.title ?? ''}</span>
                  <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>keyboard_arrow_down</span>
                </span>
              </button>
              {foldButton}
            </div>
            {addButton}
          </>
        )
        : (
          <div className="mp-rail-head">
            {!p.collapsed && <span className="tb-rotulo">{t('maps.scenes.title')}</span>}
            {foldButton}
          </div>
        )}
      <ul className="mp-rail-list">
        {shown.map(s => {
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
      {!picker && addButton}
      {picker && menuFor === ADVENTURE_MENU && (
        <div className="mp-pop mp-scene-menu mp-adv-menu" role="menu" aria-label={t('maps.scenes.showScenesOf')} ref={menuRef}
          style={menuAt ? { top: menuAt.top, left: menuAt.left } : undefined}>
          <span className="mp-adv-menu-label" aria-hidden="true">{t('maps.scenes.showScenesOf')}</span>
          {advs.map((a, i) => {
            const n = countOf(a.id);
            return (
              <button key={a.id} type="button" role="menuitemradio" aria-checked={a.id === p.adventureId}
                className={`mp-menu-item mp-adv-item${a.id === p.adventureId ? ' on' : ''}`}
                onClick={() => { p.onPickAdventure?.(a.id); cerrar(); }}>
                <span className="mp-adv-n" aria-hidden="true">{i + 1}</span>
                <span className="mp-adv-text">
                  <span className="mp-adv-title">{a.title}</span>
                  <span className="mp-adv-sub">
                    {t(`adventures.status.${a.status}`)} · {n === 1 ? t('adventures.sceneCountOne') : t('adventures.sceneCount', { n: String(n) })}
                  </span>
                </span>
                {a.id === p.adventureId && <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>check</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
