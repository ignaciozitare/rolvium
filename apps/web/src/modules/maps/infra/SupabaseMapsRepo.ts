import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import type { BgTransform, CreateSceneInput, Drawing, DrawingData, DrawingKind, FogMode, GridSettings, ImageAsset, Lighting, NewDrawing, NewToken, NewWall, RowChange, Scene, ScenePatch, Token, TokenPatch, Wall, WallKind, WallPatch } from '../domain/entities/Scene';
import type { MapsLiveEvent, MapsLiveHandlers, MapsPort, Unsubscribe } from '../domain/ports/MapsPort';

interface SceneRow { id: string; campaign_id: string; name: string; width: number; height: number; bg_color: string; bg_image_url: string | null; bg_transform: BgTransform; grid: GridSettings; fog_mode: FogMode; lighting: Lighting; night_radius_m: number; sort_order: number; visible_players: boolean; created_at: string; updated_at: string }
interface WallRow { id: string; scene_id: string; campaign_id: string; x1: number; y1: number; x2: number; y2: number; visible_players: boolean; kind: WallKind; blocks_sight: boolean; blocks_move: boolean; is_open: boolean }
interface TokenRow { id: string; scene_id: string; campaign_id: string; character_id: string | null; bestiary_ref: string | null; name: string; image_url: string | null; x: number; y: number; size: number; color: string | null; visible: boolean; controlled_by: string | null; vision_radius: number | null; state: Record<string, unknown> }
interface DrawingRow { id: string; scene_id: string; campaign_id: string; author_id: string; kind: DrawingKind; data: DrawingData; color: string; width: number; created_at: string }
interface ImageRow { id: string; campaign_id: string; name: string; url: string; created_at: string }

const SCENE_COLS = 'id, campaign_id, name, width, height, bg_color, bg_image_url, bg_transform, grid, fog_mode, lighting, night_radius_m, sort_order, visible_players, created_at, updated_at';
const WALL_COLS = 'id, scene_id, campaign_id, x1, y1, x2, y2, visible_players, kind, blocks_sight, blocks_move, is_open';
/** Defaults mirror the migration, so a row written before slice 2 still reads as a plain closed wall. */
const DEFAULT_NIGHT_RADIUS_M = 10;
const TOKEN_COLS = 'id, scene_id, campaign_id, character_id, bestiary_ref, name, image_url, x, y, size, color, visible, controlled_by, vision_radius, state';
export const BACKGROUNDS_BUCKET = 'backgrounds';

export const mapSceneRow = (r: SceneRow): Scene => ({
  id: r.id, campaignId: r.campaign_id, name: r.name, width: r.width, height: r.height, bgColor: r.bg_color, bgImageUrl: r.bg_image_url,
  bgTransform: r.bg_transform ?? { mode: 'cover', x: 0, y: 0, scale: 1 }, grid: r.grid ?? { size: 27, visible: true }, fogMode: r.fog_mode,
  lighting: r.lighting ?? 'day', nightRadiusM: r.night_radius_m ?? DEFAULT_NIGHT_RADIUS_M,
  sortOrder: r.sort_order, visiblePlayers: r.visible_players, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const mapWallRow = (r: WallRow): Wall => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, visiblePlayers: r.visible_players,
  kind: r.kind ?? 'wall', blocksSight: r.blocks_sight ?? true, blocksMove: r.blocks_move ?? true, isOpen: r.is_open ?? false,
});
function wallPatchRow(p: WallPatch): Record<string, unknown> {
  const map: Record<string, string> = { visiblePlayers: 'visible_players', kind: 'kind', blocksSight: 'blocks_sight', blocksMove: 'blocks_move', isOpen: 'is_open' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) { const v = (p as Record<string, unknown>)[k]; if (v !== undefined) row[col] = v; }
  return row;
}
export const mapTokenRow = (r: TokenRow): Token => ({
  id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, characterId: r.character_id, bestiaryRef: r.bestiary_ref, name: r.name, imageUrl: r.image_url,
  x: r.x, y: r.y, size: r.size, color: r.color, visible: r.visible, controlledBy: r.controlled_by, visionRadius: r.vision_radius, state: r.state ?? {},
});
export const mapDrawingRow = (r: DrawingRow): Drawing => ({ id: r.id, sceneId: r.scene_id, campaignId: r.campaign_id, authorId: r.author_id, kind: r.kind, data: r.data, color: r.color, width: r.width, createdAt: r.created_at });
export const mapImageRow = (r: ImageRow): ImageAsset => ({ id: r.id, campaignId: r.campaign_id, name: r.name, url: r.url, createdAt: r.created_at });

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
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder;
  if (p.visiblePlayers !== undefined) row.visible_players = p.visiblePlayers;
  return row;
}
function tokenPatchRow(p: TokenPatch): Record<string, unknown> {
  const map: Record<string, string> = { characterId: 'character_id', bestiaryRef: 'bestiary_ref', name: 'name', imageUrl: 'image_url', x: 'x', y: 'y', size: 'size', color: 'color', visible: 'visible', controlledBy: 'controlled_by', visionRadius: 'vision_radius', state: 'state' };
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
  private readonly channels = new Map<string, RealtimeChannel>();
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
      .insert({ scene_id: w.sceneId, campaign_id: w.campaignId, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, ...wallPatchRow(w) })
      .select(WALL_COLS).single();
    this.fail(error);
    return mapWallRow(data as unknown as WallRow);
  }
  async updateWallGeometry(id: string, at: { x1: number; y1: number; x2: number; y2: number }): Promise<void> {
    const { error } = await this.db.from('maps_walls').update(at).eq('id', id);
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
    const { data, error } = await this.db.from('maps_drawings').select('id, scene_id, campaign_id, author_id, kind, data, color, width, created_at').eq('scene_id', sceneId).order('created_at', { ascending: true });
    this.fail(error);
    return ((data ?? []) as unknown as DrawingRow[]).map(mapDrawingRow);
  }
  async addDrawing(d: NewDrawing): Promise<Drawing> {
    const author_id = await this.me();
    const { data, error } = await this.db.from('maps_drawings').insert({ scene_id: d.sceneId, campaign_id: d.campaignId, author_id, kind: d.kind, data: d.data, color: d.color, width: d.width }).select('id, scene_id, campaign_id, author_id, kind, data, color, width, created_at').single();
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
  async removeAllDrawings(sceneId: string): Promise<void> {
    const { error } = await this.db.from('maps_drawings').delete().eq('scene_id', sceneId);
    this.fail(error);
  }

  // ── realtime ──
  subscribe(sceneId: string, h: MapsLiveHandlers): Unsubscribe {
    const channel: RealtimeChannel = this.db.channel(`scene:${sceneId}`);
    const byScene = { event: '*' as const, schema: 'public', filter: `scene_id=eq.${sceneId}` };
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps_scenes', filter: `id=eq.${sceneId}` }, (p: Change) => h.onScene?.(toChange<SceneRow, Scene>(p, mapSceneRow)))
      .on('postgres_changes', { ...byScene, table: 'maps_tokens' }, (p: Change) => h.onToken?.(toChange<TokenRow, Token>(p, mapTokenRow)))
      .on('postgres_changes', { ...byScene, table: 'maps_walls' }, (p: Change) => h.onWall?.(toChange<WallRow, Wall>(p, mapWallRow)))
      .on('postgres_changes', { ...byScene, table: 'maps_drawings' }, (p: Change) => h.onDrawing?.(toChange<DrawingRow, Drawing>(p, mapDrawingRow)))
      .on('broadcast', { event: 'map' }, (msg: { payload: MapsLiveEvent }) => h.onEvent?.(msg.payload))
      .subscribe();
    this.channels.set(sceneId, channel);
    return () => { if (this.channels.get(sceneId) === channel) this.channels.delete(sceneId); void this.db.removeChannel(channel); };
  }
  broadcast(sceneId: string, event: MapsLiveEvent): void {
    const ch = this.channels.get(sceneId);
    if (ch) void ch.send({ type: 'broadcast', event: 'map', payload: event });
  }
}
