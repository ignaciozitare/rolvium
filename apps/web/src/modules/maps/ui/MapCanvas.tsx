import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { Drawing, DrawingKind, Scene, Token, Wall } from '../domain/entities/Scene';
import { canEraseDrawing, canMoveToken, canvasToScene, distanceCells, distanceLabel, hitTest, shapeData, snap, tokenCellAt, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import type { LiveDrag, LivePin } from './useScene';
import { BackgroundLayer, DrawingShape, GridLayer, TokenGlyph } from './canvasLayers';

export interface StrokeStyle { color: string; width: number }

interface Props {
  scene: Scene;
  tokens: Token[];
  walls: Wall[];
  drawings: Drawing[];
  drags: Record<string, LiveDrag>;
  pin: LivePin | null;
  tool: Tool;
  stroke: StrokeStyle;
  me: string;
  isDm: boolean;
  /** DM «ver como jugador»: hides walls / hidden tokens / DM chrome. */
  playerView: boolean;
  showWalls: boolean;
  view: View;
  onViewChange: (v: View) => void;
  nameOf: (userId: string) => string;
  onDragToken: (id: string, x: number, y: number) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  onAddDrawing: (kind: DrawingKind, data: Drawing['data']) => void;
  onErase: (id: string) => void;
  onAddWall: (a: Point, b: Point) => void;
  onPin: (p: Point) => void;
  /** Encounter / PC placement (cell coordinates); only wired while something is pending. */
  onPlace?: (cell: Point) => void;
  selectedTokenId: string | null;
  onSelectToken: (id: string | null) => void;
}

type Gesture =
  | { kind: 'pan'; start: Point; origin: View }
  | { kind: 'token'; id: string; start: Point; origin: Point; moved: boolean }
  | { kind: 'draw'; tool: DrawTool; start: Point; points: [number, number][]; last: Point }
  | { kind: 'measure' };

type DrawTool = 'stroke' | 'line' | 'rect' | 'circle';
const DRAW_TOOLS: Record<string, DrawTool> = { pencil: 'stroke', line: 'line', rect: 'rect', circle: 'circle' };
const PIN_MS = 2500;

/** SVG scene canvas: background → grid → walls → drawings → tokens → UI (measure · pin · wall draft · selection). Fog arrives in slice 2 (specs/modules/maps/SPEC.md). */
export function MapCanvas(p: Props): JSX.Element {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [localDrag, setLocalDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point } | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [pinShown, setPinShown] = useState<LivePin | null>(null);
  const grid = p.scene.grid.size;
  const dmSight = p.isDm && !p.playerView;

  useEffect(() => {
    if (!p.pin) { setPinShown(null); return; }
    setPinShown(p.pin);
    const id = window.setTimeout(() => setPinShown(null), PIN_MS);
    return () => window.clearTimeout(id);
  }, [p.pin]);
  useEffect(() => { if (p.tool !== 'wall') setWallStart(null); if (p.tool !== 'measure') setMeasure(null); }, [p.tool]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setWallStart(null); setGesture(null); setMeasure(null); p.onSelectToken(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onSelectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const local = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);
  const toScene = useCallback((e: { clientX: number; clientY: number }): Point => canvasToScene(local(e), p.view), [local, p.view]);

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    p.onViewChange(zoomAt(p.view, e.deltaY < 0 ? 1.1 : 1 / 1.1, local(e)));
  };

  const onTokenDown = (tok: Token) => (e: ReactPointerEvent<SVGGElement>) => {
    if (p.tool !== 'move' || e.button !== 0) return;
    e.stopPropagation();
    p.onSelectToken(tok.id);
    if (!canMoveToken(tok, p.me, p.isDm)) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setGesture({ kind: 'token', id: tok.id, start: toScene(e), origin: { x: tok.x, y: tok.y }, moved: false });
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = toScene(e);
    if (e.button === 1 || (e.button === 0 && p.tool === 'move')) {
      p.onSelectToken(null);
      setGesture({ kind: 'pan', start: local(e), origin: p.view });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const draw = DRAW_TOOLS[p.tool];
    if (draw) { setGesture({ kind: 'draw', tool: draw, start: s, points: [[s.x, s.y]], last: s }); svgRef.current?.setPointerCapture?.(e.pointerId); return; }
    switch (p.tool) {
      case 'measure': setMeasure({ a: s, b: s }); setGesture({ kind: 'measure' }); svgRef.current?.setPointerCapture?.(e.pointerId); return;
      case 'pin': p.onPin(s); return;
      case 'erase': { const hit = hitTest(p.drawings, s, 6 / p.view.zoom); if (hit && canEraseDrawing(hit, p.me, p.isDm)) p.onErase(hit.id); return; }
      case 'wall': {
        if (!dmSight) return;
        const q = { x: snap(s.x, grid), y: snap(s.y, grid) };
        if (wallStart) p.onAddWall(wallStart, q);
        setWallStart(q);
        return;
      }
      case 'encounter': if (p.onPlace) p.onPlace(tokenCellAt(s, grid)); return;
      default: return;
    }
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = toScene(e);
    setHover(s);
    if (!gesture) return;
    if (gesture.kind === 'pan') {
      const l = local(e);
      p.onViewChange({ ...gesture.origin, panX: gesture.origin.panX + l.x - gesture.start.x, panY: gesture.origin.panY + l.y - gesture.start.y });
    } else if (gesture.kind === 'token') {
      const x = gesture.origin.x + (s.x - gesture.start.x) / grid, y = gesture.origin.y + (s.y - gesture.start.y) / grid;
      setLocalDrag({ id: gesture.id, x, y });
      if (!gesture.moved) setGesture({ ...gesture, moved: true });
      p.onDragToken(gesture.id, x, y);
    } else if (gesture.kind === 'draw') {
      setGesture(gesture.tool === 'stroke' ? { ...gesture, points: [...gesture.points, [s.x, s.y]], last: s } : { ...gesture, last: s });
    } else if (gesture.kind === 'measure' && measure) {
      setMeasure({ a: measure.a, b: s });
    }
  };

  const onUp = () => {
    if (!gesture) return;
    if (gesture.kind === 'token') {
      if (gesture.moved && localDrag) p.onMoveToken(gesture.id, Math.round(localDrag.x), Math.round(localDrag.y));
      setLocalDrag(null);
    } else if (gesture.kind === 'draw') {
      if (gesture.tool === 'stroke') { if (gesture.points.length > 1) p.onAddDrawing('stroke', { points: gesture.points }); }
      else if (Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 2) p.onAddDrawing(gesture.tool, shapeData(gesture.tool, gesture.start, gesture.last));
    }
    setGesture(null);
  };

  const wallsShown = dmSight ? (p.showWalls ? p.walls : []) : p.walls.filter(w => w.visiblePlayers);
  const tokensShown = dmSight ? p.tokens : p.tokens.filter(tk => tk.visible);
  const draft = gesture?.kind === 'draw' ? { kind: gesture.tool, data: gesture.tool === 'stroke' ? { points: gesture.points } : shapeData(gesture.tool, gesture.start, gesture.last), color: p.stroke.color, width: p.stroke.width } : null;
  const clipId = `mp-clip-${p.scene.id}`;
  const cursor = p.tool === 'move' ? (gesture?.kind === 'pan' ? 'grabbing' : 'grab') : 'crosshair';
  const measured = measure ? distanceLabel(distanceCells(measure.a, measure.b, grid)) : null;

  return (
    <svg ref={svgRef} className="mp-svg" data-tool={p.tool} style={{ cursor }} aria-label={t('maps.canvas.label')} role="application"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} onWheel={onWheel} onContextMenu={e => e.preventDefault()}>
      <defs><clipPath id={clipId}><rect x={0} y={0} width={p.scene.width} height={p.scene.height} /></clipPath></defs>
      <g transform={`translate(${p.view.panX} ${p.view.panY}) scale(${p.view.zoom})`}>
        <BackgroundLayer scene={p.scene} clipId={clipId} />
        <GridLayer scene={p.scene} patternId={`mp-grid-${p.scene.id}`} />
        <g className="mp-layer-walls" data-testid="mp-walls">
          {wallsShown.map(w => <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={`mp-wall ${w.visiblePlayers ? 'visible' : ''}`} data-wall-id={w.id} />)}
          {wallStart && hover && p.tool === 'wall' && <line x1={wallStart.x} y1={wallStart.y} x2={snap(hover.x, grid)} y2={snap(hover.y, grid)} className="mp-wall draft" />}
        </g>
        <g className="mp-layer-drawings" data-testid="mp-drawings">
          {p.drawings.map(d => <DrawingShape key={d.id} d={d} />)}
          {draft && <DrawingShape d={draft} draft />}
        </g>
        {/* TODO(slice 2): fog layer — per-player explored polygons + vision from the API (specs/modules/maps/SPEC.md). */}
        <g className="mp-layer-tokens" data-testid="mp-tokens">
          {tokensShown.map(tk => {
            const ov = localDrag?.id === tk.id ? localDrag : p.drags[tk.id] ?? null;
            return <TokenGlyph key={tk.id} token={tk} grid={grid} override={ov} selected={p.selectedTokenId === tk.id} movable={p.tool === 'move' && canMoveToken(tk, p.me, p.isDm)}
              label={t('maps.canvas.token', { name: tk.name })} hiddenLabel={t('maps.canvas.hidden')} onPointerDown={onTokenDown(tk)} />;
          })}
        </g>
        <g className="mp-layer-ui">
          {measure && measured && (
            <g className="mp-measure" data-testid="mp-measure">
              <line x1={measure.a.x} y1={measure.a.y} x2={measure.b.x} y2={measure.b.y} />
              <circle cx={measure.a.x} cy={measure.a.y} r={3} /><circle cx={measure.b.x} cy={measure.b.y} r={3} />
              <text x={(measure.a.x + measure.b.x) / 2} y={(measure.a.y + measure.b.y) / 2 - 8} textAnchor="middle">{t('maps.canvas.measure', { cells: measured.cells, m: measured.metres })}</text>
            </g>
          )}
          {pinShown && (
            <g className="mp-pin" transform={`translate(${pinShown.x} ${pinShown.y})`} data-testid="mp-pin" aria-label={t('maps.canvas.pin', { name: p.nameOf(pinShown.by) })}>
              <circle r={14} className="mp-pin-ring" /><circle r={4} className="mp-pin-dot" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
