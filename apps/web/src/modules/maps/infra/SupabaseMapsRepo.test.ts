import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { BACKGROUNDS_BUCKET, SupabaseMapsRepo, mapDrawingRow, mapSceneRow, mapTokenRow, mapWallRow } from './SupabaseMapsRepo';

const SCENE_ROW = { id: 'sc-1', campaign_id: 'c1', name: 'Almacén', width: 1080, height: 675, bg_color: '#4a4a3e', bg_image_url: null, bg_transform: { mode: 'cover' as const, x: 0, y: 0, scale: 1 }, grid: { size: 27, visible: true }, fog_mode: 'vision' as const, sort_order: 0, visible_players: false, created_at: 't', updated_at: 't' };
const TOKEN_ROW = { id: 'tk-1', scene_id: 'sc-1', campaign_id: 'c1', character_id: 'ch-karen', bestiary_ref: null, name: 'Karen', image_url: null, x: 10, y: 11, size: 1, color: '#6e2418', visible: true, controlled_by: 'u-pip', vision_radius: null, state: {} };
const WALL_ROW = { id: 'w-1', scene_id: 'sc-1', campaign_id: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visible_players: false };
const DRAWING_ROW = { id: 'd-1', scene_id: 'sc-1', campaign_id: 'c1', author_id: 'u-pip', kind: 'stroke' as const, data: { points: [[1, 2]] as [number, number][] }, color: '#c9a84c', width: 2, created_at: 't' };
const IMAGE_ROW = { id: 'img-1', campaign_id: 'c1', name: 'Capilla', url: 'https://x/chapel.png', created_at: 't' };

const withSession = (client: Record<string, unknown>, uid = 'u-pip') => ({ ...client, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: uid } } } }) } });
const q = (m: ReturnType<typeof createSupabaseMock>, i = 0) => (m.client.from as ReturnType<typeof vi.fn>).mock.results[i]!.value as Record<string, ReturnType<typeof vi.fn>>;

describe('SupabaseMapsRepo — mappers', () => {
  it('maps snake_case rows to entities with jsonb defaults', () => {
    expect(mapSceneRow(SCENE_ROW)).toMatchObject({ id: 'sc-1', campaignId: 'c1', bgColor: '#4a4a3e', bgTransform: { mode: 'cover' }, grid: { size: 27 }, fogMode: 'vision', visiblePlayers: false });
    expect(mapSceneRow({ ...SCENE_ROW, bg_transform: null as never, grid: null as never }).grid).toEqual({ size: 27, visible: true });
    expect(mapTokenRow(TOKEN_ROW)).toMatchObject({ id: 'tk-1', sceneId: 'sc-1', characterId: 'ch-karen', controlledBy: 'u-pip', x: 10, y: 11, state: {} });
    expect(mapWallRow(WALL_ROW)).toMatchObject({ id: 'w-1', x2: 10, visiblePlayers: false });
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
    const w = await repo.addWall({ sceneId: 'sc-1', campaignId: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visiblePlayers: false });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', x1: 0, y1: 0, x2: 10, y2: 0, visible_players: false });
    expect(w.id).toBe('w-1');
    await repo.removeWall('w-1');
    expect(m.deleteSpy).toHaveBeenCalled();
    expect(q(m, 1)['eq']).toHaveBeenCalledWith('id', 'w-1');
  });
  it('tokens: insert maps every column, updateToken sends only the given columns (x/y for a player move)', async () => {
    const m = createSupabaseMock({ tables: { maps_tokens: { data: TOKEN_ROW, error: null } } });
    const repo = new SupabaseMapsRepo(m.client as unknown as SupabaseClient);
    await repo.addToken({ sceneId: 'sc-1', campaignId: 'c1', characterId: 'ch-karen', bestiaryRef: null, name: 'Karen', imageUrl: 'i', x: 1, y: 2, size: 1, color: null, visible: true, controlledBy: 'u-pip', visionRadius: null, state: {} });
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', character_id: 'ch-karen', bestiary_ref: null, name: 'Karen', image_url: 'i', x: 1, y: 2, size: 1, color: null, visible: true, controlled_by: 'u-pip', vision_radius: null, state: {} });
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
    expect(m.insertSpy).toHaveBeenCalledWith({ scene_id: 'sc-1', campaign_id: 'c1', author_id: 'u-pip', kind: 'stroke', data: { points: [[1, 2]] }, color: '#c9a84c', width: 2 });
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

describe('SupabaseMapsRepo — realtime', () => {
  it('subscribe opens scene:{id} with postgres_changes per table + broadcast; delivers mapped changes; broadcast sends on it; unsubscribe removes it', () => {
    const m = createSupabaseMock();
    const handlers: { type: string; filter: Record<string, string>; cb: (p: unknown) => void }[] = [];
    const channel = { on: vi.fn((type: string, filter: Record<string, string>, cb: (p: unknown) => void) => { handlers.push({ type, filter, cb }); return channel; }), subscribe: vi.fn(() => channel), send: vi.fn() };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repo = new SupabaseMapsRepo(client as unknown as SupabaseClient);
    const h = { onScene: vi.fn(), onToken: vi.fn(), onWall: vi.fn(), onDrawing: vi.fn(), onEvent: vi.fn() };
    const off = repo.subscribe('sc-1', h);
    expect(client.channel).toHaveBeenCalledWith('scene:sc-1');
    expect(handlers.map(x => x.filter.table ?? x.filter.event)).toEqual(['maps_scenes', 'maps_tokens', 'maps_walls', 'maps_drawings', 'map']);
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
    const ev = { type: 'pin.focused' as const, campaignId: 'c1', sceneId: 'sc-1', x: 1, y: 2, by: 'u-gm' };
    handlers[4]!.cb({ payload: ev });
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
});
