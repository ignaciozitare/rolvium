import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ColorPicker, Tooltip } from '@rolvium/ui';
import type { BgFit, BgTransform, ImageAsset, Layer, Scene } from '../domain/entities/Scene';
import { BG_COLORS } from '../domain/useCases/mapRules';

const HEX_RX = /^#[0-9a-fA-F]{6}$/;
const FITS: BgFit[] = ['cover', 'contain', 'custom'];

interface Props {
  scene: Scene;
  /**
   * Rebanada 7: si hay una CAPA DE TERRENO activa, la foto y el encaje que se tocan son los suyos, no los de
   * la escena — y el color de base desaparece, porque es de la escena y una capa no tiene. Sin esto, «+ Capa
   * de terreno» dejaba una capa vacía sin manera de darle foto.
   */
  layer?: Layer | null;
  images: ImageAsset[] | null;
  onColor: (hex: string) => void;
  onImage: (url: string | null) => void;
  onTransform: (tr: BgTransform) => void;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}

/** DM «Fondo del mapa»: base colour (swatches + hex) · campaign image library (upload / choose / none) · fit Cubrir/Encajar/Reposicionar. */
export function BackgroundPopover({ scene, layer = null, images, onColor, onImage, onTransform, onUpload, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const [hex, setHex] = useState(scene.bgColor);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setHex(scene.bgColor); }, [scene.bgColor]);
  // Sobre qué se está trabajando: la capa de terreno activa, o la escena de siempre.
  const imageUrl = layer ? layer.imageUrl : scene.bgImageUrl;
  const tr = layer ? layer.transform : scene.bgTransform;
  const title = layer ? t('maps.bg.layerTitle', { name: layer.name || t('maps.layers.kind.terrain') }) : t('maps.bg.title');
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setError(null);
    try { await onUpload(f); } catch { setError(t('maps.bg.uploadError')); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
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
            <ColorPicker value={scene.bgColor} onChange={c => { setHex(c); onColor(c); }} palette={BG_COLORS} allowCustom={false} />
            <div className="mp-hexrow">
              <span className="mp-hex-swatch" style={{ background: HEX_RX.test(hex) ? hex : scene.bgColor }} aria-hidden />
              <input className="mp-hex" value={hex} maxLength={7} spellCheck={false} aria-label={t('maps.bg.hex')} onChange={e => { setHex(e.target.value); if (HEX_RX.test(e.target.value)) onColor(e.target.value); }} />
              <span className="tb-italic tb-dim mp-hint">{t('maps.bg.hexHint')}</span>
            </div>
          </>
        )}
        <div className="mp-pop-row">
          <span className="tb-rotulo">{t('maps.bg.library')}</span>
          <span className="mp-spacer" />
          <button type="button" className="tb-btn tb-btn-xs" disabled={busy} onClick={() => fileRef.current?.click()}>{t('maps.bg.upload')}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden data-testid="mp-bg-file" onChange={e => void upload(e.target.files?.[0])} />
        </div>
        {error && <p className="mp-error">{error}</p>}
        <div className="mp-lib">
          {images === null && <span className="tb-dim tb-italic">{t('common.loading')}</span>}
          {images?.length === 0 && <span className="tb-dim tb-italic">{t('maps.bg.empty')}</span>}
          {images?.map(img => (
            <button key={img.id} type="button" className={`mp-lib-item ${imageUrl === img.url ? 'on' : ''}`} aria-pressed={imageUrl === img.url} aria-label={img.name} onClick={() => onImage(img.url)}>
              <span className="mp-lib-thumb" style={{ backgroundImage: `url(${img.url})` }} /><span className="mp-lib-name">{img.name}</span>
            </button>
          ))}
          <button type="button" className={`mp-lib-item ${imageUrl === null ? 'on' : ''}`} aria-pressed={imageUrl === null} aria-label={t('maps.bg.none')} onClick={() => onImage(null)}>
            <span className="mp-lib-thumb none"><span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-md)' }}>hide_image</span></span><span className="mp-lib-name">{t('maps.bg.none')}</span>
          </button>
        </div>
        <div className="mp-pop-row">
          <span className="tb-rotulo">{t('maps.bg.fit')}</span>
          {FITS.map(m => <button key={m} type="button" className={`tb-btn tb-btn-xs ${tr.mode === m ? 'tb-btn-solid' : ''}`} aria-pressed={tr.mode === m} onClick={() => onTransform({ ...tr, mode: m })}>{t(`maps.bg.${m}`)}</button>)}
        </div>
        {tr.mode === 'custom' && (
          <div className="mp-pop-row mp-custom">
            <label>{t('maps.bg.scale')}<input type="range" min={0.25} max={3} step={0.05} value={tr.scale} onChange={e => onTransform({ ...tr, scale: Number(e.target.value) })} /></label>
            <label>{t('maps.bg.offsetX')}<input type="number" value={tr.x} onChange={e => onTransform({ ...tr, x: Number(e.target.value) })} /></label>
            <label>{t('maps.bg.offsetY')}<input type="number" value={tr.y} onChange={e => onTransform({ ...tr, y: Number(e.target.value) })} /></label>
          </div>
        )}
      </div>
    </div>
  );
}
