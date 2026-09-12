import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { PanelHint, Tooltip } from '@rolvium/ui';
import type { MapColor } from '../domain/entities/Scene';
import { BRUSH_COLORS, brushColorName, isHexColor } from '../domain/useCases/roomRules';

interface Props {
  /** El color puesto. Se pinta grande arriba, que es la corrección suya del 2026-09-10. */
  value: string;
  onChange: (hex: string) => void;
  /** Los que él se ha inventado en ESTA campaña. `null` mientras se están pidiendo. */
  savedColors: readonly MapColor[] | null;
  onSave: (hex: string) => void;
}

/**
 * EL BLOQUE DEL COLOR (`rolvium.pen` · `M9zw2t` y `TlJot` § S/4), aprobado por él el 2026-09-10 con su
 * corrección: «*aquí el color se tiene que guardar, no veo un cuadradito donde quede puesto*» → el cuadro
 * grande del color puesto va arriba del todo.
 *
 * 🔑 **Está aparte porque lo usan LOS DOS paneles.** El Pincel pinta con un color encima de lo que ya está;
 * el Builder levanta una habitación pintada con un color (§ «Rebanada 10 · B»: «*el muro con textura, la
 * habitación con color*»). Es el mismo bloque y la misma paleta guardada por campaña — tenerlo dos veces
 * sería tener dos sitios donde se guardan los colores de él, y un día dirían cosas distintas.
 *
 * Sigue siendo **de este módulo** y no de `@rolvium/ui`: la paleta base son colores del MAPA (dato, no tema)
 * y los guardados son filas de `maps_colors`. Nada de eso tiene sentido fuera de aquí.
 */
export function PaintColor({ value, onChange, savedColors, onSave }: Props): JSX.Element {
  const { t } = useTranslation();
  /** Lo tecleado en el campo del hex mientras no sea un color todavía. `null` = manda el color puesto. */
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const nombre = brushColorName(value);
  const guardado = (savedColors ?? []).some(c => c.color.toLowerCase() === value.toLowerCase());
  /** Un color de la casa no se guarda: ya está en la paleta, y guardarlo lo pondría dos veces en pantalla. */
  const sePuedeGuardar = !nombre && !guardado;

  const swatch = (hex: string, etiqueta: string): JSX.Element => (
    <button key={hex} type="button" role="radio" aria-checked={value.toLowerCase() === hex.toLowerCase()}
      aria-label={etiqueta} className={`mp-bp-swatch ${value.toLowerCase() === hex.toLowerCase() ? 'on' : ''}`}
      style={{ background: hex }} onClick={() => { onChange(hex); setHexDraft(null); }} />
  );

  return (<>
    <div className="mp-bp-color-now">
      <span className="mp-bp-color-big" data-testid="mp-bp-color-big" style={{ background: value }} aria-hidden="true" />
      <span className="mp-bp-color-txt">
        <span className="mp-bp-color-n">{nombre ? t(`maps.brush.color.${nombre}`) : t('maps.brush.colorOwn')}</span>
        <span className="mp-bp-color-hex">{value}</span>
        <PanelHint as="span">{t('maps.brush.colorStays')}</PanelHint>
      </span>
    </div>
    <div className="mp-bp-swatches" role="radiogroup" aria-label={t('maps.brush.colorLabel')}>
      {BRUSH_COLORS.map(c => swatch(c.hex, t(`maps.brush.color.${c.name}`)))}
    </div>

    {/*
      * ── TUS COLORES ── Lo que salga del cuentagotas o del campo se queda aquí, POR CAMPAÑA: una campaña es
      * un mundo con un aspecto, y el verde que mezclas para el bosque lo quieres en los demás mapas de ese
      * bosque. Mismo alcance que la biblioteca de fondos, y por lo mismo.
      */}
    <span className="tb-rotulo">{t('maps.brush.mine')}</span>
    <div className="mp-bp-swatches" role="radiogroup" aria-label={t('maps.brush.mine')}>
      {savedColors === null && <span className="tb-dim tb-italic">{t('common.loading')}</span>}
      {savedColors?.map(c => swatch(c.color, t('maps.brush.colorOwnNamed', { hex: c.color })))}
      <Tooltip label={t('maps.brush.save')} placement="top">
        <button type="button" className="mp-bp-swatch add" aria-label={t('maps.brush.save')}
          disabled={!sePuedeGuardar} onClick={() => onSave(value)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">add</span>
        </button>
      </Tooltip>
    </div>

    <div className="mp-bp-hexrow">
      <input className="mp-hex" value={hexDraft ?? value} maxLength={7} spellCheck={false}
        aria-label={t('maps.brush.hex')}
        onChange={e => { setHexDraft(e.target.value); if (isHexColor(e.target.value)) { onChange(e.target.value); setHexDraft(null); } }} />
      {/*
        * EL CUENTAGOTAS es el selector del navegador (`input type="color"`), que es el que él pidió —«*ahí
        * tiene que haber una paleta base y un color picker*»— y el único que funciona en todos. Envuelto en
        * un `label` con el `input` escondido: así el botón se puede pintar como el diseño.
        */}
      <label className="mp-bp-eyedrop" title={t('maps.brush.picker')}>
        <input type="color" value={isHexColor(value) ? value : '#000000'} aria-label={t('maps.brush.picker')}
          onChange={e => { onChange(e.target.value); setHexDraft(null); }} />
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">colorize</span>
      </label>
    </div>
  </>);
}
