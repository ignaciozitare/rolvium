import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { useDialog, Tooltip } from '@rolvium/ui';
import type { Scene } from '../domain/entities/Scene';

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
 */
export function ScenesMenu(p: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const create = async () => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.new') }); if (name?.trim()) await p.onCreate(name.trim()); };
  const rename = async (s: Scene) => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.rename'), defaultValue: s.name }); if (name?.trim() && name.trim() !== s.name) await p.onRename(s.id, name.trim()); setMenuFor(null); };
  const remove = async (s: Scene) => { if (await dialog.confirm(t('maps.scenes.deleteConfirm', { name: s.name }), { title: t('maps.scenes.delete'), danger: true, confirmLabel: t('common.delete') })) await p.onRemove(s.id); setMenuFor(null); };
  const thumb = (s: Scene) => ({ background: s.bgImageUrl ? `${s.bgColor} url(${s.bgImageUrl}) center/cover` : s.bgColor });

  return (
    <div className={`mp-rail ${p.collapsed ? 'collapsed' : ''}`} role="group" aria-label={t('maps.scenes.title')}>
      <div className="mp-rail-head">
        {!p.collapsed && <span className="tb-rotulo">{t('maps.scenes.title')}</span>}
        <button type="button" className="mp-rail-fold" aria-expanded={!p.collapsed} aria-label={p.collapsed ? t('maps.scenes.expand') : t('maps.scenes.collapse')} onClick={p.onToggleCollapsed}>
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{p.collapsed ? 'left_panel_open' : 'left_panel_close'}</span>
        </button>
      </div>
      <ul className="mp-rail-list">
        {p.scenes.map(s => {
          const on = s.id === p.selectedId, active = s.id === p.activeSceneId;
          const row = (
            <button type="button" className={`mp-rail-item ${on ? 'on' : ''}`} aria-pressed={on} aria-label={t('maps.scenes.select', { name: s.name })}
              onClick={() => (on && !p.collapsed ? setMenuFor(m => (m === s.id ? null : s.id)) : (p.onSelect(s.id), setMenuFor(null)))}>
              <span className="mp-rail-thumb" aria-hidden style={thumb(s)} />
              {!p.collapsed && <span className="mp-rail-name">{s.name}</span>}
              {active && <span className="mp-scene-active" aria-label={t('maps.scenes.active')} />}
            </button>
          );
          return (
            <li key={s.id} className="mp-rail-row">
              {p.collapsed ? <Tooltip label={s.name}>{row}</Tooltip> : row}
              {menuFor === s.id && !p.collapsed && (
                <div className="mp-pop mp-scene-menu" role="menu" aria-label={t('maps.scenes.menu')}>
                  <button type="button" role="menuitem" className="mp-menu-item" disabled={active} onClick={() => { void p.onActivate(s.id); setMenuFor(null); }}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>play_arrow</span>{t('maps.scenes.activate')}</button>
                  <button type="button" role="menuitemcheckbox" aria-checked={s.visiblePlayers} className="mp-menu-item" onClick={() => void p.onToggleVisible(s.id, !s.visiblePlayers)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{s.visiblePlayers ? 'check_box' : 'check_box_outline_blank'}</span>{t('maps.scenes.visible')}</button>
                  <button type="button" role="menuitem" className="mp-menu-item" onClick={() => void rename(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>edit</span>{t('maps.scenes.rename')}</button>
                  <button type="button" role="menuitem" className="mp-menu-item danger" onClick={() => void remove(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>delete</span>{t('maps.scenes.delete')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="mp-rail-add" onClick={() => void create()} aria-label={t('maps.scenes.add')}>
        {p.collapsed ? <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>add</span> : t('maps.scenes.add')}
      </button>
    </div>
  );
}
