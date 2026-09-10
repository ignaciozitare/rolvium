import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrushTip, Scene } from '../domain/entities/Scene';
import { MASK_STEP_RATIO, maskSize, maskStops, roughOutline, roughRadii, strokeDots, toMaskPoint } from '../domain/useCases/layerRules';

interface Point { x: number; y: number }

/**
 * SOBRE QUÉ SE ESTÁ PINTANDO AHORA MISMO. Una habitación, la roca o una foto se guardan igual —un PNG aparte,
 * lo de debajo intacto— y se pintan igual, así que son el MISMO pincel con distinto destino.
 */
export interface PaintTarget {
  /** Al cambiar, el lienzo se rehace desde la pintura guardada de lo nuevo. */
  id: string;
  /** La pintura ya guardada, con su rompe-caché puesto. `null` = sin pintar. */
  src: string | null;
  /**
   * EL RECORTE, en px de ESCENA: fuera de esta forma el brochazo no pinta. `null` = no hace falta recortar
   * aquí porque lo hace el lienzo al dibujar (la roca se recorta contra su propia máscara, y una foto contra
   * su encaje).
   *
   * 🔑 Es «*si elijo pintar una habitación el scope de ese pincel es la habitación*» (orden suya, 2026-09-10).
   */
  clip: string | null;
  save: (png: Blob) => Promise<unknown>;
  clear: () => Promise<unknown>;
}

/** Con qué se está pintando. La textura manda sobre el color, igual que en una forma del constructor. */
export interface PaintInk {
  /** La foto del catálogo, ya cargada. `null` = se pinta con el color. */
  textureUrl: string | null;
  /** Cuánto mide un azulejo de esa textura, EN PX DE ESCENA. */
  tilePx: number;
  color: string;
}

/** Lo que decide la forma de un brochazo. Sale entero del panel, y el panel de la escena. */
export interface PaintStroke {
  strength: number;
  /** El BORDE: 0 se difumina, 1 corta a filo. No es lo mismo que roto. */
  hardness: number;
  tip: BrushTip;
  roughness: number;
  /** `paint` pone; `erase` quita lo pintado y deja ver lo que había debajo. **No derriba nada.** */
  mode: 'paint' | 'erase';
}

export interface PaintBrush {
  /** Lo que hay que pintar AHORA MISMO en el lienzo, sin esperar a que suba nada. `null` = sin pintura. */
  preview: string | null;
  paint: (from: Point, to: Point, radiusScenePx: number, ink: PaintInk, s: PaintStroke, start?: boolean) => void;
  /** Sube el PNG. Se llama al soltar el ratón, no en cada movimiento. */
  flush: () => Promise<void>;
  /** Quita TODA la pintura de este destino. Lo pintado debajo no se toca: nunca se tocó. */
  reset: () => Promise<void>;
  saving: boolean;
}

/** Cada cuánto se rehace la vista previa mientras se arrastra. Codificar un PNG en cada `pointermove` sobra. */
const PREVIEW_MS = 100;

/**
 * EL PINCEL QUE PINTA ENCIMA (specs/modules/maps/SPEC.md § «Rebanada 10 · A»).
 *
 * 🔑 **Es el hermano de `useMaskPainter` con el signo cambiado, y por eso son dos hooks y no uno.** Aquél
 * pinta NEGRO sobre una máscara para QUITAR lo de arriba y que asome lo de abajo; éste pinta COLOR o TEXTURA
 * sobre un lienzo propio para PONER encima. Comparten la aritmética del brochazo —los mismos puntos, el mismo
 * degradado, el mismo borde roto— y no la comparten por copia: sale toda de `layerRules`, que a su vez la
 * saca de `@rolvium/core`.
 *
 * Mezclarlos en un solo hook con un interruptor habría dejado UN fichero y UNA columna para dos cosas que
 * hacen lo contrario, y entonces el borrador de una se llevaría la otra por delante.
 *
 * **La pintura SE SUMA** (suyo, 2026-09-10: «*si tengo la base del piso a cuadros, pinto musgo arriba y pongo
 * otro color arriba de éste, se van sumando*»). Eso es literalmente lo que hace un lienzo de píxeles: cada
 * pasada cae encima de la anterior y el resultado queda cocido dentro. Por eso se guarda un PNG por cosa
 * pintada y no una fila por pincelada — no hay nada que re-apilar al abrir el mapa.
 *
 * Y **pintar no cambia el mapa**: ni por dónde se anda, ni qué se ve, ni la luz. Este hook no toca una sola
 * fila de muro, de sala ni de niebla.
 */
export function usePaintBrush(scene: Scene | null, target: PaintTarget | null): PaintBrush {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** El lienzo de usar y tirar donde se estampa la forma del brochazo antes de teñirla con la textura. */
  const stampRef = useRef<HTMLCanvasElement | null>(null);
  const dirtyRef = useRef(false);
  const lastPreview = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const targetId = target?.id ?? null;
  const targetSrc = target?.src ?? null;
  /** La forma del borde roto de la pincelada EN CURSO. Se sortea al empezarla y dura hasta que se suelta. */
  const edgeRef = useRef<number[] | null>(null);
  /** La foto de la textura, ya cargada, por URL. Cargarla en cada pasada dejaría el trazo a trozos. */
  const texRef = useRef<Map<string, HTMLImageElement>>(new Map());

  /**
   * El lienzo va al tamaño con el que se guarda la pintura, el mismo que las máscaras: es lo que hace que un
   * PNG pese lo mismo con una pincelada que con diez mil.
   *
   * 🐞 Depende del TAMAÑO y no de la escena entera, por lo mismo que en `useMaskPainter`: el pincel se guarda
   * EN LA ESCENA, así que soltar cualquier deslizador trae una escena nueva con el mismo tamaño — y colgado
   * del objeto eso vaciaría el lienzo y perdería lo pintado sin subir.
   */
  const maskDim = scene ? maskSize(scene) : null;
  const maskW = maskDim?.width ?? 0, maskH = maskDim?.height ?? 0;
  const canvasOf = useCallback((): HTMLCanvasElement | null => {
    if (maskW < 1 || maskH < 1 || typeof document === 'undefined') return null;
    let c = canvasRef.current;
    if (!c) { c = document.createElement('canvas'); canvasRef.current = c; }
    if (c.width !== maskW || c.height !== maskH) { c.width = maskW; c.height = maskH; }
    return c;
  }, [maskW, maskH]);

  const repaintPreview = useCallback((force = false) => {
    const c = canvasRef.current;
    if (!c || typeof c.toDataURL !== 'function') return;
    const now = Date.now();
    if (!force && now - lastPreview.current < PREVIEW_MS) return;
    lastPreview.current = now;
    try { setPreview(c.toDataURL('image/png')); } catch { /* lienzo manchado: se sigue con lo guardado */ }
  }, []);

  /**
   * Al cambiar de destino se empieza de SU pintura guardada, no en blanco: si no, la primera pincelada
   * borraría todo lo pintado en sesiones anteriores.
   *
   * `crossOrigin` es obligatorio y no decorativo: sin él el lienzo queda MANCHADO al dibujar una imagen de
   * otro origen y `toBlob` revienta con un error de seguridad — es decir, el pincel dejaría de guardar.
   */
  useEffect(() => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
    setPreview(targetSrc);
    if (!targetSrc || !c || !ctx || typeof Image === 'undefined') return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!alive) return; ctx.drawImage(img, 0, 0, c.width, c.height); repaintPreview(true); };
    img.src = targetSrc;
    return () => { alive = false; };
  }, [targetId, targetSrc, canvasOf, repaintPreview]);

  /**
   * La foto de la textura, cargada una vez y guardada. Devuelve `null` la primera vez —todavía no ha
   * llegado— y entonces la pasada sale con el color: es lo mismo que hace una forma sin foto, y es preferible
   * a no pintar nada mientras el navegador la descarga.
   */
  const textureOf = useCallback((url: string): HTMLImageElement | null => {
    const ya = texRef.current.get(url);
    if (ya) return ya.complete && ya.naturalWidth > 0 ? ya : null;
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => repaintPreview(true);
    img.src = url;
    texRef.current.set(url, img);
    return null;
  }, [repaintPreview]);

  const paint = useCallback((from: Point, to: Point, radiusScenePx: number, ink: PaintInk, s: PaintStroke, start = false) => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (!c || !ctx || !target || !scene) return;
    const size = { width: c.width, height: c.height };
    const r = Math.max(1, toMaskPoint({ x: radiusScenePx, y: 0 }, scene, size).x);
    const a = Math.min(1, Math.max(0, s.strength));
    // La forma del borde roto se sortea UNA VEZ por pincelada («distinto cada vez» es por brochazo).
    if (start || edgeRef.current === null) edgeRef.current = roughRadii(s.roughness, Math.random);
    const edge = edgeRef.current;
    /**
     * CON QUÉ SE TIÑE. Con un color basta un degradado radial —el mismo que la máscara, cambiando el negro
     * por el suyo—. Con una textura no: un degradado no puede ser un patrón, así que la pasada se estampa
     * primero en un lienzo aparte y ahí se tiñe con `source-in`. Es el único camino que respeta a la vez la
     * transparencia, el borde difuminado y el azulejo.
     */
    const img = !ink.textureUrl || s.mode === 'erase' ? null : textureOf(ink.textureUrl);
    const stamp = img ? stampOf(stampRef, size) : null;
    const sctx = stamp?.getContext?.('2d') ?? null;
    const dest = stamp && sctx ? sctx : ctx;
    if (stamp && sctx) sctx.clearRect(0, 0, stamp.width, stamp.height);
    dest.save();
    /*
     * EL RECORTE, y por qué va aquí y no en una comprobación por punto: pintando una habitación el brochazo
     * se recorta contra su contorno, así que pasar el pincel por encima del muro no lo mancha. El contorno
     * viene en px de escena y la pintura se guarda reducida, de ahí la escala.
     */
    if (target.clip && typeof Path2D !== 'undefined' && typeof dest.clip === 'function') {
      dest.scale(size.width / scene.width, size.height / scene.height);
      dest.clip(new Path2D(target.clip));
      dest.setTransform(1, 0, 0, 1, 0, 0);
    }
    /*
     * Borrando se quita del propio lienzo de pintura (`destination-out`): lo que asoma es lo que había debajo,
     * que nunca se tocó. **No derriba nada** — la forma, el muro y la foto siguen exactamente donde estaban.
     */
    dest.globalCompositeOperation = s.mode === 'erase' ? 'destination-out' : 'source-over';
    // Con textura, la pasada se estampa OPACA y la transparencia se aplica luego, al pegarla: si no, el
    // solape de dos gotas de la misma pasada se vería como una mancha más oscura dentro del propio brochazo.
    const alpha = stamp ? 1 : a;
    const tinta = (op: number): string => rgba(ink.color, op);
    for (const dot of strokeDots(toMaskPoint(from, scene, size), toMaskPoint(to, scene, size), r * MASK_STEP_RATIO)) {
      /*
       * El borde lo manda la DUREZA (`maskStops`), no una constante, y la PUNTA manda sobre el degradado:
       * `disc` corta a canto limpio pase lo que pase, `soft` y `rough` lo respetan. Igual que en la máscara,
       * porque es el mismo brochazo.
       */
      const g = dest.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, r);
      if (s.tip === 'disc') { g.addColorStop(0, tinta(alpha)); g.addColorStop(1, tinta(alpha)); }
      else for (const st of maskStops(alpha, s.hardness)) g.addColorStop(st.at, tinta(st.alpha));
      dest.fillStyle = g;
      dest.beginPath();
      if (s.tip === 'rough') {
        const pts = roughOutline(dot.x, dot.y, r, edge);
        pts.forEach((pt, i) => (i === 0 ? dest.moveTo(pt.x, pt.y) : dest.lineTo(pt.x, pt.y)));
        dest.closePath();
      } else {
        dest.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      }
      dest.fill();
    }
    dest.restore();
    if (stamp && sctx && img) {
      // La textura, teñida por la forma del brochazo: `source-in` la recorta a lo que se acaba de estampar.
      sctx.save();
      sctx.globalCompositeOperation = 'source-in';
      const pat = sctx.createPattern(img, 'repeat');
      if (pat) {
        // El azulejo se mide en px de ESCENA y el lienzo va reducido: sin esta escala una losa saldría del
        // tamaño del mapa entero en un mapa grande.
        const lado = Math.max(1, (ink.tilePx * size.width) / scene.width);
        pat.setTransform?.(new DOMMatrix().scale(lado / img.naturalWidth, lado / img.naturalHeight));
        sctx.fillStyle = pat;
      } else {
        sctx.fillStyle = ink.color;
      }
      sctx.fillRect(0, 0, stamp.width, stamp.height);
      sctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.drawImage(stamp, 0, 0);
      ctx.restore();
    }
    dirtyRef.current = true;
    repaintPreview();
  }, [canvasOf, target, scene, repaintPreview, textureOf]);

  const flush = useCallback(async () => {
    const c = canvasRef.current;
    // La pincelada terminó: la siguiente vuelve a sortear su forma.
    edgeRef.current = null;
    if (!c || !target || !dirtyRef.current) return;
    repaintPreview(true);
    const blob = await new Promise<Blob | null>(resolve => {
      if (typeof c.toBlob !== 'function') { resolve(null); return; }
      c.toBlob(b => resolve(b), 'image/png');
    });
    if (!blob) return;
    dirtyRef.current = false;
    setSaving(true);
    try { await target.save(blob); } finally { setSaving(false); }
  }, [target, repaintPreview]);

  const reset = useCallback(async () => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
    setPreview(null);
    if (target) await target.clear();
  }, [canvasOf, target]);

  return { preview, paint, flush, reset, saving };
}

/** El lienzo de usar y tirar donde se estampa la forma antes de teñirla. Uno solo, reaprovechado. */
function stampOf(ref: { current: HTMLCanvasElement | null }, size: { width: number; height: number }): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  let c = ref.current;
  if (!c) { c = document.createElement('canvas'); ref.current = c; }
  if (c.width !== size.width || c.height !== size.height) { c.width = size.width; c.height = size.height; }
  return c;
}

/**
 * Un hex de la paleta, con su opacidad. Se pasa a `rgba()` a mano y no se usa `globalAlpha` porque lo que
 * hace el degradado del brochazo es justamente variar la opacidad punto a punto — con `globalAlpha` el borde
 * difuminado se perdería.
 *
 * ⚠️ Éstos NO son colores de tema: son DATO, el color con el que él pintó, y viven en `maps_rooms.floor_color`
 * o en `maps_colors`. Mismo caso justificado que `BRUSH_COLORS` y `STROKE_COLORS`.
 */
function rgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
