import { useTranslation } from '@rolvium/i18n';
import type { Wall, WallKind } from '../domain/entities/Scene';
import { WALL_KINDS, canOpen } from '../domain/useCases/mapRules';

interface Props {
  /** The segment being edited, or `null` while the Muro tool is only choosing what to draw next. */
  wall: Wall | null;
  kind: WallKind;
  onKind: (kind: WallKind) => void;
  onVisible?: (visible: boolean) => void;
  onToggleOpen?: () => void;
  onRemove?: () => void;
}

/**
 * «Segmento»: floats over the canvas, same family as the token bar (rolvium.pen · «Escena · Director»).
 *
 * Two jobs, one bar. With the Muro tool and nothing selected it chooses what the next segment will be; with a
 * segment selected it changes what that one IS, whether the players see it, whether it is open, and deletes it.
 * It lives over the map and not on a bar above it because a full-width bar costs height the map wants.
 */
export function SegmentBar({ wall, kind, onKind, onVisible, onToggleOpen, onRemove }: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mp-segbar" role="toolbar" aria-label={t('maps.wall.segment')}>
      <span className="tb-rotulo">{t('maps.wall.segment')}</span>
      <span className="mp-kinds" role="radiogroup" aria-label={t('maps.wall.kindOf')}>
        {WALL_KINDS.map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={`mp-seg ${kind === k ? 'on' : ''}`} onClick={() => onKind(k)}>{t(`maps.wall.kind.${k}`)}</button>
        ))}
      </span>
      {wall && onVisible && (
        <label className="mp-check">
          <input type="checkbox" checked={wall.visiblePlayers} onChange={e => onVisible(e.target.checked)} />
          {t('maps.wall.visible')}
        </label>
      )}
      {wall && onToggleOpen && canOpen(wall) && (
        <button type="button" className="tb-btn tb-btn-xs" onClick={onToggleOpen}>{wall.isOpen ? t('maps.wall.close') : t('maps.wall.open')}</button>
      )}
      {wall && onRemove && (
        <button type="button" className="mp-segbar-del" aria-label={t('maps.wall.remove')} onClick={onRemove}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>delete</span>
        </button>
      )}
      {!wall && <span className="mp-stroke-note tb-italic tb-dim">{t('maps.wall.toggleHint')}</span>}
    </div>
  );
}
