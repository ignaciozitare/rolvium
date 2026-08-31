import { useTranslation } from '@rolvium/i18n';
import { hardnessLabel, MASK_DIRECTIONS, MASK_SIZE_MAX, MASK_SIZE_MIN, strengthLabel, type MaskDirection } from '../domain/useCases/layerRules';

interface Props {
  layerName: string;
  /** En CASILLAS y continuo — el pincel de niebla sigue con sus cuatro discos, que es otro mando. */
  size: number;
  onSize: (n: number) => void;
  strength: number;
  onStrength: (v: number) => void;
  /** El BORDE del brochazo: 0 se difumina, 1 corta a filo. */
  hardness: number;
  onHardness: (v: number) => void;
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
export function MaskBrushBar({ layerName, size, onSize, strength, onStrength, hardness, onHardness, direction, onDirection, onReset, saving = false }: Props): JSX.Element {
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
      <label className="mp-mask-strength">
        <span className="tb-rotulo">{t('maps.mask.size')}</span>
        <input type="range" min={MASK_SIZE_MIN * 10} max={MASK_SIZE_MAX * 10} step={1} value={Math.round(size * 10)} aria-label={t('maps.mask.size')}
          onChange={e => onSize(Number(e.target.value) / 10)} />
        <span className="mp-light-value">{t('maps.mask.sizeCells', { n: size.toFixed(1) })}</span>
      </label>
      <label className="mp-mask-strength">
        <span className="tb-rotulo">{t('maps.mask.strength')}</span>
        <input type="range" min={5} max={100} step={5} value={Math.round(strength * 100)} aria-label={t('maps.mask.strength')}
          onChange={e => onStrength(Number(e.target.value) / 100)} />
        <span className="mp-light-value">{strengthLabel(strength)}</span>
      </label>
      <label className="mp-mask-strength">
        <span className="tb-rotulo">{t('maps.mask.hardness')}</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(hardness * 100)} aria-label={t('maps.mask.hardness')}
          onChange={e => onHardness(Number(e.target.value) / 100)} />
        <span className="mp-light-value">{hardnessLabel(hardness)}</span>
      </label>
      <span className="mp-stroke-note tb-italic tb-dim">{t('maps.mask.hint')}</span>
      <span className="mp-spacer" />
      {saving && <span className="tb-italic tb-dim">{t('maps.mask.saving')}</span>}
      <button type="button" className="tb-btn tb-btn-xs" onClick={onReset}>{t('maps.mask.reset')}</button>
    </div>
  );
}
