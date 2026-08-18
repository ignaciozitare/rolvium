import { sightRadiusPx, type FogCell, type SceneVision, type VisionPolygon } from '@rolvium/core';
import type { IMapsRepository, SceneRecord, TokenRecord, WallRecord } from '../../domain/maps/IMapsRepository.js';
import { allCells, boundsSegments, cellsInDisc, cellsInPolygons, subtractCells, unionCells, visionPolygon, type Point, type Segment } from './vision.js';

export type VisionErrorCode = 'NOT_FOUND' | 'FORBIDDEN';
export type VisionOutcome = { ok: true; data: SceneVision } | { ok: false; code: VisionErrorCode };

interface Deps { maps: IMapsRepository }

/** Blocking geometry: the scene's own walls plus its four sides, so no ray escapes the map. */
export function sightSegments(walls: WallRecord[], scene: Pick<SceneRecord, 'width' | 'height'>): Segment[] {
  const blocking = walls
    .filter(w => w.blocksSight && !w.isOpen)
    .map(w => ({ a: { x: w.x1, y: w.y1 }, b: { x: w.x2, y: w.y2 } }));
  return [...blocking, ...boundsSegments(scene.width, scene.height)];
}

/** Centre of a token in scene px (`x`/`y` are the top-left cell). */
export const tokenOrigin = (t: Pick<TokenRecord, 'x' | 'y' | 'size'>, grid: number): Point =>
  ({ x: (t.x + t.size / 2) * grid, y: (t.y + t.size / 2) * grid });

/** The tokens whose eyes a viewer looks through: the ones they control. The DM does not need any — they see all. */
export const tokensOf = (tokens: TokenRecord[], userId: string): TokenRecord[] => tokens.filter(t => t.controlledBy === userId);

/**
 * Recomputes what `userId` can see in the scene and remembers it.
 *
 * A player gets one polygon per token they control plus their own explored cells, which grow with what they just saw.
 * The DM gets no polygon (they see the whole map) and the union of what every player has explored.
 * `manual` fog computes nothing — only the DM's brush reveals. `off` reveals the whole scene.
 */
export async function computeSceneVision(deps: Deps, input: { sceneId: string; userId: string }): Promise<VisionOutcome> {
  const scene = await deps.maps.getScene(input.sceneId);
  if (!scene) return { ok: false, code: 'NOT_FOUND' };
  const role = await deps.maps.roleOf(scene.campaignId, input.userId);
  if (!role) return { ok: false, code: 'FORBIDDEN' };

  const radiusPx = sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize);

  if (role === 'dm') {
    const rows = await deps.maps.listExplored(scene.id);
    return { ok: true, data: { vision: [], explored: unionCells(...rows), radiusPx } };
  }

  const stored = await deps.maps.getExplored(scene.id, input.userId);
  if (scene.fogMode === 'off') {
    return { ok: true, data: { vision: [], explored: allCells(scene.gridSize, scene.width, scene.height), radiusPx } };
  }
  if (scene.fogMode === 'manual') return { ok: true, data: { vision: [], explored: stored, radiusPx } };

  const [walls, tokens] = await Promise.all([deps.maps.listWalls(scene.id), deps.maps.listTokens(scene.id)]);
  const segments = sightSegments(walls, scene);
  const vision: VisionPolygon[] = tokensOf(tokens, input.userId)
    .map(t => visionPolygon(tokenOrigin(t, scene.gridSize), segments, radiusPx ?? Infinity))
    .filter(p => p.length >= 3);

  const explored = unionCells(stored, cellsInPolygons(vision, scene.gridSize, scene.width, scene.height));
  if (explored.length !== stored.length) await deps.maps.saveExplored(scene.id, scene.campaignId, input.userId, explored);
  return { ok: true, data: { vision, explored, radiusPx } };
}

export interface PaintInput {
  sceneId: string;
  userId: string;
  op: 'reveal' | 'hide';
  /** Brush centre in scene px + radius in scene px. Omitted when `all` is set. */
  at?: { x: number; y: number; radius: number };
  /** «Revelar todo» / «Ocultar todo» for the whole scene. */
  all?: boolean;
}

/**
 * The DM's brush. Writes on the explored cells of EVERY player of the campaign at once (spec: «pinta sobre lo
 * explorado de todos los jugadores»), and answers with the DM's union so their veil updates in the same round trip.
 */
export async function paintSceneFog(deps: Deps, input: PaintInput): Promise<VisionOutcome> {
  const scene = await deps.maps.getScene(input.sceneId);
  if (!scene) return { ok: false, code: 'NOT_FOUND' };
  const role = await deps.maps.roleOf(scene.campaignId, input.userId);
  if (role !== 'dm') return { ok: false, code: 'FORBIDDEN' };

  const painted: FogCell[] = input.all
    ? allCells(scene.gridSize, scene.width, scene.height)
    : input.at
      ? cellsInDisc(input.at, input.at.radius, scene.gridSize, scene.width, scene.height)
      : [];

  const players = await deps.maps.listPlayerIds(scene.campaignId);
  const next = await Promise.all(players.map(async playerId => {
    const current = await deps.maps.getExplored(scene.id, playerId);
    const cells = input.op === 'reveal' ? unionCells(current, painted) : subtractCells(current, painted);
    if (cells.length !== current.length) await deps.maps.saveExplored(scene.id, scene.campaignId, playerId, cells);
    return cells;
  }));

  return { ok: true, data: { vision: [], explored: unionCells(...next), radiusPx: sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize) } };
}
