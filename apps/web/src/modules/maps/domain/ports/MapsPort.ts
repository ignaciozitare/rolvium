import type { TableEvent } from '@rolvium/core';
import type { CreateSceneInput, Drawing, ImageAsset, Layer, LayerPatch, Light, LightPatch, NewDrawing, NewLayer, NewLight, NewToken, NewWall, RowChange, Scene, ScenePatch, Token, TokenPatch, Wall, WallPatch } from '../entities/Scene';

export type Unsubscribe = () => void;

/** Ephemeral events that travel by broadcast on the scene channel (never persisted). */
export type MapsLiveEvent = Extract<TableEvent, { type: 'token.moved' | 'pin.focused' | 'fog.updated' }>;

export interface MapsLiveHandlers {
  onScene?: (change: RowChange<Scene>) => void;
  onToken?: (change: RowChange<Token>) => void;
  onWall?: (change: RowChange<Wall>) => void;
  onDrawing?: (change: RowChange<Drawing>) => void;
  /** Capas de contenido y luces de ambiente (rebanada 7). Un jugador nunca recibe las de «Notas del director». */
  onLayer?: (change: RowChange<Layer>) => void;
  onLight?: (change: RowChange<Light>) => void;
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
  /** DM only: the segment was moved or a vertex stretched with Seleccionar. */
  updateWallGeometry(id: string, at: { x1: number; y1: number; x2: number; y2: number }): Promise<void>;
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
  // layers (rebanada 7) — las escribe SÓLO el director
  listLayers(sceneId: string): Promise<Layer[]>;
  /**
   * DM only. Las tres capas fijas las crea un disparador al nacer la escena, así que por aquí sólo pasan
   * las de TERRENO, que son las únicas sin límite.
   */
  addLayer(input: NewLayer): Promise<Layer>;
  updateLayer(id: string, patch: LayerPatch): Promise<void>;
  /** DM only. Se lleva los dibujos y las luces de esa capa; las FICHAS vuelven a su capa natural. */
  removeLayer(id: string): Promise<void>;
  /**
   * DM only. Sube el PNG de la máscara del pincel a `backgrounds/{campaignId}/masks/{layerId}.png` y deja
   * el puntero + la versión nueva en la fila. La foto original de la capa no se toca nunca.
   */
  saveMask(layer: Pick<Layer, 'id' | 'campaignId' | 'maskVersion'>, png: Blob): Promise<Layer>;
  /** DM only. Quita la máscara: la capa vuelve a ser opaca entera. */
  clearMask(layer: Pick<Layer, 'id' | 'campaignId'>): Promise<void>;

  // lights (rebanada 7) — HOY SON PINTURA: no revelan niebla ni entran en el cálculo de visión
  listLights(sceneId: string): Promise<Light[]>;
  addLight(input: NewLight): Promise<Light>;
  updateLight(id: string, patch: LightPatch): Promise<void>;
  removeLight(id: string): Promise<void>;

  // realtime (channel `scene:{sceneId}` — separate from the table's `campaign:{id}` channel)
  subscribe(sceneId: string, handlers: MapsLiveHandlers): Unsubscribe;
  /** Sends an ephemeral event on the scene channel opened by `subscribe` (no-op if not subscribed). */
  broadcast(sceneId: string, event: MapsLiveEvent): void;
}
