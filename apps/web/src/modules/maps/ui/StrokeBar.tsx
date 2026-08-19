import { useTranslation } from '@rolvium/i18n';
import { BRUSH_SIZES, STROKE_COLORS, STROKE_WIDTHS, isBrush, type Tool } from '../domain/useCases/mapRules';
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
}

/**
 * The bar above the canvas follows the active tool. Drawing → «Trazo» (thickness · colours · clear); the DM's
 * reveal/hide → «Pincel» (brush size + the two «todo» buttons, rolvium.pen `uXK3T`). Choosing what kind of segment
 * to draw is NOT here: it rides `SegmentBar`, floating over the map, because a full-width bar costs map height.
 */
export function StrokeBar({ value, onChange, onClearMine, onClearAll, tool = 'pencil', brush, onBrush, onRevealAll, onHideAll }: Props): JSX.Element {
  const { t } = useTranslation();
  const brushing = isBrush(tool) && brush !== undefined && !!onBrush;

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
