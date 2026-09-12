import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_DOOR } from '../domain/entities/Scene';
import type { BgTransform, BlockShape, CreateSceneInput, MapColor, DoorSettings, Drawing, DrawingData, DrawingKind, FogMode, GridSettings, ImageAsset, Layer, LayerKind, LayerPatch, Light, LightKind, LightPatch, LightShape, Lighting, NewDrawing, NewLayer, NewLight, NewProp, NewRoom, NewRoomOpening, NewSceneProp, NewToken, NewWall, Prop, PropCategory, PropPatch, Room, RoomKind, RoomOpening, RoomPreset, RoomShapeKind, Texture, TextureCategory, NewTexture, TexturePatch, RowChange, Scene, ScenePatch, SceneProp, ScenePropPatch, Token, TokenPatch, Wall, WallKind, WallPatch } from '../domain/entities/Scene';
import type { MapsLiveEvent, MapsLiveHandlers, MapsPort, RoomOpeningPatch, Unsubscribe } from '../domain/ports/MapsPort';
import { clampHardness, clampMaskSize, clampRoughness, clampStrength, DEFAULT_BRUSH_ROUGHNESS, DEFAULT_BRUSH_TIP, DEFAULT_MASK_HARDNESS, DEFAULT_MASK_SIZE, DEFAULT_MASK_STRENGTH, isBrushTip, maskPath, roomMaskPath } from '../domain/useCases/layerRules';
import { TOKEN_SCALE } from '../domain/useCases/mapRules';
import { DEFAULT_BAND_ROUGHNESS, DEFAULT_BAND_TIP, isBandTip } from '../domain/useCases/roomRules';
import { propPath } from '../domain/useCases/propRules';
import { layerPaintPath, rockPaintPath, roomPaintPath } from '../domain/useCases/paintRules';

interface SceneRow { id: string; campaign_id: string; name: string; width: number; height: number; bg_color: string; bg_image_url: string | null; bg_transform: BgTransform; grid: GridSettings; fog_mode: FogMode; lighting: Lighting; night_radius_m: number; solid_walls: boolean; sort_order: number; visible_players: boolean; /* rebanada 8 — opcionales a propósito: una fila escrita antes de la migración no las trae, y el mapeador ya las defiende con su valor de serie */ room_preset?: RoomPreset; wall_texture_url?: string | null; floor_texture_url?: string | null; wall_thickness?: number; wall_texture_scale?: number; floor_texture_scale?: number; wall_texture_rotation?: number; floor_texture_rotation?: number; door_color?: string | null; door_texture_url?: string | null; token_scale?: number; /* rebanada 9 — el pincel de la escena, opcionales por lo mismo */ brush_tip?: string; brush_size?: number; brush_strength?: number; brush_hardness?: number; brush_roughness?: number; /* rebanada 10 B — la punta de «A pulso», opcionales por lo mismo */ band_tip?: string; band_roughness?: number; /* rebanada 10 — la pintura de la roca, opcional por lo mismo */ rock_paint_url?: string | null; created_at: string; updated_at: string }
interface WallRow { id: string; scene_id: string; campaign_id: string; x1: number; y1: number; x2: number; y2: number; visible_players: boolean; kind: WallKind; blocks_sight: boolean; blocks_move: boolean; is_open: boolean; group_id: string | null; /* las puertas, de verdad — opcionales a propósito: una fila anterior a la migración no las trae y `mapDoorRow` la defiende con DEFAULT_DOOR */ leaves?: number | null; hinge?: string | null; swing?: string | null; door_color?: string | null; door_texture_url?: string | null }
interface TokenRow { id: string; scene_id: string; campaign_id: string; character_id: string | null; bestiary_ref: string | null; bestiary_entry_id: string | null; name: string; image_url: string | null; x: number; y: number; size: number; color: string | null; visible: boolean; controlled_by: string | null; vision_radius: number | null; state: Record<string, unknown>; layer_id: string | null }
interface DrawingRow { id: string; scene_id: string; campaign_id: string; author_id: string; kind: DrawingKind; data: DrawingData; color: string; width: number; created_at: string; layer_id: string | null }
interface LayerRow { id: string; scene_id: string; campaign_id: string; kind: LayerKind; name: string; sort_order: number; visible: boolean; locked: boolean; image_url: string | null; transform: BgTransform; mask_url: string | null; mask_version: number; /* rebanada 10 — la pintura, opcional a propósito: una capa anterior a la migración no la trae */ paint_url?: string | null; paint_version?: number; created_at: string; updated_at: string }
interface LightRow { id: string; scene_id: string; campaign_id: string; layer_id: string | null; shape: LightShape; kind: LightKind; x: number; y: number; rotation: number; cone_angle: number; color: string; flicker: boolean; range_m: number; casts_shadow: boolean; spin_ms: number; intensity: number; created_at: string; updated_at: string }
interface RoomRow { id: string; scene_id: string; campaign_id: string; kind?: RoomKind; shape: RoomShapeKind; points: [number, number][]; floor_preset: RoomPreset; floor_url: string | null; floor_mask_url?: string | null; /* rebanada 10 — opcional por lo mismo: una forma anterior al pincel no trae color propio ni pintura */ floor_color?: string | null; floor_paint_url?: string | null; created_at: string; updated_at: string }
/** Espejo de `maps_colors` (rebanada 10): los colores que él mezcla, por campaña. */
interface ColorRow { id: string; campaign_id: string; color: string; created_at: string }
interface RoomOpeningRow { id: string; scene_id: string; campaign_id: string; x1: number; y1: number; x2: number; y2: number; kind: 'door' | 'window'; is_open: boolean; /* las puertas, de verdad — opcionales a propósito: una fila anterior a la migración no las trae y `mapDoorRow` la defiende con DEFAULT_DOOR */ leaves?: number | null; hinge?: string | null; swing?: string | null; door_color?: string | null; door_texture_url?: string | null }
interface ImageRow { id: string; campaign_id: string; name: string; url: string; created_at: string }
interface TextureRow { id: string; name: string; category: TextureCategory; url: string; tile_cells: number; uploaded_by: string | null; created_at: string; updated_at: string }
interface PropRow { id: string; campaign_id: string | null; name: string; category: PropCategory; image_url: string; natural_width: number; natural_height: number; default_scale: number; default_blocks_sight: boolean; default_blocks_move: boolean; default_block_shape: BlockShape; uploaded_by: string | null; created_at: string; updated_at: string }
interface ScenePropRow { id: string; scene_id: string; campaign_id: string; layer_id: string | null; prop_id: string | null; image_url: string; name: string; x: number; y: number; width: number; height: number; rotation: number; blocks_sight: boolean; blocks_move: boolean; block_shape: BlockShape; block_w: number; block_h: number; block_dx: number; block_dy: number; created_at: string; updated_at: string }

const SCENE_COLS = 'id, campaign_id, name, width, height, bg_color, bg_image_url, bg_transform, grid, fog_mode, lighting, night_radius_m, solid_walls, sort_order, visible_players, room_preset, wall_texture_url, floor_texture_url, wall_thickness, wall_texture_scale, floor_texture_scale, wall_texture_rotation, floor_texture_rotation, door_color, door_texture_url, token_scale, brush_tip, brush_size, brush_strength, brush_hardness, brush_roughness, band_tip, band_roughness, rock_paint_url, created_at, updated_at';
const ROOM_COLS = 'id, scene_id, campaign_id, kind, shape, points, floor_preset, floor_url, floor_color, floor_mask_url, floor_paint_url, created_at, updated_at';
const COLOR_COLS = 'id, campaign_id, color, created_at';
/**
 * El choque contra el índice único de `maps_colors`. Se mira el MENSAJE y no un código porque el cliente de
 * Supabase devuelve un error de forma libre; el mensaje de Postgres para un duplicado siempre lo dice así.
 */
const UNIQUE_VIOLATION = /duplicate key|23505/i;
const ROOM_OPENING_COLS = 'id, scene_id, campaign_id, x1, y1, x2, y2, kind, is_open, leaves, hinge, swing, door_color, door_texture_url';
const TEXTURE_COLS = 'id, name, category, url, tile_cells, uploaded_by, created_at, updated_at';
/** Espejo de la migración: una escena de antes de la rebanada 8 se lee con el preajuste y el grosor de serie. */
const DEFAULT_ROOM_PRESET: RoomPreset = 'hatch';
const DEFAULT_WALL_THICKNESS = 0.22;
/** Un azulejo grande, que es lo que menos sorprende al subir una foto cualquiera. En CASILLAS. */
const DEFAULT_TEXTURE_SCALE = 4;
const WALL_COLS = 'id, scene_id, campaign_id, x1, y1, x2, y2, visible_players, kind, blocks_sight, blocks_move, is_open, group_id, leaves, hinge, swing, door_color, door_texture_url';
/** Defaults mirror the migration, so a row written before slice 2 still reads as a plain closed wall. */
const DEFAULT_NIGHT_RADIUS_M = 10;
const TOKEN_COLS = 'id, scene_id, campaign_id, character_id, bestiary_ref, bestiary_entry_id, name, image_url, x, y, size, color, visible, controlled_by, vision_radius, state, layer_id';
const DRAWING_COLS = 'id, scene_id, campaign_id, author_id, kind, data, color, width, created_at, layer_id';
const LAYER_COLS = 'id, scene_id, campaign_id, kind, name, sort_order, visible, locked, image_url, transform, mask_url, mask_version, paint_url, paint_version, created_at, updated_at';
const LIGHT_COLS = 'id, scene_id, campaign_id, layer_id, shape, kind, x, y, rotation, cone_angle, color, flicker, range_m, casts_shadow, spin_ms, intensity, created_at, updated_at';
const PROP_COLS = 'id, campaign_id, name, category, image_url, natural_width, natural_height, default_scale, default_blocks_sight, default_blocks_move, default_block_shape, uploaded_by, created_at, updated_at';
const SCENE_PROP_COLS = 'id, scene_id, campaign_id, layer_id, prop_id, image_url, name, x, y, width, height, rotation, blocks_sight, blocks_move, block_shape, block_w, block_h, block_dx, block_dy, created_at, updated_at';
/** La máscara del pincel vive en el bucket de fondos, bajo la carpeta de la campaña: la política ya lo cubre. */
const DEFAULT_TRANSFORM: BgTransform = { mode: 'cover', x: 0, y: 0, scale: 1 };
export const BACKGROUNDS_BUCKET = 'backgrounds';

/**
 * LAS CUATRO DE LA PUERTA, en un solo sitio para las dos tablas (`maps_walls` y `maps_room_openings`).
 * Se leen con `DEFAULT_DOOR` por si falta la columna: una fila escrita antes de esta migración es una
 * puerta de una hoja, colgada del extremo por donde se empezó a dibujar — que es justo lo que hacía.
 */
const DOOR_COLS: Record<string, string> = { leaves: 'leaves', hinge: 'hinge', swing: 'swing', doorColor: 'door_color', doorTextureUrl: 'door_texture_url' };
type DoorRow = { leaves?: number | null; hinge?: string | null; swing?: string | null; door_color?: string | null; door_texture_url?: string | null };
const mapDoorRow = (r: DoorRow): DoorSettings => ({
  leaves: r.leaves === 2 ? 2 : DEFAULT_DOOR.leaves,
  hinge: r.hinge === 'end' ? 'end' : DEFAULT_DOOR.hinge,
  swing: r.swing === 'left' ? 'left' : DEFAULT_DOOR.swing,
  doorColor: r.door_color ?? DEFAULT_DOOR.doorColor,
  doorTextureUrl: r.door_texture_url ?? DEFAULT_DOOR.doorTextureUrl,
});
function doorPatchRow(p: Partial<DoorSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(DOOR_COLS)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}

export const mapSceneRow = (r: SceneRow): Scene => ({
  id: r.id, campaignId: r.campaign_id, name: r.name, width: r.width, height: r.height, bgColor: r.bg_color, bgImageUrl: r.bg_image_url,
  bgTransform: r.bg_transform ?? { mode: 'cover', x: 0, y: 0, scale: 1 }, grid: r.grid ?? { size: 27, visible: true }, fogMode: r.fog_mode,
  lighting: r.lighting ?? 'day', nightRadiusM: r.night_radius_m ?? DEFAULT_NIGHT_RADIUS_M,
  // Una escena guardada antes de la rebanada 4 no trae la columna: se lee como «no sólidas», que es como estaba.
  solidWalls: r.solid_walls ?? false,
  sortOrder: r.sort_order, visiblePlayers: r.visible_players,
  // Rebanada 8: una escena anterior no trae estas columnas y se lee con el preajuste de serie — ninguna sala
  // levantada cambia de aspecto por esto, porque sin salas no hay nada que pintar.
  roomPreset: r.room_preset ?? DEFAULT_ROOM_PRESET,
  wallTextureUrl: r.wall_texture_url ?? null,
  floorTextureUrl: r.floor_texture_url ?? null,
  wallThickness: r.wall_thickness ?? DEFAULT_WALL_THICKNESS,
  wallTextureScale: r.wall_texture_scale ?? DEFAULT_TEXTURE_SCALE,
  floorTextureScale: r.floor_texture_scale ?? DEFAULT_TEXTURE_SCALE,
  // Una escena escrita antes del giro (2026-09-12) se lee a 0°: se ve exactamente igual.
  wallTextureRotation: r.wall_texture_rotation ?? 0,
  floorTextureRotation: r.floor_texture_rotation ?? 0,
  // Nulo = el trazo del muro, que es de donde salen las puertas de todas las escenas de antes.
  doorColor: r.door_color ?? null,
  doorTextureUrl: r.door_texture_url ?? null,
  // Una escena escrita antes de la migración no trae la columna: se lee como 1 y se ve exactamente igual.
  tokenScale: r.token_scale ?? TOKEN_SCALE.def,
  /*
   * EL PINCEL DE LA ESCENA (rebanada 9). Una escena escrita antes de la migración no trae estas columnas:
   * cae en los mismos valores que la app ya usaba, así que se abre exactamente como se abría.
   */
  brushTip: isBrushTip(r.brush_tip) ? r.brush_tip : DEFAULT_BRUSH_TIP,
  brushSize: clampMaskSize(r.brush_size ?? DEFAULT_MASK_SIZE),
  brushStrength: clampStrength(r.brush_strength ?? DEFAULT_MASK_STRENGTH),
  brushHardness: clampHardness(r.brush_hardness ?? DEFAULT_MASK_HARDNESS),
  brushRoughness: clampRoughness(r.brush_roughness ?? DEFAULT_BRUSH_ROUGHNESS),
  // La punta de «A pulso» (§ 10B.4): una escena anterior no trae las columnas y dibuja con canto limpio, como siempre.
  bandTip: isBandTip(r.band_tip) ? r.band_tip : DEFAULT_BAND_TIP,
  bandRoughness: clampRoughness(r.band_roughness ?? DEFAULT_BAND_ROUGHNESS),
  // Un mapa anterior a la rebanada 10 no trae la columna: nadie ha pintado su roca, y se ve como siempre.
  rockPaintUrl: r.rock_paint_url ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapRoomRow = (r: RoomRow): Room => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id,
  // Una fila escrita antes de que existieran los rellenos es una SALA, que es lo que era.
  kind: r.kind ?? 'room', shape: r.shape ?? 'rect',
  points: (r.points ?? []) as [number, number][],
  floorPreset: r.floor_preset ?? DEFAULT_ROOM_PRESET, floorUrl: r.floor_url ?? null,
  // Una forma dibujada antes del pincel que construye no trae color propio: manda su preajuste, como siempre.
  floorColor: r.floor_color ?? null,
  // Una sala dibujada antes del pincel no trae la columna: nadie ha pintado en ella, y se ve entera.
  floorMaskUrl: r.floor_mask_url ?? null,
  // …y sin pintura encima, que es otra columna y otro fichero: la máscara QUITA y la pintura PONE.
  floorPaintUrl: r.floor_paint_url ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapColorRow = (r: ColorRow): MapColor => ({
  id: r.id, campaignId: r.campaign_id, color: r.color, createdAt: r.created_at,
});
export const mapTextureRow = (r: TextureRow): Texture => ({
  id: r.id, name: r.name, category: r.category ?? 'misc', url: r.url,
  tileCells: r.tile_cells ?? 4, uploadedBy: r.uploaded_by ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapRoomOpeningRow = (r: RoomOpeningRow): RoomOpening => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id,
  x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, kind: r.kind ?? 'door', isOpen: r.is_open ?? false,
  ...mapDoorRow(r),
});
export const mapWallRow = (r: WallRow): Wall => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, visiblePlayers: r.visible_players,
  kind: r.kind ?? 'wall', blocksSight: r.blocks_sight ?? true, blocksMove: r.blocks_move ?? true, isOpen: r.is_open ?? false,
  groupId: r.group_id ?? null,
  ...mapDoorRow(r),
});
function wallPatchRow(p: WallPatch): Record<string, unknown> {
  const map: Record<string, string> = { visiblePlayers: 'visible_players', kind: 'kind', blocksSight: 'blocks_sight', blocksMove: 'blocks_move', isOpen: 'is_open', ...DOOR_COLS };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}

/** Las columnas de un muro nuevo. Las comparten el alta de uno y la de una sala entera. */
function wallInsertRow(w: NewWall): Record<string, unknown> {
  return { scene_id: w.sceneId, campaign_id: w.campaignId, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, group_id: w.groupId ?? null, ...wallPatchRow(w) };
}
export const mapTokenRow = (r: TokenRow): Token => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, characterId: r.character_id, bestiaryRef: r.bestiary_ref,
  bestiaryEntryId: r.bestiary_entry_id ?? null, name: r.name, imageUrl: r.image_url,
  x: r.x, y: r.y, size: r.size, color: r.color, visible: r.visible, controlledBy: r.controlled_by, visionRadius: r.vision_radius, state: r.state ?? {},
  // Una ficha colocada antes de la rebanada 7 no trae columna: se lee como «su capa natural», que es donde estaba.
  layerId: r.layer_id ?? null,
});
export const mapDrawingRow = (r: DrawingRow): Drawing => ({ id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, authorId: r.author_id, kind: r.kind, data: r.data, color: r.color, width: r.width, createdAt: r.created_at, layerId: r.layer_id ?? null });

export const mapLayerRow = (r: LayerRow): Layer => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, kind: r.kind, name: r.name ?? '', sortOrder: r.sort_order,
  visible: r.visible, locked: r.locked, imageUrl: r.image_url, transform: r.transform ?? DEFAULT_TRANSFORM,
  maskUrl: r.mask_url, maskVersion: r.mask_version ?? 0,
  // Una capa anterior a la rebanada 10 no trae pintura: se ve su foto tal cual.
  paintUrl: r.paint_url ?? null, paintVersion: r.paint_version ?? 0,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapLightRow = (r: LightRow): Light => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, layerId: r.layer_id, shape: r.shape, kind: r.kind,
  x: r.x, y: r.y, rotation: r.rotation, coneAngle: r.cone_angle, color: r.color, flicker: r.flicker,
  rangeM: r.range_m, castsShadow: r.casts_shadow, spinMs: r.spin_ms ?? 0, intensity: r.intensity ?? 100, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapPropRow = (r: PropRow): Prop => ({
  id: r.id, campaignId: r.campaign_id, name: r.name, category: r.category, imageUrl: r.image_url,
  naturalWidth: r.natural_width, naturalHeight: r.natural_height, defaultScale: r.default_scale,
  defaultBlocksSight: r.default_blocks_sight, defaultBlocksMove: r.default_blocks_move,
  defaultBlockShape: r.default_block_shape, uploadedBy: r.uploaded_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapScenePropRow = (r: ScenePropRow): SceneProp => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, layerId: r.layer_id, propId: r.prop_id,
  imageUrl: r.image_url, name: r.name, x: r.x, y: r.y, width: r.width, height: r.height, rotation: r.rotation,
  blocksSight: r.blocks_sight, blocksMove: r.blocks_move, blockShape: r.block_shape,
  blockW: r.block_w, blockH: r.block_h, blockDx: r.block_dx, blockDy: r.block_dy,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
function propPatchRow(p: PropPatch): Record<string, unknown> {
  const map: Record<string, string> = {
    name: 'name', category: 'category', imageUrl: 'image_url', naturalWidth: 'natural_width',
    naturalHeight: 'natural_height', defaultScale: 'default_scale', defaultBlocksSight: 'default_blocks_sight',
    defaultBlocksMove: 'default_blocks_move', defaultBlockShape: 'default_block_shape',
    // `uploadedBy` NO está a propósito: quién subió una pieza se pone una vez al crearla y no se edita.
    // Dejarlo aquí lo colaba en el insert DESPUÉS del valor bueno y lo borraba con el `null` de la entrada.
  };
  return Object.fromEntries(Object.entries(p).filter(([k]) => k in map).map(([k, v]) => [map[k]!, v]));
}
function scenePropPatchRow(p: ScenePropPatch): Record<string, unknown> {
  const map: Record<string, string> = {
    layerId: 'layer_id', propId: 'prop_id', imageUrl: 'image_url', name: 'name', x: 'x', y: 'y',
    width: 'width', height: 'height', rotation: 'rotation', blocksSight: 'blocks_sight',
    blocksMove: 'blocks_move', blockShape: 'block_shape', blockW: 'block_w', blockH: 'block_h',
    blockDx: 'block_dx', blockDy: 'block_dy',
  };
  return Object.fromEntries(Object.entries(p).filter(([k]) => k in map).map(([k, v]) => [map[k]!, v]));
}
function layerPatchRow(p: LayerPatch): Record<string, unknown> {
  const map: Record<string, string> = { name: 'name', sortOrder: 'sort_order', visible: 'visible', locked: 'locked', imageUrl: 'image_url', transform: 'transform', maskUrl: 'mask_url', maskVersion: 'mask_version', paintUrl: 'paint_url', paintVersion: 'paint_version' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}
function lightPatchRow(p: LightPatch): Record<string, unknown> {
  const map: Record<string, string> = { layerId: 'layer_id', shape: 'shape', kind: 'kind', x: 'x', y: 'y', rotation: 'rotation', coneAngle: 'cone_angle', color: 'color', flicker: 'flicker', rangeM: 'range_m', castsShadow: 'casts_shadow', spinMs: 'spin_ms', intensity: 'intensity' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}
const mapImageRow = (r: ImageRow): ImageAsset => ({ id: r.id, campaignId: r.campaign_id, name: r.name, url: r.url, createdAt: r.created_at });

function scenePatchRow(p: ScenePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.width !== undefined) row.width = p.width;
  if (p.height !== undefined) row.height = p.height;
  if (p.bgColor !== undefined) row.bg_color = p.bgColor;
  if (p.bgImageUrl !== undefined) row.bg_image_url = p.bgImageUrl;
  if (p.bgTransform !== undefined) row.bg_transform = p.bgTransform;
  if (p.grid !== undefined) row.grid = p.grid;
  if (p.fogMode !== undefined) row.fog_mode = p.fogMode;
  if (p.lighting !== undefined) row.lighting = p.lighting;
  if (p.nightRadiusM !== undefined) row.night_radius_m = p.nightRadiusM;
  if (p.solidWalls !== undefined) row.solid_walls = p.solidWalls;
  if (p.doorColor !== undefined) row.door_color = p.doorColor;
  if (p.doorTextureUrl !== undefined) row.door_texture_url = p.doorTextureUrl;
  // Rebanada 8 — las dos texturas base, el preajuste y el grosor son DE LA ESCENA («una cripta y un bosque
  // no se parecen en nada»). Cambiarlos no repinta ninguna sala ya levantada: cada una se llevó su suelo.
  if (p.roomPreset !== undefined) row.room_preset = p.roomPreset;
  if (p.wallTextureUrl !== undefined) row.wall_texture_url = p.wallTextureUrl;
  if (p.floorTextureUrl !== undefined) row.floor_texture_url = p.floorTextureUrl;
  if (p.wallThickness !== undefined) row.wall_thickness = p.wallThickness;
  if (p.wallTextureScale !== undefined) row.wall_texture_scale = p.wallTextureScale;
  if (p.floorTextureScale !== undefined) row.floor_texture_scale = p.floorTextureScale;
  // El giro se normaliza a [0, 360) al escribir: la base lo exige en un CHECK, y el mosaico no distingue 370° de 10°.
  const giro = (d: number): number => ((d % 360) + 360) % 360;
  if (p.wallTextureRotation !== undefined) row.wall_texture_rotation = giro(p.wallTextureRotation);
  if (p.floorTextureRotation !== undefined) row.floor_texture_rotation = giro(p.floorTextureRotation);
  if (p.tokenScale !== undefined) row.token_scale = p.tokenScale;
  /*
   * Se recorta al escribir, no sólo al leer: la base tiene los mismos topes en un CHECK y una llamada fuera
   * de rango la rechazaría entera, perdiendo de paso el resto del parche.
   */
  if (p.brushTip !== undefined) row.brush_tip = p.brushTip;
  if (p.brushSize !== undefined) row.brush_size = clampMaskSize(p.brushSize);
  if (p.brushStrength !== undefined) row.brush_strength = clampStrength(p.brushStrength);
  if (p.brushHardness !== undefined) row.brush_hardness = clampHardness(p.brushHardness);
  if (p.brushRoughness !== undefined) row.brush_roughness = clampRoughness(p.brushRoughness);
  // La punta de «A pulso» (§ 10B.4), aparte de la del pincel y recortada por lo mismo.
  if (p.bandTip !== undefined) row.band_tip = p.bandTip;
  if (p.bandRoughness !== undefined) row.band_roughness = clampRoughness(p.bandRoughness);
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder;
  if (p.visiblePlayers !== undefined) row.visible_players = p.visiblePlayers;
  return row;
}
function tokenPatchRow(p: TokenPatch): Record<string, unknown> {
  const map: Record<string, string> = { characterId: 'character_id', bestiaryRef: 'bestiary_ref', bestiaryEntryId: 'bestiary_entry_id', name: 'name', imageUrl: 'image_url', x: 'x', y: 'y', size: 'size', color: 'color', visible: 'visible', controlledBy: 'controlled_by', visionRadius: 'vision_radius', state: 'state', layerId: 'layer_id' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}
const tokenInsertRow = (t: NewToken) => ({ scene_id: t.sceneId, campaign_id: t.campaignId, ...tokenPatchRow(t) });

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;
function toChange<R extends { id: string }, T>(p: Change, map: (r: R) => T): RowChange<T> {
  const type = p.eventType as RowChange<T>['type'];
  if (type === 'DELETE') return { type, id: (p.old as { id: string }).id, row: null };
  const row = p.new as unknown as R;
  return { type, id: row.id, row: map(row) };
}

/** `maps_*` under RLS + realtime on channel `scene:{sceneId}` (postgres_changes + broadcast for drag / pin). */
export class SupabaseMapsRepo implements MapsPort {
  /**
   * UN canal real por escena, con la lista de quienes escuchan. Desde que los encuentros del lanzador
   * (`DmEncounters`) conviven con `useScene` sobre la MISMA escena hay dos suscriptores a la vez, y con un
   * canal por suscriptor pasaban dos cosas (revisión del 2026-08-23): el mapa por `sceneId` se PISABA — al
   * cerrar el lanzador, su unsubscribe borraba la entrada y `broadcast()` se quedaba mudo con la escena aún
   * abierta (los arrastres del director dejaban de llegar a la mesa) — y dos joins al mismo topic en el
   * mismo socket hacen que Phoenix cierre el primero. El topic tiene que seguir siendo `scene:{id}` a secas:
   * el broadcast entre navegadores viaja por topic, un sufijo único lo rompería.
   */
  private readonly channels = new Map<string, { channel: RealtimeChannel; handlers: Set<MapsLiveHandlers> }>();
  constructor(private readonly db: SupabaseClient) {}

  private async me(): Promise<string> {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session) throw new Error('not_authenticated');
    return session.user.id;
  }
  private fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }

  // ── scenes ──
  async listScenes(campaignId: string): Promise<Scene[]> {
    const { data, error } = await this.db.from('maps_scenes').select(SCENE_COLS).eq('campaign_id', campaignId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as SceneRow[]).map(mapSceneRow);
  }
  async getScene(id: string): Promise<Scene | null> {
    const { data, error } = await this.db.from('maps_scenes').select(SCENE_COLS).eq('id', id).maybeSingle();
    this.fail(error);
    return data ? mapSceneRow(data as unknown as SceneRow) : null;
  }
  async createScene(input: CreateSceneInput): Promise<Scene> {
    const row: Record<string, unknown> = { campaign_id: input.campaignId, name: input.name, created_by: await this.me() };
    if (input.width !== undefined) row.width = input.width;
    if (input.height !== undefined) row.height = input.height;
    if (input.bgColor !== undefined) row.bg_color = input.bgColor;
    if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
    const { data, error } = await this.db.from('maps_scenes').insert(row).select(SCENE_COLS).single();
    this.fail(error);
    return mapSceneRow(data as unknown as SceneRow);
  }
  async updateScene(id: string, patch: ScenePatch): Promise<void> {
    const { error } = await this.db.from('maps_scenes').update(scenePatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeScene(id: string): Promise<void> {
    const { error } = await this.db.from('maps_scenes').delete().eq('id', id);
    this.fail(error);
  }
  async setActiveScene(campaignId: string, sceneId: string | null): Promise<void> {
    const { error } = await this.db.from('campaigns_campaigns').update({ active_scene_id: sceneId }).eq('id', campaignId);
    this.fail(error);
  }

  // ── images ──
  async listImages(campaignId: string): Promise<ImageAsset[]> {
    const { data, error } = await this.db.from('maps_images').select('id, campaign_id, name, url, created_at').eq('campaign_id', campaignId).order('created_at', { ascending: false });
    this.fail(error);
    return ((data ?? []) as unknown as ImageRow[]).map(mapImageRow);
  }
  async uploadImage(campaignId: string, file: Blob, name: string): Promise<ImageAsset> {
    const me = await this.me();
    const path = `${campaignId}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_images').insert({ campaign_id: campaignId, name, url, uploaded_by: me }).select('id, campaign_id, name, url, created_at').single();
    this.fail(error);
    return mapImageRow(data as unknown as ImageRow);
  }
  async removeImage(id: string): Promise<void> {
    const { error } = await this.db.from('maps_images').delete().eq('id', id);
    this.fail(error);
  }

  // ── walls ──
  async listWalls(sceneId: string): Promise<Wall[]> {
    const { data, error } = await this.db.from('maps_walls').select(WALL_COLS).eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as unknown as WallRow[]).map(mapWallRow);
  }
  async addWall(w: NewWall): Promise<Wall> {
    const { data, error } = await this.db.from('maps_walls')
      .insert(wallInsertRow(w))
      .select(WALL_COLS).single();
    this.fail(error);
    return mapWallRow(data as unknown as WallRow);
  }
  /**
   * UNA SALA ENTERA, EN UN SOLO INSERT (§ «Rebanada 8»). No es una optimización: escribiendo los muros uno a
   * uno, si el enésimo falla se quedan puestos los anteriores y la sala queda ABIERTA — y por ese hueco se
   * cuela la visión sin que nada lo cante. Un `insert` de varias filas es una sola sentencia: entran todas o
   * no entra ninguna.
   */
  async addWalls(ws: NewWall[]): Promise<Wall[]> {
    if (!ws.length) return [];
    const { data, error } = await this.db.from('maps_walls').insert(ws.map(wallInsertRow)).select(WALL_COLS);
    this.fail(error);
    return ((data ?? []) as unknown as WallRow[]).map(mapWallRow);
  }
  async updateWallGeometry(id: string, at: { x1: number; y1: number; x2: number; y2: number }): Promise<void> {
    const { error } = await this.db.from('maps_walls').update(at).eq('id', id);
    this.fail(error);
  }
  /**
   * BORRAR UN GRUPO ENTERO (§ «EL GRUPO»). Un solo DELETE: media sala borrada es una sala abierta, y por el
   * hueco se cuela la visión — el mismo agujero que ya nos mordió al escribirla muro a muro.
   */
  async removeWalls(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.db.from('maps_walls').delete().in('id', ids);
    this.fail(error);
  }
  /**
   * ATAR O DESATAR MUROS (§ «EL GRUPO»). Un solo UPDATE con `in`: o quedan todos atados o ninguno, porque
   * media selección agrupada y la otra media suelta no es un estado que él pueda entender ni deshacer.
   */
  async setWallsGroup(ids: string[], groupId: string | null): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.db.from('maps_walls').update({ group_id: groupId }).in('id', ids);
    this.fail(error);
  }
  /**
   * TODOS LOS MUROS DE LA ESCENA, VISIBLES O NO, DE UNA VEZ (petición suya del 2026-09-03).
   *
   * Filtra por `scene_id` y NO por una lista de ids a propósito: así alcanza también a los muros que este
   * navegador no tenga cargados. La RLS ya sólo deja escribir al director (`maps_walls_dm_write`), así que
   * no hace falta comprobar nada más aquí — y no se puede: quien no sea director no actualizará ni una fila.
   *
   * ⚠️ Quien llame a esto tiene que mandar además un `walls.updated`: los avisos de fila no cruzan en el
   * sentido de esconder, porque la fila nueva ya no pasa la RLS del jugador.
   */
  async setAllWallsVisible(sceneId: string, visible: boolean): Promise<void> {
    const { error } = await this.db.from('maps_walls').update({ visible_players: visible }).eq('scene_id', sceneId);
    this.fail(error);
  }
  /**
   * MOVER O ESTIRAR UN GRUPO ENTERO (§ «EL GRUPO»). Un `upsert` de filas completas, que es una sola sentencia:
   * un grupo a medio mover deja la forma rota en la base y el hueco por el que se cuela la visión.
   *
   * Van las filas enteras y no sólo las cuatro coordenadas porque un `upsert` parcial tendría que poder
   * INSERTAR, y ahí faltarían las columnas obligatorias. Escribe el director y sólo él, así que no hay carrera
   * que perder.
   */
  async updateWallsGeometry(walls: Wall[]): Promise<void> {
    if (!walls.length) return;
    const rows = walls.map(w => ({ id: w.id, ...wallInsertRow(w) }));
    const { error } = await this.db.from('maps_walls').upsert(rows);
    this.fail(error);
  }
  /** DM only (RLS): opening or closing a door/window is an UPDATE on the segment. */
  async updateWall(id: string, patch: WallPatch): Promise<void> {
    const { error } = await this.db.from('maps_walls').update(wallPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeWall(id: string): Promise<void> {
    const { error } = await this.db.from('maps_walls').delete().eq('id', id);
    this.fail(error);
  }

  // ── tokens ──
  async listTokens(sceneId: string): Promise<Token[]> {
    const { data, error } = await this.db.from('maps_tokens').select(TOKEN_COLS).eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as TokenRow[]).map(mapTokenRow);
  }
  async addToken(t: NewToken): Promise<Token> {
    const { data, error } = await this.db.from('maps_tokens').insert(tokenInsertRow(t)).select(TOKEN_COLS).single();
    this.fail(error);
    return mapTokenRow(data as unknown as TokenRow);
  }
  async updateToken(id: string, patch: TokenPatch): Promise<void> {
    const { error } = await this.db.from('maps_tokens').update(tokenPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeToken(id: string): Promise<void> {
    const { error } = await this.db.from('maps_tokens').delete().eq('id', id);
    this.fail(error);
  }

  // ── drawings ──
  async listDrawings(sceneId: string): Promise<Drawing[]> {
    const { data, error } = await this.db.from('maps_drawings').select(DRAWING_COLS).eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as DrawingRow[]).map(mapDrawingRow);
  }
  async addDrawing(d: NewDrawing): Promise<Drawing> {
    const author_id = await this.me();
    const { data, error } = await this.db.from('maps_drawings').insert({ scene_id: d.sceneId, campaign_id: d.campaignId, author_id, kind: d.kind, data: d.data, color: d.color, width: d.width, layer_id: d.layerId ?? null }).select(DRAWING_COLS).single();
    this.fail(error);
    return mapDrawingRow(data as unknown as DrawingRow);
  }
  async removeDrawing(id: string): Promise<void> {
    const { error } = await this.db.from('maps_drawings').delete().eq('id', id);
    this.fail(error);
  }
  async removeMyDrawings(sceneId: string): Promise<void> {
    const me = await this.me();
    const { error } = await this.db.from('maps_drawings').delete().eq('scene_id', sceneId).eq('author_id', me);
    this.fail(error);
  }
  /** DM only (RLS `maps_drawings_dm_update`): lo único que se edita de un trazo es en qué capa está. */
  async updateDrawingLayer(id: string, layerId: string | null): Promise<void> {
    const { error } = await this.db.from('maps_drawings').update({ layer_id: layerId }).eq('id', id);
    this.fail(error);
  }
  async updateDrawingData(id: string, data: Drawing['data']): Promise<void> {
    const { error } = await this.db.from('maps_drawings').update({ data }).eq('id', id);
    this.fail(error);
  }
  async removeAllDrawings(sceneId: string): Promise<void> {
    const { error } = await this.db.from('maps_drawings').delete().eq('scene_id', sceneId);
    this.fail(error);
  }

  // ── layers (rebanada 7) ──
  async listLayers(sceneId: string): Promise<Layer[]> {
    const { data, error } = await this.db.from('maps_layers').select(LAYER_COLS).eq('scene_id', sceneId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as LayerRow[]).map(mapLayerRow);
  }
  async addLayer(l: NewLayer): Promise<Layer> {
    const row: Record<string, unknown> = { scene_id: l.sceneId, campaign_id: l.campaignId, kind: l.kind };
    if (l.name !== undefined) row.name = l.name;
    if (l.sortOrder !== undefined) row.sort_order = l.sortOrder;
    if (l.imageUrl !== undefined) row.image_url = l.imageUrl;
    if (l.transform !== undefined) row.transform = l.transform;
    const { data, error } = await this.db.from('maps_layers').insert(row).select(LAYER_COLS).single();
    this.fail(error);
    return mapLayerRow(data as unknown as LayerRow);
  }
  async updateLayer(id: string, patch: LayerPatch): Promise<void> {
    const { error } = await this.db.from('maps_layers').update(layerPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeLayer(id: string): Promise<void> {
    const { error } = await this.db.from('maps_layers').delete().eq('id', id);
    this.fail(error);
  }
  /**
   * La máscara se SOBREESCRIBE siempre en la misma ruta (`upsert`), así que una capa nunca deja ficheros
   * sueltos por detrás por muchas pinceladas que reciba. Lo que cambia en la fila es `mask_version`, que es
   * lo que rompe la caché del navegador: sin él, el CDN seguiría sirviendo la máscara vieja.
   */
  async saveMask(layer: Pick<Layer, 'id' | 'campaignId' | 'maskVersion'>, png: Blob): Promise<Layer> {
    const path = maskPath(layer.campaignId, layer.id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_layers').update({ mask_url: url, mask_version: layer.maskVersion + 1 }).eq('id', layer.id).select(LAYER_COLS).single();
    this.fail(error);
    return mapLayerRow(data as unknown as LayerRow);
  }
  async clearMask(layer: Pick<Layer, 'id' | 'campaignId'>): Promise<void> {
    // Primero la fila: si el borrado del fichero falla, la capa ya se ve entera y sólo queda un PNG huérfano.
    const { error } = await this.db.from('maps_layers').update({ mask_url: null }).eq('id', layer.id);
    this.fail(error);
    await this.db.storage.from(BACKGROUNDS_BUCKET).remove([maskPath(layer.campaignId, layer.id)]);
  }
  /**
   * LA PINTURA de una capa (rebanada 10). Mismo camino que la máscara —mismo bucket, `upsert` en la misma
   * ruta, número de versión que sube— pero OTRO fichero y OTRA columna: aquélla QUITA y ésta PONE, y
   * compartirlos dejaría el borrador de una llevándose la otra por delante.
   */
  async saveLayerPaint(layer: Pick<Layer, 'id' | 'campaignId' | 'paintVersion'>, png: Blob): Promise<Layer> {
    const path = layerPaintPath(layer.campaignId, layer.id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_layers').update({ paint_url: url, paint_version: layer.paintVersion + 1 }).eq('id', layer.id).select(LAYER_COLS).single();
    this.fail(error);
    return mapLayerRow(data as unknown as LayerRow);
  }
  async clearLayerPaint(layer: Pick<Layer, 'id' | 'campaignId'>): Promise<void> {
    const { error } = await this.db.from('maps_layers').update({ paint_url: null }).eq('id', layer.id);
    this.fail(error);
    await this.db.storage.from(BACKGROUNDS_BUCKET).remove([layerPaintPath(layer.campaignId, layer.id)]);
  }

  // ── lights (rebanada 7) ── HOY SON PINTURA: no revelan niebla ni entran en el cálculo de visión.
  async listLights(sceneId: string): Promise<Light[]> {
    const { data, error } = await this.db.from('maps_lights').select(LIGHT_COLS).eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as LightRow[]).map(mapLightRow);
  }
  async addLight(l: NewLight): Promise<Light> {
    const { data, error } = await this.db.from('maps_lights').insert({ scene_id: l.sceneId, campaign_id: l.campaignId, ...lightPatchRow(l) }).select(LIGHT_COLS).single();
    this.fail(error);
    return mapLightRow(data as unknown as LightRow);
  }
  async updateLight(id: string, patch: LightPatch): Promise<void> {
    const { error } = await this.db.from('maps_lights').update(lightPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeLight(id: string): Promise<void> {
    const { error } = await this.db.from('maps_lights').delete().eq('id', id);
    this.fail(error);
  }

  // ── piezas: LA BIBLIOTECA (rebanada 6) ──
  /**
   * Trae las de la campaña Y las del catálogo de la app (`campaign_id` nulo), en una sola consulta: la
   * galería las enseña juntas y separarlas en dos viajes sólo serviría para verlas aparecer a destiempo.
   */
  async listProps(campaignId: string): Promise<Prop[]> {
    const { data, error } = await this.db.from('maps_props').select(PROP_COLS)
      .or(`campaign_id.eq.${campaignId},campaign_id.is.null`).order('created_at', { ascending: false });
    this.fail(error);
    return ((data ?? []) as unknown as PropRow[]).map(mapPropRow);
  }
  /**
   * El id se genera AQUÍ, antes de subir: la foto va a `{campaña}/props/{id}.webp` y así el objeto del bucket
   * y la fila comparten nombre. Sin eso habría que insertar primero con una URL falsa y corregirla después.
   */
  async addProp(input: NewProp, image: Blob): Promise<Prop> {
    const me = await this.me();
    if (!input.campaignId) throw new Error('Una pieza subida siempre es de una campaña');
    const id = crypto.randomUUID();
    const path = propPath(input.campaignId, id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET)
      .upload(path, image, { upsert: false, contentType: image.type || 'image/webp', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_props')
      .insert({ id, campaign_id: input.campaignId, uploaded_by: me, ...propPatchRow({ ...input, imageUrl: url }) })
      .select(PROP_COLS).single();
    this.fail(error);
    return mapPropRow(data as unknown as PropRow);
  }
  async updateProp(id: string, patch: PropPatch): Promise<void> {
    const { error } = await this.db.from('maps_props').update(propPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  /**
   * Borra la fila de la biblioteca y NADA más. Lo ya plantado se queda —`prop_id` se va a nulo y cada copia
   * conserva su foto—, y el objeto del bucket tampoco se toca, que es lo que hace que esas copias sigan
   * pintándose. Es la regla del dueño, y está en la migración además de aquí.
   */
  async removeProp(id: string): Promise<void> {
    const { error } = await this.db.from('maps_props').delete().eq('id', id);
    this.fail(error);
  }

  // ── piezas: LO PLANTADO EN LA ESCENA ──
  async listSceneProps(sceneId: string): Promise<SceneProp[]> {
    const { data, error } = await this.db.from('maps_scene_props').select(SCENE_PROP_COLS)
      .eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as ScenePropRow[]).map(mapScenePropRow);
  }
  async addSceneProp(input: NewSceneProp): Promise<SceneProp> {
    const { data, error } = await this.db.from('maps_scene_props')
      .insert({ scene_id: input.sceneId, campaign_id: input.campaignId, ...scenePropPatchRow(input) })
      .select(SCENE_PROP_COLS).single();
    this.fail(error);
    return mapScenePropRow(data as unknown as ScenePropRow);
  }
  async updateSceneProp(id: string, patch: ScenePropPatch): Promise<void> {
    const { error } = await this.db.from('maps_scene_props').update(scenePropPatchRow(patch)).eq('id', id);
    this.fail(error);
  }
  async removeSceneProp(id: string): Promise<void> {
    const { error } = await this.db.from('maps_scene_props').delete().eq('id', id);
    this.fail(error);
  }

  // ── salas (rebanada 8) ──
  // Una fila es UNA FORMA. Aquí no se escribe ni un muro: el contorno se calcula al pintar y al mirar.
  async listRooms(sceneId: string): Promise<Room[]> {
    // De la más vieja a la más nueva: el orden ES la regla de qué suelo manda cuando dos se funden.
    const { data, error } = await this.db.from('maps_rooms').select(ROOM_COLS).eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return (data as RoomRow[] ?? []).map(mapRoomRow);
  }
  async addRoom(r: NewRoom): Promise<Room> {
    const { data, error } = await this.db.from('maps_rooms').insert({
      scene_id: r.sceneId, campaign_id: r.campaignId, kind: r.kind, shape: r.shape, points: r.points,
      floor_preset: r.floorPreset, floor_url: r.floorUrl, floor_color: r.floorColor, floor_mask_url: r.floorMaskUrl,
    }).select(ROOM_COLS).single();
    this.fail(error);
    return mapRoomRow(data as RoomRow);
  }
  async updateRoomPoints(id: string, points: [number, number][]): Promise<void> {
    const { error } = await this.db.from('maps_rooms').update({ points }).eq('id', id);
    this.fail(error);
  }
  async removeRoom(id: string): Promise<void> {
    const { error } = await this.db.from('maps_rooms').delete().eq('id', id);
    this.fail(error);
  }
  /**
   * La máscara del suelo de una sala (rebanada 9). Mismo camino que `saveMask` de una capa —mismo bucket,
   * misma carpeta, mismas políticas— porque es el mismo mecanismo: la textura original NUNCA se toca, se
   * pinta una máscara encima y siempre se puede volver atrás.
   *
   * Se devuelve la fila entera y no sólo la URL: el rompe-caché de una sala es su `updated_at` (no lleva
   * número de versión como las capas), y quien pinta lo necesita para que el navegador no se quede con el
   * PNG viejo.
   */
  async saveRoomFloorMask(room: Pick<Room, 'id' | 'campaignId'>, png: Blob): Promise<Room> {
    const path = roomMaskPath(room.campaignId, room.id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_rooms').update({ floor_mask_url: url }).eq('id', room.id).select(ROOM_COLS).single();
    this.fail(error);
    return mapRoomRow(data as unknown as RoomRow);
  }
  async clearRoomFloorMask(room: Pick<Room, 'id' | 'campaignId'>): Promise<void> {
    // Primero la fila, como en `clearMask`: si el borrado del fichero falla, el suelo ya se ve entero y sólo
    // queda un PNG huérfano — al revés dejaría una sala apuntando a un fichero que ya no está.
    const { error } = await this.db.from('maps_rooms').update({ floor_mask_url: null }).eq('id', room.id);
    this.fail(error);
    await this.db.storage.from(BACKGROUNDS_BUCKET).remove([roomMaskPath(room.campaignId, room.id)]);
  }

  /**
   * LA PINTURA de una forma (rebanada 10): el PNG que se dibuja ENCIMA de su suelo. Se devuelve la fila
   * entera por lo mismo que la máscara — el rompe-caché de una sala es su `updated_at`, y sin traerlo de
   * vuelta el navegador se queda con el PNG de antes y parece que el pincel no pinta.
   */
  async saveRoomFloorPaint(room: Pick<Room, 'id' | 'campaignId'>, png: Blob, alsoIds: readonly string[] = []): Promise<Room[]> {
    const path = roomPaintPath(room.campaignId, room.id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    /*
     * UN SOLO FICHERO Y N PUNTEROS: todas las formas excavadas apuntan al mismo PNG y cada una lo dibuja
     * dentro de su contorno, así que la pintura no se corta en las costuras de una habitación hecha de varios
     * trozos. Es una escritura en lote, no N viajes.
     */
    const ids = [room.id, ...alsoIds.filter(id => id !== room.id)];
    const { data, error } = await this.db.from('maps_rooms').update({ floor_paint_url: url }).in('id', ids).select(ROOM_COLS);
    this.fail(error);
    return ((data ?? []) as unknown as RoomRow[]).map(mapRoomRow);
  }
  async clearRoomFloorPaint(room: Pick<Room, 'id' | 'campaignId'>, alsoIds: readonly string[] = []): Promise<void> {
    const ids = [room.id, ...alsoIds.filter(id => id !== room.id)];
    const { error } = await this.db.from('maps_rooms').update({ floor_paint_url: null }).in('id', ids);
    this.fail(error);
    await this.db.storage.from(BACKGROUNDS_BUCKET).remove([roomPaintPath(room.campaignId, room.id)]);
  }

  /**
   * LA PINTURA DE LA ROCA (rebanada 10). Va en la ESCENA porque la roca no es una fila: es el negativo de lo
   * excavado. El recorte contra la roca lo hace el lienzo con la máscara que ya usa para tallarla, así que
   * aquí no hay nada que comprobar — y por eso pintar la roca no puede manchar una sala.
   */
  async saveRockPaint(scene: Pick<Scene, 'id' | 'campaignId'>, png: Blob): Promise<Scene> {
    const path = rockPaintPath(scene.campaignId, scene.id);
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_scenes').update({ rock_paint_url: url }).eq('id', scene.id).select(SCENE_COLS).single();
    this.fail(error);
    return mapSceneRow(data as unknown as SceneRow);
  }
  async clearRockPaint(scene: Pick<Scene, 'id' | 'campaignId'>): Promise<void> {
    const { error } = await this.db.from('maps_scenes').update({ rock_paint_url: null }).eq('id', scene.id);
    this.fail(error);
    await this.db.storage.from(BACKGROUNDS_BUCKET).remove([rockPaintPath(scene.campaignId, scene.id)]);
  }

  // ── los colores guardados de la campaña (rebanada 10) ─────────────────────
  async listColors(campaignId: string): Promise<MapColor[]> {
    const { data, error } = await this.db.from('maps_colors').select(COLOR_COLS).eq('campaign_id', campaignId).order('created_at', { ascending: true });
    this.fail(error);
    return (data as ColorRow[] ?? []).map(mapColorRow);
  }
  async addColor(campaignId: string, color: string): Promise<MapColor> {
    /**
     * 🔑 EL MISMO COLOR DOS VECES NO ES UN ERROR: es el mismo color, y lo que él espera es que su muestra
     * siga ahí. Lo impide la base con un índice único sobre `(campaign_id, lower(color))`.
     *
     * Se INTENTA meter y se recoge el choque, en vez de consultar antes y escribir después: entre la consulta
     * y la escritura cabe la otra pestaña del director, que es justo el hueco por el que se pierde un color.
     * Y el índice es sobre una FUNCIÓN (`lower(color)`), así que no se puede pedir un `upsert` por columnas:
     * PostgREST necesita nombres de columna y `lower(color)` no lo es.
     */
    const me = await this.me();
    const { data, error } = await this.db.from('maps_colors')
      .insert({ campaign_id: campaignId, color, created_by: me }).select(COLOR_COLS).single();
    if (!error) return mapColorRow(data as ColorRow);
    if (!UNIQUE_VIOLATION.test(error.message)) { this.fail(error); }
    const previo = await this.db.from('maps_colors').select(COLOR_COLS)
      .eq('campaign_id', campaignId).ilike('color', color).limit(1).single();
    this.fail(previo.error);
    return mapColorRow(previo.data as ColorRow);
  }

  async listRoomOpenings(sceneId: string): Promise<RoomOpening[]> {
    const { data, error } = await this.db.from('maps_room_openings').select(ROOM_OPENING_COLS).eq('scene_id', sceneId);
    this.fail(error);
    return (data as RoomOpeningRow[] ?? []).map(mapRoomOpeningRow);
  }
  async addRoomOpening(o: NewRoomOpening): Promise<RoomOpening> {
    const { data, error } = await this.db.from('maps_room_openings').insert({
      scene_id: o.sceneId, campaign_id: o.campaignId, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, kind: o.kind, is_open: o.isOpen, ...doorPatchRow(o),
    }).select(ROOM_OPENING_COLS).single();
    this.fail(error);
    return mapRoomOpeningRow(data as RoomOpeningRow);
  }
  async updateRoomOpening(id: string, patch: RoomOpeningPatch): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.isOpen !== undefined) row.is_open = patch.isOpen;
    Object.assign(row, doorPatchRow(patch));
    const { error } = await this.db.from('maps_room_openings').update(row).eq('id', id);
    this.fail(error);
  }
  async removeRoomOpening(id: string): Promise<void> {
    const { error } = await this.db.from('maps_room_openings').delete().eq('id', id);
    this.fail(error);
  }

  // ── el catálogo de texturas (rebanada 8) ──
  // De la HERRAMIENTA, no de una campaña: ni se filtra por campaña ni se pasa una. La foto sí se sube bajo la
  // carpeta de la campaña, que es la que las políticas del bucket ya cubren — y el bucket sirve las imágenes
  // públicas, así que el sitio del fichero no limita quién puede verla.
  async listTextures(): Promise<Texture[]> {
    const { data, error } = await this.db.from('maps_textures').select(TEXTURE_COLS).order('created_at', { ascending: false });
    this.fail(error);
    return (data as TextureRow[] ?? []).map(mapTextureRow);
  }
  async addTexture(input: Omit<NewTexture, 'url' | 'uploadedBy'>, image: Blob, campaignId: string): Promise<Texture> {
    const me = await this.me();
    const path = `${campaignId}/textures/${crypto.randomUUID()}.png`;
    const { error: upErr } = await this.db.storage.from(BACKGROUNDS_BUCKET).upload(path, image, { upsert: false, contentType: image.type || 'image/png', cacheControl: '3600' });
    this.fail(upErr);
    const url = this.db.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.db.from('maps_textures')
      .insert({ name: input.name, category: input.category, tile_cells: input.tileCells, url, uploaded_by: me })
      .select(TEXTURE_COLS).single();
    this.fail(error);
    return mapTextureRow(data as TextureRow);
  }
  async updateTexture(id: string, patch: TexturePatch): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.category !== undefined) row.category = patch.category;
    const { error } = await this.db.from('maps_textures').update(row).eq('id', id);
    this.fail(error);
  }
  async removeTexture(id: string): Promise<void> {
    const { error } = await this.db.from('maps_textures').delete().eq('id', id);
    this.fail(error);
  }

  // ── realtime ──
  subscribe(sceneId: string, h: MapsLiveHandlers): Unsubscribe {
    let entry = this.channels.get(sceneId);
    if (!entry) {
      const handlers = new Set<MapsLiveHandlers>();
      const each = (fn: (x: MapsLiveHandlers) => void) => handlers.forEach(fn);
      const channel: RealtimeChannel = this.db.channel(`scene:${sceneId}`);
      const byScene = { event: '*' as const, schema: 'public', filter: `scene_id=eq.${sceneId}` };
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maps_scenes', filter: `id=eq.${sceneId}` }, (p: Change) => { const c = toChange<SceneRow, Scene>(p, mapSceneRow); each(x => x.onScene?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_tokens' }, (p: Change) => { const c = toChange<TokenRow, Token>(p, mapTokenRow); each(x => x.onToken?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_walls' }, (p: Change) => { const c = toChange<WallRow, Wall>(p, mapWallRow); each(x => x.onWall?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_drawings' }, (p: Change) => { const c = toChange<DrawingRow, Drawing>(p, mapDrawingRow); each(x => x.onDrawing?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_layers' }, (p: Change) => { const c = toChange<LayerRow, Layer>(p, mapLayerRow); each(x => x.onLayer?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_lights' }, (p: Change) => { const c = toChange<LightRow, Light>(p, mapLightRow); each(x => x.onLight?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_scene_props' }, (p: Change) => { const c = toChange<ScenePropRow, SceneProp>(p, mapScenePropRow); each(x => x.onSceneProp?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_rooms' }, (p: Change) => { const c = toChange<RoomRow, Room>(p, mapRoomRow); each(x => x.onRoom?.(c)); })
        .on('postgres_changes', { ...byScene, table: 'maps_room_openings' }, (p: Change) => { const c = toChange<RoomOpeningRow, RoomOpening>(p, mapRoomOpeningRow); each(x => x.onRoomOpening?.(c)); })
        .on('broadcast', { event: 'map' }, (msg: { payload: MapsLiveEvent }) => each(x => x.onEvent?.(msg.payload)))
        .subscribe();
      entry = { channel, handlers };
      this.channels.set(sceneId, entry);
    }
    const mine = entry;
    mine.handlers.add(h);
    return () => {
      mine.handlers.delete(h);
      // El canal se quita sólo cuando se va el ÚLTIMO: quitarlo antes dejaba mudo al que quedaba.
      if (mine.handlers.size === 0 && this.channels.get(sceneId) === mine) {
        this.channels.delete(sceneId);
        void this.db.removeChannel(mine.channel);
      }
    };
  }
  broadcast(sceneId: string, event: MapsLiveEvent): void {
    const ch = this.channels.get(sceneId)?.channel;
    if (ch) void ch.send({ type: 'broadcast', event: 'map', payload: event });
  }
}
