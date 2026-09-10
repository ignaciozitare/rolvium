import { useTranslation } from '@rolvium/i18n';
import { BRUSH_TIPS, type BrushTip } from '../domain/entities/Scene';
import {
  BRUSH_TARGETS, hardnessStep, MASK_DIRECTIONS, MASK_SIZE_MAX, MASK_SIZE_MIN, roughnessStep, strengthLabel,
  type BrushTarget, type MaskDirection,
} from '../domain/useCases/layerRules';

export interface BrushSettings {
  tip: BrushTip;
  /** En CASILLAS y continuo. La niebla deja aquí sus cuatro discos: uno solo para los tres sitios. */
  size: number;
  strength: number;
  /** El BORDE del brochazo: 0 se difumina, 1 corta a filo. */
  hardness: number;
  /** Cuánto de roto, 0..1. **Sólo se aplica con la punta `rough`.** */
  roughness: number;
}

interface Props {
  target: BrushTarget;
  onTarget: (t: BrushTarget) => void;
  direction: MaskDirection;
  onDirection: (d: MaskDirection) => void;
  value: BrushSettings;
  /** Un solo camino de vuelta: la barra escribe el pincel de la ESCENA, y la escena es quien lo recuerda. */
  onChange: (patch: Partial<BrushSettings>) => void;
  /**
   * SE SOLTÓ EL DESLIZADOR. Mover es continuo y guardar es una vez: sin esto cada paso del deslizador sería
   * una escritura en la base. Mismo reparto que el previo de la escala de textura.
   */
  onCommit: () => void;
  /** Quitar del todo lo pintado. En la niebla son dos —revelar y ocultar—, y por eso llegan por separado. */
  onReset?: (() => void) | undefined;
  onRevealAll?: (() => void) | undefined;
  onHideAll?: (() => void) | undefined;
  saving?: boolean;
}

/** Un deslizador con su rótulo y su lectura, que es la fila que la barra repite cuatro veces. */
function Slider({ label, min, max, step, value, text, onChange, onCommit }: {
  label: string; min: number; max: number; step: number; value: number; text: string;
  onChange: (v: number) => void; onCommit: () => void;
}): JSX.Element {
  return (
    <label className="mp-mask-strength">
      <span className="tb-rotulo">{label}</span>
      {/* `pointerUp` para el ratón y `keyUp` para el teclado: las dos formas de soltar un deslizador. */}
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={e => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} />
      <span className="mp-light-value">{text}</span>
    </label>
  );
}

/**
 * LA BARRA DEL PINCEL (rebanada 9 · `rolvium.pen` frame «PL/Pincel · barra», aprobado por él el 2026-09-09).
 *
 * Un solo mando para los TRES sitios donde se pinta —una capa de terreno, la niebla y el suelo de una sala—
 * porque él lo pidió así: «*para los dos, tengo que poder elegir el trazo*». Antes eran tres herramientas con
 * tres comportamientos distintos y el suelo de una sala no tenía ninguna.
 *
 * Flota sobre el lienzo, como todas las barras desde la rebanada 3: una franja a lo ancho cuesta altura de
 * mapa.
 *
 * ⚠️ Lo que se toca aquí NO es estado de la pantalla: se guarda **en la escena** (decisión suya, contra la
 * recomendación contraria: «*el trazo es de la escena*»). Un mapa tiene un estilo y el pincel es parte de él.
 */
export function BrushBar({ target, onTarget, direction, onDirection, value, onChange, onCommit, onReset, onRevealAll, onHideAll, saving = false }: Props): JSX.Element {
  const { t } = useTranslation();
  const seg = (on: boolean): string => `mp-brush-opt ${on ? 'on' : ''}`;
  return (
    <div className="mp-strokebar mp-maskbar mp-brushbar-v2">
      <div className="mp-brush-row">
        <span className="tb-rotulo">{t('maps.brush.label')}</span>
        <span className="mp-brush-group">
          <span className="tb-rotulo">{t('maps.brush.on')}</span>
          <span className="mp-brush-seg" role="radiogroup" aria-label={t('maps.brush.on')}>
            {BRUSH_TARGETS.map(x => (
              <button key={x} type="button" role="radio" aria-checked={target === x} className={seg(target === x)} onClick={() => onTarget(x)}>
                {t(`maps.brush.target.${x}`)}
              </button>
            ))}
          </span>
        </span>
        <span className="mp-brush-group">
          <span className="tb-rotulo">{t('maps.brush.way')}</span>
          {/*
            * PINTAR y QUITAR, y no «borrar/devolver»: son las dos palabras del diseño y valen para los tres
            * sitios. QUITAR se lleva lo que hay encima —la capa, el suelo, la niebla—; PINTAR lo devuelve, y
            * en la niebla eso es taparla. Es la misma pareja de siempre (`erase`/`restore`) rotulada de forma
            * que signifique algo en los tres.
            */}
          <span className="mp-brush-seg" role="radiogroup" aria-label={t('maps.brush.way')}>
            {MASK_DIRECTIONS.map(d => (
              <button key={d} type="button" role="radio" aria-checked={direction === d} className={seg(direction === d)} onClick={() => onDirection(d)}>
                {t(`maps.brush.dir.${d}`)}
              </button>
            ))}
          </span>
        </span>
        <span className="mp-spacer" />
        {saving && <span className="tb-italic tb-dim">{t('maps.mask.saving')}</span>}
      </div>

      <div className="mp-brush-row">
        <span className="mp-brush-group">
          <span className="tb-rotulo">{t('maps.brush.tipLabel')}</span>
          <span className="mp-brush-seg" role="radiogroup" aria-label={t('maps.brush.tipLabel')}>
            {BRUSH_TIPS.map(tip => (
              <button key={tip} type="button" role="radio" aria-checked={value.tip === tip} className={seg(value.tip === tip)} onClick={() => onChange({ tip })}>
                <span className={`mp-brush-tipdot ${tip}`} aria-hidden="true" />
                {t(`maps.brush.tip.${tip}`)}
              </button>
            ))}
          </span>
        </span>
        {/* El tamaño va por décimas de casilla: el paso entero se le quedaba corto («gradual, no me sirve eso»). */}
        <Slider label={t('maps.brush.sizeLabel')} min={MASK_SIZE_MIN * 10} max={MASK_SIZE_MAX * 10} step={1}
          value={Math.round(value.size * 10)} onChange={n => onChange({ size: n / 10 })} onCommit={onCommit}
          // En el uno exacto no se dice «1.0 casillas»: ni el decimal ni el plural pintan nada ahí.
          text={value.size === 1 ? t('maps.mask.sizeCell') : t('maps.mask.sizeCells', { n: value.size.toFixed(1) })} />
        <Slider label={t('maps.brush.alpha')} min={5} max={100} step={5}
          value={Math.round(value.strength * 100)} onChange={n => onChange({ strength: n / 100 })} onCommit={onCommit}
          text={strengthLabel(value.strength)} />
        <Slider label={t('maps.brush.edge')} min={0} max={100} step={5}
          value={Math.round(value.hardness * 100)} onChange={n => onChange({ hardness: n / 100 })} onCommit={onCommit}
          text={t(`maps.brush.edgeStep.${hardnessStep(value.hardness)}`)} />
        <span className="mp-spacer" />
      </div>

      <div className="mp-brush-row">
        {/*
          * «Cuánto de roto» sólo existe con el BORDE ROTO, y va aparte de la dureza a propósito: la dureza
          * difumina hacia fuera y siempre en círculo, roto cambia el contorno. Un brochazo puede ser de canto
          * duro y roto a la vez, así que son dos mandos y no uno.
          */}
        {value.tip === 'rough' && (<>
          <Slider label={t('maps.brush.roughLabel')} min={0} max={100} step={5}
            value={Math.round(value.roughness * 100)} onChange={n => onChange({ roughness: n / 100 })} onCommit={onCommit}
            text={t(`maps.brush.roughness.${roughnessStep(value.roughness)}`)} />
          <span className="mp-brush-sample">{t('maps.brush.everyStrokeDiffers')}</span>
        </>)}
        <span className="mp-spacer" />
        {onRevealAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onRevealAll}>{t('maps.brush.revealAll')}</button>}
        {onHideAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onHideAll}>{t('maps.brush.hideAll')}</button>}
        {onReset && <button type="button" className="tb-btn tb-btn-xs" onClick={onReset}>{t('maps.mask.reset')}</button>}
      </div>

      <div className="mp-brush-hints">
        <span>{t('maps.brush.hintRoom')}</span>
        <span>{t('maps.brush.hintScene')}</span>
        <span>{t('maps.brush.hintFog')}</span>
      </div>
    </div>
  );
}
