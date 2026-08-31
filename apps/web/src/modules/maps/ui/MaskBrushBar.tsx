import { useTranslation } from '@rolvium/i18n';
import { BRUSH_SIZES } from '../domain/useCases/mapRules';
import { MASK_DIRECTIONS, strengthLabel, type MaskDirection } from '../domain/useCases/layerRules';

interface Props {
  layerName: string;
  size: number;
  onSize: (n: number) => void;
  strength: number;
  onStrength: (v: number) => void;
  direction: MaskDirection;
  onDirection: (d: MaskDirection) => void;
  onReset: () => void;
  saving?: boolean;
}

/**
 * La barra del pincel de transparencia, flotando sobre el mapa (rolvium.pen · «Escena · Director · capas y
 * pincel de transparencia»). Como la de niebla desde la rebanada 3: flotante, porque una franja a lo ancho
 * cuesta altura de mapa.
 *
 * Dos sentidos, igual que Revelar/Ocultar en la niebla: `erase` quita la capa y asoma la de abajo,
 * `restore` la trae de vuelta. Es lo que hace verdad la promesa del spec — la foto original no se toca nunca.
 */
export function MaskBrushBar({ layerName, size, onSize, strength, onStrength, direction, onDirection, onReset, saving = false }: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mp-strokebar mp-maskbar">
      <span className="tb-rotulo">{t('maps.mask.label')}</span>
      <span className="mp-mask-layer">{layerName}</span>
      <div className="mp-mask-dirs" role="radiogroup" aria-label={t('maps.mask.direction')}>
        {MASK_DIRECTIONS.map(d => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} className={`mp-light-opt ${direction === d ? 'on' : ''}`} onClick={() => onDirection(d)}>
            {t(`maps.mask.${d}`)}
          </button>
        ))}
      </div>
      <div className="mp-brush-sizes" role="radiogroup" aria-label={t('maps.brush.size')}>
        {BRUSH_SIZES.map(n => (
          <button key={n} type="button" role="radio" aria-checked={size === n} aria-label={t('maps.brush.sizeN', { n: String(n) })}
            className={`mp-brush-dot ${size === n ? 'on' : ''}`} style={{ width: 6 + n * 5, height: 6 + n * 5 }} onClick={() => onSize(n)} />
        ))}
      </div>
      <label className="mp-mask-strength">
        <span className="tb-rotulo">{t('maps.mask.strength')}</span>
        <input type="range" min={5} max={100} step={5} value={Math.round(strength * 100)} aria-label={t('maps.mask.strength')}
          onChange={e => onStrength(Number(e.target.value) / 100)} />
        <span className="mp-light-value">{strengthLabel(strength)}</span>
      </label>
      <span className="mp-stroke-note tb-italic tb-dim">{t('maps.mask.hint')}</span>
      <span className="mp-spacer" />
      {saving && <span className="tb-italic tb-dim">{t('maps.mask.saving')}</span>}
      <button type="button" className="tb-btn tb-btn-xs" onClick={onReset}>{t('maps.mask.reset')}</button>
    </div>
  );
}
