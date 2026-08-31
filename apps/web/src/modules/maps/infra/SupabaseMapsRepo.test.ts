import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { BACKGROUNDS_BUCKET, SupabaseMapsRepo, mapDrawingRow, mapLayerRow, mapPropRow, mapSceneRow, mapScenePropRow, mapTokenRow, mapWallRow } from './SupabaseMapsRepo';

const SCENE_ROW = { id: 'sc-1', campaign_id: 'c1', name: 'Almacén', width: 1080, height: 675, bg_color: '#4a4a3e', bg_image_url: null, bg_transform: { mode: 'cover' as const, x: 0, y: 0, scale: 1 }, grid: { size: 27, visible: true }, fog_mode: 'vision' as const, lighting: 'day' as const, night_radius_m: 10, solid_walls: false, sort_order: 0, visible_players: false, created_at: 't', updated_at: 't' };
const TOKEN_ROW = { id: 'tk-1', scene_id: 'sc-1', campaign_id: 'c1', character_id: 'ch-karen', bestiary_ref: null, bestiary_entry_id: null, name: 'Karen', image_url: null, x: 10, y: 11, size: 1, color: '#6e2418', visible: true, controlled_by: 'u-pip', vision_radius: null, state: {}, layer_id: null };
const WALL_ROW = { id: 'w-1', scene_id: 'sc-1', campaign_id: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visible_players: false, kind: 'wall' as const, blocks_sight: true, blocks_move: true, is_open: false };
const LAYER_ROW = { id: 'ly-1', scene_id: 'sc-1', campaign_id: 'c1', kind: 'terrain' as const, name: 'Musgo', sort_order: 1, visible: true, locked: false, image_url: 'https://x/moss.png', transform: { mode: 'cover' as const, x: 0, y: 0, scale: 1 }, mask_url: 'https://x/masks/ly-1.png', mask_version: 3, created_at: 't', updated_at: 't' };
const LIGHT_ROW = { id: 'li-1', scene_id: 'sc-1', campaign_id: 'c1', layer_id: null, shape: 'radius' as const, kind: 'torch' as const, x: 300, y: 200, rotation: 0, cone_angle: 60, color: '#e8a24e', flicker: true, range_m: 6, casts_shadow: false, created_at: 't', updated_at: 't' };
const DRAWING_ROW = { id: 'd-1', scene_id: 'sc-1', campaign_id: 'c1', author_id: 'u-pip', kind: 'stroke' as const, data: { points: [[1, 2]] as [number, number][] }, color: '#c9a84c', width: 2, created_at: 't', layer_id: null };
const IMAGE_ROW = { id: 'img-1', campaign_id: 'c1', name: 'Capilla', url: 'https://x/chapel.png', created_at: 't' };
const PROP_ROW = { id: 'pr-1', campaign_id: 'c1', name: 'Roble', category: 'vegetation' as const, image_url: 'https://x/oak.webp', natural_width: 200, natural_height: 300, default_scale: 1.5, default_blocks_sight: true, default_blocks_move: false, default_block_shape: 'circle' as const, uploaded_by: 'u-gm', created_at: 't', updated_at: 't' };
const SCENE_PROP_ROW = { id: 'sp-1', scene_id: 'sc-1', campaign_id: 'c1', layer_id: null, prop_id: 'pr-1', image_url: 'https://x/oak.webp', name: 'Roble', x: 120, y: 340, width: 300, height: 450, rotation: 15, blocks_sight: true, blocks_move: false, block_shape: 'circle' as const, block_w: 450, block_h: 450, block_dx: 0, block_dy: 0, created_at: 't', updated_at: 't' };

const withSession = (client: Record<string, unknown>, uid = 'u-pip') => ({ ...client, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: uid } } } }) } });
const q = (m: ReturnType<typeof createSupabaseMock>, i = 0) => (m.client.from as ReturnType<typeof vi.fn>).mock.results[i]!.value as Record<string, ReturnType<typeof vi.fn>>;

describe('SupabaseMapsRepo — mappers', () => {
  it('maps snake_case rows to entities with jsonb defaults', () => {
    expect(mapSceneRow(SCENE_ROW)).toMatchObject({ id: 'sc-1', campaignId: 'c1', bgColor: '#4a4a3e', bgTransform: { mode: 'cover' }, grid: { size: 27 }, fogMode: 'vision', lighting: 'day', nightRadiusM: 10, visiblePlayers: false });
    // a row written before slice 2 still reads as a plain closed wall by day
    expect(mapSceneRow({ ...SCENE_ROW, lighting: null as never, night_radius_m: null as never })).toMatchObject({ lighting: 'day', nightRadiusM: 10 });
    // Y una escrita antes de la rebanada 4 se lee como «paredes NO sólidas», que es como se comportaba.
    expect(mapSceneRow(SCENE_ROW).solidWalls).toBe(false);
    expect(mapSceneRow({ ...SCENE_ROW, solid_walls: true }).solidWalls).toBe(true);
    expect(mapSceneRow({ ...SCENE_ROW, solid_walls: null as never }).solidWalls).toBe(false);
    expect(mapSceneRow({ ...SCENE_ROW, bg_transform: null as never, grid: null as never }).grid).toEqual({ size: 27, visible: true });
    expect(mapTokenRow(TOKEN_ROW)).toMatchObject({ id: 'tk-1', sceneId: 'sc-1', characterId: 'ch-karen', controlledBy: 'u-pip', x: 10, y: 11, state: {}, layerId: null });
    // El enlace al encuentro propio (H5). Una fila escrita antes de la columna lo lee como «ninguno».
    expect(mapTokenRow({ ...TOKEN_ROW, bestiary_entry_id: 'be-9' }).bestiaryEntryId).toBe('be-9');
    expect(mapTokenRow({ ...TOKEN_ROW, bestiary_entry_id: null as never }).bestiaryEntryId).toBeNull();
    expect(mapWallRow(WALL_ROW)).toMatchObject({ id: 'w-1', x2: 10, visiblePlayers: false, kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false });
    expect(mapDrawingRow(DRAWING_ROW)).toMatchObject({ id: 'd-1', authorId: 'u-pip', kind: 'stroke', data: { points: [[1, 2]] } });
  });
});

describe('SupabaseMapsRepo — scenes', () => {
  it('listScenes filters by campaign ordered by sort_order; getScene by id; errors throw', async () => {
    const m = createSupabaseMock({ tables: { maps_scenes: { data: [SCENE_ROW], error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    expect(await repo.listScenes('c1')).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('maps_scenes');
    expect(q(m)['eq']).toHaveBeenCalledWith('campaign_id', 'c1');
    expect(q(m)['order']).toHaveBeenCalledWith('sort_order', { ascending: true });
    const one = createSupabaseMock({ tables: { maps_scenes: { data: SCENE_ROW, error: null } } });
    expect((await new SupabaseMapsRepo(one.client as unknown as SupabaseClient).getScene('sc-1'))?.name).toBe('Almacén');
    expect(q(one)['maybeSingle']).toHaveBeenCalled();
    const bad = createSupabaseMock({ tables: { maps_scenes: { data: null, error: new Error('rls') } } });
    await expect(new SupabaseMapsRepo(bad.client as unknown as SupabaseClient).listScenes('c1')).rejects.toThrow('rls');
  });
  it('createScene inserts with created_by = me; updateScene maps the patch to columns; removeScene deletes; setActiveScene updates the campaign', async () => {
    const m = createSupabaseMock({ tables: { maps_scenes: { data: SCENE_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(withSession(m.client, 'u-gm') as unknown as SupabaseClient);
    const s = await repo.createScene({ campaignId: 'c1', name: 'Almacén', sortOrder: 2 });
    expect(s.id).toBe('sc-1');
    expect(m.insertSpy).toHaveBeenCalledWith({ campaign_id: 'c1', name: 'Almacén', created_by: 'u-gm', sort_order: 2 });
    await repo.updateScene('sc-1', { bgColor: '#111111', bgImageUrl: 'u', bgTransform: { mode: 'contain', x: 0, y: 0, scale: 1 }, visiblePlayers: true, name: 'X' });
    expect(m.updateSpy).toHaveBeenCalledWith({ bg_color: '#111111', bg_image_url: 'u', bg_transform: { mode: 'contain', x: 0, y: 0, scale: 1 }, visible_players: true, name: 'X' });
    await repo.removeScene('sc-1');
    expect(m.deleteSpy).toHaveBeenCalled();
    await repo.setActiveScene('c1', 'sc-1');
    expect(m.fromSpy).toHaveBeenLastCalledWith('campaigns_campaigns');
    expect(m.updateSpy).toHaveBeenLastCalledWith({ active_scene_id: 'sc-1' });
    const noSession = createSupabaseMock();
    await expect(new SupabaseMapsRepo(noSession.client as unknown as SupabaseClient).createScene({ campaignId: 'c1', name: 'x' })).rejects.toThrow('not_authenticated');
  });
});

describe('SupabaseMapsRepo — images', () => {
  it('uploadImage stores under backgrounds/{campaignId}/{uuid}.png and inserts the row; listImages by campaign', async () => {
    const m = createSupabaseMock({ tables: { maps_images: { data: IMAGE_ROW, error: null } } });
    const upload = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { ...withSession(m.client, 'u-gm'), storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn((p: string) => ({ data: { publicUrl: `https://x/${p}` } })) })) } };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    const img = await repo.uploadImage('c1', new Blob(['x'], { type: 'image/png' }), 'Capilla');
    expect(client.storage.from).toHaveBeenCalledWith(BACKGROUNDS_BUCKET);
    expect(upload.mock.calls[0]![0]).toMatch(/^c1\/[0-9a-f-]{36}\.png$/);
    expect(m.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ campaign_id: 'c1', name: 'Capilla', uploaded_by: 'u-gm', url: expect.stringContaining('https://x/c1/') }));
    expect(img.name).toBe('Capilla');
    const list = createSupabaseMock({ tables: { maps_images: { data: [IMAGE_ROW], error: null } } });
    expect(await new SupabaseMapsRepo(list.client as unknown as SupabaseClient).listImages('c1')).toHaveLength(1);
    expect(q(list)['eq']).toHaveBeenCalledWith('campaign_id', 'c1');
    const failing = { ...client, storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'too big' } }), getPublicUrl: vi.fn() })) } };
    await expect(new SupabaseMapsRepo(failing as unknown as SupabaseClient).uploadImage('c1', new Blob(['x']), 'x')).rejects.toThrow('too big');
  });
});

describe('SupabaseMapsRepo — walls, tokens, drawings', () => {
  it('walls: list by scene, insert maps camelCase, delete by id', async () => {
    const list = createSupabaseMock({ tables: { maps_walls: { data: [WALL_ROW], error: null } } });
    expect(await new SupabaseMapsRepo(list.client as unknown as SupabaseClient).listWalls('sc-1')).toHaveLength(1);
    expect(q(list)['eq']).toHaveBeenCalledWith('scene_id', 'sc-1');
    const m = createSupabaseMock({ tables: { maps_walls: { data: WALL_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    const w = await repo.addWall({ sceneId: 'sc-1', campaignId: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visiblePlayers: false, kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visible_players: false, kind: 'wall', blocks_sight: true, blocks_move: true, is_open: false });
    expect(w.id).toBe('w-1');
    await repo.removeWall('w-1');
    expect(m.deleteSpy).toHaveBeenCalled();
    expect(q(m, 1)['eq']).toHaveBeenCalledWith('id', 'w-1');
  });
  it('tokens: insert maps every column, updateToken sends only the given columns (x/y for a player move)', async () => {
    const m = createSupabaseMock({ tables: { maps_tokens: { data: TOKEN_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    await repo.addToken({ sceneId: 'sc-1', campaignId: 'c1', characterId: 'ch-karen', bestiaryRef: null, bestiaryEntryId: null, name: 'Karen', imageUrl: 'i', x: 1, y: 2, size: 1, color: null, visible: true, controlledBy: 'u-pip', visionRadius: null, state: {} });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', character_id: 'ch-karen', bestiary_ref: null, bestiary_entry_id: null, name: 'Karen', image_url: 'i', x: 1, y: 2, size: 1, color: null, visible: true, controlled_by: 'u-pip', vision_radius: null, state: {} });
    await repo.updateToken('tk-1', { x: 3, y: 4 });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ x: 3, y: 4 });
    await repo.updateToken('tk-1', { visible: false, controlledBy: null });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ visible: false, controlled_by: null });
    const bad = createSupabaseMock({ tables: { maps_tokens: { data: null, error: new Error('players may only move their token') } } });
    await expect(new SupabaseMapsRepo(bad.client as unknown as SupabaseClient).updateToken('tk-1', { name: 'x' })).rejects.toThrow(/only move/);
  });
  it('drawings: addDrawing stamps author_id = me; removeMyDrawings filters scene + author; removeAllDrawings only by scene', async () => {
    const m = createSupabaseMock({ tables: { maps_drawings: { data: DRAWING_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(withSession(m.client, 'u-pip') as unknown as SupabaseClient);
    const d = await repo.addDrawing({ sceneId: 'sc-1', campaignId: 'c1', kind: 'stroke', data: { points: [[1, 2]] }, color: '#c9a84c', width: 2 });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', author_id: 'u-pip', kind: 'stroke', data: { points: [[1, 2]] }, color: '#c9a84c', width: 2, layer_id: null });
    expect(d.authorId).toBe('u-pip');
    await repo.removeMyDrawings('sc-1');
    expect(q(m, 1)['eq']).toHaveBeenCalledWith('scene_id', 'sc-1');
    expect(q(m, 1)['eq']).toHaveBeenCalledWith('author_id', 'u-pip');
    await repo.removeAllDrawings('sc-1');
    expect(q(m, 2)['eq']).toHaveBeenCalledTimes(1);
    await repo.removeDrawing('d-1');
    expect(q(m, 3)['eq']).toHaveBeenCalledWith('id', 'd-1');
  });
});

describe('SupabaseMapsRepo — capas y luces (rebanada 7)', () => {
  it('las capas se piden por escena y en orden, y sólo se insertan las de terreno', async () => {
    const m = createSupabaseMock({ tables: { maps_layers: { data: LAYER_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    const l = await repo.addLayer({ sceneId: 'sc-1', campaignId: 'c1', kind: 'terrain', name: 'Musgo', sortOrder: 1, imageUrl: 'https://x/moss.png' });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', kind: 'terrain', name: 'Musgo', sort_order: 1, image_url: 'https://x/moss.png' });
    expect(l).toMatchObject({ kind: 'terrain', name: 'Musgo', maskVersion: 3, transform: { mode: 'cover' } });
    // Una capa sin encaje propio se guarda con el de la casa, no con `undefined`.
    expect(mapLayerRow({ ...LAYER_ROW, transform: null as never, name: null as never, mask_version: null as never })).toMatchObject({ transform: { mode: 'cover', x: 0, y: 0, scale: 1 }, name: '', maskVersion: 0 });
  });

  it('el ojo y el candado viajan como columnas, y sólo las que se tocan', async () => {
    const m = createSupabaseMock({ tables: { maps_layers: { data: LAYER_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    await repo.updateLayer('ly-1', { visible: false });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ visible: false });
    await repo.updateLayer('ly-1', { locked: true, sortOrder: 2 });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ locked: true, sort_order: 2 });
  });

  /**
   * La máscara se sobreescribe SIEMPRE en la misma ruta, bajo la carpeta de la campaña —que es lo que mira
   * la política del bucket— y lo que cambia en la fila es la versión: sin ella el CDN seguiría sirviendo la
   * máscara vieja y el pincel parecería no hacer nada.
   */
  it('guardar la máscara sobreescribe el mismo PNG y sube la versión', async () => {
    const m = createSupabaseMock({ tables: { maps_layers: { data: { ...LAYER_ROW, mask_version: 4 }, error: null } } });
    const upload = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { ...m.client, storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://x/${path}` } })) })) } };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    const png = new Blob(['x'], { type: 'image/png' });
    const out = await repo.saveMask({ id: 'ly-1', campaignId: 'c1', maskVersion: 3 }, png);
    expect(client.storage.from).toHaveBeenCalledWith(BACKGROUNDS_BUCKET);
    expect(upload).toHaveBeenCalledWith('c1/masks/ly-1.png', png, expect.objectContaining({ upsert: true, contentType: 'image/png' }));
    expect(m.updateSpy).toHaveBeenCalledWith({ mask_url: 'https://x/c1/masks/ly-1.png', mask_version: 4 });
    expect(out.maskVersion).toBe(4);
  });

  /**
   * La fila se vacía ANTES que el fichero: si el borrado del PNG falla, la capa ya se ve entera y lo único
   * que queda por detrás es un fichero huérfano. Al revés, un borrado a medias dejaría una capa apuntando a
   * una máscara que ya no existe.
   */
  it('quitar la máscara vacía la fila y borra el fichero de la campaña', async () => {
    const m = createSupabaseMock({ tables: { maps_layers: { data: LAYER_ROW, error: null } } });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { ...m.client, storage: { from: vi.fn(() => ({ remove })) } };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    await repo.clearMask({ id: 'ly-1', campaignId: 'c1' });
    expect(m.updateSpy).toHaveBeenCalledWith({ mask_url: null });
    expect(remove).toHaveBeenCalledWith(['c1/masks/ly-1.png']);
  });

  it('las luces mapean sus columnas, incluidas las que todavía no se usan', async () => {
    const m = createSupabaseMock({ tables: { maps_lights: { data: LIGHT_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    const l = await repo.addLight({ sceneId: 'sc-1', campaignId: 'c1', layerId: null, shape: 'radius', kind: 'torch', x: 300, y: 200, rotation: 0, coneAngle: 60, color: '#e8a24e', flicker: true, rangeM: 6, castsShadow: false });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', layer_id: null, shape: 'radius', kind: 'torch', x: 300, y: 200, rotation: 0, cone_angle: 60, color: '#e8a24e', flicker: true, range_m: 6, casts_shadow: false });
    // `rangeM` y `castsShadow` se guardan desde el primer día aunque todavía no iluminen.
    expect(l).toMatchObject({ kind: 'torch', rangeM: 6, castsShadow: false, coneAngle: 60 });
    await repo.updateLight('li-1', { flicker: false });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ flicker: false });
    await repo.updateLight('li-1', { layerId: 'ly-1', rangeM: 9 });
    expect(m.updateSpy).toHaveBeenLastCalledWith({ layer_id: 'ly-1', range_m: 9 });
  });
});

describe('SupabaseMapsRepo — realtime', () => {
  it('subscribe opens scene:{id} with postgres_changes per table + broadcast; delivers mapped changes; broadcast sends on it; unsubscribe removes it', () => {
    const m = createSupabaseMock();
    const handlers: { type: string; filter: Record<string, string>; cb: (p: unknown) => void }[] = [];
    const channel = { on: vi.fn((type: string, filter: Record<string, string>, cb: (p: unknown) => void) => { handlers.push({ type, filter, cb }); return channel; }), subscribe: vi.fn(() => channel), send: vi.fn() };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    const h = { onScene: vi.fn(), onToken: vi.fn(), onWall: vi.fn(), onDrawing: vi.fn(), onLayer: vi.fn(), onLight: vi.fn(), onSceneProp: vi.fn(), onEvent: vi.fn() };
    const off = repo.subscribe('sc-1', h);
    expect(client.channel).toHaveBeenCalledWith('scene:sc-1');
    expect(handlers.map(x => x.filter.table ?? x.filter.event)).toEqual(['maps_scenes', 'maps_tokens', 'maps_walls', 'maps_drawings', 'maps_layers', 'maps_lights', 'maps_scene_props', 'map']);
    expect(handlers[0]!.filter.filter).toBe('id=eq.sc-1');
    expect(handlers[1]!.filter.filter).toBe('scene_id=eq.sc-1');
    handlers[1]!.cb({ eventType: 'UPDATE', new: TOKEN_ROW, old: { id: 'tk-1' } });
    expect(h.onToken).toHaveBeenCalledWith({ type: 'UPDATE', id: 'tk-1', row: expect.objectContaining({ controlledBy: 'u-pip' }) });
    handlers[3]!.cb({ eventType: 'DELETE', new: {}, old: { id: 'd-1' } });
    expect(h.onDrawing).toHaveBeenCalledWith({ type: 'DELETE', id: 'd-1', row: null });
    handlers[0]!.cb({ eventType: 'UPDATE', new: SCENE_ROW, old: { id: 'sc-1' } });
    expect(h.onScene).toHaveBeenCalledWith(expect.objectContaining({ id: 'sc-1', row: expect.objectContaining({ name: 'Almacén' }) }));
    handlers[2]!.cb({ eventType: 'INSERT', new: WALL_ROW, old: {} });
    expect(h.onWall).toHaveBeenCalledWith(expect.objectContaining({ type: 'INSERT', id: 'w-1' }));
    // Rebanada 7: las capas y las luces llegan por el mismo canal, filtradas por escena.
    handlers[4]!.cb({ eventType: 'INSERT', new: LAYER_ROW, old: {} });
    expect(h.onLayer).toHaveBeenCalledWith(expect.objectContaining({ type: 'INSERT', id: 'ly-1', row: expect.objectContaining({ kind: 'terrain', maskVersion: 3 }) }));
    handlers[5]!.cb({ eventType: 'UPDATE', new: LIGHT_ROW, old: { id: 'li-1' } });
    expect(h.onLight).toHaveBeenCalledWith(expect.objectContaining({ id: 'li-1', row: expect.objectContaining({ kind: 'torch', rangeM: 6, castsShadow: false }) }));
    // Rebanada 6: lo plantado también, por el mismo canal y con el mismo filtro de escena.
    handlers[6]!.cb({ eventType: 'INSERT', new: SCENE_PROP_ROW, old: {} });
    expect(h.onSceneProp).toHaveBeenCalledWith(expect.objectContaining({ type: 'INSERT', id: 'sp-1', row: expect.objectContaining({ name: 'Roble', blocksSight: true, blockShape: 'circle' }) }));
    const ev = { type: 'pin.focused' as const, campaignId: 'c1', sceneId: 'sc-1', x: 1, y: 2, by: 'u-gm' };
    handlers[7]!.cb({ payload: ev });
    expect(h.onEvent).toHaveBeenCalledWith(ev);
    repo.broadcast('sc-1', ev);
    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'map', payload: ev });
    repo.broadcast('other', ev);
    expect(channel.send).toHaveBeenCalledTimes(1);
    off();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    repo.broadcast('sc-1', ev);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  /**
   * DOS SUSCRIPTORES A LA MISMA ESCENA (revisión del 2026-08-23): los encuentros del lanzador
   * (`DmEncounters`) conviven con `useScene`. Con un canal por suscriptor, el mapa por `sceneId` se pisaba
   * — cerrar el lanzador dejaba `broadcast()` mudo con la escena abierta — y dos joins al mismo topic en el
   * mismo socket hacen que Phoenix cierre el primero. UN canal real, y se quita cuando se va el ÚLTIMO.
   */
  it('regresión · dos suscriptores a la misma escena comparten UN canal, y soltar uno no deja mudo al otro', () => {
    const m = createSupabaseMock();
    const handlers: { filter: Record<string, string>; cb: (p: unknown) => void }[] = [];
    const channel = { on: vi.fn((_t: string, filter: Record<string, string>, cb: (p: unknown) => void) => { handlers.push({ filter, cb }); return channel; }), subscribe: vi.fn(() => channel), send: vi.fn() };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    const a = { onToken: vi.fn() };
    const b = { onToken: vi.fn() };
    const offA = repo.subscribe('sc-1', a);
    const offB = repo.subscribe('sc-1', b);
    expect(client.channel).toHaveBeenCalledTimes(1); // un solo topic scene:sc-1 — nada de joins duplicados
    // un cambio de token les llega a LOS DOS
    handlers[1]!.cb({ eventType: 'UPDATE', new: TOKEN_ROW, old: { id: 'tk-1' } });
    expect(a.onToken).toHaveBeenCalledTimes(1);
    expect(b.onToken).toHaveBeenCalledTimes(1);
    // se va uno (cerrar el lanzador): el canal SIGUE — el otro recibe y el broadcast no se queda mudo
    offB();
    expect(client.removeChannel).not.toHaveBeenCalled();
    handlers[1]!.cb({ eventType: 'UPDATE', new: TOKEN_ROW, old: { id: 'tk-1' } });
    expect(a.onToken).toHaveBeenCalledTimes(2);
    expect(b.onToken).toHaveBeenCalledTimes(1);
    const ev = { type: 'pin.focused' as const, campaignId: 'c1', sceneId: 'sc-1', x: 1, y: 2, by: 'u-gm' };
    repo.broadcast('sc-1', ev);
    expect(channel.send).toHaveBeenCalledTimes(1);
    // se va el último: ahora sí se quita el canal
    offA();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});


// ── Rebanada 6 · la galería de piezas ───────────────────────────────────────

describe('SupabaseMapsRepo — la biblioteca de piezas', () => {
  it('los mappers traducen las dos filas nuevas', () => {
    expect(mapPropRow(PROP_ROW)).toMatchObject({
      id: 'pr-1', campaignId: 'c1', name: 'Roble', category: 'vegetation', imageUrl: 'https://x/oak.webp',
      naturalWidth: 200, naturalHeight: 300, defaultScale: 1.5,
      defaultBlocksSight: true, defaultBlocksMove: false, defaultBlockShape: 'circle', uploadedBy: 'u-gm',
    });
    // Una del catálogo de la app llega sin campaña, y eso es lo que la distingue.
    expect(mapPropRow({ ...PROP_ROW, campaign_id: null }).campaignId).toBeNull();
    expect(mapScenePropRow(SCENE_PROP_ROW)).toMatchObject({
      id: 'sp-1', sceneId: 'sc-1', propId: 'pr-1', imageUrl: 'https://x/oak.webp', name: 'Roble',
      x: 120, y: 340, width: 300, height: 450, rotation: 15,
      blocksSight: true, blocksMove: false, blockShape: 'circle', blockW: 450, blockH: 450, blockDx: 0, blockDy: 0,
    });
    // Y una plantada cuya pieza de biblioteca ya no existe sigue entera: por eso lleva su propia foto.
    expect(mapScenePropRow({ ...SCENE_PROP_ROW, prop_id: null })).toMatchObject({ propId: null, imageUrl: 'https://x/oak.webp' });
  });

  it('lista las tuyas Y las del catálogo de la app en una sola consulta', async () => {
    const m = createSupabaseMock({ tables: { maps_props: { data: [PROP_ROW], error: null } } });
    expect(await new SupabaseMapsRepo(m.client as unknown as SupabaseClient).listProps('c1')).toHaveLength(1);
    expect(q(m).or).toHaveBeenCalledWith('campaign_id.eq.c1,campaign_id.is.null');
  });

  it('subir una pieza pone la foto y la fila bajo el MISMO id, en el bucket de fondos', async () => {
    const m = createSupabaseMock({ tables: { maps_props: { data: PROP_ROW, error: null } } });
    const client = withSession(m.client, 'u-gm');
    const bucket = { upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x/subida.webp' } })) };
    (client.storage as { from: ReturnType<typeof vi.fn> }).from = vi.fn(() => bucket);
    await new SupabaseMapsRepo(client as unknown as SupabaseClient).addProp({
      campaignId: 'c1', name: 'Roble', category: 'vegetation', imageUrl: '', naturalWidth: 200, naturalHeight: 300,
      defaultScale: 1.5, defaultBlocksSight: true, defaultBlocksMove: false, defaultBlockShape: 'circle', uploadedBy: null,
    }, new Blob(['x'], { type: 'image/webp' }));

    expect((client.storage as { from: ReturnType<typeof vi.fn> }).from).toHaveBeenCalledWith(BACKGROUNDS_BUCKET);
    const path = bucket.upload.mock.calls[0]![0] as string;
    expect(path).toMatch(/^c1\/props\/[0-9a-f-]{36}\.webp$/);
    const inserted = m.insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    // El id de la fila y el nombre del fichero son el mismo: sin eso habría que insertar y corregir después.
    expect(path).toBe(`c1/props/${inserted.id as string}.webp`);
    expect(inserted).toMatchObject({ campaign_id: 'c1', uploaded_by: 'u-gm', image_url: 'https://x/subida.webp', natural_width: 200, default_scale: 1.5, default_block_shape: 'circle' });
  });

  it('una pieza subida siempre es de una campaña: al catálogo de la app no se le mete nada desde aquí', async () => {
    const m = createSupabaseMock({});
    const repo = new SupabaseMapsRepo(withSession(m.client, 'u-gm') as unknown as SupabaseClient);
    await expect(repo.addProp({
      campaignId: null, name: 'x', category: 'misc', imageUrl: '', naturalWidth: 1, naturalHeight: 1,
      defaultScale: 1, defaultBlocksSight: false, defaultBlocksMove: false, defaultBlockShape: 'rect', uploadedBy: null,
    }, new Blob(['x']))).rejects.toThrow();
  });

  it('actualizar traduce a columnas, y es por donde se guarda la escala que la pieza recuerda', async () => {
    const m = createSupabaseMock({ tables: { maps_props: { data: PROP_ROW, error: null } } });
    await new SupabaseMapsRepo(m.client as unknown as SupabaseClient).updateProp('pr-1', { defaultScale: 2.4, defaultBlocksSight: false });
    expect(m.updateSpy).toHaveBeenCalledWith({ default_scale: 2.4, default_blocks_sight: false });
  });

  it('borrar de la biblioteca NO toca el bucket: es lo que deja vivas las ya plantadas', async () => {
    const m = createSupabaseMock({ tables: { maps_props: { data: null, error: null } } });
    const client = withSession(m.client, 'u-gm');
    const bucket = { remove: vi.fn().mockResolvedValue({ error: null }) };
    (client.storage as { from: ReturnType<typeof vi.fn> }).from = vi.fn(() => bucket);
    await new SupabaseMapsRepo(client as unknown as SupabaseClient).removeProp('pr-1');
    expect(m.deleteSpy).toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

describe('SupabaseMapsRepo — lo plantado en la escena', () => {
  it('lista por escena, planta, actualiza traduciendo a columnas y borra', async () => {
    const m = createSupabaseMock({ tables: { maps_scene_props: { data: [SCENE_PROP_ROW], error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    expect(await repo.listSceneProps('sc-1')).toHaveLength(1);
    expect(q(m).eq).toHaveBeenCalledWith('scene_id', 'sc-1');

    const m2 = createSupabaseMock({ tables: { maps_scene_props: { data: SCENE_PROP_ROW, error: null } } });
    const repo2 = new SupabaseMapsRepo(m2.client as unknown as SupabaseClient);
    await repo2.addSceneProp({
      sceneId: 'sc-1', campaignId: 'c1', layerId: 'ly-7', propId: 'pr-1', imageUrl: 'https://x/oak.webp', name: 'Roble',
      x: 120, y: 340, width: 300, height: 450, rotation: 0, blocksSight: true, blocksMove: false,
      blockShape: 'circle', blockW: 450, blockH: 450, blockDx: 0, blockDy: 0,
    });
    expect(m2.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ scene_id: 'sc-1', campaign_id: 'c1', layer_id: 'ly-7', prop_id: 'pr-1', image_url: 'https://x/oak.webp', block_shape: 'circle', block_w: 450 }));

    await repo2.updateSceneProp('sp-1', { width: 600, height: 900, rotation: 42, blocksMove: true });
    expect(m2.updateSpy).toHaveBeenCalledWith({ width: 600, height: 900, rotation: 42, blocks_move: true });

    await repo2.removeSceneProp('sp-1');
    expect(m2.deleteSpy).toHaveBeenCalled();
  });
});
