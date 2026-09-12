import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseToolbarOrder } from './SupabaseToolbarOrder';

const withSession = (client: Record<string, unknown>, uid: string | null = 'u-admin') => ({
  ...client,
  auth: { getSession: vi.fn().mockResolvedValue({ data: { session: uid ? { user: { id: uid } } : null } }) },
});
const q = (m: ReturnType<typeof createSupabaseMock>, i = 0) => (m.client.from as ReturnType<typeof vi.fn>).mock.results[i]!.value as Record<string, ReturnType<typeof vi.fn>>;

/** 🧲 El orden de la barra: una fila de `app_settings` que leen todos y escribe sólo el admin (por RLS). */
describe('SupabaseToolbarOrder', () => {
  it('load: lee la fila `maps.toolbar_order` de app_settings y la sanea', async () => {
    const m = createSupabaseMock({ tables: { app_settings: { data: { value: { play: ['pin', 'dice', 7], dm: 'no' } }, error: null } } });
    const repo = new SupabaseToolbarOrder(m.client as unknown as SupabaseClient);
    expect(await repo.load()).toEqual({ play: ['pin', 'dice'] });
    expect(m.fromSpy).toHaveBeenCalledWith('app_settings');
    expect(q(m)['eq']).toHaveBeenCalledWith('key', 'maps.toolbar_order');
    expect(q(m)['maybeSingle']).toHaveBeenCalled();
  });

  it('load: sin fila devuelve null (nadie ha ordenado nada), y un error de la base lanza', async () => {
    const none = createSupabaseMock({ tables: { app_settings: { data: null, error: null } } });
    expect(await new SupabaseToolbarOrder(none.client as unknown as SupabaseClient).load()).toBeNull();
    const bad = createSupabaseMock({ tables: { app_settings: { data: null, error: new Error('boom') } } });
    await expect(new SupabaseToolbarOrder(bad.client as unknown as SupabaseClient).load()).rejects.toThrow('boom');
  });

  it('save: upsert por clave con el orden y quién lo tocó; sin permiso (error de la base) lanza', async () => {
    const m = createSupabaseMock({ tables: { app_settings: { data: null, error: null } } });
    const repo = new SupabaseToolbarOrder(withSession(m.client) as unknown as SupabaseClient);
    await repo.save({ dm: ['wall', 'light'] });
    expect(m.upsertSpy).toHaveBeenCalledWith({ key: 'maps.toolbar_order', value: { dm: ['wall', 'light'] }, updated_by: 'u-admin' }, { onConflict: 'key' });
    const denied = createSupabaseMock({ tables: { app_settings: { data: null, error: new Error('new row violates row-level security policy') } } });
    await expect(new SupabaseToolbarOrder(withSession(denied.client) as unknown as SupabaseClient).save({ play: ['pin'] })).rejects.toThrow(/row-level security/);
  });
});
