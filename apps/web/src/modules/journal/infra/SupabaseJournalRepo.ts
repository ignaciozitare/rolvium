import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDoc, type RichDoc } from '@rolvium/core';
import { LogbookConflictError, type CampaignLogbook, type CampaignNotes } from '../domain/entities/Journal';
import type { JournalPort } from '../domain/ports/JournalPort';

interface NotesRow { id: string; campaign_id: string; user_id: string; doc: unknown; updated_at: string }
interface LogbookRow { id: string; campaign_id: string; doc: unknown; updated_by: string | null; updated_at: string }

const NOTES_COLS = 'id, campaign_id, user_id, doc, updated_at';
const LOGBOOK_COLS = 'id, campaign_id, doc, updated_by, updated_at';

export const mapNotesRow = (r: NotesRow): CampaignNotes => ({
  id: r.id, campaignId: r.campaign_id, userId: r.user_id, doc: parseDoc(r.doc), updatedAt: r.updated_at,
});

export const mapLogbookRow = (r: LogbookRow): CampaignLogbook => ({
  id: r.id, campaignId: r.campaign_id, doc: parseDoc(r.doc), updatedBy: r.updated_by, updatedAt: r.updated_at,
});

/**
 * NOTAS Y BITÁCORA contra Supabase, bajo RLS (`supabase/migrations/20260919120000_journal_notas_y_bitacora.sql`).
 * Aquí no hay ni un solo filtro de permisos escrito a mano: quién puede leer qué lo decide la base.
 *
 * Dos detalles que no son evidentes:
 * - **Abrir crea la fila si no existe.** La primera vez que alguien entra en la pestaña no hay nada guardado, y
 *   una pantalla que no puede escribir porque «no hay fila» es un error inventado. El `doc` por defecto ya viene
 *   con la forma buena desde la migración.
 * - **La bitácora se guarda con la marca de tiempo con la que se abrió** (`updated_at`). Si otro guardó primero,
 *   el UPDATE no encuentra fila y esto lanza `LogbookConflictError` en vez de pisarle el texto (v1: un escritor
 *   a la vez, spec § Rules & limits).
 */
export class SupabaseJournalRepo implements JournalPort {
  constructor(private readonly db: SupabaseClient) {}

  async openNotes(campaignId: string, userId: string): Promise<CampaignNotes> {
    const { data, error } = await this.db.from('journal_notes').select(NOTES_COLS)
      .eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (data) return mapNotesRow(data as NotesRow);

    const created = await this.db.from('journal_notes')
      .insert({ campaign_id: campaignId, user_id: userId }).select(NOTES_COLS).single();
    if (created.error) throw created.error;
    return mapNotesRow(created.data as NotesRow);
  }

  async saveNotes(notesId: string, doc: RichDoc): Promise<string> {
    const { data, error } = await this.db.from('journal_notes')
      .update({ doc }).eq('id', notesId).select('updated_at').single();
    if (error) throw error;
    return (data as { updated_at: string }).updated_at;
  }

  async openLogbook(campaignId: string): Promise<CampaignLogbook> {
    const { data, error } = await this.db.from('journal_logbook').select(LOGBOOK_COLS)
      .eq('campaign_id', campaignId).maybeSingle();
    if (error) throw error;
    if (data) return mapLogbookRow(data as LogbookRow);

    const created = await this.db.from('journal_logbook')
      .insert({ campaign_id: campaignId }).select(LOGBOOK_COLS).single();
    if (created.error) throw created.error;
    return mapLogbookRow(created.data as LogbookRow);
  }

  async saveLogbook(logbookId: string, doc: RichDoc, expectedUpdatedAt: string, userId: string): Promise<string> {
    const { data, error } = await this.db.from('journal_logbook')
      .update({ doc, updated_by: userId })
      .eq('id', logbookId).eq('updated_at', expectedUpdatedAt)
      .select('updated_at').maybeSingle();
    if (error) throw error;
    if (data) return (data as { updated_at: string }).updated_at;

    // No ha entrado: o alguien guardó antes (lo normal) o la fila ya no está. En los dos casos se cuenta, no se pisa.
    const current = await this.db.from('journal_logbook').select('updated_at').eq('id', logbookId).maybeSingle();
    if (current.error) throw current.error;
    throw new LogbookConflictError((current.data as { updated_at: string } | null)?.updated_at ?? expectedUpdatedAt);
  }
}
