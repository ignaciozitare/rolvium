import { useTranslation } from '@rolvium/i18n';
import type { WallKind } from '../domain/entities/Scene';
import { BRUSH_SIZES, STROKE_COLORS, STROKE_WIDTHS, WALL_KINDS, isBrush, type Tool } from '../domain/useCases/mapRules';
import type { StrokeStyle } from './MapCanvas';

interface Props {
  value: StrokeStyle;
  onChange: (s: StrokeStyle) => void;
  onClearMine: () => void;
  onClearAll?: () => void;
  /** The bar follows the active tool: drawing → «Trazo», reveal/hide → «Pincel». */
  tool?: Tool;
  brush?: number;
  onBrush?: (size: number) => void;
  onRevealAll?: () => void;
  onHideAll?: () => void;
  /** What the Muro tool draws next (DM). */
  wallKind?: WallKind;
  onWallKind?: (kind: WallKind) => void;
}

/**
 * The bar above the canvas follows the active tool. Drawing → «Trazo» (thickness · colours · clear); the DM's
 * reveal/hide → «Pincel» (brush size + the two «todo» buttons, rolvium.pen `uXK3T`); the DM's Muro → «Muro»
 * (which of the three types the next segment is, rolvium.pen `h3Q3NN`). The canvas legend keeps explaining what
 * each type cuts, so the note here only says the thing the legend cannot: how to work a door.
 */
export function StrokeBar({ value, onChange, onClearMine, onClearAll, tool = 'pencil', brush, onBrush, onRevealAll, onHideAll, wallKind, onWallKind }: Props): JSX.Element {
  const { t } = useTranslation();
  const brushing = isBrush(tool) && brush !== undefined && !!onBrush;
  const walling = tool === 'wall' && wallKind !== undefined && !!onWallKind;

  if (walling) {
    return (
      <div className="mp-strokebar mp-wallbar">
        <span className="tb-rotulo">{t('maps.wall.label')}</span>
        <span className="mp-kinds" role="radiogroup" aria-label={t('maps.wall.kindOf')}>
          {WALL_KINDS.map(kind => (
            <button key={kind} type="button" role="radio" aria-checked={wallKind === kind}
              className={`mp-seg ${wallKind === kind ? 'on' : ''}`} onClick={() => onWallKind(kind)}>{t(`maps.wall.kind.${kind}`)}</button>
          ))}
        </span>
        <span className="mp-stroke-note tb-italic tb-dim">{t('maps.wall.toggleHint')}</span>
      </div>
    );
  }

  if (brushing) {
    return (
      <div className="mp-strokebar mp-brushbar">
        <span className="tb-rotulo">{t('maps.brush.label')}</span>
        <div className="mp-brush-sizes" role="radiogroup" aria-label={t('maps.brush.size')}>
          {BRUSH_SIZES.map(size => (
            <button key={size} type="button" role="radio" aria-checked={brush === size} aria-label={t('maps.brush.sizeN', { n: String(size) })}
              className={`mp-brush-dot ${brush === size ? 'on' : ''}`} style={{ width: 6 + size * 5, height: 6 + size * 5 }} onClick={() => onBrush(size)} />
          ))}
        </div>
        <span className="mp-stroke-note tb-italic tb-dim">{t('maps.brush.affectsAll')}</span>
        <span className="mp-spacer" />
        {onRevealAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onRevealAll}>{t('maps.brush.revealAll')}</button>}
        {onHideAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onHideAll}>{t('maps.brush.hideAll')}</button>}
      </div>
    );
  }

  return (
    <div className="mp-strokebar">
      <span className="tb-rotulo">{t('maps.stroke.label')}</span>
      <input type="range" className="mp-stroke-width" min={0} max={STROKE_WIDTHS.length - 1} step={1} aria-label={t('maps.stroke.width')}
        value={Math.max(0, STROKE_WIDTHS.indexOf(value.width as typeof STROKE_WIDTHS[number]))} onChange={e => onChange({ ...value, width: STROKE_WIDTHS[Number(e.target.value)] ?? 2 })} />
      <div className="mp-stroke-colors" role="radiogroup" aria-label={t('maps.stroke.label')}>
        {STROKE_COLORS.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={value.color === c} aria-label={t('maps.stroke.color', { n: String(i + 1) })} className={`mp-swatch ${value.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange({ ...value, color: c })} />
        ))}
      </div>
      <span className="mp-stroke-note tb-italic tb-dim">{t('maps.stroke.shared')}</span>
      <span className="mp-spacer" />
      {onClearAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onClearAll}>{t('maps.stroke.clearAll')}</button>}
      <button type="button" className="tb-btn tb-btn-xs" onClick={onClearMine}>{t('maps.stroke.clearMine')}</button>
    </div>
  );
}
