import type { CatalogItem } from '@rolvium/core';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { Drawing, DrawingKind, NewToken, Scene, Token } from '../entities/Scene';

/** Pure rules of the scene: coordinates, grid, permissions, hit-tests. No React, no I/O. */

export type Point = { x: number; y: number };
/** Canvas view: scene px → canvas px is `(p * zoom) + pan`. */
export interface View { zoom: number; panX: number; panY: number }
export type Tool = 'move' | 'measure' | 'pin' | 'pencil' | 'line' | 'rect' | 'circle' | 'erase' | 'wall' | 'reveal' | 'hide' | 'encounter';

export const PLAYER_TOOLS: Tool[] = ['move', 'measure', 'pin', 'pencil', 'line', 'rect', 'circle', 'erase'];
export const DM_TOOLS: Tool[] = ['wall', 'reveal', 'hide', 'encounter'];
/** Fog tools arrive with slice 2 (vision computed by the API — specs/modules/maps/SPEC.md). */
export const TOOLS_NOT_YET: Tool[] = ['reveal', 'hide'];
export const toolsFor = (isDm: boolean): Tool[] => (isDm ? [...PLAYER_TOOLS, ...DM_TOOLS] : PLAYER_TOOLS);

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.25;
export const DEFAULT_GRID = 27;
/** Metres per grid cell for the measure tool (Plenilunio plays in metres; 1 cell ≈ 1.5 m). */
export const METRES_PER_CELL = 1.5;

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

// ── hit tests (erase) ────────────────────────────────────────────────────────
function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
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
    sceneId, campaignId: c.campaignId, characterId: c.id, bestiaryRef: null, name: c.name,
    imageUrl: c.tokenUrl ?? c.avatarUrl ?? ownerAvatarUrl ?? null, x: at.x, y: at.y, size: 1, color: c.color,
    visible: true, controlledBy: c.ownerId, visionRadius: null, state: {},
  };
}
/** Token from a system bestiary entry (the bestiary hexagon lands later; `bestiary_ref` keeps the catalog id). */
export function tokenFromBestiary(entry: CatalogItem, label: string, campaignId: string, sceneId: string, at: Point): NewToken {
  const state: Record<string, unknown> = {};
  const res = entry.data?.resistance;
  if (typeof res === 'number') state.resistance = res;
  return { sceneId, campaignId, characterId: null, bestiaryRef: entry.id, name: label, imageUrl: null, x: at.x, y: at.y, size: 1, color: null, visible: false, controlledBy: null, visionRadius: null, state };
}

/** Case/diacritics-insensitive filter for the encounter search. */
export function filterEntries<T>(items: T[], query: string, labelOf: (t: T) => string): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query.trim());
  return q ? items.filter(i => norm(labelOf(i)).includes(q)) : items;
}
