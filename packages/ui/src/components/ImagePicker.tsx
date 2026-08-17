import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImagePickerShape = 'circle' | 'square';
export type ImagePickerOutput = 'png' | 'jpeg' | 'webp';

export interface ImagePickerLabels {
  /** Header label above the drop zone (e.g. "AVATAR", "LOGO"). */
  label?:        string;
  /** Help text under the drop area. */
  helpText?:    string;
  /** Drop-zone primary call to action. */
  dropCta?:     string;
  /** Crop-stage title. */
  cropTitle?:   string;
  /** Zoom slider label. */
  zoom?:        string;
  /** Save button. */
  save?:        string;
  /** Back / cancel button (returns to drop view). */
  back?:        string;
  /** Remove button (only shown when currentUrl is set). */
  remove?:      string;
  /** Loading text shown while onUpload resolves. */
  loading?:     string;
  /** Error: unsupported mime. */
  errorMime?:   string;
  /** Error: too large. Receives `${kb}` interpolation. */
  errorSize?:   string;
  /** Error: read failed. */
  errorRead?:   string;
  /** Error: upload failed. */
  errorUpload?: string;
}

export interface ImagePickerProps {
  /** Existing image to show as preview. */
  currentUrl?:      string | null;
  /** Caller handles the actual upload (Supabase Storage call, etc.). */
  onUpload:         (file: Blob) => Promise<void>;
  /** Optional: caller handles removal of the current image. */
  onRemove?:        () => Promise<void>;
  /** Preview clip shape. Default 'square'. */
  shape?:           ImagePickerShape;
  /** Max accepted file size in KB. Default 500. */
  maxSizeKB?:       number;
  /** Accepted MIME types. */
  acceptMime?:      string[];
  /** Canvas output format. Default 'png'. */
  outputFormat?:    ImagePickerOutput;
  /** Square crop dimension (px). Default 512. */
  outputDimension?: number;
  /** Header label (e.g. "LOGO" or "AVATAR"). */
  label?:           string;
  /** Help text under the drop area. */
  helpText?:        string;
  /** Optional override for all visible labels (for i18n). */
  labels?:          ImagePickerLabels;
  /** Optional outer style. */
  style?:           CSSProperties;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const DEFAULT_LABELS: Required<ImagePickerLabels> = {
  label:       '',
  helpText:    'PNG/JPG/SVG · max 500KB · recorte cuadrado',
  dropCta:     'Drop an image or click to upload',
  cropTitle:   'Adjust crop',
  zoom:        'Zoom',
  save:        'Save',
  back:        'Back',
  remove:      'Remove',
  loading:     'Saving…',
  errorMime:   'Unsupported file type.',
  errorSize:   'File too large. Max ${kb}KB.',
  errorRead:   'Could not read the file.',
  errorUpload: 'Upload failed. Try again.',
};

// ─── Component ────────────────────────────────────────────────────────────────

type Mode = 'home' | 'crop';

/**
 * ImagePicker — generic image upload + crop component.
 *
 * Presentational only: accepts an `onUpload(blob)` callback so the caller owns
 * persistence (Supabase Storage, S3, etc.). Supports drag-and-drop, file picker,
 * inline validation, square-canvas crop with zoom + pan, and an optional remove
 * action.
 *
 * Pure UI: no app context, no i18n. Pass localized strings via `labels`.
 */
export function ImagePicker({
  currentUrl,
  onUpload,
  onRemove,
  shape           = 'square',
  maxSizeKB       = 500,
  acceptMime      = DEFAULT_MIME,
  outputFormat    = 'png',
  outputDimension = 512,
  label,
  helpText,
  labels,
  style,
}: ImagePickerProps) {
  const L: Required<ImagePickerLabels> = { ...DEFAULT_LABELS, ...(labels ?? {}) };
  if (label    !== undefined) L.label    = label;
  if (helpText !== undefined) L.helpText = helpText;

  const maxBytes = maxSizeKB * 1024;

  const [mode, setMode]   = useState<Mode>('home');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [drag, setDrag]   = useState(false);

  // Crop state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isSvg, setIsSvg]               = useState(false);
  const imageElRef                       = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom]                 = useState(1);
  const [offset, setOffset]             = useState({ x: 0, y: 0 });
  const dragStart                        = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef                     = useRef<HTMLInputElement | null>(null);

  // Reset state when component re-mounts via key change isn't needed —
  // we just keep the home/crop transitions local.

  useEffect(() => {
    return () => {
      if (imageDataUrl) {
        // best-effort cleanup; FileReader data URLs don't need revoke, but
        // we drop the ref so the GC can reclaim it.
      }
    };
  }, [imageDataUrl]);

  const handleFile = (file: File) => {
    setError(null);
    if (!acceptMime.includes(file.type)) {
      setError(L.errorMime);
      return;
    }
    if (file.size > maxBytes) {
      setError(L.errorSize.replace('${kb}', String(maxSizeKB)));
      return;
    }
    const svg = file.type === 'image/svg+xml';
    setIsSvg(svg);

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      if (svg) {
        // SVGs can't be canvas-cropped reliably (taint/origin issues + vector).
        // Upload as-is, skipping crop UI.
        void uploadBlob(file);
      } else {
        setMode('crop');
      }
    };
    reader.onerror = () => setError(L.errorRead);
    reader.readAsDataURL(file);
  };

  const uploadBlob = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    try {
      await onUpload(blob);
      setMode('home');
      setImageDataUrl(null);
    } catch (err: any) {
      setError(err?.message || L.errorUpload);
    } finally {
      setBusy(false);
    }
  };

  const cropAndUpload = async () => {
    const img = imageElRef.current;
    if (!img) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = outputDimension;
      canvas.height = outputDimension;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');

      // For 'png' / 'webp' we want transparent background; for 'jpeg' fill white.
      if (outputFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputDimension, outputDimension);
      }

      // Draw the source image with current zoom + pan, centered.
      const baseSize = Math.min(img.naturalWidth, img.naturalHeight) * zoom;
      const sx = Math.max(0, (img.naturalWidth  - baseSize) / 2 - offset.x);
      const sy = Math.max(0, (img.naturalHeight - baseSize) / 2 - offset.y);
      const sw = Math.min(baseSize, img.naturalWidth  - sx);
      const sh = Math.min(baseSize, img.naturalHeight - sy);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputDimension, outputDimension);

      const mime =
        outputFormat === 'jpeg' ? 'image/jpeg' :
        outputFormat === 'webp' ? 'image/webp' :
                                  'image/png';
      const quality = outputFormat === 'jpeg' ? 0.92 : undefined;

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob')), mime, quality)
      );

      await onUpload(blob);
      setMode('home');
      setImageDataUrl(null);
    } catch (err: any) {
      setError(err?.message || L.errorUpload);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (err: any) {
      setError(err?.message || L.errorUpload);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const previewRadius = shape === 'circle' ? '50%' : '8px';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {L.label && (
        <div style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--tx3)',
          textTransform: 'uppercase', letterSpacing: '.08em',
        }}>
          {L.label}
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 6,
          background: 'var(--red-dim)', color: 'var(--red)',
          fontSize: 'var(--fs-xs)',
        }}>
          {error}
        </div>
      )}

      {mode === 'home' && (
        <>
          {/* Current preview + remove */}
          {currentUrl && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 10, background: 'var(--sf2)',
              borderRadius: 8,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: previewRadius,
                overflow: 'hidden', background: 'var(--sf3)',
                flexShrink: 0,
              }}>
                <img src={currentUrl} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                }} />
              </div>
              <div style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--tx2)' }}>
                {L.helpText}
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  style={{
                    padding: '8px 12px', borderRadius: 6,
                    background: 'var(--sf3)', border: '1px solid var(--bd)',
                    color: 'var(--tx2)', cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--fs-2xs)', fontWeight: 700, fontFamily: 'inherit',
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}
                >
                  {L.remove}
                </button>
              )}
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => !busy && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            style={{
              border: '2px dashed var(--bd)',
              borderColor: drag ? 'var(--ac)' : 'var(--bd)',
              borderRadius: 10,
              padding: 24,
              textAlign: 'center',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: drag ? 'var(--ac-dim)' : 'var(--sf2)',
              transition: 'background .15s, border-color .15s, transform .15s',
              transform: drag ? 'scale(1.015)' : 'scale(1)',
              opacity: busy ? .5 : 1,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 'var(--icon-lg)', color: 'var(--tx3)' }}
            >
              {busy ? 'hourglass_top' : 'cloud_upload'}
            </span>
            <div style={{
              fontSize: 'var(--fs-xs)', color: 'var(--tx)',
              marginTop: 6, fontWeight: 600,
            }}>
              {busy ? L.loading : L.dropCta}
            </div>
            {!currentUrl && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', marginTop: 4 }}>
                {L.helpText}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptMime.join(',')}
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </>
      )}

      {mode === 'crop' && imageDataUrl && !isSvg && (
        <>
          <div style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--tx3)',
            textTransform: 'uppercase', letterSpacing: '.08em',
          }}>
            {L.cropTitle}
          </div>

          <div
            onMouseDown={e => { dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; }}
            onMouseMove={e => {
              if (!dragStart.current) return;
              setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
            }}
            onMouseUp={() => { dragStart.current = null; }}
            onMouseLeave={() => { dragStart.current = null; }}
            style={{
              width: '100%', aspectRatio: '1', position: 'relative',
              borderRadius: previewRadius, overflow: 'hidden',
              background: 'var(--sf2)',
              cursor: dragStart.current ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <img
              ref={imageElRef}
              src={imageDataUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${1 / zoom})`,
                minWidth: '100%', minHeight: '100%', objectFit: 'cover',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div>
            <div style={{
              fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', marginBottom: 4,
              textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700,
            }}>
              {L.zoom}
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setMode('home'); setImageDataUrl(null); }}
              disabled={busy}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                background: 'var(--sf2)', border: '1px solid var(--bd)',
                color: 'var(--tx2)', cursor: busy ? 'not-allowed' : 'pointer',
                fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              {L.back}
            </button>
            <button
              type="button"
              onClick={cropAndUpload}
              disabled={busy}
              style={{
                flex: 2, padding: '10px 12px', borderRadius: 8,
                background: 'linear-gradient(135deg, var(--ac2), var(--ac))',
                border: 'none',
                color: 'var(--ac-on)',
                cursor: busy ? 'wait' : 'pointer',
                fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'inherit',
                boxShadow: busy ? 'none' : '0 0 12px var(--ac-dim)',
              }}
            >
              {busy ? L.loading : L.save}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
