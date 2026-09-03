import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import type { Wall, WallKind } from '../domain/entities/Scene';
import { WALL_KINDS, canOpen } from '../domain/useCases/mapRules';
import { ROOM_SHAPES, type RoomShape } from '../domain/useCases/roomRules';

interface Props {
  /** The segment being edited, or `null` while the Muro tool is only choosing what to draw next. */
  wall: Wall | null;
  kind: WallKind;
  onKind: (kind: WallKind) => void;
  /** Con qué forma levanta. Sólo mientras se construye: con un segmento elegido se edita ESE, no el siguiente. */
  shape?: RoomShape;
  onShape?: (shape: RoomShape) => void;
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
export function SegmentBar({ wall, kind, onKind, shape, onShape, onVisible, onToggleOpen, onRemove }: Props): JSX.Element {
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
        <Tooltip label={t('maps.wall.remove')} placement="top">
          <button type="button" className="mp-segbar-del" aria-label={t('maps.wall.remove')} onClick={onRemove}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>delete</span>
          </button>
        </Tooltip>
      )}
      {!wall && shape && onShape && (
        <span className="mp-kinds" role="radiogroup" aria-label={t('maps.room.shapeOf')}>
          {ROOM_SHAPES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={shape === s} className={`mp-seg ${shape === s ? 'on' : ''}`} onClick={() => onShape(s)}>{t(`maps.room.shape.${s}`)}</button>
          ))}
        </span>
      )}
      {!wall && <span className="mp-stroke-note tb-italic tb-dim">{shapeHint(shape, t)}</span>}
    </div>
  );
}

/**
 * La pista de abajo cambia con la forma: cada una se dibuja con un gesto distinto y decirlo aquí ahorra
 * tener que adivinarlo sobre el lienzo.
 */
function shapeHint(shape: RoomShape | undefined, t: (key: string) => string): string {
  if (!shape || shape === 'segment') return t('maps.wall.toggleHint');
  return shape === 'poly' ? t('maps.room.polyHint') : t('maps.room.dragHint');
}
