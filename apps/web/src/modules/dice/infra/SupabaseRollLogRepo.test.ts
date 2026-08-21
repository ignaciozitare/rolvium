import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseRollLogRepo, mapRollRow } from './SupabaseRollLogRepo';

const ROW = {
  id: 'r1', campaign_id: 'c1', character_id: 'ch1', author_id: 'u1', system_id: 'plenilunio', kind: 'system' as const, title: 'sheet.stats.combat',
  request: { systemId: 'plenilunio', kind: 'system' as const, title: 'sheet.stats.combat', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' as const },
  dice: [[6, 2]], result: { summary: 'roll.degree.success.1', total: 1 }, visibility: 'table' as const, corrects_id: null, created_at: '2026-08-18T00:00:00Z',
  author: { name: 'Pip Pérez', alias: 'Pip', avatar_url: null },
  character: { name: 'Karen Sinclair' },
};

describe('SupabaseRollLogRepo', () => {
  it('maps rows (author alias precedence, nullable joins)', () => {
    expect(mapRollRow(ROW)).toMatchObject({ id: 'r1', campaignId: 'c1', authorName: 'Pip', authorAvatarUrl: null, systemId: 'plenilunio', kind: 'system', dice: [[6, 2]], visibility: 'table', correctsId: null });
    expect(mapRollRow({ ...ROW, author: { name: 'Pip Pérez', alias: null, avatar_url: 'u' } }).authorName).toBe('Pip Pérez');
    expect(mapRollRow({ ...ROW, author: null }).authorName).toBeNull();
  });
  /**
   * El Registro enseña quién tiró EN LA FICCIÓN, y eso es el personaje, no la cuenta: el director
   * tira por media mesa. Cuando la RLS no deja ver ese personaje el join no llega y la entrada se
   * queda como estaba, sin nombre — nunca cae en el del usuario.
   */
  it('mapea el nombre del personaje, y lo deja en null cuando el join no llega', () => {
    expect(mapRollRow(ROW).characterName).toBe('Karen Sinclair');
    expect(mapRollRow({ ...ROW, character: [{ name: 'Karen Sinclair' }] }).characterName).toBe('Karen Sinclair');
    expect(mapRollRow({ ...ROW, character: null }).characterName).toBeNull();
    expect(mapRollRow({ ...ROW, character: { name: '  ' } }).characterName).toBeNull();
  });
  it('listRecent selects dice_rolls of the campaign with the author join, newest first, limited', async () => {
    const m = createSupabaseMock({ tables: { dice_rolls: { data: [ROW], error: null } } });
    const chain = m.client.from as ReturnType<typeof vi.fn>;
    const repo = new SupabaseRollLogRepo(m.client as unknown as SupabaseClient);
    const list = await repo.listRecent('c1', 20);
    expect(list).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('dice_rolls');
    expect(m.selectSpy).toHaveBeenCalledWith(expect.stringContaining('author:users!dice_rolls_author_id_fkey'));
    expect(m.selectSpy).toHaveBeenCalledWith(expect.stringContaining('character:characters!dice_rolls_character_id_fkey ( name )'));
    const q = chain.mock.results[0]!.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(q['eq']).toHaveBeenCalledWith('campaign_id', 'c1');
    expect(q['order']).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(q['limit']).toHaveBeenCalledWith(20);
    const bad = createSupabaseMock({ tables: { dice_rolls: { data: null, error: new Error('rls') } } });
    await expect(new SupabaseRollLogRepo(bad.client as unknown as SupabaseClient).listRecent('c1')).rejects.toThrow('rls');
  });
  it('subscribe listens to INSERTs on dice_rolls filtered by campaign, refetches the row (RLS) and unsubscribes by removing the channel', async () => {
    const m = createSupabaseMock({ tables: { dice_rolls: { data: ROW, error: null } } });
    const handlers: { filter: Record<string, string>; cb: (p: { new: unknown }) => void }[] = [];
    const channel = { on: vi.fn((_: string, filter: Record<string, string>, cb: (p: { new: unknown }) => void) => { handlers.push({ filter, cb }); return channel; }), subscribe: vi.fn(() => channel) };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repo = new SupabaseRollLogRepo(client as unknown as SupabaseClient);
    const onInsert = vi.fn();
    const off = repo.subscribe('c1', onInsert);
    expect(client.channel).toHaveBeenCalledWith('campaign-rolls:c1');
    expect(handlers[0]!.filter).toMatchObject({ event: 'INSERT', table: 'dice_rolls', filter: 'campaign_id=eq.c1' });
    handlers[0]!.cb({ new: { id: 'r1' } });
    await vi.waitFor(() => expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1', authorName: 'Pip' })));
    off();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
