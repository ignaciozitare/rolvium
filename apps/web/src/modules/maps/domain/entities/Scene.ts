/** Maps (H7) — domain entities. Mirrors `maps_*` (supabase/migrations/20260818130000_maps.sql). */

export type FogMode = 'vision' | 'manual' | 'off';
/** Scene light: `day` = only geometry limits sight; `night` = up to `nightRadiusM` metres from each token. */
export type Lighting = 'day' | 'night';
/** Background fit: Cubrir / Encajar / Reposicionar. */
export type BgFit = 'cover' | 'contain' | 'custom';
export interface BgTransform { mode: BgFit; x: number; y: number; scale: number }
export interface GridSettings { size: number; visible: boolean }

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  /** Scene size in px (scene coordinates). */
  width: number;
  height: number;
  bgColor: string;
  bgImageUrl: string | null;
  bgTransform: BgTransform;
  grid: GridSettings;
  fogMode: FogMode;
  lighting: Lighting;
  /** How far one sees at night, in METRES (the unit the table reasons in); px conversion uses the system's metres per cell. */
  nightRadiusM: number;
  sortOrder: number;
  visiblePlayers: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateSceneInput { campaignId: string; name: string; width?: number; height?: number; bgColor?: string; sortOrder?: number }
export type ScenePatch = Partial<Pick<Scene, 'name' | 'width' | 'height' | 'bgColor' | 'bgImageUrl' | 'bgTransform' | 'grid' | 'fogMode' | 'lighting' | 'nightRadiusM' | 'sortOrder' | 'visiblePlayers'>>;

/** What a segment is. The three types collapse into two flags — see `blocksSightNow` / `blocksMoveNow` in mapRules. */
export type WallKind = 'wall' | 'door' | 'window';
/**
 * Wall segment in scene px; players only receive `visiblePlayers` ones (RLS).
 * Semantics (supabase/migrations/20260818140000_maps_vision.sql): cuts sight ⇔ `blocksSight && !isOpen`;
 * cuts movement ⇔ `blocksMove && !isOpen` (no effect until slice 3).
 */
export interface Wall {
  id: string; sceneId: string; campaignId: string;
  x1: number; y1: number; x2: number; y2: number;
  visiblePlayers: boolean;
  kind: WallKind;
  blocksSight: boolean;
  blocksMove: boolean;
  isOpen: boolean;
}
export type NewWall = Omit<Wall, 'id'>;
export type WallPatch = Partial<Pick<Wall, 'visiblePlayers' | 'kind' | 'blocksSight' | 'blocksMove' | 'isOpen'>>;

/** A PC or a bestiary instance. `x`/`y`/`size` are in grid cells (top-left cell). */
export interface Token {
  id: string;
  sceneId: string;
  campaignId: string;
  characterId: string | null;
  bestiaryRef: string | null;
  /**
   * Fila de `bestiary_entries` de la que salió esta instancia, cuando viene de un encuentro PROPIO del
   * director (H5). Las criaturas del manual no tienen fila y siguen viajando en `bestiaryRef`.
   * Se rompe con ON DELETE SET NULL: borrar la plantilla no puede vaciar la escena a mitad de partida.
   */
  bestiaryEntryId: string | null;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  size: number;
  color: string | null;
  visible: boolean;
  /** Player who may move it (besides the DM). */
  controlledBy: string | null;
  visionRadius: number | null;
  state: Record<string, unknown>;
}
export type NewToken = Omit<Token, 'id'>;
export type TokenPatch = Partial<Omit<Token, 'id' | 'sceneId' | 'campaignId'>>;

export type DrawingKind = 'stroke' | 'line' | 'rect' | 'circle' | 'text';
export type DrawingData =
  | { points: [number, number][] }                       // stroke
  | { x1: number; y1: number; x2: number; y2: number }   // line / rect (bbox)
  | { cx: number; cy: number; r: number }                // circle
  | { x: number; y: number; text: string };              // text
export interface Drawing { id: string; sceneId: string; campaignId: string; authorId: string; kind: DrawingKind; data: DrawingData; color: string; width: number; createdAt: string }
export type NewDrawing = Omit<Drawing, 'id' | 'authorId' | 'createdAt'>;

/** Campaign background library entry (bucket `backgrounds/{campaignId}/…`). */
export interface ImageAsset { id: string; campaignId: string; name: string; url: string; createdAt: string }

/** Row-level change coming from realtime. `row` is null on DELETE (only the id travels). */
export interface RowChange<T> { type: 'INSERT' | 'UPDATE' | 'DELETE'; id: string; row: T | null }
