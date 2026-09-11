import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { BRUSH_TIPS, type BrushTip, type MapColor } from '../domain/entities/Scene';
import {
  hardnessStep, MASK_SIZE_MAX, MASK_SIZE_MIN, roughnessStep, strengthLabel,
} from '../domain/useCases/layerRules';
import {
  PAINT_ON, PAINT_WITH, paintActionsFor, paintsWithStuff, type PaintAction, type PaintOn, type PaintWith,
} from '../domain/useCases/paintRules';
import { tilePx } from '../domain/useCases/roomStyles';
import { PaintColor } from './PaintColor';
import { useDragPanel } from './useDragPanel';

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

/** El icono de cada destino, del diseño aprobado (`TlJot` § S/1). */
const ON_ICON: Record<PaintOn, string> = { room: 'dashboard', rock: 'fence', layer: 'image', fog: 'cloud' };
/** …y el de cada cosa que se puede hacer (`TlJot` § S/2). */
const ACTION_ICON: Record<PaintAction, string> = { paint: 'brush', erase: 'ink_eraser', uncover: 'opacity' };
/** …y el de con qué se pinta (`TlJot` § S/3). */
const WITH_ICON: Record<PaintWith, string> = { texture: 'texture', color: 'palette' };

interface Props {
  on: PaintOn;
  onOn: (x: PaintOn) => void;
  action: PaintAction;
  onAction: (a: PaintAction) => void;

  // ── con qué se pinta ───────────────────────────────────────────────────────
  ink: PaintWith;
  onInk: (w: PaintWith) => void;
  /** La textura con la que se va a pintar el próximo brochazo, y cómo se llama. */
  textureUrl: string | null;
  textureName: string | null;
  /** Cuántas casillas mide un azulejo de esa textura: la muestra grande enseña el tamaño de verdad. */
  textureCells: number;
  gridSize: number;
  onPickTexture: () => void;
  onClearTexture: () => void;
  /**
   * CUÁNTO MIDE UN AZULEJO del pincel, en casillas. Petición suya del 2026-09-10: «*aquí hace falta agregar un
   * tamaño de la textura*». Mismo reparto que las escalas del Builder: mover va en vivo y no se guarda nada —
   * el azulejo queda cocido dentro del PNG en cuanto se suelta un brochazo.
   */
  onTextureCells?: (cells: number) => void;
  /**
   * CUÁNTOS GRADOS SE GIRA la textura (petición suya, 2026-09-10: «*además de escalarse, que se pueda girar*»).
   * Va DEBAJO de la escala (`TlJot` § S/4, y suyo: «*el girar va debajo*»). Mismo reparto: mover va en vivo y
   * no se guarda nada — queda cocido en el PNG en cuanto se suelta un brochazo.
   */
  textureDeg?: number;
  onTextureDeg?: (deg: number) => void;
  color: string;
  onColor: (hex: string) => void;
  /** Los que él se ha inventado en ESTA campaña. `null` mientras se están pidiendo. */
  savedColors: readonly MapColor[] | null;
  onSaveColor: (hex: string) => void;

  value: BrushSettings;
  /** Un solo camino de vuelta: el panel escribe el pincel de la ESCENA, y la escena es quien lo recuerda. */
  onChange: (patch: Partial<BrushSettings>) => void;
  /**
   * SE SOLTÓ EL DESLIZADOR. Mover es continuo y guardar es una vez: sin esto cada paso del deslizador sería
   * una escritura en la base. Mismo reparto que el previo de la escala de textura.
   */
  onCommit: () => void;
  /** Quitar del todo lo que el pincel haya puesto en este destino. En la niebla son dos, y llegan aparte. */
  onReset?: (() => void) | undefined;
  onRevealAll?: (() => void) | undefined;
  onHideAll?: (() => void) | undefined;
  saving?: boolean;
  onClose: () => void;
}

/** Un deslizador APILADO: rótulo y lectura arriba, la barra debajo a todo lo ancho (`TlJot` § C/TAMAÑO). */
function Slider({ label, min, max, step, value, text, onChange, onCommit }: {
  label: string; min: number; max: number; step: number; value: number; text: string;
  /** Sin `onCommit` el deslizador es sólo en vivo: la escala y el giro de la textura no guardan nada al soltar. */
  onChange: (v: number) => void; onCommit?: () => void;
}): JSX.Element {
  return (
    <label className="mp-bp-slider">
      <span className="mp-bp-slider-head">
        <span className="tb-rotulo">{label}</span>
        <span className="mp-bp-slider-v">{text}</span>
      </span>
      {/* `pointerUp` para el ratón y `keyUp` para el teclado: las dos formas de soltar un deslizador. */}
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={e => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} />
    </label>
  );
}

/**
 * EL PANEL DEL PINCEL QUE PINTA ENCIMA (rebanada 10 · `rolvium.pen` marco `TlJot` «PINTAR ENCIMA», aprobado
 * por él el 2026-09-10).
 *
 * 🔴 **REESCRITO el 2026-09-10 después de que él lo viera funcionando.** La versión anterior ofrecía «SOBRE
 * QUÉ: suelo · muro» y «CON QUÉ: textura · color · borrar» para EXCAVAR, y él lo paró en pantalla: «*lo que
 * has hecho no es un pincel para pintar sobre las habitaciones o muros o fotos que pongas, lo que eso es, es
 * cavar con construir, que no es lo que te pedí*». Todo aquello se MUDÓ al Builder (`BuilderPanel`), que es
 * donde él dijo que hacía falta — no se tiró nada.
 *
 * 🔑 **PINTAR NO CAMBIA EL MAPA.** Ni por dónde se anda, ni qué se ve, ni la luz. Es sólo cómo se ve, y es la
 * línea que separa este pincel del Builder.
 *
 * Sigue siendo de la familia de `BuilderPanel` y `LightEditor` —flota, se agarra por la cabecera, la X lo
 * cierra— porque él tumbó la barra a lo ancho de la rebanada 9: «*ajusta el diseño como un modal que se mueva
 * como todos los otros*».
 */
export function BrushPanel({
  on, onOn, action, onAction, ink, onInk,
  textureUrl, textureName, textureCells, gridSize, onPickTexture, onClearTexture, onTextureCells, textureDeg = 0, onTextureDeg,
  color, onColor, savedColors, onSaveColor,
  value, onChange, onCommit,
  onReset, onRevealAll, onHideAll, saving = false, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { ref, style, handlers } = useDragPanel<HTMLDivElement>();
  /** Sólo PINTANDO hay algo que elegir: borrando y destapando no se pinta con nada. Y en la niebla, nunca. */
  const eligeConQue = action === 'paint' && paintsWithStuff(on);
  const acciones = paintActionsFor(on);

  const chip = (activo: boolean): string => `mp-bp-opt ${activo ? 'on' : ''}`;

  return (
    <div className="mp-brushpanel" ref={ref} style={style} role="group" aria-label={t('maps.brush.label')}>
      <div className="mp-builder-head mp-drag" title={t('maps.builder.move')} {...handlers}>
        <span className="material-symbols-outlined mp-builder-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">drag_indicator</span>
        {/* El MISMO icono que la barra de herramientas — petición suya: «*que no sea una gota, que sea un pincel*». */}
        <span className="material-symbols-outlined mp-bp-icon" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">brush</span>
        <span className="mp-builder-title">{t('maps.brush.label')}</span>
        {saving && <span className="tb-italic tb-dim">{t('maps.mask.saving')}</span>}
        <Tooltip label={t('maps.brush.close')} placement="top">
          <button type="button" className="mp-layers-icon" aria-label={t('maps.brush.close')} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
          </button>
        </Tooltip>
      </div>

      {/*
        * ── SOBRE QUÉ PINTO ── Las cuatro cosas sobre las que se puede pintar, en el orden de la lámina.
        *
        * 🔑 Y LO ELEGIDO ES EL LÍMITE: si se te va la mano, lo de al lado no se mancha. No hace falta apuntar
        * fino — el recorte sale de dónde se guarda la pintura, no de una comprobación.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.brush.on')}</legend>
        <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.on')}>
          {PAINT_ON.map(x => (
            <button key={x} type="button" role="radio" aria-checked={on === x}
              className={chip(on === x)} onClick={() => onOn(x)}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{ON_ICON[x]}</span>
              {t(`maps.brush.target.${x}`)}
            </button>
          ))}
        </div>
        <p className="mp-builder-hint">{t('maps.brush.scopeHint')}</p>
      </fieldset>

      {/*
        * ── QUÉ HAGO ── Pintar, borrar la pintura, o destapar lo de debajo. Los que no valen para el destino
        * elegido **no salen** (§ `paintActionsFor`): destapar la roca no significa nada, y en la niebla ya lo
        * hace borrar.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.brush.doLabel')}</legend>
        <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.doLabel')}>
          {acciones.map(a => (
            <button key={a} type="button" role="radio" aria-checked={action === a}
              className={`${chip(action === a)} ${a === 'uncover' ? 'wide' : ''}`} onClick={() => onAction(a)}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{ACTION_ICON[a]}</span>
              {t(`maps.brush.do.${a}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── CON QUÉ PINTO ── Sólo pintando: borrando y destapando no se pinta con nada. */}
      {eligeConQue && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.brush.with')}</legend>
          <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.with')}>
            {PAINT_WITH.map(w => (
              <button key={w} type="button" role="radio" aria-checked={ink === w}
                className={chip(ink === w)} onClick={() => onInk(w)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{WITH_ICON[w]}</span>
                {t(`maps.brush.paint.${w}`)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/*
        * ── LA TEXTURA ── La muestra va A TODO LO ANCHO y con los azulejos al tamaño de verdad: es la única
        * manera de ver si una losa va a salir del tamaño de una sala. Sale del MISMO catálogo que la pared y
        * el suelo del constructor — es de la herramienta y ya está hecho.
        */}
      {eligeConQue && ink === 'texture' && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.brush.textureLabel')}</legend>
          <span className="mp-bp-tex" data-testid="mp-bp-tex" aria-hidden="true"
            style={textureUrl
              ? { backgroundImage: `url(${textureUrl})`, backgroundSize: `${tilePx(textureCells, gridSize)}px ${tilePx(textureCells, gridSize)}px`, backgroundRepeat: 'repeat' }
              : { background: color }} />
          <span className="mp-bp-tex-n">{textureUrl ? textureName ?? t('maps.room.textures.own') : t('maps.brush.textureNone')}</span>
          <div className="mp-builder-row">
            <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={onPickTexture}>
              {t(textureUrl ? 'maps.room.textures.change' : 'maps.room.textures.pick')}
            </button>
            {textureUrl && (
              <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={onClearTexture}>
                {t('maps.room.textures.remove')}
              </button>
            )}
          </div>
          {/*
            * LA ESCALA Y, DEBAJO, EL GIRO (`TlJot` § S/4). Sólo con una foto puesta: sin ella se pinta con el
            * color, y un color ni se escala ni se gira. Mientras se arrastra cualquiera de los dos, el MAPA
            * ENTERO se cubre con la textura así —«*se debería ver en el mapa cubriendo todo el lienzo para ver
            * el tamaño en previo*»—, que es la única forma de saberlo antes de dar el primer brochazo.
            *
            * El rótulo era «Azulejo» y él lo quiso «Escala», expresamente (2026-09-10).
            */}
          {textureUrl && onTextureCells && (
            <Slider label={t('maps.brush.tileLabel')} min={0.25} max={20} step={0.25} value={textureCells}
              onChange={onTextureCells}
              text={textureCells === 1 ? t('maps.mask.sizeCell') : t('maps.mask.sizeCells', { n: String(textureCells) })} />
          )}
          {textureUrl && onTextureDeg && (
            <Slider label={t('maps.brush.turnLabel')} min={0} max={355} step={5} value={textureDeg}
              onChange={onTextureDeg} text={`${textureDeg}°`} />
          )}
        </fieldset>
      )}

      {/* ── EL COLOR ── El mismo bloque que usa el Builder para pintar una habitación: uno solo, y sus colores. */}
      {eligeConQue && ink === 'color' && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.brush.colorLabel')}</legend>
          <PaintColor value={color} onChange={onColor} savedColors={savedColors} onSave={onSaveColor} />
        </fieldset>
      )}

      {/*
        * ── EL BROCHAZO ── **Aquí valen los cuatro** (§ 10A.7), al revés que excavando: esto SÍ es pintura, y
        * una mancha de humedad tiene transparencia y borde. Es el vuelco exacto de la versión anterior, donde
        * la mitad de los mandos no significaban nada porque lo que se hacía era abrir suelo.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.brush.strokeLabel')}</legend>
        <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.tipLabel')}>
          {BRUSH_TIPS.map(tip => (
            <button key={tip} type="button" role="radio" aria-checked={value.tip === tip}
              className={`${chip(value.tip === tip)} ${tip === 'rough' ? 'wide' : ''}`} onClick={() => onChange({ tip })}>
              <span className={`mp-brush-tipdot ${tip}`} aria-hidden="true" />
              {t(`maps.brush.tip.${tip}`)}
            </button>
          ))}
        </div>
        {/* El tamaño va por décimas de casilla: el paso entero se le quedaba corto («gradual, no me sirve eso»). */}
        <Slider label={t('maps.brush.sizeLabel')} min={MASK_SIZE_MIN * 10} max={MASK_SIZE_MAX * 10} step={1}
          value={Math.round(value.size * 10)} onChange={n => onChange({ size: n / 10 })} onCommit={onCommit}
          // En el uno exacto no se dice «1.0 casillas»: ni el decimal ni el plural pintan nada ahí.
          text={value.size === 1 ? t('maps.mask.sizeCell') : t('maps.mask.sizeCells', { n: value.size.toFixed(1) })} />
        {/*
          * 🐞 LA TRANSPARENCIA IBA AL REVÉS pintando (suyo, 2026-09-10: «*transparencia está al revés, un 100 %
          * es que no se ve y aquí es lo más opaco posible*»). Por dentro esto es la OPACIDAD del brochazo, así
          * que pintando y borrando se le da la vuelta al número: 100 % de transparencia = no se ve.
          *
          * ⚠️ DESTAPANDO Y EN LA NIEBLA NO SE INVIERTE, y no es una excepción caprichosa: allí el brochazo no
          * pone pintura, QUITA lo de arriba — y quitar a tope ES dejarlo transparente del todo. El mismo
          * número ya decía la verdad, y darle la vuelta lo rompería.
          */}
        {(() => {
          const invierte = action !== 'uncover' && on !== 'fog';
          const leido = invierte ? 100 - Math.round(value.strength * 100) : Math.round(value.strength * 100);
          return (
            <Slider label={t('maps.brush.alpha')} min={0} max={95} step={5}
              value={leido} onChange={n => onChange({ strength: invierte ? (100 - n) / 100 : n / 100 })} onCommit={onCommit}
              text={invierte ? `${leido} %` : strengthLabel(value.strength)} />
          );
        })()}
        <Slider label={t('maps.brush.edge')} min={0} max={100} step={5}
          value={Math.round(value.hardness * 100)} onChange={n => onChange({ hardness: n / 100 })} onCommit={onCommit}
          text={t(`maps.brush.edgeStep.${hardnessStep(value.hardness)}`)} />
        {/*
          * «Cuánto de roto» sólo existe con el BORDE ROTO, y va aparte de la dureza a propósito: la dureza
          * difumina hacia fuera y siempre en círculo, roto cambia el contorno. Un brochazo puede ser de canto
          * duro y roto a la vez, así que son dos mandos y no uno.
          */}
        {value.tip === 'rough' && (
          <Slider label={t('maps.brush.roughLabel')} min={0} max={100} step={5}
            value={Math.round(value.roughness * 100)} onChange={n => onChange({ roughness: n / 100 })} onCommit={onCommit}
            text={t(`maps.brush.roughness.${roughnessStep(value.roughness)}`)} />
        )}
      </fieldset>

      {/* Quitar del todo lo que el pincel haya puesto aquí. Lo de debajo no se toca: nunca se tocó. */}
      {(onRevealAll || onHideAll || onReset) && (
        <div className="mp-builder-row">
          {onRevealAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onRevealAll}>{t('maps.brush.revealAll')}</button>}
          {onHideAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onHideAll}>{t('maps.brush.hideAll')}</button>}
          {onReset && <button type="button" className="tb-btn tb-btn-xs" onClick={onReset}>{t('maps.mask.reset')}</button>}
        </div>
      )}

      {/* La línea del pie, que dice lo único que hay que saber antes de arrastrar. */}
      <p className="mp-builder-hint">{t(on === 'fog' ? 'maps.brush.hintFog' : 'maps.brush.footPaint')}</p>
    </div>
  );
}
