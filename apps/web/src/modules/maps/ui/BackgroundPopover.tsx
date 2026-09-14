import { useTranslation } from '@rolvium/i18n';
import { Slider, Tooltip } from '@rolvium/ui';
import type { BgFit, BgTransform, Layer, MapColor, Scene } from '../domain/entities/Scene';
import { PaintColor } from './PaintColor';

const FITS: BgFit[] = ['cover', 'contain', 'custom'];

interface Props {
  scene: Scene;
  /**
   * Rebanada 7: si hay una CAPA DE TERRENO activa, la foto y el encaje que se tocan son los suyos, no los de
   * la escena — y el color de base desaparece, porque es de la escena y una capa no tiene. Sin esto, «+ Capa
   * de terreno» dejaba una capa vacía sin manera de darle foto.
   */
  layer?: Layer | null;
  /** Cómo se llama lo que hay puesto de fondo. `null` = ninguno. */
  currentName: string | null;
  /** Los colores que él ha guardado en ESTA campaña, para el bloque de color. `null` mientras llegan. */
  savedColors: readonly MapColor[] | null;
  onSaveColor: (hex: string) => void;
  onColor: (hex: string) => void;
  /** Abre el catálogo de fondos, aparte y encima del mapa — como el catálogo de texturas del Constructor. */
  onOpenCatalog: () => void;
  /** Quitar la foto y quedarse con el color de base. Es la vieja opción «Ninguna». */
  onRemoveImage: () => void;
  onTransform: (tr: BgTransform) => void;
  onClose: () => void;
}

/**
 * EL FONDO DEL MAPA (`rolvium.pen` · `PL/Fondo del mapa · panel`, aprobado el 2026-09-14). Spec de maps,
 * § «EL FONDO DEL MAPA».
 *
 * Tres bloques: el COLOR DE BASE, LA IMAGEN y el AJUSTE. Y dos cosas que él pidió con la pantalla delante
 * (2026-09-14):
 *
 * - **El color es EL MISMO bloque que el Pincel y el Constructor** (`PaintColor`): «*el color picker tiene que
 *   ajustarse como hicimos en otros menús*». Antes había aquí un `ColorPicker` con su hex apagado MÁS una fila
 *   de hex hecha a mano al lado — dos mandos para una cosa, y ninguno guardaba colores. Ahora se guardan por
 *   campaña, como en el Pincel.
 * - **La foto no se elige aquí**: la muestra y CAMBIAR abren el catálogo a pantalla completa, igual que las
 *   texturas del Constructor («*la foto es el botón*», § 6.8 punto 8). Antes había una rejilla plana sin
 *   categorías y una subida de un fichero cada vez.
 *
 * QUITAR es la vieja opción «Ninguna»: deja el mapa con el color de base, que es justo lo que se ve donde no
 * llega ninguna foto.
 */
export function BackgroundPopover({
  scene, layer = null, currentName, savedColors, onSaveColor, onColor, onOpenCatalog, onRemoveImage, onTransform, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  // Sobre qué se está trabajando: la capa de terreno activa, o la escena de siempre.
  const imageUrl = layer ? layer.imageUrl : scene.bgImageUrl;
  const tr = layer ? layer.transform : scene.bgTransform;
  const title = layer ? t('maps.bg.layerTitle', { name: layer.name || t('maps.layers.kind.terrain') }) : t('maps.bg.title');
  return (
    <div className="mp-pop mp-bgpop" role="dialog" aria-label={title}>
      <div className="mp-pop-head">
        <span className="mp-pop-title">{title}</span>
        <Tooltip label={t('maps.bg.close')} placement="left">
          <button type="button" className="mp-pop-x" aria-label={t('maps.bg.close')} onClick={onClose}><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span></button>
        </Tooltip>
      </div>
      <div className="mp-pop-body">
        {/* El color de base es de la ESCENA: se ve donde no llega ninguna foto, así que no aparece al tocar una capa. */}
        {!layer && (
          <>
            <span className="tb-rotulo">{t('maps.bg.baseColor')}</span>
            <PaintColor value={scene.bgColor} onChange={onColor} savedColors={savedColors} onSave={onSaveColor} />
          </>
        )}
        {/*
          * LA FILA DE LA IMAGEN: la misma que las de textura del Constructor (`mp-builder-tex`), que es la
          * forma que él ya aprobó para «muestra + nombre + CAMBIAR». Se reutiliza su CSS a propósito: es el
          * mismo objeto visual, y tenerlo dos veces sería que un día dijeran cosas distintas.
          */}
        <span className="tb-rotulo">{t('maps.bg.image')}</span>
        <div className="mp-builder-tex">
          <button type="button" className="mp-builder-tex-swatch" data-testid="mp-bg-swatch"
            aria-label={t('maps.bg.openCatalog')} onClick={onOpenCatalog}
            style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'var(--sf2)' }} />
          <span className="mp-builder-tex-n">{currentName ?? t('maps.bg.none')}</span>
          <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={onOpenCatalog}>{t('maps.bg.change')}</button>
          {imageUrl && (
            <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={onRemoveImage}>{t('maps.bg.remove')}</button>
          )}
        </div>
        <div className="mp-pop-row">
          <span className="tb-rotulo">{t('maps.bg.fit')}</span>
          {FITS.map(m => <button key={m} type="button" className={`tb-btn tb-btn-xs ${tr.mode === m ? 'tb-btn-solid' : ''}`} aria-pressed={tr.mode === m} onClick={() => onTransform({ ...tr, mode: m })}>{t(`maps.bg.${m}`)}</button>)}
        </div>
        {tr.mode === 'custom' && (
          <div className="mp-pop-row mp-custom">
            <Slider className="mp-bg-scale" label={t('maps.bg.scale')} min={0.25} max={3} step={0.05} value={tr.scale} onChange={v => onTransform({ ...tr, scale: v })} />
            <label>{t('maps.bg.offsetX')}<input type="number" value={tr.x} onChange={e => onTransform({ ...tr, x: Number(e.target.value) })} /></label>
            <label>{t('maps.bg.offsetY')}<input type="number" value={tr.y} onChange={e => onTransform({ ...tr, y: Number(e.target.value) })} /></label>
          </div>
        )}
      </div>
    </div>
  );
}
