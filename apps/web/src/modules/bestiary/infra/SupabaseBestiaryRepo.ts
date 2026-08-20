import type { SupabaseClient } from '@supabase/supabase-js';
import type { BestiaryEntry, BestiaryEntryPatch, CreatureData, EntryOrigin, NewBestiaryEntry } from '../domain/entities/BestiaryEntry';
import type { BestiaryPort } from '../domain/ports/BestiaryPort';

interface EntryRow {
  id: string; campaign_id: string | null; owner_id: string; system_id: string;
  origin: Exclude<EntryOrigin, 'manual'>; source_ref: string | null; name: string;
  data: Partial<CreatureData>; token_url: string | null; notes: string;
}

const COLS = 'id, campaign_id, owner_id, system_id, origin, source_ref, name, data, token_url, notes';
export const TOKENS_BUCKET = 'tokens';

/** Una fila puede haberse guardado antes de que `data` tuviera un campo, así que todo lleva valor por defecto. */
export const mapEntryRow = (r: EntryRow): BestiaryEntry => ({
  id: r.id,
  origin: r.origin,
  name: r.name,
  notes: r.notes ?? '',
  tokenUrl: r.token_url,
  sourceRef: r.source_ref,
  campaignId: r.campaign_id,
  editable: true,                 // todo lo que sale de esta tabla es del director y suyo para editar
  data: {
    stats: r.data?.stats ?? {},
    endurance: r.data?.endurance ?? 0,
    destiny: r.data?.destiny ?? 0,
    protection: r.data?.protection ?? 0,
    abilities: r.data?.abilities ?? [],
    specialties: r.data?.specialties ?? {},
    page: r.data?.page,
  },
});

function patchRow(p: BestiaryEntryPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.data !== undefined) row.data = p.data;
  if (p.notes !== undefined) row.notes = p.notes;
  if (p.tokenUrl !== undefined) row.token_url = p.tokenUrl;
  // `null` es un valor con significado aquí («todas mis campañas»), no un «no lo mandes».
  if (p.campaignId !== undefined) row.campaign_id = p.campaignId;
  return row;
}

/**
 * Entradas propias del director sobre `bestiary_entries`, bajo RLS.
 *
 * No hay ningún filtro por dueño en las consultas: lo pone la RLS, y repetirlo aquí daría la falsa
 * sensación de que la seguridad vive en el navegador. Lo que sí hace falta es `owner_id` al insertar,
 * porque la política lo exige y es lo que sostiene las entradas globales.
 */
export class SupabaseBestiaryRepo implements BestiaryPort {
  constructor(private readonly sb: SupabaseClient) {}

  /** Las de la campaña MÁS las guardadas «para todas mis campañas» (campaña en blanco). */
  async listForCampaign(campaignId: string, systemId: string): Promise<BestiaryEntry[]> {
    const { data, error } = await this.sb.from('bestiary_entries').select(COLS)
      .eq('system_id', systemId)
      .or(`campaign_id.eq.${campaignId},campaign_id.is.null`)
      .order('name');
    if (error) throw error;
    return (data as unknown as EntryRow[] ?? []).map(mapEntryRow);
  }

  async create(input: NewBestiaryEntry): Promise<BestiaryEntry> {
    const { data: auth } = await this.sb.auth.getUser();
    const ownerId = auth.user?.id;
    if (!ownerId) throw new Error('bestiary: no session');
    const { data, error } = await this.sb.from('bestiary_entries').insert({
      campaign_id: input.campaignId, owner_id: ownerId, system_id: input.systemId, origin: input.origin,
      source_ref: input.sourceRef ?? null, name: input.name, data: input.data,
      token_url: input.tokenUrl ?? null, notes: input.notes ?? '',
    }).select(COLS).single();
    if (error) throw error;
    return mapEntryRow(data as unknown as EntryRow);
  }

  async update(id: string, patch: BestiaryEntryPatch): Promise<BestiaryEntry> {
    const { data, error } = await this.sb.from('bestiary_entries').update(patchRow(patch)).eq('id', id).select(COLS).single();
    if (error) throw error;
    return mapEntryRow(data as unknown as EntryRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.sb.from('bestiary_entries').delete().eq('id', id);
    if (error) throw error;
  }

  /**
   * La imagen llega YA comprimida a WebP (ver specs/core/images). El nombre lo pone el cliente a partir
   * del id de la entrada, nunca el del fichero del usuario: un nombre de fichero es entrada no fiable.
   */
  async uploadToken(entryId: string, file: Blob): Promise<string> {
    const path = `${entryId}/${crypto.randomUUID()}.webp`;
    const { error } = await this.sb.storage.from(TOKENS_BUCKET).upload(path, file, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    return this.sb.storage.from(TOKENS_BUCKET).getPublicUrl(path).data.publicUrl;
  }
}
