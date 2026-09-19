import type { RichDoc } from '@rolvium/core';
import type { CampaignLogbook, CampaignNotes } from '../entities/Journal';

/**
 * NOTAS Y BITÁCORA (H9). Todo va directo a Supabase bajo RLS: las Notas sólo se las da la base a su autor
 * —sin puerta de atrás para el admin, a propósito— y la Bitácora a cualquier miembro de la campaña.
 *
 * `openNotes` y `openLogbook` CREAN la fila si no existe: la primera vez que alguien abre la pestaña no hay
 * nada en la base, y una pantalla vacía que no puede guardar sería un error donde no lo hay.
 */
export interface JournalPort {
  /** Mis apuntes en esta campaña; los crea vacíos la primera vez. Nunca los de otro: eso no existe. */
  openNotes(campaignId: string, userId: string): Promise<CampaignNotes>;
  saveNotes(notesId: string, doc: RichDoc): Promise<string>;

  /** La bitácora de la campaña; la crea vacía la primera vez. */
  openLogbook(campaignId: string): Promise<CampaignLogbook>;
  /**
   * Guarda la bitácora sólo si nadie la ha tocado desde que la abriste (`expectedUpdatedAt`), y si la han
   * tocado lanza `LogbookConflictError` en vez de pisarla. Devuelve la nueva marca de tiempo.
   */
  saveLogbook(logbookId: string, doc: RichDoc, expectedUpdatedAt: string, userId: string): Promise<string>;
}
