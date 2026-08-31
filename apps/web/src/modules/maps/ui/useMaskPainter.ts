import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layer, Scene } from '../domain/entities/Scene';
import { MASK_STEP_RATIO, maskSize, maskSrc, strokeDots, toMaskPoint, type MaskDirection } from '../domain/useCases/layerRules';

interface Point { x: number; y: number }

export interface MaskPainter {
  /** Lo que hay que pintar AHORA MISMO en el lienzo, sin esperar a que suba nada. `null` = sin máscara. */
  preview: string | null;
  /** Estampa el pincel desde un punto hasta otro, en px de ESCENA. */
  paint: (from: Point, to: Point, radiusScenePx: number, strength: number, dir: MaskDirection) => void;
  /** Sube el PNG. Se llama al soltar el ratón, no en cada movimiento. */
  flush: () => Promise<void>;
  /** Quita la máscara entera: la capa vuelve a verse completa. */
  reset: () => Promise<void>;
  saving: boolean;
}

/** Cada cuánto se rehace la vista previa mientras se arrastra. Codificar un PNG en cada `pointermove` sobra. */
const PREVIEW_MS = 100;

/**
 * El pincel de transparencia de una capa de terreno (rebanada 7).
 *
 * Pinta sobre un lienzo PROPIO fuera de pantalla —la foto de la capa no se toca NUNCA, que es la promesa del
 * spec— y ese lienzo es la máscara: negro donde la capa no se ve, transparente donde se ve entera. Se sube
 * como PNG al soltar, no en cada movimiento: un guardado por pincelada, no cien.
 *
 * Los dos sentidos son los dos modos de composición del lienzo:
 *   · `erase`   → se pinta negro encima (`source-over`): la capa desaparece y asoma la de abajo;
 *   · `restore` → se BORRA lo pintado (`destination-out`): la capa vuelve.
 * Por eso «subir la fuerza en sentido contrario» devuelve la foto de verdad, y no la aclara a medias.
 */
export function useMaskPainter(scene: Scene | null, layer: Layer | null, deps: { saveMask: (l: Layer, png: Blob) => Promise<unknown>; clearMask: (l: Layer) => Promise<unknown> }): MaskPainter {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dirtyRef = useRef(false);
  const lastPreview = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const layerId = layer?.id ?? null;

  /** Un lienzo por escena, al tamaño reducido con el que se guarda la máscara. */
  const canvasOf = useCallback((): HTMLCanvasElement | null => {
    // Sin escena no hay dónde pintar: el director aún no ha activado ninguna.
    if (!scene || typeof document === 'undefined') return null;
    const size = maskSize(scene);
    let c = canvasRef.current;
    if (!c) { c = document.createElement('canvas'); canvasRef.current = c; }
    if (c.width !== size.width || c.height !== size.height) { c.width = size.width; c.height = size.height; }
    return c;
  }, [scene]);

  const repaintPreview = useCallback((force = false) => {
    const c = canvasRef.current;
    if (!c || typeof c.toDataURL !== 'function') return;
    const now = Date.now();
    if (!force && now - lastPreview.current < PREVIEW_MS) return;
    lastPreview.current = now;
    try { setPreview(c.toDataURL('image/png')); } catch { /* lienzo manchado: se sigue con lo guardado */ }
  }, []);

  /**
   * Al cambiar de capa se empieza de su máscara guardada, no en blanco: si no, la primera pincelada borraría
   * todo lo pintado en sesiones anteriores.
   *
   * `crossOrigin` es obligatorio y no decorativo: sin él el lienzo queda MANCHADO al dibujar una imagen de
   * otro origen y `toBlob` revienta con un error de seguridad — es decir, el pincel dejaría de guardar.
   */
  useEffect(() => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
    const src = layer ? maskSrc(layer) : null;
    setPreview(src);
    if (!src || !c || !ctx || typeof Image === 'undefined') return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!alive) return; ctx.drawImage(img, 0, 0, c.width, c.height); repaintPreview(true); };
    img.src = src;
    return () => { alive = false; };
  }, [layerId, canvasOf, repaintPreview, layer]);

  const paint = useCallback((from: Point, to: Point, radiusScenePx: number, strength: number, dir: MaskDirection) => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (!c || !ctx || !layer || !scene) return;
    const size = { width: c.width, height: c.height };
    const r = Math.max(1, toMaskPoint({ x: radiusScenePx, y: 0 }, scene, size).x);
    const a = Math.min(1, Math.max(0, strength));
    ctx.save();
    ctx.globalCompositeOperation = dir === 'erase' ? 'source-over' : 'destination-out';
    for (const dot of strokeDots(toMaskPoint(from, scene, size), toMaskPoint(to, scene, size), r * MASK_STEP_RATIO)) {
      // Borde suave: un círculo duro deja el recorte a tijera y lo que se pidió es MEZCLAR dos fotos.
      const g = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${a * 0.75})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    dirtyRef.current = true;
    repaintPreview();
  }, [canvasOf, layer, scene, repaintPreview]);

  const flush = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !layer || !dirtyRef.current) return;
    repaintPreview(true);
    const blob = await new Promise<Blob | null>(resolve => {
      if (typeof c.toBlob !== 'function') { resolve(null); return; }
      c.toBlob(b => resolve(b), 'image/png');
    });
    if (!blob) return;
    dirtyRef.current = false;
    setSaving(true);
    try { await deps.saveMask(layer, blob); } finally { setSaving(false); }
  }, [layer, deps, repaintPreview]);

  const reset = useCallback(async () => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
    setPreview(null);
    if (layer) await deps.clearMask(layer);
  }, [canvasOf, layer, deps]);

  return { preview, paint, flush, reset, saving };
}
