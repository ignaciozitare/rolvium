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
  /** Paredes sólidas: si un token puede atravesar un muro en esta escena (rebanada 4). */
  solidWalls: boolean;
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

/**
 * Una luz de la escena, con lo justo para saber qué alumbra: forma, alcance y si se corta contra los muros.
 * Ni color ni parpadeo — eso es pintura y no cambia la geometría.
 */
export interface LightRecord {
  id: string;
  /** `null` = la capa natural de su tipo, igual que en la base de datos. */
  layerId: string | null;
  x: number; y: number; rotation: number;
  shape: 'cone' | 'radius' | 'square';
  coneAngle: number;
  /** Alcance en METROS, como se guarda; a px lo pasa `sightRadiusPx` con la rejilla de la escena. */
  rangeM: number;
  castsShadow: boolean;
}

/**
 * Una capa, con lo justo para saber si lo que vive en ella se pinta. El ojo de Photoshop (`visible`) apaga
 * la capa para TODOS; `dm_notes` sólo se le pinta al director.
 */
export interface LayerRecord { id: string; kind: 'terrain' | 'objects' | 'creatures' | 'dm_notes'; visible: boolean }

export type TableRole = 'dm' | 'player';

/** Read side of `maps_*` with the service role: the server sees every wall, which is the whole point. */
export interface IMapsRepository {
  getScene(sceneId: string): Promise<SceneRecord | null>;
  /** Every wall of the scene, hidden ones included. */
  listWalls(sceneId: string): Promise<WallRecord[]>;
  listTokens(sceneId: string): Promise<TokenRecord[]>;
  /** Toda luz de la escena, también las de una capa apagada o de notas del director: filtrar es del caso de uso. */
  listLights(sceneId: string): Promise<LightRecord[]>;
  /** Las capas de la escena, para saber qué se pinta y qué no. */
  listLayers(sceneId: string): Promise<LayerRecord[]>;
  /** The caller's table role, or `null` when they are not a member of the campaign. */
  roleOf(campaignId: string, userId: string): Promise<TableRole | null>;
  /** Members with the `player` table role — who the DM's brush paints on. */
  listPlayerIds(campaignId: string): Promise<string[]>;
  getExplored(sceneId: string, userId: string): Promise<FogCell[]>;
  /** Every player's explored cells in the scene, for the DM's union. */
  listExplored(sceneId: string): Promise<FogCell[][]>;
  saveExplored(sceneId: string, campaignId: string, userId: string, cells: FogCell[]): Promise<void>;
}
