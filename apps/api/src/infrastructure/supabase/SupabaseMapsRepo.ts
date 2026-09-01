import type { SupabaseClient } from '@supabase/supabase-js';
import type { FogCell } from '@rolvium/core';
import type { IMapsRepository, LayerRecord, LightRecord, SceneRecord, ScenePropRecord, TableRole, TokenRecord, WallRecord } from '../../domain/maps/IMapsRepository.js';

interface SceneRow { id: string; campaign_id: string; width: number; height: number; grid: { size?: number } | null; fog_mode: SceneRecord['fogMode']; lighting: SceneRecord['lighting']; night_radius_m: number; solid_walls: boolean }
interface WallRow { id: string; x1: number; y1: number; x2: number; y2: number; blocks_sight: boolean; blocks_move: boolean; is_open: boolean }
interface TokenRow { id: string; x: number; y: number; size: number; controlled_by: string | null }
interface LightRow { id: string; layer_id: string | null; x: number; y: number; rotation: number; shape: LightRecord['shape']; cone_angle: number; range_m: number; casts_shadow: boolean; spin_ms: number }
interface LayerRow { id: string; kind: LayerRecord['kind']; visible: boolean }
interface ScenePropRow { id: string; layer_id: string | null; x: number; y: number; rotation: number; blocks_sight: boolean; blocks_move: boolean; block_shape: ScenePropRecord['blockShape']; block_w: number; block_h: number; block_dx: number; block_dy: number }

const DEFAULT_GRID = 27;
/** Rows may hold anything jsonb; keep only well-formed integer pairs. */
const toCells = (raw: unknown): FogCell[] =>
  Array.isArray(raw) ? raw.filter((c): c is FogCell => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) : [];

/** Service-role reader over `maps_*`: the server sees EVERY wall, which is what makes server-side vision a boundary. */
export class SupabaseMapsRepo implements IMapsRepository {
  constructor(private readonly db: SupabaseClient) {}

  private fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }

  async getScene(sceneId: string): Promise<SceneRecord | null> {
    const { data, error } = await this.db.from('maps_scenes')
      .select('id, campaign_id, width, height, grid, fog_mode, lighting, night_radius_m, solid_walls').eq('id', sceneId).maybeSingle();
    this.fail(error);
    if (!data) return null;
    const r = data as unknown as SceneRow;
    return {
      id: r.id, campaignId: r.campaign_id, width: r.width, height: r.height, gridSize: r.grid?.size ?? DEFAULT_GRID,
      fogMode: r.fog_mode, lighting: r.lighting, nightRadiusM: r.night_radius_m,
      // Una escena de antes de la rebanada 4 no trae la columna: «no sólidas», que es como estaba.
      solidWalls: r.solid_walls ?? false,
    };
  }

  async listWalls(sceneId: string): Promise<WallRecord[]> {
    const { data, error } = await this.db.from('maps_walls').select('id, x1, y1, x2, y2, blocks_sight, blocks_move, is_open').eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as unknown as WallRow[]).map(r => ({ id: r.id, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, blocksSight: r.blocks_sight, blocksMove: r.blocks_move, isOpen: r.is_open }));
  }

  async listTokens(sceneId: string): Promise<TokenRecord[]> {
    const { data, error } = await this.db.from('maps_tokens').select('id, x, y, size, controlled_by').eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as unknown as TokenRow[]).map(r => ({ id: r.id, x: r.x, y: r.y, size: r.size, controlledBy: r.controlled_by }));
  }

  async listLights(sceneId: string): Promise<LightRecord[]> {
    const { data, error } = await this.db.from('maps_lights').select('id, layer_id, x, y, rotation, shape, cone_angle, range_m, casts_shadow, spin_ms').eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as unknown as LightRow[]).map(r => ({
      id: r.id, layerId: r.layer_id, x: r.x, y: r.y, rotation: r.rotation,
      shape: r.shape, coneAngle: r.cone_angle, rangeM: r.range_m, castsShadow: r.casts_shadow,
      spinMs: r.spin_ms ?? 0,
    }));
  }

  async listLayers(sceneId: string): Promise<LayerRecord[]> {
    const { data, error } = await this.db.from('maps_layers').select('id, kind, visible').eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as unknown as LayerRow[]).map(r => ({ id: r.id, kind: r.kind, visible: r.visible }));
  }

  async listSightBlockingProps(sceneId: string): Promise<ScenePropRecord[]> {
    const { data, error } = await this.db.from('maps_scene_props')
      .select('id, layer_id, x, y, rotation, blocks_sight, blocks_move, block_shape, block_w, block_h, block_dx, block_dy')
      .eq('scene_id', sceneId).eq('blocks_sight', true);
    this.fail(error);
    return ((data ?? []) as unknown as ScenePropRow[]).map(r => ({
      id: r.id, layerId: r.layer_id, x: r.x, y: r.y, rotation: r.rotation,
      blocksSight: r.blocks_sight, blocksMove: r.blocks_move, blockShape: r.block_shape,
      blockW: r.block_w, blockH: r.block_h, blockDx: r.block_dx, blockDy: r.block_dy,
    }));
  }

  async roleOf(campaignId: string, userId: string): Promise<TableRole | null> {
    const { data, error } = await this.db.from('campaigns_members').select('role').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle();
    this.fail(error);
    return (data as { role: TableRole } | null)?.role ?? null;
  }

  async listPlayerIds(campaignId: string): Promise<string[]> {
    const { data, error } = await this.db.from('campaigns_members').select('user_id').eq('campaign_id', campaignId).eq('role', 'player');
    this.fail(error);
    return ((data ?? []) as { user_id: string }[]).map(r => r.user_id);
  }

  async getExplored(sceneId: string, userId: string): Promise<FogCell[]> {
    const { data, error } = await this.db.from('maps_fog').select('explored').eq('scene_id', sceneId).eq('user_id', userId).maybeSingle();
    this.fail(error);
    return toCells((data as { explored: unknown } | null)?.explored);
  }

  async listExplored(sceneId: string): Promise<FogCell[][]> {
    const { data, error } = await this.db.from('maps_fog').select('explored').eq('scene_id', sceneId);
    this.fail(error);
    return ((data ?? []) as { explored: unknown }[]).map(r => toCells(r.explored));
  }

  async saveExplored(sceneId: string, campaignId: string, userId: string, cells: FogCell[]): Promise<void> {
    const { error } = await this.db.from('maps_fog')
      .upsert({ scene_id: sceneId, user_id: userId, campaign_id: campaignId, explored: cells, updated_at: new Date().toISOString() }, { onConflict: 'scene_id,user_id' });
    this.fail(error);
  }
}
