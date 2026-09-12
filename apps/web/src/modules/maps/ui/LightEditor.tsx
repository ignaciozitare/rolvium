import { useTranslation } from '@rolvium/i18n';
import { FloatingPanel, OptionGroup, PanelIconButton, PanelNote, PanelSection, Slider } from '@rolvium/ui';
import type { Light, LightKind, LightPatch, LightShape } from '../domain/entities/Scene';
import { clampIntensity, clampRangeM, clampSpinMs, DEFAULT_SPIN_MS, flickerOf, INTENSITY_STEP, intensityLabel, LIGHT_COLORS, LIGHT_KINDS, LIGHT_SHAPES, MAX_INTENSITY, MAX_RANGE_M, MAX_SPIN_MS, MIN_INTENSITY, MIN_RANGE_M, MIN_SPIN_MS, rangeLabelM, RANGE_STEP_M, spinLabelS, SPIN_STEP_MS } from '../domain/useCases/layerRules';

const KIND_ICON: Record<LightKind, string> = {
  torch: 'local_fire_department', bulb: 'lightbulb', fire: 'fireplace', lantern: 'wb_twilight',
  flashlight: 'flashlight_on', moonlight: 'dark_mode', magic: 'flare',
};

interface Props {
  light: Light;
  onChange: (patch: LightPatch) => void;
  onRemove: () => void;
  /**
   * Cerrar SIN borrar la luz. Sin esto el panel no tenía salida (dueño, 2026-08-31: «no puedo mover el modal
   * de luces ni cerrarlo»): con la herramienta de luces un clic fuera COLOCA otra luz, y cambiar de
   * herramienta tampoco lo quitaba, así que se quedaba tapando el mapa hasta borrar la luz.
   */
  onClose: () => void;
}

/**
 * El editor de una luz de ambiente (rolvium.pen · «Escena · Director · luces de ambiente»).
 *
 * Se agarra por la cabecera y se aparta, y la X lo cierra sin borrar la luz: con la herramienta de luces un
 * clic fuera COLOCA otra, así que sin salida propia el panel se quedaba tapando el mapa (dueño, 2026-08-31).
 *
 * Desde § 7.2 la luz alumbra de verdad —se recorta contra los muros y entra en el cálculo de visión, que
 * hace el servidor—, así que `castsShadow` ya no es un dato guardado a la espera: es el interruptor que lo
 * enciende.
 *
 * El parpadeo SÍ se anima: animar es pintar. El ritmo lo pone el TIPO (la antorcha tiembla, la hoguera
 * respira, la bombilla da golpes secos), así que aquí sólo hay un interruptor y no un juego de velocidades.
 *
 * Desde el 2026-09-11 la carcasa, los deslizadores y los botones de opción son las piezas comunes de
 * `@rolvium/ui`, y lo elegido —la forma y el tipo— va en sangre como en el Builder y el Pincel, no en negro
 * ni en oro.
 */
export function LightEditor({ light, onChange, onRemove, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const kindLabel = (k: LightKind): string => t(`maps.lights.kinds.${k}`);
  const animated = !!flickerOf(light);

  return (
    <FloatingPanel className="mp-light-editor" title={t('maps.lights.title')}
      ariaLabel={t('maps.lights.select', { kind: kindLabel(light.kind) })}
      moveLabel={t('maps.lights.move')} closeLabel={t('maps.lights.close')} onClose={onClose}
      // Escape cierra, como cualquier panel flotante de la app. Es la salida que se busca a ciegas.
      closeOnEscape
      icon={<span className="material-symbols-outlined mp-light-head-icon" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">{KIND_ICON[light.kind]}</span>}
      actions={<PanelIconButton icon="delete" label={t('maps.lights.delete')} onClick={onRemove} />}>

      <div className="mp-light-preview" aria-hidden="true">
        <span className="mp-light-halo" style={{ background: `radial-gradient(circle, ${light.color} 0%, transparent 70%)` }} />
      </div>

      <PanelSection label={t('maps.lights.shape')}>
        <OptionGroup ariaLabel={t('maps.lights.shape')} look="outline" columns="row" value={light.shape}
          onChange={(sh: LightShape) => onChange({ shape: sh })}
          options={LIGHT_SHAPES.map(sh => ({ value: sh, label: t(`maps.lights.shapes.${sh}`) }))} />
        {light.shape === 'cone' && (
          <>
            <Slider layout="inline" hideLabel label={t('maps.lights.cone')} min={10} max={300} step={5} value={light.coneAngle}
              onChange={v => onChange({ coneAngle: v })} valueText={`${Math.round(light.coneAngle)}°`} />
            {/*
              * Hacia dónde APUNTA el cono. La apertura sin la dirección no sirve de nada: un foco que sólo
              * puede mirar a la derecha no es un foco (dueño, 2026-08-31). `rotation` se guardaba desde el
              * primer día y ya la lee el recorte contra los muros; lo único que faltaba era poder tocarla.
              * En vuelta entera, porque 0 y 360 son el mismo sitio y así el deslizador no tiene tope raro.
              */}
            <Slider layout="inline" hideLabel label={t('maps.lights.rotation')} min={0} max={355} step={5}
              value={((light.rotation % 360) + 360) % 360} onChange={v => onChange({ rotation: v })}
              valueText={`${Math.round(((light.rotation % 360) + 360) % 360)}°`} />
            {/*
              * QUE GIRE SOLA, «como una sirena» (§ 7.2, petición del dueño del 2026-08-31). Sólo aquí, con
              * el cono: un radio ya alumbra en redondo y un cuadrado girando no significa nada.
              *
              * Un interruptor y un periodo, pero UN solo dato: `spinMs = 0` es «quieta». Guardar además un
              * «gira sí/no» sería decir lo mismo dos veces y acabaría mintiendo.
              */}
            <label className="mp-light-check">
              <input type="checkbox" checked={light.spinMs > 0} onChange={e => onChange({ spinMs: e.target.checked ? DEFAULT_SPIN_MS : 0 })} />
              {t('maps.lights.spin')}
            </label>
            {light.spinMs > 0 && (
              <Slider layout="inline" hideLabel label={t('maps.lights.spinPeriod')} min={MIN_SPIN_MS} max={MAX_SPIN_MS} step={SPIN_STEP_MS}
                value={light.spinMs} onChange={v => onChange({ spinMs: clampSpinMs(v) })} valueText={spinLabelS(light.spinMs)} />
            )}
          </>
        )}
      </PanelSection>

      <PanelSection label={t('maps.lights.kind')}>
        <OptionGroup ariaLabel={t('maps.lights.kind')} look="outline" columns={3} caps={false} value={light.kind}
          onChange={k => onChange({ kind: k })}
          options={LIGHT_KINDS.map(k => ({ value: k, label: kindLabel(k), icon: KIND_ICON[k] }))} />
      </PanelSection>

      <PanelSection label={t('maps.lights.color')}>
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
        {/*
          * INTENSIDAD (§ 7.2, petición del dueño 2026-09-01). Va en «Color» y no en «Se guardan ya» porque
          * esto SÍ se ve en el mapa al momento: es cuánto canta la luz. Cuánto ILUMINA es el alcance, y está
          * abajo con lo demás. La barra es la misma de siempre —cono, rotación, vuelta—, no una nueva.
          */}
        <Slider layout="inline" hideLabel label={t('maps.lights.intensity')} min={MIN_INTENSITY} max={MAX_INTENSITY} step={INTENSITY_STEP}
          value={light.intensity} onChange={v => onChange({ intensity: clampIntensity(v) })} valueText={intensityLabel(light.intensity)} />
      </PanelSection>

      {/*
        * Alcance y sombra NO se usan todavía. Se enseñan igual, y rotulados como «se guardan ya», porque el
        * director tiene que poder dejarlos puestos hoy: añadirlos el día que las luces iluminen obligaría a
        * repasar a mano todas las luces de todas las escenas.
        */}
      <PanelSection label={t('maps.lights.prepared')}>
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
      </PanelSection>

      <PanelNote>{t('maps.lights.note')}</PanelNote>
    </FloatingPanel>
  );
}
