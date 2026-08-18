import type { TableEvent } from '@rolvium/core';
import type { CreateSceneInput, Drawing, ImageAsset, NewDrawing, NewToken, NewWall, RowChange, Scene, ScenePatch, Token, TokenPatch, Wall, WallPatch } from '../entities/Scene';

export type Unsubscribe = () => void;

/** Ephemeral events that travel by broadcast on the scene channel (never persisted). */
export type MapsLiveEvent = Extract<TableEvent, { type: 'token.moved' | 'pin.focused' | 'fog.updated' }>;

export interface MapsLiveHandlers {
  onScene?: (change: RowChange<Scene>) => void;
  onToken?: (change: RowChange<Token>) => void;
  onWall?: (change: RowChange<Wall>) => void;
  onDrawing?: (change: RowChange<Drawing>) => void;
  /**
   * Token drag in progress · focus pin from another device · `fog.updated` = «what you can see may have changed,
   * ask the server again». That last one MUST travel by broadcast: `postgres_changes` applies each subscriber's
   * RLS, so a player never receives the row of a door they are not allowed to see.
   */
  onEvent?: (event: MapsLiveEvent) => void;
}

/**
 * Maps port. RLS decides what each role gets: the DM everything; players the visible/active scenes,
 * visible tokens, `visible_players` walls, and may only move (x/y) tokens they control.
 */
export interface MapsPort {
  // scenes
  listScenes(campaignId: string): Promise<Scene[]>;
  getScene(id: string): Promise<Scene | null>;
  createScene(input: CreateSceneInput): Promise<Scene>;
  updateScene(id: string, patch: ScenePatch): Promise<void>;
  removeScene(id: string): Promise<void>;
  /** DM only: what the players see (`campaigns.active_scene_id`). */
  setActiveScene(campaignId: string, sceneId: string | null): Promise<void>;
  // background library
  listImages(campaignId: string): Promise<ImageAsset[]>;
  /** DM only: uploads to `backgrounds/{campaignId}/{uuid}.png` and registers the row. */
  uploadImage(campaignId: string, file: Blob, name: string): Promise<ImageAsset>;
  removeImage(id: string): Promise<void>;
  // walls
  listWalls(sceneId: string): Promise<Wall[]>;
  addWall(input: NewWall): Promise<Wall>;
  /** DM only: open/close a door or window, or change what a segment is. */
  updateWall(id: string, patch: WallPatch): Promise<void>;
  removeWall(id: string): Promise<void>;
  // tokens
  listTokens(sceneId: string): Promise<Token[]>;
  addToken(input: NewToken): Promise<Token>;
  /** Players: only `x`/`y` of tokens they control (trigger); DM: anything. */
  updateToken(id: string, patch: TokenPatch): Promise<void>;
  removeToken(id: string): Promise<void>;
  // drawings
  listDrawings(sceneId: string): Promise<Drawing[]>;
  addDrawing(input: NewDrawing): Promise<Drawing>;
  removeDrawing(id: string): Promise<void>;
  /** My strokes in the scene. */
  removeMyDrawings(sceneId: string): Promise<void>;
  /** DM: every stroke in the scene. */
  removeAllDrawings(sceneId: string): Promise<void>;
  // realtime (channel `scene:{sceneId}` — separate from the table's `campaign:{id}` channel)
  subscribe(sceneId: string, handlers: MapsLiveHandlers): Unsubscribe;
  /** Sends an ephemeral event on the scene channel opened by `subscribe` (no-op if not subscribed). */
  broadcast(sceneId: string, event: MapsLiveEvent): void;
}
