import type { Drawing, Scene, Token } from '../domain/entities/Scene';
import { initialsOf, tokenCenter } from '../domain/useCases/mapRules';

/** Presentational SVG pieces of the canvas (no pointer logic) — see MapCanvas.tsx. */

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
