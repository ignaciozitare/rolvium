import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../tests/helpers/supabaseMock';
import { SupabaseCompressionLevels } from './SupabaseCompressionLevels';

const withSession = (client: Record<string, unknown>, uid: string | null = 'u-admin') => ({
  ...client,
  auth: { getSession: vi.fn().mockResolvedValue({ data: { session: uid ? { user: { id: uid } } : null } }) },
});
const q = (m: ReturnType<typeof createSupabaseMock>, i = 0) => (m.client.from as ReturnType<typeof vi.fn>).mock.results[i]!.value as Record<string, ReturnType<typeof vi.fn>>;

/** El nivel de compresión por tipo: una fila de `app_settings` que leen todos y escribe sólo el admin (por RLS). */
describe('SupabaseCompressionLevels', () => {
  it('load: lee la fila `images.compression_levels` de app_settings y la sanea', async () => {
    const m = createSupabaseMock({ tables: { app_settings: { data: { value: { texture: 'max', prop: 'nope', background: 'light' } }, error: null } } });
    const repo = new SupabaseCompressionLevels(m.client as unknown as SupabaseClient);
    expect(await repo.load()).toEqual({ texture: 'max', prop: 'balanced', background: 'light' });
    expect(m.fromSpy).toHaveBeenCalledWith('app_settings');
    expect(q(m)['eq']).toHaveBeenCalledWith('key', 'images.compression_levels');
    expect(q(m)['maybeSingle']).toHaveBeenCalled();
  });

  it('load: sin fila devuelve null (nadie lo ha tocado), y un error de la base lanza', async () => {
    const none = createSupabaseMock({ tables: { app_settings: { data: null, error: null } } });
    expect(await new SupabaseCompressionLevels(none.client as unknown as SupabaseClient).load()).toBeNull();
    const bad = createSupabaseMock({ tables: { app_settings: { data: null, error: new Error('boom') } } });
    await expect(new SupabaseCompressionLevels(bad.client as unknown as SupabaseClient).load()).rejects.toThrow('boom');
  });

  it('save: upsert por clave con los tres niveles y quién los tocó; sin permiso (error de la base) lanza', async () => {
    const m = createSupabaseMock({ tables: { app_settings: { data: null, error: null } } });
    const repo = new SupabaseCompressionLevels(withSession(m.client) as unknown as SupabaseClient);
    await repo.save({ texture: 'light', prop: 'balanced', background: 'max' });
    expect(m.upsertSpy).toHaveBeenCalledWith(
      { key: 'images.compression_levels', value: { texture: 'light', prop: 'balanced', background: 'max' }, updated_by: 'u-admin' },
      { onConflict: 'key' },
    );
    const denied = createSupabaseMock({ tables: { app_settings: { data: null, error: new Error('new row violates row-level security policy') } } });
    await expect(
      new SupabaseCompressionLevels(withSession(denied.client) as unknown as SupabaseClient).save({ texture: 'balanced', prop: 'balanced', background: 'balanced' }),
    ).rejects.toThrow(/row-level security/);
  });
});
