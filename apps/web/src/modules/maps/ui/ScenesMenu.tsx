import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { useDialog } from '@rolvium/ui';
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
}

/** DM scene chips with miniatures + «+ Escena»; the selected chip opens the options menu (rename · activate · visible · delete). */
export function ScenesMenu(p: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const create = async () => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.new') }); if (name?.trim()) await p.onCreate(name.trim()); };
  const rename = async (s: Scene) => { const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.rename'), defaultValue: s.name }); if (name?.trim() && name.trim() !== s.name) await p.onRename(s.id, name.trim()); setMenuFor(null); };
  const remove = async (s: Scene) => { if (await dialog.confirm(t('maps.scenes.deleteConfirm', { name: s.name }), { title: t('maps.scenes.delete'), danger: true, confirmLabel: t('common.delete') })) await p.onRemove(s.id); setMenuFor(null); };
  return (
    <div className="mp-scenes" role="group" aria-label={t('maps.scenes.title')}>
      {p.scenes.map(s => {
        const on = s.id === p.selectedId, active = s.id === p.activeSceneId;
        return (
          <div key={s.id} className="mp-scene-chip-wrap">
            <button type="button" className={`tb-btn mp-scene-chip ${on ? 'tb-btn-solid' : ''} ${active ? 'active' : ''}`} aria-pressed={on} aria-label={t('maps.scenes.select', { name: s.name })}
              onClick={() => (on ? setMenuFor(m => (m === s.id ? null : s.id)) : (p.onSelect(s.id), setMenuFor(null)))}>
              <span className="mp-scene-thumb" aria-hidden style={{ background: s.bgImageUrl ? `${s.bgColor} url(${s.bgImageUrl}) center/cover` : s.bgColor }} />
              {s.name}
              {active && <span className="mp-scene-active" title={t('maps.scenes.active')} aria-label={t('maps.scenes.active')} />}
              {on && <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-xs)' }}>expand_more</span>}
            </button>
            {menuFor === s.id && (
              <div className="mp-pop mp-scene-menu" role="menu" aria-label={t('maps.scenes.menu')}>
                <button type="button" role="menuitem" className="mp-menu-item" disabled={active} onClick={() => { void p.onActivate(s.id); setMenuFor(null); }}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>play_arrow</span>{t('maps.scenes.activate')}</button>
                <button type="button" role="menuitemcheckbox" aria-checked={s.visiblePlayers} className="mp-menu-item" onClick={() => void p.onToggleVisible(s.id, !s.visiblePlayers)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{s.visiblePlayers ? 'check_box' : 'check_box_outline_blank'}</span>{t('maps.scenes.visible')}</button>
                <button type="button" role="menuitem" className="mp-menu-item" onClick={() => void rename(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>edit</span>{t('maps.scenes.rename')}</button>
                <button type="button" role="menuitem" className="mp-menu-item danger" onClick={() => void remove(s)}><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>delete</span>{t('maps.scenes.delete')}</button>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="tb-btn" onClick={() => void create()}>{t('maps.scenes.add')}</button>
    </div>
  );
}
