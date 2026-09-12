import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrushTip, Scene } from '../domain/entities/Scene';
import { MASK_STEP_RATIO, maskSize, maskStops, roughOutline, roughRadii, strokeDots, toMaskPoint, type MaskDirection } from '../domain/useCases/layerRules';

interface Point { x: number; y: number }

/**
 * SOBRE QUÉ PINTA ESTE PINCEL. Una capa de terreno y el suelo de una sala se guardan igual —un PNG aparte,
 * la foto original intacta— y se pintan igual, así que son el MISMO pincel con distinto destino. Antes el
 * hook sólo sabía de capas y por eso el suelo de una sala no tenía herramienta ninguna.
 */
export interface MaskTarget {
  /** Al cambiar, el lienzo se rehace desde la máscara guardada de lo nuevo. */
  id: string;
  /** La máscara ya guardada, con su rompe-caché puesto. `null` = sin pintar. */
  src: string | null;
  /**
   * EL RECORTE, en px de ESCENA: fuera de esta forma el brochazo no pinta. `null` = todo el mapa.
   *
   * 🔑 Es «si voy a pintar una sala no tiene que manchar una pared» (regla suya). No se resuelve eligiendo
   * capa: se recorta contra el contorno de la sala, así que el director puede pasar el pincel por encima del
   * muro sin miedo — y es lo que permite pintar deprisa.
   */
  clip: string | null;
  save: (png: Blob) => Promise<unknown>;
  clear: () => Promise<unknown>;
}

/** Lo que decide la forma de un brochazo. Sale entero de la barra, y la barra de la escena. */
export interface BrushStroke {
  strength: number;
  /** El BORDE: 0 se difumina, 1 corta a filo. No es lo mismo que roto. */
  hardness: number;
  tip: BrushTip;
  roughness: number;
  dir: MaskDirection;
}

export interface MaskPainter {
  /** Lo que hay que pintar AHORA MISMO en el lienzo, sin esperar a que suba nada. `null` = sin máscara. */
  preview: string | null;
  /**
   * Estampa el pincel desde un punto hasta otro, en px de ESCENA.
   *
   * `start` marca el PRIMER brochazo de un arrastre, y no es un detalle: es donde se sortea la forma del
   * borde roto. Sorteándola en cada punto intermedio —y un arrastre son decenas— el trazo saldría de ruido en
   * vez de desgarrado. Una pincelada, una forma («distinto cada vez» es por pincelada, no por punto).
   */
  paint: (from: Point, to: Point, radiusScenePx: number, s: BrushStroke, start?: boolean) => void;
  /** Sube el PNG. Se llama al soltar el ratón, no en cada movimiento. */
  flush: () => Promise<void>;
  /** Quita la máscara entera: lo pintado vuelve a verse completo. */
  reset: () => Promise<void>;
  saving: boolean;
}

/** Cada cuánto se rehace la vista previa mientras se arrastra. Codificar un PNG en cada `pointermove` sobra. */
const PREVIEW_MS = 100;

/**
 * El pincel que pinta sobre una MÁSCARA: una capa de terreno (rebanada 7) o el suelo de una sala (rebanada 9).
 *
 * Pinta sobre un lienzo PROPIO fuera de pantalla —la foto de la capa, o la textura del suelo, no se toca
 * NUNCA, que es la promesa del spec— y ese lienzo es la máscara: negro donde no se ve, transparente donde se
 * ve entero. Se sube como PNG al soltar, no en cada movimiento: un guardado por pincelada, no cien.
 *
 * Los dos sentidos son los dos modos de composición del lienzo:
 *   · `erase`   → se pinta negro encima (`source-over`): lo de arriba desaparece y asoma lo de abajo;
 *   · `restore` → se BORRA lo pintado (`destination-out`): vuelve.
 * Por eso «subir la fuerza en sentido contrario» devuelve la foto de verdad, y no la aclara a medias.
 */
export function useMaskPainter(scene: Scene | null, target: MaskTarget | null): MaskPainter {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dirtyRef = useRef(false);
  const lastPreview = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const targetId = target?.id ?? null;
  const targetSrc = target?.src ?? null;
  /** La forma del borde roto de la pincelada EN CURSO. Se sortea al empezarla y dura hasta que se suelta. */
  const edgeRef = useRef<number[] | null>(null);

  /**
   * Un lienzo por escena, al tamaño reducido con el que se guarda la máscara.
   *
   * 🐞 DEPENDE DEL TAMAÑO, NO DE LA ESCENA ENTERA, y no es cosmético: desde la rebanada 9 el pincel se guarda
   * EN LA ESCENA («*el trazo es de la escena*»), así que soltar cualquier deslizador de la barra reescribe la
   * fila y llega aquí una escena nueva con el MISMO tamaño. Colgado del objeto, eso rehacía este `useCallback`
   * y con él el efecto de abajo: lienzo borrado, lo pintado sin subir y el PNG guardado descargándose otra
   * vez. Un parpadeo en cada roce del deslizador y, si daba tiempo a pintar antes de que llegara la imagen,
   * la máscara vieja caía encima de lo nuevo.
   */
  const maskDim = scene ? maskSize(scene) : null;
  const maskW = maskDim?.width ?? 0, maskH = maskDim?.height ?? 0;
  const canvasOf = useCallback((): HTMLCanvasElement | null => {
    // Sin escena no hay dónde pintar: el director aún no ha activado ninguna.
    if (maskW < 1 || maskH < 1 || typeof document === 'undefined') return null;
    let c = canvasRef.current;
    if (!c) { c = document.createElement('canvas'); canvasRef.current = c; }
    // Cambiar de mapa SÍ rehace el lienzo: otro tamaño es otra máscara, y tocar `width` lo vacía de por sí.
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
   * Al cambiar de destino se empieza de SU máscara guardada, no en blanco: si no, la primera pincelada
   * borraría todo lo pintado en sesiones anteriores. Y por eso el efecto depende del destino y de su URL —
   * pasar de una capa a una sala tiene que traerse la máscara de la sala.
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

  const paint = useCallback((from: Point, to: Point, radiusScenePx: number, s: BrushStroke, start = false) => {
    const c = canvasOf();
    const ctx = c?.getContext?.('2d') ?? null;
    if (!c || !ctx || !target || !scene) return;
    const size = { width: c.width, height: c.height };
    const r = Math.max(1, toMaskPoint({ x: radiusScenePx, y: 0 }, scene, size).x);
    const a = Math.min(1, Math.max(0, s.strength));
    // La forma del borde roto se sortea UNA VEZ por pincelada («distinto cada vez» es por brochazo).
    if (start || edgeRef.current === null) edgeRef.current = roughRadii(s.roughness, Math.random);
    const edge = edgeRef.current;
    ctx.save();
    /*
     * EL RECORTE, y por qué va aquí y no en una comprobación por punto: pintando el suelo de una sala el
     * brochazo se recorta contra su contorno, así que pasar el pincel por encima del muro no lo mancha. El
     * contorno viene en px de escena y la máscara se guarda reducida, de ahí la escala.
     */
    if (target.clip && typeof Path2D !== 'undefined' && typeof ctx.clip === 'function') {
      ctx.scale(size.width / scene.width, size.height / scene.height);
      ctx.clip(new Path2D(target.clip));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalCompositeOperation = s.dir === 'erase' ? 'source-over' : 'destination-out';
    for (const dot of strokeDots(toMaskPoint(from, scene, size), toMaskPoint(to, scene, size), r * MASK_STEP_RATIO)) {
      /*
       * El borde lo manda la DUREZA (`maskStops`), no una constante: a 0 se difumina desde el centro y a
       * tope corta a filo. Y la PUNTA manda sobre el degradado: `disc` corta a canto limpio pase lo que pase
       * con la dureza —es lo que se pide cuando se elige un disco—, `soft` y `rough` lo respetan.
       */
      const g = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, r);
      if (s.tip === 'disc') { g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, `rgba(0,0,0,${a})`); }
      else for (const st of maskStops(a, s.hardness)) g.addColorStop(st.at, `rgba(0,0,0,${st.alpha})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      /*
       * `rough` NO es «dureza 0»: la dureza difumina hacia fuera, siempre en círculo, y roto cambia el
       * CONTORNO. Por eso aquí sólo cambia la figura que se rellena — el degradado sigue siendo el mismo, y
       * un brochazo puede ser de canto duro y roto a la vez.
       */
      if (s.tip === 'rough') {
        const pts = roughOutline(dot.x, dot.y, r, edge);
        pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
      } else {
        ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
    dirtyRef.current = true;
    repaintPreview();
  }, [canvasOf, target, scene, repaintPreview]);

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
