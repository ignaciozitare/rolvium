import { METRES_PER_CELL, sightRadiusPx, type CatalogItem, type FogCell, type VisionPolygon } from '@rolvium/core';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { Drawing, DrawingKind, NewToken, NewWall, Scene, Token, Wall, WallKind } from '../entities/Scene';

export { METRES_PER_CELL } from '@rolvium/core';

/** Pure rules of the scene: coordinates, grid, permissions, hit-tests. No React, no I/O. */

export type Point = { x: number; y: number };
/** Canvas view: scene px → canvas px is `(p * zoom) + pan`. */
export interface View { zoom: number; panX: number; panY: number }
/**
 * `select` replaced `move` in slice 3: choosing and editing is a tool, panning is NOT — it is a modifier
 * (space bar or middle button) so it works from every tool (specs/modules/maps/SPEC.md § «Rebanada 3»).
 */
export type Tool = 'select' | 'measure' | 'pin' | 'pencil' | 'line' | 'rect' | 'circle' | 'text' | 'erase' | 'wall' | 'reveal' | 'hide' | 'encounter';

export const PLAYER_TOOLS: Tool[] = ['select', 'measure', 'pin', 'pencil', 'line', 'rect', 'circle', 'text', 'erase'];
export const DM_TOOLS: Tool[] = ['wall', 'reveal', 'hide', 'encounter'];
/** Tools that exist in the design but not yet in code; the toolbar greys them out. Empty since slice 2 shipped the fog brush. */
export const TOOLS_NOT_YET: Tool[] = [];
/** The reveal/hide brush paints on the fog instead of drawing. */
export const BRUSH_TOOLS: Tool[] = ['reveal', 'hide'];
export const isBrush = (t: Tool): boolean => BRUSH_TOOLS.includes(t);
export const toolsFor = (isDm: boolean): Tool[] => (isDm ? [...PLAYER_TOOLS, ...DM_TOOLS] : PLAYER_TOOLS);

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.25;
export const DEFAULT_GRID = 27;
/** Reveal/hide brush radii in cells (design: four discs on the «Pincel» bar). */
export const BRUSH_SIZES = [1, 2, 3, 4] as const;
export const DEFAULT_BRUSH = 3;

/** Stroke palette (persisted as hex in `maps_drawings.color`, so these are data, not theme). Order = design (paper, gold, blood, olive, steel, ink). */
export const STROKE_COLORS = ['#dedcd5', '#c9a84c', '#b8452c', '#5f8f6a', '#5f6bb3', '#131310'] as const;
export const STROKE_WIDTHS = [1, 2, 4, 6, 8] as const;
/** Base-colour swatches of the background popover (persisted in `maps_scenes.bg_color`). */
export const BG_COLORS = ['#1a1a1a', '#0f0f0f', '#4a4a3e', '#c9c4b4', '#2c3e50', '#3d2b2b', '#e8e4d8'] as const;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function canvasToScene(p: Point, v: View): Point {
  return { x: (p.x - v.panX) / v.zoom, y: (p.y - v.panY) / v.zoom };
}
export function sceneToCanvas(p: Point, v: View): Point {
  return { x: p.x * v.zoom + v.panX, y: p.y * v.zoom + v.panY };
}
/** Zoom by `factor` keeping the canvas point `at` fixed. */
export function zoomAt(v: View, factor: number, at: Point): View {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return { zoom, panX: at.x - (at.x - v.panX) * k, panY: at.y - (at.y - v.panY) * k };
}
/** View that fits the whole scene centred in a viewport. */
export function fitView(scene: Pick<Scene, 'width' | 'height'>, viewport: { width: number; height: number }): View {
  if (viewport.width <= 0 || viewport.height <= 0) return { zoom: 1, panX: 0, panY: 0 };
  const zoom = clampZoom(Math.min(viewport.width / scene.width, viewport.height / scene.height));
  return { zoom, panX: (viewport.width - scene.width * zoom) / 2, panY: (viewport.height - scene.height * zoom) / 2 };
}
/** View centred on a scene point at the current zoom. */
export function centerOn(v: View, p: Point, viewport: { width: number; height: number }): View {
  return { zoom: v.zoom, panX: viewport.width / 2 - p.x * v.zoom, panY: viewport.height / 2 - p.y * v.zoom };
}

// ── grid ─────────────────────────────────────────────────────────────────────
export const snap = (v: number, grid: number): number => Math.round(v / grid) * grid;
/** Scene px → cell (floor). */
export const cellOf = (px: number, grid: number): number => Math.floor(px / grid);
/** Cell of a token centred on a scene point (token top-left in cells). */
export function tokenCellAt(p: Point, grid: number, size = 1): Point {
  return { x: cellOf(p.x, grid) - Math.floor((size - 1) / 2), y: cellOf(p.y, grid) - Math.floor((size - 1) / 2) };
}
export const tokenCenter = (t: Pick<Token, 'x' | 'y' | 'size'>, grid: number): Point => ({ x: (t.x + t.size / 2) * grid, y: (t.y + t.size / 2) * grid });

/** Distance between two scene points in cells (Euclidean). */
export function distanceCells(a: Point, b: Point, grid: number): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / grid;
}
export function distanceLabel(cells: number, metresPerCell = METRES_PER_CELL): { cells: string; metres: string } {
  const c = Math.round(cells * 10) / 10;
  const m = Math.round(cells * metresPerCell * 10) / 10;
  return { cells: String(c), metres: String(m) };
}

// ── permissions / visibility ─────────────────────────────────────────────────
export function canMoveToken(t: Pick<Token, 'controlledBy'>, me: string | null, isDm: boolean): boolean {
  return isDm || (!!me && t.controlledBy === me);
}
export function canEraseDrawing(d: Pick<Drawing, 'authorId'>, me: string | null, isDm: boolean): boolean {
  return isDm || (!!me && d.authorId === me);
}
/** Player sees a scene when flagged visible or when it is the campaign's active one (RLS mirrors this). */
export function sceneVisibleTo(s: Pick<Scene, 'id' | 'visiblePlayers'>, activeSceneId: string | null, isDm: boolean): boolean {
  return isDm || s.visiblePlayers || s.id === activeSceneId;
}
/** Hidden tokens do not exist for players (RLS) — kept here so a stale cache never leaks them. */
export function visibleTokens(tokens: Token[], isDm: boolean, playerView = false): Token[] {
  return isDm && !playerView ? tokens : tokens.filter(t => t.visible);
}

/** Distance from `p` to the segment `a`–`b` (used by the erase and door hit-tests). */
function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ── openings: walls, doors and windows ───────────────────────────────────────
/**
 * The three types of the spec are two flags, so nothing here is a `switch` on `kind`
 * (supabase/migrations/20260818140000_maps_vision.sql):
 *   muro    → sight ✓ move ✓, never opens   · puerta → both, opens · ventana → move only, opens
 * The server applies the same condition to compute vision; this copy only decides how a segment is drawn.
 */
/** Order of the picker in the design (rolvium.pen `h3Q3NN` · Tipo). */
export const WALL_KINDS: WallKind[] = ['wall', 'door', 'window'];
export const WALL_FLAGS: Record<WallKind, Pick<Wall, 'blocksSight' | 'blocksMove'>> = {
  wall: { blocksSight: true, blocksMove: true },
  door: { blocksSight: true, blocksMove: true },
  window: { blocksSight: false, blocksMove: true },
};
/** A brand-new segment of `kind`: the flags always follow the type, never the other way round. */
export const newWallOf = (kind: WallKind): Pick<Wall, 'kind' | 'blocksSight' | 'blocksMove' | 'isOpen'> =>
  ({ kind, ...WALL_FLAGS[kind], isOpen: false });
/** A `wall` is fixed shut; doors and windows can be opened. */
export const canOpen = (w: Pick<Wall, 'kind'>): boolean => w.kind !== 'wall';
export const blocksSightNow = (w: Pick<Wall, 'blocksSight' | 'isOpen'>): boolean => w.blocksSight && !w.isOpen;
/** No movement rules until slice 3 — kept so the invariant lives next to its twin. */
export const blocksMoveNow = (w: Pick<Wall, 'blocksMove' | 'isOpen'>): boolean => w.blocksMove && !w.isOpen;

/** Nearest segment within `tol` scene px of `p` — how the DM picks a door to open. */
export function hitWall(walls: Wall[], p: Point, tol = 8): Wall | null {
  let best: Wall | null = null;
  let bestDist = tol;
  for (const w of walls) {
    const d = segDist(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
    if (d <= bestDist) { best = w; bestDist = d; }
  }
  return best;
}

/** The door or the window under the pointer — what the hover disc opens. A plain wall never answers: it never opens. */
export const hitOpening = (walls: Wall[], p: Point, tol = 8): Wall | null => hitWall(walls.filter(canOpen), p, tol);
/** Middle of a segment: where the open/close disc sits. */
export const midpoint = (w: Segment): Point => ({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 });

/**
 * Where to draw a door's jambs and its swung leaf. `n` is the unit normal of the segment, `d` the unit direction.
 * A closed door is the segment itself plus a jamb tick at each end; an open one keeps the threshold faint and
 * swings a leaf out of one jamb (rolvium.pen `uXK3T` · «Puerta abierta»).
 */
export function openingGeometry(w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>, jamb = 9): { jambA: [Point, Point]; jambB: [Point, Point]; leaf: [Point, Point] } {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1;
  const d = { x: dx / len, y: dy / len };
  const n = { x: -d.y, y: d.x };
  const a = { x: w.x1, y: w.y1 }, b = { x: w.x2, y: w.y2 };
  const tick = (p: Point): [Point, Point] => [{ x: p.x - n.x * jamb, y: p.y - n.y * jamb }, { x: p.x + n.x * jamb, y: p.y + n.y * jamb }];
  return { jambA: tick(a), jambB: tick(b), leaf: [a, { x: a.x + n.x * len, y: a.y + n.y * len }] };
}

/** Endpoints of a segment in scene px — the geometry of a wall without the row around it. */
export interface Segment { x1: number; y1: number; x2: number; y2: number }
/** Leftovers this short are the zero-length ends of a cut: the spec says they are not saved. */
const MIN_PIECE = 0.5;

export interface OpeningPlan {
  /** Where the opening lands: on the host's line when there is a wall underneath, exactly as drawn when there is not. */
  opening: Segment;
  /** The wall the opening was cut out of and what survives of it, or `null` when nothing was underneath. */
  split: { host: Wall; pieces: Segment[] } | null;
}
export type WallSplit = NonNullable<OpeningPlan['split']>;

/**
 * Where a door or a window drawn between `a` and `b` really goes
 * (specs/modules/maps/SPEC.md § «Una puerta dibujada sobre un muro lo parte»).
 *
 * Until now segments simply stacked: a door drawn on a wall left both, the wall went on cutting sight and the
 * door did nothing. Here the overlapped stretch BECOMES the opening and the wall is left as the two leftovers.
 * The opening is projected onto the host's line so it can never sit a hair off — a crooked one would keep the
 * wall cutting sight along its sides, which is the same bug wearing a different hat.
 *
 * A plain wall never cuts anything (you are building, not opening), and neither does an opening drawn over
 * another opening: masonry is what gets holes.
 */
export function planOpening(walls: Wall[], a: Point, b: Point, kind: WallKind, tol = 8): OpeningPlan {
  const opening: Segment = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  if (kind === 'wall' || (a.x === b.x && a.y === b.y)) return { opening, split: null };
  let best: { host: Wall; len: number; s0: number; s1: number; off: number } | null = null;
  for (const host of walls) {
    if (host.kind !== 'wall') continue;
    const dx = host.x2 - host.x1, dy = host.y2 - host.y1;
    const len = Math.hypot(dx, dy);
    if (len < MIN_PIECE) continue;
    const d = { x: dx / len, y: dy / len };
    const along = (q: Point): number => (q.x - host.x1) * d.x + (q.y - host.y1) * d.y;
    const off = (q: Point): number => Math.abs((q.x - host.x1) * -d.y + (q.y - host.y1) * d.x);
    const worst = Math.max(off(a), off(b));
    if (worst > tol) continue;                       // it is not lying ON this wall
    const s0 = Math.max(0, Math.min(along(a), along(b)));
    const s1 = Math.min(len, Math.max(along(a), along(b)));
    if (s1 - s0 <= MIN_PIECE) continue;              // it only grazes an end: nothing to cut
    // Longest overlap wins; between two equal ones, the wall it sits flattest on.
    if (!best || s1 - s0 > best.s1 - best.s0 || (s1 - s0 === best.s1 - best.s0 && worst < best.off)) best = { host, len, s0, s1, off: worst };
  }
  if (!best) return { opening, split: null };
  const { host, len } = best;
  const at = (s: number): Point => ({ x: host.x1 + (host.x2 - host.x1) * (s / len), y: host.y1 + (host.y2 - host.y1) * (s / len) });
  const seg = (from: number, to: number): Segment => { const p = at(from), q = at(to); return { x1: p.x, y1: p.y, x2: q.x, y2: q.y }; };
  // A leftover shorter than MIN_PIECE is not saved, so the OPENING has to take that stub: otherwise dropping it
  // would leave a sub-pixel slit of nothing at the wall's end — a hole, which is exactly what this must never make.
  const from = best.s0 > MIN_PIECE ? best.s0 : 0;
  const to = len - best.s1 > MIN_PIECE ? best.s1 : len;
  const pieces = ([[0, from], [to, len]] as const).filter(([a0, b0]) => b0 > a0).map(([a0, b0]) => seg(a0, b0));
  return { opening: seg(from, to), split: { host, pieces } };
}

/** A leftover of a split keeps everything the host wall was — only its geometry is new. */
export const wallPiece = (host: Wall, at: Segment): NewWall => ({
  sceneId: host.sceneId, campaignId: host.campaignId, visiblePlayers: host.visiblePlayers,
  kind: host.kind, blocksSight: host.blocksSight, blocksMove: host.blocksMove, isOpen: host.isOpen, ...at,
});

// ── fog & vision (drawn from what the API answers; never computed here) ──────
/** `"x,y x,y …"` for an SVG `<polygon points>`. */
export const polygonPoints = (poly: VisionPolygon): string => poly.map(([x, y]) => `${x},${y}`).join(' ');
/** One `<path d>` for a whole set of explored cells — one element instead of a rect per cell. */
export const cellsPath = (cells: FogCell[], grid: number): string =>
  cells.map(([cx, cy]) => `M${cx * grid} ${cy * grid}h${grid}v${grid}h${-grid}z`).join('');
/** Brush radius in scene px for a size taken from `BRUSH_SIZES`. */
export const brushRadius = (size: number, grid: number): number => size * grid;
/** Night sight radius of a scene in scene px, or `null` by day. Same helper the API uses. */
export const sceneRadiusPx = (s: Pick<Scene, 'lighting' | 'nightRadiusM' | 'grid'>): number | null =>
  sightRadiusPx(s.lighting, s.nightRadiusM, s.grid.size);
/** Night radius as a rounded metre label for the light toggle. */
export const nightLabelM = (s: Pick<Scene, 'nightRadiusM'>): string => String(Math.round(s.nightRadiusM * 10) / 10);

// ── hit tests (erase) ────────────────────────────────────────────────────────
/** True when `p` is within `tol` scene px of the drawing's outline (rect/circle: their border; text: its anchor box). */
export function hitDrawing(d: Pick<Drawing, 'kind' | 'data' | 'width'>, p: Point, tol = 6): boolean {
  const tolerance = tol + d.width / 2;
  const data = d.data as Record<string, unknown>;
  if (d.kind === 'stroke') {
    const pts = (data.points as [number, number][] | undefined) ?? [];
    if (pts.length === 1) return Math.hypot(p.x - pts[0]![0], p.y - pts[0]![1]) <= tolerance;
    for (let i = 1; i < pts.length; i++) if (segDist(p, { x: pts[i - 1]![0], y: pts[i - 1]![1] }, { x: pts[i]![0], y: pts[i]![1] }) <= tolerance) return true;
    return false;
  }
  if (d.kind === 'line') return segDist(p, { x: data.x1 as number, y: data.y1 as number }, { x: data.x2 as number, y: data.y2 as number }) <= tolerance;
  if (d.kind === 'rect') {
    const x1 = Math.min(data.x1 as number, data.x2 as number), x2 = Math.max(data.x1 as number, data.x2 as number);
    const y1 = Math.min(data.y1 as number, data.y2 as number), y2 = Math.max(data.y1 as number, data.y2 as number);
    const c = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
    return c.some((a, i) => segDist(p, a, c[(i + 1) % 4]!) <= tolerance);
  }
  if (d.kind === 'circle') return Math.abs(Math.hypot(p.x - (data.cx as number), p.y - (data.cy as number)) - (data.r as number)) <= tolerance;
  const x = data.x as number, y = data.y as number;
  return p.x >= x - tolerance && p.x <= x + 120 && p.y >= y - 16 - tolerance && p.y <= y + tolerance;
}
export function hitTest(drawings: Drawing[], p: Point, tol?: number): Drawing | null {
  for (let i = drawings.length - 1; i >= 0; i--) if (hitDrawing(drawings[i]!, p, tol)) return drawings[i]!;
  return null;
}

/** Shape data of a two-point tool (line/rect/circle) between `a` and `b`. */
export function shapeData(kind: Exclude<DrawingKind, 'stroke' | 'text'>, a: Point, b: Point): Drawing['data'] {
  if (kind === 'circle') return { cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

// ── token factories ──────────────────────────────────────────────────────────
export const initialsOf = (name: string): string => name.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

/** Token from a PC: token image → avatar → owner avatar; the owner controls it. */
export function tokenFromCharacter(c: Character, ownerAvatarUrl: string | null | undefined, sceneId: string, at: Point): NewToken {
  return {
    sceneId, campaignId: c.campaignId, characterId: c.id, bestiaryRef: null, bestiaryEntryId: null, name: c.name,
    imageUrl: c.tokenUrl ?? c.avatarUrl ?? ownerAvatarUrl ?? null, x: at.x, y: at.y, size: 1, color: c.color,
    visible: true, controlledBy: c.ownerId, visionRadius: null, state: {},
  };
}
/**
 * Instancia colocada en la escena desde el bestiario (H5).
 *
 * La Resistencia se copia al `state` del token: es lo que hace que cada ogro se hiera por su cuenta y que la
 * plantilla no se entere. Sin esto, dos ogros compartirían heridas.
 *
 * Dos procedencias, y por eso dos campos: las criaturas del MANUAL no tienen fila y viajan en `bestiaryRef`
 * (id del catálogo); los encuentros PROPIOS del director sí la tienen y viajan en `bestiaryEntryId`, que
 * `toCatalogItem` del bestiario deja en `data.entryId`. `data.tokenUrl` trae su imagen si le pusieron una.
 */
export function tokenFromBestiary(entry: CatalogItem, label: string, campaignId: string, sceneId: string, at: Point): NewToken {
  const state: Record<string, unknown> = {};
  const res = entry.data?.resistance;
  if (typeof res === 'number') state.resistance = res;
  const entryId = entry.data?.entryId;
  const tokenUrl = entry.data?.tokenUrl;
  return {
    sceneId, campaignId, characterId: null,
    // Una entrada propia no es un id de catálogo: si se guardara en `bestiaryRef` nadie sabría distinguirlas.
    bestiaryRef: typeof entryId === 'string' ? null : entry.id,
    bestiaryEntryId: typeof entryId === 'string' ? entryId : null,
    name: label, imageUrl: typeof tokenUrl === 'string' ? tokenUrl : null,
    x: at.x, y: at.y, size: 1, color: null, visible: false, controlledBy: null, visionRadius: null, state,
  };
}

/** Case/diacritics-insensitive filter for the encounter search. */
export function filterEntries<T>(items: T[], query: string, labelOf: (t: T) => string): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query.trim());
  return q ? items.filter(i => norm(labelOf(i)).includes(q)) : items;
}

/**
 * Where a segment lands while it is being dragged with Seleccionar: grabbing an endpoint stretches that end,
 * grabbing anywhere else moves the whole thing. Everything snaps to the grid, like drawing does, so an edited
 * wall keeps lining up with the plan.
 */
export function wallDragTo(
  origin: { x1: number; y1: number; x2: number; y2: number },
  grab: 'a' | 'b' | 'whole',
  from: Point,
  to: Point,
  grid: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (grab === 'a') return { ...origin, x1: snap(origin.x1 + dx, grid), y1: snap(origin.y1 + dy, grid) };
  if (grab === 'b') return { ...origin, x2: snap(origin.x2 + dx, grid), y2: snap(origin.y2 + dy, grid) };
  const sx = snap(origin.x1 + dx, grid) - origin.x1, sy = snap(origin.y1 + dy, grid) - origin.y1;
  return { x1: origin.x1 + sx, y1: origin.y1 + sy, x2: origin.x2 + sx, y2: origin.y2 + sy };
}

/** Tools that put ink on the map: while one is active the «Trazo» bar is the one that shows. */
export const DRAW_TOOLS: Tool[] = ['pencil', 'line', 'rect', 'circle', 'text', 'erase'];
export const isDraw = (t: Tool): boolean => DRAW_TOOLS.includes(t);

/** Normalised rectangle from two dragged corners, in scene px. */
export function rectFrom(a: Point, b: Point): { x: number; y: number; w: number; h: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}
/** Tokens whose centre falls inside the marquee — «mantener pulsado y seleccionar por área». */
export function tokensInRect(tokens: Token[], a: Point, b: Point, grid: number): string[] {
  const r = rectFrom(a, b);
  return tokens.filter(t => {
    const c = tokenCenter(t, grid);
    return c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h;
  }).map(t => t.id);
}
