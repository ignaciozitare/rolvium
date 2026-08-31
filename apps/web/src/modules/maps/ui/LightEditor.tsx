import { useEffect, useRef, useState } from 'react';
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
  /**
   * Cerrar SIN borrar la luz. Sin esto el panel no tenía salida (dueño, 2026-08-31: «no puedo mover el modal
   * de luces ni cerrarlo»): con la herramienta de luces un clic fuera COLOCA otra luz, y cambiar de
   * herramienta tampoco lo quitaba, así que se quedaba tapando el mapa hasta borrar la luz.
   */
  onClose: () => void;
}

/**
 * Arrastrar el panel por su cabecera. Devuelve un DESPLAZAMIENTO, no una posición: el panel sigue anclado
 * donde lo deja el CSS y sólo se corre desde ahí, así que no hay dos sitios peleándose por dónde va.
 *
 * Vive aquí y no en un sitio compartido porque hoy sólo lo usa este panel. El día que un segundo lo necesite
 * se extrae, con dos consumidores reales delante y no antes.
 */
function useDragPanel(): { offset: { x: number; y: number }; handlers: Record<string, (e: React.PointerEvent<HTMLElement>) => void> } {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const from = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    // Los botones de la cabecera mandan sobre el arrastre: borrar y cerrar tienen que poder pulsarse.
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    from.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    const f = from.current;
    if (f) setOffset({ x: f.ox + e.clientX - f.px, y: f.oy + e.clientY - f.py });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>): void => {
    from.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return { offset, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
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
 */
export function LightEditor({ light, onChange, onRemove, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const { offset, handlers } = useDragPanel();
  // Escape cierra, como cualquier panel flotante de la app. Es la salida que se busca a ciegas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const kindLabel = (k: LightKind): string => t(`maps.lights.kinds.${k}`);
  const animated = !!flickerOf(light);

  return (
    <div className="mp-light-editor" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      role="group" aria-label={t('maps.lights.select', { kind: kindLabel(light.kind) })}>
      <div className="mp-light-head mp-drag" title={t('maps.lights.move')} {...handlers}>
        <span className="material-symbols-outlined mp-light-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">drag_indicator</span>
        <span className="material-symbols-outlined mp-light-head-icon" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">{KIND_ICON[light.kind]}</span>
        <span className="mp-light-title">{t('maps.lights.title')}</span>
        <button type="button" className="mp-layers-icon" aria-label={t('maps.lights.delete')} onClick={onRemove}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>delete</span>
        </button>
        <button type="button" className="mp-layers-icon" aria-label={t('maps.lights.close')} onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
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
