import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseCharactersRepo, mapCharacterRow } from './SupabaseCharactersRepo';

const ROW = { id: 'ch1', campaign_id: 'c1', owner_id: 'u1', kind: 'pc' as const, name: 'Marta la Loba', concept: 'Loba', avatar_url: null, token_url: null, color: null, data: { stats: { combat: 3 } }, derived: {}, health: 'healthy', xp: 0, archived_at: null, created_at: 'a', updated_at: 'b', campaign: { name: 'Ruinas', system_id: 'plenilunio' }, owner: { name: 'Pip Pérez', alias: 'Pip' } };

function make() {
  const m = createSupabaseMock({ tables: { characters: { data: [ROW], error: null }, characters_audit: { data: [{ id: 2, character_id: 'ch1', author_id: 'u1', origin: 'damage', field: 'health', before: 'healthy', after: 'bruised', at: 't' }], error: null }, campaigns_members: { data: null, error: null } } });
  (m.client.auth as Record<string, unknown>)['getSession'] = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  const saver = { save: vi.fn().mockResolvedValue({ derived: { endurance: 9 }, health: 'bruised' }) };
  return { m, saver, repo: new SupabaseCharactersRepo(m.client as unknown as SupabaseClient, saver) };
}

describe('SupabaseCharactersRepo', () => {
  it('maps rows (campaign name/system, owner alias precedence)', () => {
    const c = mapCharacterRow(ROW);
    expect(c).toMatchObject({ id: 'ch1', campaignName: 'Ruinas', systemId: 'plenilunio', ownerName: 'Pip', health: 'healthy', data: { stats: { combat: 3 } } });
    expect(mapCharacterRow({ ...ROW, owner: { name: 'Pip Pérez', alias: null } }).ownerName).toBe('Pip Pérez');
  });
  it('listMine filters by owner and listByCampaign by campaign', async () => {
    const { repo, m } = make();
    expect((await repo.listMine())[0]?.name).toBe('Marta la Loba');
    expect(m.fromSpy).toHaveBeenCalledWith('characters');
    expect((await repo.listByCampaign('c1')).length).toBe(1);
  });
  it('create inserts with me as owner by default and links my member row', async () => {
    const { repo, m } = make();
    (m.client.from as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
      const chain: Record<string, unknown> = { then: (f: (r: unknown) => unknown) => Promise.resolve({ data: t === 'characters' ? ROW : null, error: null }).then(f) };
      for (const k of ['insert', 'select', 'single', 'update', 'eq']) chain[k] = vi.fn(() => chain);
      if (t === 'characters') m.insertSpy.mockImplementation(() => chain), chain['insert'] = m.insertSpy;
      if (t === 'campaigns_members') m.updateSpy.mockImplementation(() => chain), chain['update'] = m.updateSpy;
      return chain;
    });
    const c = await repo.create({ campaignId: 'c1', name: ' Marta la Loba ', data: {} });
    expect(m.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ campaign_id: 'c1', name: 'Marta la Loba', owner_id: 'u1', kind: 'pc', created_by: 'u1' }));
    expect(m.updateSpy).toHaveBeenCalledWith({ character_id: 'ch1' });
    expect(c.id).toBe('ch1');
  });
  it('update: plain patch → table update; tagged origin → RPC', async () => {
    const { repo, m } = make();
    await repo.update('ch1', { health: 'bruised', data: { a: 1 } });
    expect(m.updateSpy).toHaveBeenCalledWith({ data: { a: 1 }, health: 'bruised' });
    await repo.update('ch1', { xp: 20 }, 'progression');
    expect(m.client.rpc).toHaveBeenCalledWith('characters_update_with_origin', { cid: 'ch1', patch: { xp: 20 }, origin: 'progression' });
    m.updateSpy.mockClear();
    await repo.update('ch1', {});
    expect(m.updateSpy).not.toHaveBeenCalled();
  });
  it('saveSheet delegates to the API sheet saver (data, origin, xp) and returns its derived/health', async () => {
    const { repo, saver } = make();
    const r = await repo.saveSheet('ch1', { data: { name: 'K' }, derived: { local: 1 }, xp: 3 }, 'progression');
    expect(saver.save).toHaveBeenCalledWith('ch1', { name: 'K' }, 'progression', 3);
    expect(r).toEqual({ derived: { endurance: 9 }, health: 'bruised' });
  });
  it('claim/remove/listAudit go through rpc/delete/select', async () => {
    const { repo, m } = make();
    await repo.claim('ch9');
    expect(m.client.rpc).toHaveBeenCalledWith('characters_claim', { cid: 'ch9' });
    await repo.remove('ch1');
    expect(m.deleteSpy).toHaveBeenCalled();
    const a = await repo.listAudit('ch1');
    expect(a[0]).toMatchObject({ origin: 'damage', field: 'health', after: 'bruised' });
  });
  it('uploadImage stores under {me}/characters/{id}.png in the right bucket and patches the url', async () => {
    const { repo, m } = make();
    const ops = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://x/tokens/u1/characters/ch1.png' } })) };
    (m.client as Record<string, unknown>)['storage'] = { from: vi.fn(() => ops) };
    const url = await repo.uploadImage('token', 'ch1', new Blob(['x'], { type: 'image/png' }));
    expect((m.client.storage as { from: ReturnType<typeof vi.fn> }).from).toHaveBeenCalledWith('tokens');
    expect(ops.upload).toHaveBeenCalledWith('u1/characters/ch1.png', expect.any(Blob), expect.objectContaining({ upsert: true }));
    expect(url).toMatch(/ch1\.png\?v=/);
    expect(m.updateSpy).toHaveBeenCalledWith({ token_url: url });
  });
});
