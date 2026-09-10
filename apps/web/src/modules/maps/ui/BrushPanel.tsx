import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { BRUSH_TIPS, type BrushTip, type MapColor } from '../domain/entities/Scene';
import {
  hardnessStep, MASK_DIRECTIONS, MASK_SIZE_MAX, MASK_SIZE_MIN, roughnessStep, strengthLabel,
  type MaskDirection,
} from '../domain/useCases/layerRules';
import {
  BRUSH_COLORS, BRUSH_ON, BRUSH_PAINTS, brushColorName, isBuildOn, isHexColor,
  type BrushOn, type BrushPaint,
} from '../domain/useCases/roomRules';
import { tilePx } from '../domain/useCases/roomStyles';
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

/** El icono de cada destino, del diseño aprobado (`YwHzR` § S/1). */
const ON_ICON: Record<BrushOn, string> = {
  floor: 'dashboard', wall: 'fence', layer: 'layers', fog: 'cloud', room: 'grass',
};
/** …y el de cada manera de pintar (`YwHzR` § S/2). */
const PAINT_ICON: Record<BrushPaint, string> = {
  texture: 'texture', color: 'palette', erase: 'ink_eraser',
};

/**
 * LAS PUNTAS QUE VALEN CONSTRUYENDO (§ 10.4). El difuminado NO: el borde de un muro no se desvanece, igual
 * que la transparencia no vale porque un suelo se anda o no se anda.
 *
 * Y no se enseñan APAGADAS: no salen. Un mando que no hace nada es peor que no tenerlo.
 */
const BUILD_TIPS: BrushTip[] = ['disc', 'rough'];

interface Props {
  on: BrushOn;
  onOn: (x: BrushOn) => void;

  // ── construyendo (suelo o muro) ────────────────────────────────────────────
  paint: BrushPaint;
  onPaint: (p: BrushPaint) => void;
  /** La textura con la que se va a pintar el próximo brochazo, y cómo se llama. */
  textureUrl: string | null;
  textureName: string | null;
  /** Cuántas casillas mide un azulejo de esa textura: la muestra grande enseña el tamaño de verdad. */
  textureCells: number;
  gridSize: number;
  onPickTexture: () => void;
  onClearTexture: () => void;
  color: string;
  onColor: (hex: string) => void;
  /** Los que él se ha inventado en ESTA campaña. `null` mientras se están pidiendo. */
  savedColors: readonly MapColor[] | null;
  onSaveColor: (hex: string) => void;

  // ── pintando encima de algo que ya está (rebanada 9, intacto) ──────────────
  direction: MaskDirection;
  onDirection: (d: MaskDirection) => void;

  value: BrushSettings;
  /** Un solo camino de vuelta: el panel escribe el pincel de la ESCENA, y la escena es quien lo recuerda. */
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
  onClose: () => void;
}

/** Un deslizador APILADO: rótulo y lectura arriba, la barra debajo a todo lo ancho (`YwHzR` § C/TAMAÑO). */
function Slider({ label, min, max, step, value, text, onChange, onCommit }: {
  label: string; min: number; max: number; step: number; value: number; text: string;
  onChange: (v: number) => void; onCommit: () => void;
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
 * EL PANEL DEL PINCEL (rebanada 10 · `rolvium.pen`, marcos `YwHzR` «con textura» y `M9zw2t` «con color»,
 * aprobados por él el 2026-09-10 después de dos correcciones suyas: «*demasiado ancho*» → 220 px, y «*aquí el
 * color se tiene que guardar, no veo un cuadradito donde quede puesto*» → el cuadro grande del color puesto).
 *
 * 🔑 **Sustituye a la barra flotante de la rebanada 9**, que él paró en pantalla el 2026-09-09: «*esto está
 * mal, ajusta el diseño como un modal que se mueva como todos los otros*». Por eso es de la familia de
 * `BuilderPanel` y `LightEditor` — flota, se agarra por la cabecera, se aparta y la X lo cierra — y no una
 * franja a lo ancho, que además cuesta altura de mapa.
 *
 * Lleva LOS DOS pinceles, porque para él es uno solo:
 *  · **SUELO y MURO levantan mapa** — el brochazo se guarda como una forma más de `maps_rooms`, así que
 *    fundirse, cortar la vista y frenar a las fichas salen gratis (§ 10.2);
 *  · **CAPA, NIEBLA y SUELO DE SALA pintan encima** de algo que ya está, que es lo de la rebanada 9 intacto.
 *
 * ⚠️ Lo que se toca en «EL BROCHAZO» NO es estado de la pantalla: se guarda **en la escena** (decisión suya,
 * contra la recomendación contraria: «*el trazo es de la escena*»). La textura y el color del pincel sí son
 * de la sesión: quedan pegados al brochazo que se pinte, no al mapa.
 */
export function BrushPanel({
  on, onOn, paint, onPaint,
  textureUrl, textureName, textureCells, gridSize, onPickTexture, onClearTexture,
  color, onColor, savedColors, onSaveColor,
  direction, onDirection, value, onChange, onCommit,
  onReset, onRevealAll, onHideAll, saving = false, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { ref, style, handlers } = useDragPanel<HTMLDivElement>();
  /** Lo tecleado en el campo del hex mientras no sea un color todavía. `null` = manda el color puesto. */
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const construye = isBuildOn(on);
  /** Borrando no se pinta con nada: ni textura, ni color, ni forma de brochazo. Sólo se derriba. */
  const borra = construye && paint === 'erase';
  const nombre = brushColorName(color);
  const guardado = (savedColors ?? []).some(c => c.color.toLowerCase() === color.toLowerCase());
  /** Un color de la casa no se guarda: ya está en la paleta, y guardarlo lo pondría dos veces en pantalla. */
  const sePuedeGuardar = !nombre && !guardado;

  const chip = (activo: boolean): string => `mp-bp-opt ${activo ? 'on' : ''}`;
  const swatch = (hex: string, etiqueta: string): JSX.Element => (
    <button key={hex} type="button" role="radio" aria-checked={color.toLowerCase() === hex.toLowerCase()}
      aria-label={etiqueta} className={`mp-bp-swatch ${color.toLowerCase() === hex.toLowerCase() ? 'on' : ''}`}
      style={{ background: hex }} onClick={() => { onColor(hex); setHexDraft(null); }} />
  );

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
        * ── SOBRE QUÉ ── Las cinco en un solo interruptor, porque para él es una sola pregunta: dónde estoy
        * pintando. Las dos primeras LEVANTAN MAPA; las tres siguientes pintan encima de algo que ya está.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.brush.on')}</legend>
        <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.on')}>
          {BRUSH_ON.map(x => (
            <button key={x} type="button" role="radio" aria-checked={on === x}
              className={`${chip(on === x)} ${x === 'room' ? 'wide' : ''}`} onClick={() => onOn(x)}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{ON_ICON[x]}</span>
              {t(`maps.brush.target.${x}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {/*
        * ── CON QUÉ PINTO ── sólo construyendo. Pintando encima, lo que hay que elegir es el SENTIDO —quitar
        * o devolver— que es lo de siempre y vale igual para una capa, para la niebla y para el suelo de una
        * sala.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t(construye ? 'maps.brush.with' : 'maps.brush.way')}</legend>
        {construye ? (
          <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.with')}>
            {BRUSH_PAINTS.map(x => (
              <button key={x} type="button" role="radio" aria-checked={paint === x}
                className={`${chip(paint === x)} ${x === 'erase' ? 'wide' : ''}`} onClick={() => onPaint(x)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{PAINT_ICON[x]}</span>
                {t(`maps.brush.paint.${x}`)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.way')}>
            {MASK_DIRECTIONS.map(d => (
              <button key={d} type="button" role="radio" aria-checked={direction === d}
                className={chip(direction === d)} onClick={() => onDirection(d)}>
                {t(`maps.brush.dir.${d}`)}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {/*
        * ── LA TEXTURA ── La muestra va A TODO LO ANCHO y con los azulejos al tamaño de verdad: es la única
        * manera de ver si una losa va a salir del tamaño de una sala. Sale del MISMO catálogo que la pared y
        * el suelo del constructor — es de la herramienta y ya está hecho.
        */}
      {construye && paint === 'texture' && (
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
        </fieldset>
      )}

      {/*
        * ── EL COLOR ── Con el CUADRO GRANDE del que está puesto arriba del todo, que es la corrección suya
        * del 2026-09-10: la paleta enseñaba las opciones pero nada decía cuál era la tuya.
        */}
      {construye && paint === 'color' && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.brush.colorLabel')}</legend>
          <div className="mp-bp-color-now">
            <span className="mp-bp-color-big" data-testid="mp-bp-color-big" style={{ background: color }} aria-hidden="true" />
            <span className="mp-bp-color-txt">
              <span className="mp-bp-color-n">{nombre ? t(`maps.brush.color.${nombre}`) : t('maps.brush.colorOwn')}</span>
              <span className="mp-bp-color-hex">{color}</span>
              <span className="mp-builder-hint">{t('maps.brush.colorStays')}</span>
            </span>
          </div>
          <div className="mp-bp-swatches" role="radiogroup" aria-label={t('maps.brush.colorLabel')}>
            {BRUSH_COLORS.map(c => swatch(c.hex, t(`maps.brush.color.${c.name}`)))}
          </div>

          {/*
            * ── TUS COLORES ── Lo que salga del cuentagotas o del campo se queda aquí, POR CAMPAÑA: una
            * campaña es un mundo con un aspecto, y el verde que mezclas para el bosque lo quieres en los
            * demás mapas de ese bosque. Mismo alcance que la biblioteca de fondos, y por lo mismo.
            */}
          <span className="tb-rotulo">{t('maps.brush.mine')}</span>
          <div className="mp-bp-swatches" role="radiogroup" aria-label={t('maps.brush.mine')}>
            {savedColors === null && <span className="tb-dim tb-italic">{t('common.loading')}</span>}
            {savedColors?.map(c => swatch(c.color, t('maps.brush.colorOwnNamed', { hex: c.color })))}
            <Tooltip label={t('maps.brush.save')} placement="top">
              <button type="button" className="mp-bp-swatch add" aria-label={t('maps.brush.save')}
                disabled={!sePuedeGuardar} onClick={() => onSaveColor(color)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">add</span>
              </button>
            </Tooltip>
          </div>

          <div className="mp-bp-hexrow">
            <input className="mp-hex" value={hexDraft ?? color} maxLength={7} spellCheck={false}
              aria-label={t('maps.brush.hex')}
              onChange={e => { setHexDraft(e.target.value); if (isHexColor(e.target.value)) { onColor(e.target.value); setHexDraft(null); } }} />
            {/*
              * EL CUENTAGOTAS es el selector del navegador (`input type="color"`), que es el que él pidió —
              * «*ahí tiene que haber una paleta base y un color picker*»— y el único que funciona en todos.
              * Envuelto en un `label` con el `input` escondido: así el botón se puede pintar como el diseño.
              */}
            <label className="mp-bp-eyedrop" title={t('maps.brush.picker')}>
              <input type="color" value={isHexColor(color) ? color : '#000000'} aria-label={t('maps.brush.picker')}
                onChange={e => { onColor(e.target.value); setHexDraft(null); }} />
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">colorize</span>
            </label>
          </div>
        </fieldset>
      )}

      {/*
        * ── EL BROCHAZO ── Construyendo salen SÓLO los mandos que significan algo (§ 10.4): el tamaño, que es
        * el ancho de la banda, y el borde roto, que es justo lo que quiere una cueva. La transparencia y el
        * difuminado no valen —un suelo se anda o no se anda— y no se enseñan apagados: no salen.
        *
        * Borrando no sale ninguno: el borrador se lleva el brochazo ENTERO por el que pases, así que ni el
        * tamaño ni la forma cambian nada.
        */}
      {!borra && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.brush.strokeLabel')}</legend>
          <div className="mp-bp-grid" role="radiogroup" aria-label={t('maps.brush.tipLabel')}>
            {(construye ? BUILD_TIPS : BRUSH_TIPS).map(tip => (
              <button key={tip} type="button" role="radio" aria-checked={value.tip === tip}
                className={chip(value.tip === tip)} onClick={() => onChange({ tip })}>
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
          {!construye && (<>
            <Slider label={t('maps.brush.alpha')} min={5} max={100} step={5}
              value={Math.round(value.strength * 100)} onChange={n => onChange({ strength: n / 100 })} onCommit={onCommit}
              text={strengthLabel(value.strength)} />
            <Slider label={t('maps.brush.edge')} min={0} max={100} step={5}
              value={Math.round(value.hardness * 100)} onChange={n => onChange({ hardness: n / 100 })} onCommit={onCommit}
              text={t(`maps.brush.edgeStep.${hardnessStep(value.hardness)}`)} />
          </>)}
          {/*
            * «Cuánto de roto» sólo existe con el BORDE ROTO, y va aparte de la dureza a propósito: la dureza
            * difumina hacia fuera y siempre en círculo, roto cambia el contorno. Un brochazo puede ser de
            * canto duro y roto a la vez, así que son dos mandos y no uno.
            */}
          {value.tip === 'rough' && (
            <Slider label={t('maps.brush.roughLabel')} min={0} max={100} step={5}
              value={Math.round(value.roughness * 100)} onChange={n => onChange({ roughness: n / 100 })} onCommit={onCommit}
              text={t(`maps.brush.roughness.${roughnessStep(value.roughness)}`)} />
          )}
        </fieldset>
      )}

      {/* Quitar del todo lo pintado. Sólo pintando encima: un brochazo se derriba con el borrador. */}
      {(onRevealAll || onHideAll || onReset) && (
        <div className="mp-builder-row">
          {onRevealAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onRevealAll}>{t('maps.brush.revealAll')}</button>}
          {onHideAll && <button type="button" className="tb-btn tb-btn-xs" onClick={onHideAll}>{t('maps.brush.hideAll')}</button>}
          {onReset && <button type="button" className="tb-btn tb-btn-xs" onClick={onReset}>{t('maps.mask.reset')}</button>}
        </div>
      )}

      {/* La línea del pie, que dice lo único que hay que saber antes de arrastrar. */}
      <p className="mp-builder-hint">{t(borra ? 'maps.brush.footErase' : construye ? 'maps.brush.footBuild' : on === 'room' ? 'maps.brush.hintRoom' : on === 'fog' ? 'maps.brush.hintFog' : 'maps.brush.hintScene')}</p>
    </div>
  );
}
