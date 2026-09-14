import type { BlockSegment, ScenePoint } from './maps';

/**
 * LO QUE ESTORBA DE UNA PIEZA PLANTADA (specs/modules/maps/SPEC.md § «Rebanada 6 · 6.7 Que estorben de verdad»).
 *
 * Una pieza de la galería —una columna, una mesa, un roble— puede cortar la vista y el paso. Lo que estorba
 * NO es la silueta del PNG sino una forma SIMPLE encima de la pieza: un rectángulo o un círculo, en px de
 * escena y relativa al CENTRO de la pieza, que gira con ella. Aquí esa forma se convierte en los segmentos que
 * ya entienden el motor de visión y el freno de las fichas (`BlockSegment`), así que una pieza que estorba
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
  blockShape: 'rect' | 'circle';
  /** En `circle`, `blockW` es el DIÁMETRO y `blockH` se ignora. */
  blockW: number;
  blockH: number;
  /** Desplazamiento de la forma respecto al centro de la pieza, antes de girar. */
  blockDx: number;
  blockDy: number;
}

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
export function propBlockRing(p: Pick<PropBlock, 'x' | 'y' | 'rotation' | 'blockShape' | 'blockW' | 'blockH' | 'blockDx' | 'blockDy'>): ScenePoint[] {
  const centre: ScenePoint = { x: p.x, y: p.y };
  const at: ScenePoint = { x: p.x + p.blockDx, y: p.y + p.blockDy };
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
export function propBlockSegments(p: Pick<PropBlock, 'x' | 'y' | 'rotation' | 'blockShape' | 'blockW' | 'blockH' | 'blockDx' | 'blockDy'>): BlockSegment[] {
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
