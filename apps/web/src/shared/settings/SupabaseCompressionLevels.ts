import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompressionLevelsPort } from './CompressionLevelsPort';
import { COMPRESSION_LEVELS_KEY, parseCompressionLevels, type CompressionLevels } from './compressionLevels';

/**
 * El nivel de compresión por tipo vive en `app_settings` (una fila, `key` = `images.compression_levels`) —
 * la misma tabla que `maps.toolbar_order`. Leen todos los que tienen sesión; escribe sólo quien tiene
 * `admin.manage_settings` — lo decide la RLS, no este código: si no se puede, el `upsert` falla y `save` lanza.
 */
export class SupabaseCompressionLevels implements CompressionLevelsPort {
  constructor(private readonly db: SupabaseClient) {}

  async load(): Promise<CompressionLevels | null> {
    const { data, error } = await this.db.from('app_settings').select('value').eq('key', COMPRESSION_LEVELS_KEY).maybeSingle();
    if (error) throw error;
    return data ? parseCompressionLevels((data as { value: unknown }).value) : null;
  }

  async save(levels: CompressionLevels): Promise<void> {
    const { data: s } = await this.db.auth.getSession();
    const row = { key: COMPRESSION_LEVELS_KEY, value: levels, updated_by: s.session?.user.id ?? null };
    const { error } = await this.db.from('app_settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
}
