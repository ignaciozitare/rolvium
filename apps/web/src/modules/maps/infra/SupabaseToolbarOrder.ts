import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolbarOrderPort } from '../domain/ports/ToolbarOrderPort';
import { parseToolbarOrder, TOOLBAR_ORDER_KEY, type ToolbarOrder } from '../domain/useCases/toolbarRules';

/**
 * El orden de la barra vive en `app_settings` (una fila por ajuste de plataforma, `key` = `maps.toolbar_order`).
 * Leen todos los que tienen sesión; escribe sólo quien tiene `admin.manage_settings` — lo decide la RLS, no este
 * código: si no se puede, el `upsert` falla y `save` lanza.
 */
export class SupabaseToolbarOrder implements ToolbarOrderPort {
  constructor(private readonly db: SupabaseClient) {}

  async load(): Promise<ToolbarOrder | null> {
    const { data, error } = await this.db.from('app_settings').select('value').eq('key', TOOLBAR_ORDER_KEY).maybeSingle();
    if (error) throw error;
    return data ? parseToolbarOrder((data as { value: unknown }).value) : null;
  }

  async save(order: ToolbarOrder): Promise<void> {
    const { data: s } = await this.db.auth.getSession();
    const row = { key: TOOLBAR_ORDER_KEY, value: order, updated_by: s.session?.user.id ?? null };
    const { error } = await this.db.from('app_settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
}
