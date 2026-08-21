import type { SceneVision } from '@rolvium/core';
import type { Drawing, Scene, Token, Wall } from '../domain/entities/Scene';
import { cellsPath, initialsOf, openingGeometry, polygonPoints, tokenCenter } from '../domain/useCases/mapRules';

/** Presentational SVG pieces of the canvas (no pointer logic) — see MapCanvas.tsx. */

/**
 * Luminance values of an SVG `<mask>`, NOT colours: white = fully opaque, black = fully transparent.
 * They are the only place in the app where pure white is correct — a design token would be off-white and
 * would leak a few per cent of fog into what should be plainly visible. `npm run audit` flags them as
 * `design:#fff` warnings; this is the justification.
 */
const MASK_SHOW = '#ffffff';
const MASK_HIDE = '#000000';

export function BackgroundLayer({ scene, clipId }: { scene: Scene; clipId: string }): JSX.Element {
  const { width, height, bgColor, bgImageUrl, bgTransform: tr } = scene;
  return (
    <g className="mp-layer-bg" clipPath={`url(#${clipId})`}>
      <rect x={0} y={0} width={width} height={height} fill={bgColor} data-testid="mp-bg" />
      {bgImageUrl && tr.mode !== 'custom' && (
        <image href={bgImageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio={tr.mode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'} data-testid="mp-bg-image" />
      )}
      {bgImageUrl && tr.mode === 'custom' && (
        <image href={bgImageUrl} x={tr.x} y={tr.y} width={width * tr.scale} height={height * tr.scale} preserveAspectRatio="xMinYMin meet" data-testid="mp-bg-image" />
      )}
    </g>
  );
}

export function GridLayer({ scene, patternId }: { scene: Scene; patternId: string }): JSX.Element | null {
  if (!scene.grid.visible) return null;
  const g = scene.grid.size;
  return (
    <>
      <defs><pattern id={patternId} width={g} height={g} patternUnits="userSpaceOnUse"><path d={`M ${g} 0 L 0 0 0 ${g}`} className="mp-grid-line" fill="none" /></pattern></defs>
      <rect x={0} y={0} width={scene.width} height={scene.height} fill={`url(#${patternId})`} data-testid="mp-grid" />
    </>
  );
}

export function DrawingShape({ d, draft = false }: { d: Pick<Drawing, 'kind' | 'data' | 'color' | 'width'> & { id?: string }; draft?: boolean }): JSX.Element | null {
  const data = d.data as Record<string, unknown>;
  const common = { stroke: d.color, strokeWidth: d.width, fill: 'none', className: `mp-drawing ${draft ? 'draft' : ''}`, 'data-drawing-id': d.id, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (d.kind) {
    case 'stroke': {
      const pts = (data.points as [number, number][]) ?? [];
      if (pts.length === 1) return <circle cx={pts[0]![0]} cy={pts[0]![1]} r={d.width / 2} fill={d.color} className={common.className} data-drawing-id={d.id} />;
      return <polyline points={pts.map(p => p.join(',')).join(' ')} {...common} />;
    }
    case 'line': return <line x1={data.x1 as number} y1={data.y1 as number} x2={data.x2 as number} y2={data.y2 as number} {...common} />;
    case 'rect': {
      const x1 = data.x1 as number, y1 = data.y1 as number, x2 = data.x2 as number, y2 = data.y2 as number;
      return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} {...common} />;
    }
    case 'circle': return <circle cx={data.cx as number} cy={data.cy as number} r={data.r as number} {...common} />;
    case 'text': return <text x={data.x as number} y={data.y as number} fill={d.color} className="mp-drawing mp-drawing-text" data-drawing-id={d.id}>{String(data.text ?? '')}</text>;
    default: return null;
  }
}

interface TokenProps { token: Token; grid: number; override?: { x: number; y: number } | null; selected: boolean; movable: boolean; label: string; hiddenLabel: string; onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void }
export function TokenGlyph({ token, grid, override, selected, movable, label, hiddenLabel, onPointerDown }: TokenProps): JSX.Element {
  const pos = override ?? token;
  const c = tokenCenter({ ...pos, size: token.size }, grid);
  const r = (token.size * grid) / 2 - 1.5;
  const clip = `mp-tok-${token.id}`;
  return (
    <g className={`mp-token ${token.visible ? '' : 'hidden'} ${selected ? 'selected' : ''} ${movable ? 'movable' : ''}`} transform={`translate(${c.x} ${c.y})`}
      data-token-id={token.id} role="img" aria-label={`${label}${token.visible ? '' : ` (${hiddenLabel})`}`} onPointerDown={onPointerDown} tabIndex={-1}>
      {token.imageUrl && <clipPath id={clip}><circle r={r - 1} /></clipPath>}
      <circle r={r} className="mp-token-fill" style={token.color ? { fill: token.color } : undefined} />
      {token.imageUrl
        ? <image href={token.imageUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        : <text className="mp-token-initials" textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(8, r * 0.85) }}>{initialsOf(token.name)}</text>}
      <circle r={r} className="mp-token-ring" style={token.color && token.visible ? { stroke: token.color } : undefined} />
      {selected && <circle r={r + 4} className="mp-token-sel" />}
      <text className="mp-token-name" y={r + 11} textAnchor="middle">{token.name}</text>
    </g>
  );
}

/**
 * A wall segment. `wall` is a plain gold line; a closed door adds a dark core between two jambs; an open one
 * keeps the threshold faint and swings its leaf out; a window is steel and never cuts sight
 * (rolvium.pen `uXK3T` · Muro / Puerta cerrada / Puerta abierta / Ventana).
 */
export function WallShape({ wall, selected = false, draft = null }: { wall: Wall; selected?: boolean; draft?: { x1: number; y1: number; x2: number; y2: number } | null }): JSX.Element {
  const line = draft ?? { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
  const cls = `mp-wall ${wall.kind} ${wall.isOpen ? 'open' : ''} ${wall.visiblePlayers ? 'visible' : ''} ${selected ? 'selected' : ''}`;
  if (wall.kind === 'wall') return <line {...line} className={cls} data-wall-id={wall.id} data-wall-kind={wall.kind} />;
  const g = openingGeometry(line);
  return (
    <g className={`mp-opening ${wall.kind} ${wall.isOpen ? 'open' : ''} ${selected ? 'selected' : ''}`} data-wall-id={wall.id} data-wall-kind={wall.kind} data-open={wall.isOpen ? 'true' : 'false'}>
      <line {...line} className={cls} />
      {wall.kind === 'door' && !wall.isOpen && <line {...line} className="mp-wall-core" />}
      {wall.kind === 'door' && wall.isOpen && <line x1={g.leaf[0].x} y1={g.leaf[0].y} x2={g.leaf[1].x} y2={g.leaf[1].y} className="mp-wall-leaf" />}
      <line x1={g.jambA[0].x} y1={g.jambA[0].y} x2={g.jambA[1].x} y2={g.jambA[1].y} className="mp-wall-jamb" />
      <line x1={g.jambB[0].x} y1={g.jambB[0].y} x2={g.jambB[1].x} y2={g.jambB[1].y} className="mp-wall-jamb" />
    </g>
  );
}

interface FogProps { scene: Scene; fog: SceneVision; ids: { seen: string; lit: string; dim: string; unexplored: string } }

/**
 * Lo BORROSO que es el borde de la niebla, en px de escena.
 *
 * Existe por dos quejas del dueño el 2026-08-22, que resultaron ser la misma cosa:
 *  - «el borde de la niebla, a cuadros»: lo YA EXPLORADO se guarda por casillas, así que su contorno es una
 *    escalera de 27 px. Difuminarlo la deshace sin cambiar cómo se guarda.
 *  - «si es de noche que la visión sea más corta pero que no termine de manera abrupta, sino con un fade»:
 *    de noche la visión se recorta contra un círculo, y ese corte es una cuchillada.
 *
 * Por eso son DOS valores: de día el borde lo ponen los muros y sólo hay que quitarle la escalera a lo
 * explorado, así que basta un pelín; de noche el corte es el del alcance de la luz, que en el mundo real se
 * apaga poco a poco. Se difumina la MÁSCARA, no el mapa: lo que se ve sigue nítido, lo que se difumina es
 * dónde deja de verse.
 */
export const FOG_FEATHER = { day: 5, night: 22 } as const;
export const fogFeather = (lighting: Scene['lighting']): number => (lighting === 'night' ? FOG_FEATHER.night : FOG_FEATHER.day);

/**
 * The masks the fog is painted with. Everything comes from the API — this only turns polygons and cells into SVG.
 *
 * `seen` = explored ∪ current vision (what exists at all for a player) · `lit` = current vision only (tokens) ·
 * `dim` = everything but the current vision (darkens the remembered part) · `unexplored` = the DM's blue veil.
 */
export function FogMasks({ scene, fog, ids }: FogProps): JSX.Element {
  const cells = cellsPath(fog.explored, scene.grid.size);
  const full = { x: 0, y: 0, width: scene.width, height: scene.height };
  const polys = fog.vision.map((poly, i) => <polygon key={i} points={polygonPoints(poly)} fill={MASK_SHOW} />);
  const feather = fogFeather(scene.lighting);
  const blurId = `${ids.seen}-feather`;
  const blur = `url(#${blurId})`;
  /**
   * Las máscaras se pintan con MARGEN (`-feather*3`) y no justo en el borde de la escena: un desenfoque sobre
   * un rectángulo que acaba en el filo se come su propio borde y deja el mapa con una orla apagada por los
   * cuatro lados. Con margen, el degradado sólo aparece donde de verdad hay un borde de niebla.
   */
  const pad = feather * 3;
  const wide = { x: -pad, y: -pad, width: scene.width + pad * 2, height: scene.height + pad * 2 };
  return (
    <>
      <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox">
        <feGaussianBlur stdDeviation={feather} />
      </filter>
      <mask id={ids.seen} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_HIDE} />
        <g filter={blur}>
          {cells && <path d={cells} fill={MASK_SHOW} />}
          {polys}
        </g>
      </mask>
      <mask id={ids.lit} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_HIDE} />
        <g filter={blur}>{polys}</g>
      </mask>
      <mask id={ids.dim} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_SHOW} />
        <g filter={blur}>
          {fog.vision.map((poly, i) => <polygon key={i} points={polygonPoints(poly)} fill={MASK_HIDE} />)}
        </g>
      </mask>
      <mask id={ids.unexplored} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_SHOW} />
        <g filter={blur}>{cells && <path d={cells} fill={MASK_HIDE} />}</g>
      </mask>
    </>
  );
}
