import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDoc, type RichDoc } from '@rolvium/core';
import { AdventureConflictError, type Adventure, type AdventurePatch, type AdventureStatus } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';

const COLS = 'id, campaign_id, title, summary, doc, status, sort_order, updated_at';

interface AdventureRow {
  id: string; campaign_id: string; title: string; summary: string | null; doc: unknown;
  status: AdventureStatus; sort_order: number; updated_at: string;
}

export const mapAdventureRow = (r: AdventureRow): Adventure => ({
  id: r.id, campaignId: r.campaign_id, title: r.title, summary: r.summary, doc: parseDoc(r.doc),
  status: r.status, sortOrder: r.sort_order, updatedAt: r.updated_at,
});

export const adventurePatchRow = (patch: AdventurePatch): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  return row;
};

/**
 * AVENTURAS contra Supabase (`supabase/migrations/20260919120100_adventures_aventuras.sql`).
 *
 * Igual que la Bitácora, el documento se guarda con la marca de tiempo con la que se abrió: la pestaña de la
 * mesa y la ventana aparte son dos vistas de lo mismo, y lo segundo que se guarde avisa en vez de pisar.
 */
export class SupabaseAdventuresRepo implements AdventuresPort {
  constructor(private readonly db: SupabaseClient) {}

  async list(campaignId: string, opts: { includeArchived?: boolean } = {}): Promise<Adventure[]> {
    let query = this.db.from('adventures_adventures').select(COLS).eq('campaign_id', campaignId);
    if (!opts.includeArchived) query = query.neq('status', 'archived');
    // `created_at` desempata: sin él, dos con el mismo sitio salían cada vez en un orden distinto.
    const { data, error } = await query.order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as AdventureRow[]).map(mapAdventureRow);
  }

  async getById(id: string): Promise<Adventure | null> {
    const { data, error } = await this.db.from('adventures_adventures').select(COLS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapAdventureRow(data as AdventureRow) : null;
  }

  async create(campaignId: string, title: string, sortOrder?: number): Promise<Adventure> {
    const row: Record<string, unknown> = { campaign_id: campaignId, title };
    if (sortOrder !== undefined) row.sort_order = sortOrder;
    const { data, error } = await this.db.from('adventures_adventures').insert(row).select(COLS).single();
    if (error) throw error;
    return mapAdventureRow(data as AdventureRow);
  }

  async update(id: string, patch: AdventurePatch): Promise<string | null> {
    const row = adventurePatchRow(patch);
    if (Object.keys(row).length === 0) return null;
    const { data, error } = await this.db.from('adventures_adventures').update(row).eq('id', id)
      .select('updated_at').maybeSingle();
    if (error) throw error;
    return (data as { updated_at: string } | null)?.updated_at ?? null;
  }

  async saveDoc(id: string, doc: RichDoc, expectedUpdatedAt: string): Promise<string> {
    const { data, error } = await this.db.from('adventures_adventures')
      .update({ doc }).eq('id', id).eq('updated_at', expectedUpdatedAt)
      .select('updated_at').maybeSingle();
    if (error) throw error;
    if (data) return (data as { updated_at: string }).updated_at;

    const current = await this.db.from('adventures_adventures').select('updated_at').eq('id', id).maybeSingle();
    if (current.error) throw current.error;
    throw new AdventureConflictError((current.data as { updated_at: string } | null)?.updated_at ?? expectedUpdatedAt);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('adventures_adventures').delete().eq('id', id);
    if (error) throw error;
  }
}
