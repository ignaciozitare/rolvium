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
  /**
   * Sube el PNG. Se llama al soltar el ratón, no en cada movimiento.
   *
   * Devuelve **la vuelta atrás de ESA pincelada** —o `null` si no había nada que subir— para que quien
   * llama la apile en el historial. La construye el hook porque es el único que tiene las dos fotos: la de
   * antes de la pincelada y la de después.
   */
  flush: () => Promise<{ undo: () => Promise<void>; redo: () => Promise<void> } | null>;
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
  /**
   * ── LOS TRES LIENZOS, Y POR QUÉ HACEN FALTA TRES ──
   *
   * 🐞 Su queja del 2026-09-10: «*la barra de transparencia casi que es on/off, no hay una progresión*». Y no
   * era la barra: una pincelada son decenas de gotas solapadas, y aplicándole la transparencia A CADA GOTA se
   * suman entre ellas — al 20 % la tercera gota ya iba por el 50 %, y al quinto roce el trazo estaba opaco.
   *
   * Así que la transparencia se aplica UNA VEZ, a la pincelada entera:
   *   · `base`   — lo que había ANTES de empezar esta pincelada;
   *   · `stroke` — por dónde ha pasado la mano en ESTA pincelada, a plena opacidad;
   *   · el lienzo bueno — `base` + `stroke` teñido y compuesto con la transparencia elegida.
   */
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  /** El lienzo de usar y tirar donde se tiñe la pincelada con la textura antes de pegarla. */
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
    const base = scratch(baseRef, size), stroke = scratch(strokeRef, size);
    const bctx = base?.getContext?.('2d') ?? null, sctx = stroke?.getContext?.('2d') ?? null;
    if (!base || !bctx || !stroke || !sctx) return;
    const r = Math.max(1, toMaskPoint({ x: radiusScenePx, y: 0 }, scene, size).x);
    const a = Math.min(1, Math.max(0, s.strength));
    // La forma del borde roto se sortea UNA VEZ por pincelada («distinto cada vez» es por brochazo).
    if (start || edgeRef.current === null) edgeRef.current = roughRadii(s.roughness, Math.random);
    const edge = edgeRef.current;
    // Empieza la pincelada: se guarda lo que había, y el rastro se estrena en blanco.
    if (start) {
      bctx.clearRect(0, 0, base.width, base.height);
      bctx.drawImage(c, 0, 0);
      sctx.clearRect(0, 0, stroke.width, stroke.height);
    }

    // ── 1 · POR DÓNDE HA PASADO LA MANO, a plena opacidad y con su borde ──
    sctx.save();
    /*
     * EL RECORTE, y por qué va aquí y no en una comprobación por punto: pintando una habitación el brochazo
     * se recorta contra su contorno, así que pasar el pincel por encima del muro no lo mancha. El contorno
     * viene en px de escena y la pintura se guarda reducida, de ahí la escala.
     */
    if (target.clip && typeof Path2D !== 'undefined' && typeof sctx.clip === 'function') {
      sctx.scale(size.width / scene.width, size.height / scene.height);
      sctx.clip(new Path2D(target.clip));
      sctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (const dot of strokeDots(toMaskPoint(from, scene, size), toMaskPoint(to, scene, size), r * MASK_STEP_RATIO)) {
      /*
       * El borde lo manda la DUREZA (`maskStops`) y la PUNTA manda sobre el degradado: `disc` corta a canto
       * limpio pase lo que pase, `soft` y `rough` lo respetan. Igual que en la máscara, porque es el mismo
       * brochazo — sólo que aquí a plena opacidad: la transparencia llega después, y una sola vez.
       */
      const g = sctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, r);
      if (s.tip === 'disc') { g.addColorStop(0, TRAZO); g.addColorStop(1, TRAZO); }
      else for (const st of maskStops(1, s.hardness)) g.addColorStop(st.at, `rgba(255,255,255,${st.alpha})`);
      sctx.fillStyle = g;
      sctx.beginPath();
      if (s.tip === 'rough') {
        const pts = roughOutline(dot.x, dot.y, r, edge);
        pts.forEach((pt, i) => (i === 0 ? sctx.moveTo(pt.x, pt.y) : sctx.lineTo(pt.x, pt.y)));
        sctx.closePath();
      } else {
        sctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
      }
      sctx.fill();
    }
    sctx.restore();

    // ── 2 · EL LIENZO BUENO: lo de antes, y encima esta pincelada con SU transparencia ──
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(base, 0, 0);
    ctx.save();
    ctx.globalAlpha = a;
    if (s.mode === 'erase') {
      /*
       * Borrando se quita del propio lienzo de pintura: lo que asoma es lo que había debajo, que nunca se
       * tocó. **No derriba nada** — la forma, el muro y la foto siguen exactamente donde estaban.
       */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(stroke, 0, 0);
    } else {
      // El azulejo, pasado a píxeles del lienzo con la misma regla de tres que el radio del brochazo.
      const azulejo = Math.max(1, (ink.tilePx * size.width) / scene.width);
      ctx.drawImage(tint(stampRef, stroke, ink, azulejo, textureOf), 0, 0);
    }
    ctx.restore();
    dirtyRef.current = true;
    repaintPreview();
  }, [canvasOf, target, scene, repaintPreview, textureOf]);

  const flush = useCallback(async () => {
    const c = canvasRef.current;
    // La pincelada terminó: la siguiente vuelve a sortear su forma y a estrenar rastro.
    edgeRef.current = null;
    const stroke = strokeRef.current;
    stroke?.getContext?.('2d')?.clearRect(0, 0, stroke.width, stroke.height);
    if (!c || !target || !dirtyRef.current) return null;
    repaintPreview(true);
    const despues = await pngOf(c);
    if (!despues) return null;
    /*
     * ↩️ LA VUELTA ATRÁS DE ESTA PINCELADA (2026-09-10: «*el Ctrl+Z sigue dando por culo, depende con qué te
     * deja deshacer o no*»). Se guardan las DOS fotos —la de antes y la de después— y deshacer vuelve a subir
     * la de antes: no hay forma más barata de invertir un lienzo de píxeles, y es exacta.
     *
     * ⚠️ La de antes puede ser un PNG TRANSPARENTE ENTERO en vez de «sin pintura». Se ve exactamente igual, y
     * distinguirlo obligaría a leer los píxeles del lienzo en cada pincelada para nada.
     */
    const antes = baseRef.current ? await pngOf(baseRef.current) : null;
    const save = target.save;
    dirtyRef.current = false;
    setSaving(true);
    try { await save(despues); } finally { setSaving(false); }
    // La pincelada ya está: pasa a ser «lo de antes» de la siguiente.
    const base = scratch(baseRef, { width: c.width, height: c.height });
    const bctx = base?.getContext?.('2d') ?? null;
    if (base && bctx) { bctx.clearRect(0, 0, base.width, base.height); bctx.drawImage(c, 0, 0); }

    const volver = async (png: Blob | null): Promise<void> => {
      if (!png) return;
      setSaving(true);
      try { await save(png); } finally { setSaving(false); }
      await repintarDesde(canvasOf(), baseRef, png, repaintPreview);
    };
    return { undo: () => volver(antes), redo: () => volver(despues) };
  }, [target, repaintPreview, canvasOf]);

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

/** El lienzo, en PNG. `null` cuando el navegador de turno no sabe hacerlo (jsdom en los tests). */
async function pngOf(c: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof c.toBlob !== 'function') return null;
  return new Promise<Blob | null>(resolve => c.toBlob(b => resolve(b), 'image/png'));
}

/**
 * Rehace el lienzo desde un PNG guardado. Es lo que hace que deshacer se vea EN EL ACTO, sin esperar a que el
 * navegador vuelva a bajarse la imagen que se acaba de subir.
 */
async function repintarDesde(c: HTMLCanvasElement | null, baseRef: { current: HTMLCanvasElement | null }, png: Blob, repaint: (force?: boolean) => void): Promise<void> {
  const ctx = c?.getContext?.('2d') ?? null;
  if (!c || !ctx || typeof createImageBitmap !== 'function') return;
  try {
    const bmp = await createImageBitmap(png);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const base = scratch(baseRef, { width: c.width, height: c.height });
    const bctx = base?.getContext?.('2d') ?? null;
    if (base && bctx) { bctx.clearRect(0, 0, base.width, base.height); bctx.drawImage(c, 0, 0); }
    repaint(true);
  } catch { /* si el navegador no sabe leerlo, lo que se ve es lo ya subido: no se pierde nada */ }
}

/** Un lienzo auxiliar del tamaño del bueno. Se reaprovecha: crear uno por pincelada sería tirar memoria. */
function scratch(ref: { current: HTMLCanvasElement | null }, size: { width: number; height: number }): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  let c = ref.current;
  if (!c) { c = document.createElement('canvas'); ref.current = c; }
  if (c.width !== size.width || c.height !== size.height) { c.width = size.width; c.height = size.height; }
  return c;
}

/**
 * El blanco con el que se dibuja el RASTRO de la pincelada. No es un color de tema ni se ve nunca: es la
 * silueta por la que después se cuela el color o la textura de verdad (`source-in`).
 */
const TRAZO = 'rgba(255,255,255,1)';

/**
 * LA PINCELADA, TEÑIDA. `source-in` recorta el color o el azulejo a la silueta del rastro, así que el borde
 * difuminado y el borde roto se conservan exactamente.
 *
 * ⚠️ El color NO es tema: es DATO, el que él eligió, y viaja a `maps_rooms.floor_color` o a `maps_colors`.
 * Mismo caso justificado que `BRUSH_COLORS` y `STROKE_COLORS`.
 */
function tint(ref: { current: HTMLCanvasElement | null }, stroke: HTMLCanvasElement, ink: PaintInk, tilePx: number, textureOf: (url: string) => HTMLImageElement | null): HTMLCanvasElement {
  const size = { width: stroke.width, height: stroke.height };
  const c = scratch(ref, size);
  const ctx = c?.getContext?.('2d') ?? null;
  if (!c || !ctx) return stroke;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(stroke, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  const img = ink.textureUrl ? textureOf(ink.textureUrl) : null;
  const pat = img ? ctx.createPattern(img, 'repeat') : null;
  if (pat && img) {
    // `tilePx` llega ya en píxeles DEL LIENZO: el azulejo se mide en px de escena y el lienzo va reducido,
    // así que sin esa conversión una losa saldría del tamaño del mapa entero en un mapa grande.
    pat.setTransform?.(new DOMMatrix().scale(tilePx / img.naturalWidth, tilePx / img.naturalHeight));
    ctx.fillStyle = pat;
  } else {
    ctx.fillStyle = ink.color;
  }
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.restore();
  return c;
}
