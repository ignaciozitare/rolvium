import type { FogCell } from '@rolvium/core';

/** The scene as the server needs it: light, grid and size. Mirrors `maps_scenes`. */
export interface SceneRecord {
  id: string;
  campaignId: string;
  width: number;
  height: number;
  gridSize: number;
  fogMode: 'vision' | 'manual' | 'off';
  lighting: 'day' | 'night';
  nightRadiusM: number;
}

/**
 * A wall segment as stored. The three types of the spec collapse into one condition:
 * it blocks sight ⇔ `blocksSight && !isOpen`. `blocksMove` is stored but unused until slice 3.
 */
export interface WallRecord { id: string; x1: number; y1: number; x2: number; y2: number; blocksSight: boolean; blocksMove: boolean; isOpen: boolean }

/**
 * Only what vision needs from a token: where it stands and who controls it.
 * Deliberately NOT `visible`: sight follows control, not visibility. A token the DM hid is hidden from the
 * others, not from its own player, and a hidden bestiary token has no `controlledBy` so it never sees anything.
 */
export interface TokenRecord { id: string; x: number; y: number; size: number; controlledBy: string | null }

export type TableRole = 'dm' | 'player';

/** Read side of `maps_*` with the service role: the server sees every wall, which is the whole point. */
export interface IMapsRepository {
  getScene(sceneId: string): Promise<SceneRecord | null>;
  /** Every wall of the scene, hidden ones included. */
  listWalls(sceneId: string): Promise<WallRecord[]>;
  listTokens(sceneId: string): Promise<TokenRecord[]>;
  /** The caller's table role, or `null` when they are not a member of the campaign. */
  roleOf(campaignId: string, userId: string): Promise<TableRole | null>;
  /** Members with the `player` table role — who the DM's brush paints on. */
  listPlayerIds(campaignId: string): Promise<string[]>;
  getExplored(sceneId: string, userId: string): Promise<FogCell[]>;
  /** Every player's explored cells in the scene, for the DM's union. */
  listExplored(sceneId: string): Promise<FogCell[][]>;
  saveExplored(sceneId: string, campaignId: string, userId: string, cells: FogCell[]): Promise<void>;
}
