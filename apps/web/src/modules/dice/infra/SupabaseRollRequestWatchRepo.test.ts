import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseRollRequestWatchRepo, mapRequestRow } from './SupabaseRollRequestWatchRepo';

const ROW = {
  id: 'req-1', campaign_id: 'c1', batch_id: 'b-1', target_character_id: 'ch1',
  stat: 'fortitude', difficulty: 2, specialty_allowed: true, created_at: '2026-08-22T00:00:00Z',
};

describe('SupabaseRollRequestWatchRepo', () => {
  it('mapea la fila a lo que el aviso necesita', () => {
    expect(mapRequestRow(ROW)).toEqual({
      id: 'req-1', campaignId: 'c1', batchId: 'b-1', targetCharacterId: 'ch1',
      stat: 'fortitude', difficulty: 2, specialtyAllowed: true, createdAt: '2026-08-22T00:00:00Z',
    });
  });
  it('listPending pide los pendientes de la campaña, los más viejos primero', async () => {
    const m = createSupabaseMock({ tables: { dice_roll_requests: { data: [ROW], error: null } } });
    const chain = m.client.from as ReturnType<typeof vi.fn>;
    const list = await new SupabaseRollRequestWatchRepo(m.client as unknown as SupabaseClient).listPending('c1');
    expect(list).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('dice_roll_requests');
    const q = chain.mock.results[0]!.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(q['eq']).toHaveBeenCalledWith('campaign_id', 'c1');
    expect(q['eq']).toHaveBeenCalledWith('status', 'pending');
    expect(q['order']).toHaveBeenCalledWith('created_at', { ascending: true });
  });
  it('un fallo de lectura sube, no se traga', async () => {
    const bad = createSupabaseMock({ tables: { dice_roll_requests: { data: null, error: new Error('rls') } } });
    await expect(new SupabaseRollRequestWatchRepo(bad.client as unknown as SupabaseClient).listPending('c1')).rejects.toThrow('rls');
  });
  it('sigue la tabla en vivo filtrada por campaña y se da de baja quitando el canal', () => {
    const m = createSupabaseMock({ tables: { dice_roll_requests: { data: [], error: null } } });
    const handlers: { filter: Record<string, string>; cb: () => void }[] = [];
    const channel = { on: vi.fn((_: string, filter: Record<string, string>, cb: () => void) => { handlers.push({ filter, cb }); return channel; }), subscribe: vi.fn(() => channel) };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const onChange = vi.fn();
    const off = new SupabaseRollRequestWatchRepo(client as unknown as SupabaseClient).subscribe('c1', onChange);
    expect(client.channel).toHaveBeenCalledWith('campaign-roll-requests:c1');
    expect(handlers[0]!.filter).toMatchObject({ event: '*', table: 'dice_roll_requests', filter: 'campaign_id=eq.c1' });
    handlers[0]!.cb();
    expect(onChange).toHaveBeenCalled();
    off();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
