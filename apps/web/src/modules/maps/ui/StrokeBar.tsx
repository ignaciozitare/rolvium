import { useTranslation } from '@rolvium/i18n';
import { STROKE_COLORS, STROKE_WIDTHS } from '../domain/useCases/mapRules';
import type { StrokeStyle } from './MapCanvas';

interface Props { value: StrokeStyle; onChange: (s: StrokeStyle) => void; onClearMine: () => void; onClearAll?: () => void }

/** «Trazo» bar: thickness · colours · «lo que dibujas lo ve toda la mesa» · clear my strokes (DM: clear all). */
export function StrokeBar({ value, onChange, onClearMine, onClearAll }: Props): JSX.Element {
  const { t } = useTranslation();
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
