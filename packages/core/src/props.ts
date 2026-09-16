import type { BlockSegment, ScenePoint } from './maps';

/**
 * LO QUE ESTORBA DE UNA PIEZA PLANTADA (specs/modules/maps/SPEC.md § «Rebanada 6 · 6.7 Que estorben de verdad»).
 *
 * Una pieza de la galería —una columna, una mesa, un roble— puede cortar la vista y el paso. Lo que estorba es
 * una forma encima de la pieza, en px de escena y relativa al CENTRO de la pieza, que gira con ella: un
 * rectángulo, un círculo, o **la silueta del propio PNG** (§ 6.9). Aquí esa forma se convierte en los segmentos
 * que ya entienden el motor de visión y el freno de las fichas (`BlockSegment`), así que una pieza que estorba
 * tapa y frena EXACTAMENTE igual que un muro, sin que nadie tenga que saber que es una pieza.
 *
 * Vive en `core` porque lo usan las dos orillas: el servidor (visión, luz y paredes sólidas, que es quien
 * manda) y el navegador (el freno provisional del arrastre, para que se sienta al instante).
 */
export interface PropBlock {
  /** Centro de la pieza, en px de escena. */
  x: number;
  y: number;
  /** Grados, como el resto del lienzo. La forma que estorba gira con la pieza alrededor de su centro. */
  rotation: number;
  blocksSight: boolean;
  blocksMove: boolean;
  blockShape: BlockShape;
  /** En `circle`, `blockW` es el DIÁMETRO y `blockH` se ignora. */
  blockW: number;
  blockH: number;
  /** Desplazamiento de la forma respecto al centro de la pieza, antes de girar. */
  blockDx: number;
  blockDy: number;
  /**
   * LA SILUETA (§ 6.9), sólo con `blockShape: 'silhouette'`. El anillo en FRACCIONES de la huella
   * (-0.5 … +0.5 desde el centro), no en píxeles: así estirar la pieza no obliga a reescribir 24 puntos ni a
   * volver a mirar el PNG — el tamaño lo siguen diciendo `blockW` / `blockH`.
   */
  silhouette?: readonly ScenePoint[] | null;
}

/**
 * CON QUÉ FORMA ESTORBA UNA PIEZA. Las dos simples son las de la rebanada 6; `silhouette` es la del § 6.9,
 * pedida por él con dos capturas de sus vehículos: «*tienen que recortar por la silueta del png … pero no un
 * cuadrado u óvalo que no tenga nada que ver con la silueta del objeto*». Las tres conviven: no se retira nada.
 */
export type BlockShape = 'rect' | 'circle' | 'silhouette';

/**
 * Con cuántos lados se aproxima un círculo que estorba. Dieciséis: la visión pasa por las esquinas y con
 * menos se notan; con muchos más cada pieza redonda costaría como una sala entera en cada petición.
 */
export const CIRCLE_SIDES = 16;

const rotate = (p: ScenePoint, around: ScenePoint, deg: number): ScenePoint => {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - around.x, dy = p.y - around.y;
  return { x: around.x + dx * c - dy * s, y: around.y + dx * s + dy * c };
};

const round = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * El anillo (polígono cerrado) de la forma que estorba, ya girado con la pieza y en px de escena. Vacío si la
 * forma no mide nada: una pieza sin huella que estorbe no puede tapar ni frenar.
 */
export function propBlockRing(p: Pick<PropBlock, 'x' | 'y' | 'rotation' | 'blockShape' | 'blockW' | 'blockH' | 'blockDx' | 'blockDy' | 'silhouette'>): ScenePoint[] {
  const centre: ScenePoint = { x: p.x, y: p.y };
  const at: ScenePoint = { x: p.x + p.blockDx, y: p.y + p.blockDy };
  /*
   * LA SILUETA (§ 6.9). Los puntos llegan en fracciones de la huella, así que aquí sólo se estiran al tamaño
   * de la pieza y se giran con ella — exactamente el mismo par de operaciones que las otras dos formas, y por
   * eso cuesta lo mismo. Sin lista (una pieza vieja, o un PNG que no dio contorno) se cae al RECTÁNGULO: lo
   * que él tenía hasta hoy, que estorba de más pero nunca de menos. Quedarse sin anillo la dejaría sin tapar
   * ni frenar sin avisar, que es peor.
   */
  if (p.blockShape === 'silhouette') {
    const hw = p.blockW / 2, hh = p.blockH / 2;
    const ring = p.silhouette ?? [];
    if (ring.length >= 3 && hw > 0 && hh > 0) {
      return ring
        .map(q => rotate({ x: at.x + q.x * p.blockW, y: at.y + q.y * p.blockH }, centre, p.rotation))
        .map(q => ({ x: round(q.x), y: round(q.y) }));
    }
  }
  if (p.blockShape === 'circle') {
    const r = p.blockW / 2;
    if (!(r > 0)) return [];
    const ring: ScenePoint[] = [];
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const a = (i / CIRCLE_SIDES) * Math.PI * 2;
      ring.push(rotate({ x: at.x + r * Math.cos(a), y: at.y + r * Math.sin(a) }, centre, p.rotation));
    }
    return ring.map(q => ({ x: round(q.x), y: round(q.y) }));
  }
  const hw = p.blockW / 2, hh = p.blockH / 2;
  if (!(hw > 0) || !(hh > 0)) return [];
  const corners: ScenePoint[] = [
    { x: at.x - hw, y: at.y - hh }, { x: at.x + hw, y: at.y - hh },
    { x: at.x + hw, y: at.y + hh }, { x: at.x - hw, y: at.y + hh },
  ];
  return corners.map(q => rotate(q, centre, p.rotation)).map(q => ({ x: round(q.x), y: round(q.y) }));
}

/** Los lados del anillo, en el par de puntos que entienden la visión y el freno. */
export function propBlockSegments(p: Pick<PropBlock, 'x' | 'y' | 'rotation' | 'blockShape' | 'blockW' | 'blockH' | 'blockDx' | 'blockDy' | 'silhouette'>): BlockSegment[] {
  const ring = propBlockRing(p);
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    return [a.x, a.y, b.x, b.y] as const;
  });
}

/**
 * La geometría de TODAS las piezas de una escena, separada en lo que corta la vista y lo que corta el paso.
 * Una pieza puede hacer una cosa y no la otra (una alfombra no frena a nadie; una cortina tapa y deja pasar),
 * igual que una ventana entre los muros.
 */
export function propsGeometry(props: readonly PropBlock[]): { sight: BlockSegment[]; move: BlockSegment[] } {
  const sight: BlockSegment[] = [];
  const move: BlockSegment[] = [];
  for (const p of props) {
    if (!p.blocksSight && !p.blocksMove) continue;
    const segs = propBlockSegments(p);
    if (p.blocksSight) sight.push(...segs);
    if (p.blocksMove) move.push(...segs);
  }
  return { sight, move };
}

// ── LA SILUETA, SACADA DEL PNG (specs/modules/maps/SPEC.md § 6.9) ────────────

/**
 * CUÁNTOS PUNTOS TIENE UNA SILUETA. Veinticuatro, sacados de la maqueta que él aprobó («está perfecto»).
 * No es un número mágico suelto: el óvalo que ya existe es por dentro un polígono de `CIRCLE_SIDES = 16`
 * lados, así que esto es el mismo orden de magnitud y cuesta lo mismo. Subirlo encarece CADA petición de
 * visión de CADA jugador, no sólo la subida.
 */
export const SILHOUETTE_POINTS = 24;

/**
 * DÓNDE EMPIEZA «ESTO ES EL OBJETO»: medio opaco. Con el corte más bajo, la sombra de un PNG con bordes
 * suavizados crecía un halo alrededor; con uno más alto se comía los bordes finos. 50 % es lo de la maqueta.
 */
export const SILHOUETTE_ALPHA = 0.5;

/**
 * LA SILUETA DE UNA IMAGEN, A RAYOS DESDE EL CENTRO (§ 6.9).
 *
 * Por cada ángulo se entra DESDE FUERA HACIA DENTRO hasta topar con el primer píxel opaco; ese punto es un
 * vértice. Sale **siempre** un polígono simple —sin cruces, sin agujeros y con un tope de puntos—, que es
 * justo lo que el motor de visión necesita para que el coste no se dispare. Seguir el contorno píxel a píxel
 * daría polígonos de cientos de puntos, cruces en las formas raras y ningún tope de coste.
 *
 * Y **lo que NO hace, dicho antes de construirlo**: rellena los huecos interiores (el hueco entre las ruedas
 * de un tanque queda macizo) y no entra en entrantes muy profundos, por ser vista desde el centro. Es su «*o
 * al menos lo más aproximado*», no un recorte al píxel.
 *
 * Los puntos salen en FRACCIONES de la imagen (-0.5 … +0.5 desde el centro), que es como se guardan y como
 * los lee `propBlockRing`: así la silueta sobrevive a estirar la pieza sin recalcular nada.
 *
 * `alpha` es el canal de transparencia en fila a fila, un byte por píxel (lo que da un `getImageData` una vez
 * cogido su cuarto byte). Vacío —una imagen entera transparente, o sin canal— devuelve lista vacía, y quien
 * llama se queda con la forma que ya tenía.
 */
export function silhouetteRing(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  opts: { points?: number; alphaCut?: number } = {},
): ScenePoint[] {
  const n = Math.max(3, Math.floor(opts.points ?? SILHOUETTE_POINTS));
  const cut = Math.round(255 * Math.min(1, Math.max(0, opts.alphaCut ?? SILHOUETTE_ALPHA)));
  if (!(width > 0) || !(height > 0) || alpha.length < width * height) return [];
  const cx = width / 2, cy = height / 2;
  const opaco = (x: number, y: number): boolean => {
    const px = Math.min(width - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(height - 1, Math.max(0, Math.floor(y)));
    return (alpha[py * width + px] ?? 0) >= cut;
  };
  const ring: ScenePoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    /*
     * HASTA DÓNDE LLEGA EL RAYO: el borde de la imagen por ese lado. Se saca por semejanza y no probando, que
     * es lo que evita recorrer la diagonal entera en una imagen muy apaisada.
     */
    const tx = dx > 0 ? (width - cx) / dx : dx < 0 ? -cx / dx : Infinity;
    const ty = dy > 0 ? (height - cy) / dy : dy < 0 ? -cy / dy : Infinity;
    const tMax = Math.min(tx, ty);
    if (!Number.isFinite(tMax) || tMax <= 0) continue;
    // De fuera hacia dentro, píxel a píxel: el PRIMER opaco es el borde del objeto por ese lado.
    let hit = -1;
    for (let t = tMax; t >= 0; t -= 1) {
      if (opaco(cx + dx * t, cy + dy * t)) { hit = t; break; }
    }
    // Un rayo que no topa con nada NO inventa un vértice: se salta. El polígono sigue siendo simple —todos
    // los vértices se ven desde el centro— y una media luna no sale con un pico falso en medio del hueco.
    if (hit < 0) continue;
    ring.push({
      x: redondeo((cx + dx * hit) / width - 0.5),
      y: redondeo((cy + dy * hit) / height - 0.5),
    });
  }
  // Dos vértices en el mismo sitio dejan un lado de longitud cero, que no tapa ni frena: sobra.
  const limpio = ring.filter((p, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]!;
    return p.x !== prev.x || p.y !== prev.y;
  });
  return limpio.length >= 3 ? limpio : [];
}

/** Cuatro decimales: en fracciones de la huella eso es menos de un píxel, y deja el JSON de la fila pequeño. */
const redondeo = (v: number): number => Math.round(v * 10000) / 10000;
