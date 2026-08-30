import { useTranslation } from '@rolvium/i18n';
import type { Light, LightKind, LightPatch, LightShape } from '../domain/entities/Scene';
import { clampRangeM, flickerOf, LIGHT_COLORS, LIGHT_KINDS, LIGHT_SHAPES, MAX_RANGE_M, MIN_RANGE_M, rangeLabelM, RANGE_STEP_M } from '../domain/useCases/layerRules';

const KIND_ICON: Record<LightKind, string> = {
  torch: 'local_fire_department', bulb: 'lightbulb', fire: 'fireplace', lantern: 'wb_twilight',
  flashlight: 'flashlight_on', moonlight: 'dark_mode', magic: 'flare',
};

interface Props {
  light: Light;
  onChange: (patch: LightPatch) => void;
  onRemove: () => void;
}

/**
 * El editor de una luz de ambiente (rolvium.pen · «Escena · Director · luces de ambiente»).
 *
 * Lo importante que se dice EN PANTALLA, y no sólo en el código: hoy la luz es PINTURA —no revela niebla ni
 * cambia lo que ve nadie— pero el alcance y la sombra se guardan desde el primer día, porque añadirlos el día
 * que ilumine obligaría a repasar a mano todas las luces ya colocadas de todas las escenas.
 *
 * El parpadeo SÍ se anima: animar es pintar. El ritmo lo pone el TIPO (la antorcha tiembla, la hoguera
 * respira, la bombilla da golpes secos), así que aquí sólo hay un interruptor y no un juego de velocidades.
 */
export function LightEditor({ light, onChange, onRemove }: Props): JSX.Element {
  const { t } = useTranslation();
  const kindLabel = (k: LightKind): string => t(`maps.lights.kinds.${k}`);
  const animated = !!flickerOf(light);

  return (
    <div className="mp-light-editor" role="group" aria-label={t('maps.lights.select', { kind: kindLabel(light.kind) })}>
      <div className="mp-light-head">
        <span className="material-symbols-outlined mp-light-head-icon" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">{KIND_ICON[light.kind]}</span>
        <span className="mp-light-title">{t('maps.lights.title')}</span>
        <button type="button" className="mp-layers-icon" aria-label={t('maps.lights.delete')} onClick={onRemove}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>delete</span>
        </button>
      </div>

      <div className="mp-light-preview" aria-hidden="true">
        <span className="mp-light-halo" style={{ background: `radial-gradient(circle, ${light.color} 0%, transparent 70%)` }} />
      </div>

      <fieldset className="mp-light-group">
        <legend className="tb-rotulo">{t('maps.lights.shape')}</legend>
        <div className="mp-light-seg" role="radiogroup" aria-label={t('maps.lights.shape')}>
          {LIGHT_SHAPES.map((sh: LightShape) => (
            <button key={sh} type="button" role="radio" aria-checked={light.shape === sh} className={`mp-light-opt ${light.shape === sh ? 'on' : ''}`} onClick={() => onChange({ shape: sh })}>
              {t(`maps.lights.shapes.${sh}`)}
            </button>
          ))}
        </div>
        {light.shape === 'cone' && (
          <label className="mp-light-row">
            <span className="mp-light-label">{t('maps.lights.cone')}</span>
            <input type="range" min={10} max={300} step={5} value={light.coneAngle} aria-label={t('maps.lights.cone')} onChange={e => onChange({ coneAngle: Number(e.target.value) })} />
            <span className="mp-light-value">{Math.round(light.coneAngle)}°</span>
          </label>
        )}
      </fieldset>

      <fieldset className="mp-light-group">
        <legend className="tb-rotulo">{t('maps.lights.kind')}</legend>
        <div className="mp-light-kinds" role="radiogroup" aria-label={t('maps.lights.kind')}>
          {LIGHT_KINDS.map(k => (
            <button key={k} type="button" role="radio" aria-checked={light.kind === k} className={`mp-light-kind ${light.kind === k ? 'on' : ''}`} onClick={() => onChange({ kind: k })}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{KIND_ICON[k]}</span>
              {kindLabel(k)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mp-light-group">
        <legend className="tb-rotulo">{t('maps.lights.color')}</legend>
        <div className="mp-light-row">
          <div className="mp-light-colors" role="radiogroup" aria-label={t('maps.lights.color')}>
            {LIGHT_COLORS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={light.color === c} aria-label={t('maps.lights.colorN', { n: String(i + 1) })}
                className={`mp-swatch ${light.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange({ color: c })} />
            ))}
          </div>
          <label className="mp-light-check">
            <input type="checkbox" checked={light.flicker} onChange={e => onChange({ flicker: e.target.checked })} />
            {t('maps.lights.flicker')}
          </label>
          {/* Se dice que se anima de verdad: es lo que el dueño pidió y no se ve en un interruptor apagado. */}
          {animated && <span className="mp-light-animates">{t('maps.lights.animates')}</span>}
        </div>
      </fieldset>

      {/*
        * Alcance y sombra NO se usan todavía. Se enseñan igual, y rotulados como «se guardan ya», porque el
        * director tiene que poder dejarlos puestos hoy: añadirlos el día que las luces iluminen obligaría a
        * repasar a mano todas las luces de todas las escenas.
        */}
      <fieldset className="mp-light-group">
        <legend className="tb-rotulo">{t('maps.lights.prepared')}</legend>
        <div className="mp-light-row">
          <label className="mp-light-range">
            <span className="mp-light-label">{t('maps.lights.range')}</span>
            <input type="number" min={MIN_RANGE_M} max={MAX_RANGE_M} step={RANGE_STEP_M} value={light.rangeM} aria-label={t('maps.lights.range')}
              onChange={e => onChange({ rangeM: clampRangeM(Number(e.target.value)) })} />
            <span className="mp-light-value">{rangeLabelM(light)} m</span>
          </label>
          <label className="mp-light-check">
            <input type="checkbox" checked={light.castsShadow} onChange={e => onChange({ castsShadow: e.target.checked })} />
            {t('maps.lights.shadow')}
          </label>
        </div>
      </fieldset>

      <p className="mp-light-note">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">info</span>
        {t('maps.lights.note')}
      </p>
    </div>
  );
}
