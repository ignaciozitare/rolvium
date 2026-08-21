import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseAttackWatchRepo, mapAttackRow } from './SupabaseAttackWatchRepo';

const ROW = {
  id: 'atk-1', campaign_id: 'c1', attacker_name: 'Ogro', target_character_id: 'ch1', dice: 4,
  request: {
    systemId: 'plenilunio', kind: 'system' as const, title: 'Ogro ataca a Karen',
    groups: [{ count: 4, sides: 6, tag: 'own' }],
    options: { stat: 'combat', weaponDamage: 8, autoSuccesses: 2 }, visibility: 'table' as const,
  },
  created_at: '2026-08-21T00:00:00Z',
};

describe('SupabaseAttackWatchRepo', () => {
  it('mapea la fila a lo que el aviso necesita', () => {
    expect(mapAttackRow(ROW)).toEqual({
      id: 'atk-1', campaignId: 'c1', attackerName: 'Ogro', targetCharacterId: 'ch1',
      dice: 4, stat: 'combat', createdAt: '2026-08-21T00:00:00Z',
    });
  });
  /**
   * La ENTIDAD se queda sólo con la característica, para que el daño del arma y los éxitos automáticos de
   * la criatura no anden sueltos por la pantalla del jugador. ⚠ No es una protección: la fila viaja entera
   * en el `select` y la RLS deja al atacado leerla completa.
   */
  it('la entidad se queda sólo con la característica, y nada más', () => {
    const mapped = mapAttackRow(ROW) as unknown as Record<string, unknown>;
    expect(JSON.stringify(mapped)).not.toContain('weaponDamage');
    expect(JSON.stringify(mapped)).not.toContain('autoSuccesses');
  });
  it('sin característica guardada devuelve null en vez de inventarse una', () => {
    expect(mapAttackRow({ ...ROW, request: { ...ROW.request, options: {} } }).stat).toBeNull();
    expect(mapAttackRow({ ...ROW, request: { ...ROW.request, options: { stat: '' } } }).stat).toBeNull();
    expect(mapAttackRow({ ...ROW, request: { ...ROW.request, options: { stat: 7 } as never } }).stat).toBeNull();
  });
  it('listPending pide los pendientes de la campaña, los más viejos primero', async () => {
    const m = createSupabaseMock({ tables: { dice_attacks: { data: [ROW], error: null } } });
    const chain = m.client.from as ReturnType<typeof vi.fn>;
    const list = await new SupabaseAttackWatchRepo(m.client as unknown as SupabaseClient).listPending('c1');
    expect(list).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('dice_attacks');
    const q = chain.mock.results[0]!.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(q['eq']).toHaveBeenCalledWith('campaign_id', 'c1');
    expect(q['eq']).toHaveBeenCalledWith('status', 'pending');
    expect(q['order']).toHaveBeenCalledWith('created_at', { ascending: true });
  });
  it('un fallo de lectura sube, no se traga', async () => {
    const bad = createSupabaseMock({ tables: { dice_attacks: { data: null, error: new Error('rls') } } });
    await expect(new SupabaseAttackWatchRepo(bad.client as unknown as SupabaseClient).listPending('c1')).rejects.toThrow('rls');
  });
  /** Escucha CUALQUIER cambio: uno que se abre saca el aviso, y uno que deja de estar pendiente lo quita. */
  it('sigue la tabla en vivo filtrada por campaña y se da de baja quitando el canal', () => {
    const m = createSupabaseMock({ tables: { dice_attacks: { data: [], error: null } } });
    const handlers: { filter: Record<string, string>; cb: () => void }[] = [];
    const channel = { on: vi.fn((_: string, filter: Record<string, string>, cb: () => void) => { handlers.push({ filter, cb }); return channel; }), subscribe: vi.fn(() => channel) };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const onChange = vi.fn();
    const off = new SupabaseAttackWatchRepo(client as unknown as SupabaseClient).subscribe('c1', onChange);
    expect(client.channel).toHaveBeenCalledWith('campaign-attacks:c1');
    expect(handlers[0]!.filter).toMatchObject({ event: '*', table: 'dice_attacks', filter: 'campaign_id=eq.c1' });
    handlers[0]!.cb();
    expect(onChange).toHaveBeenCalled();
    off();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
