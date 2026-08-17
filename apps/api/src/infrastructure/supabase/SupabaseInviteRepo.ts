import type { SupabaseClient } from '@supabase/supabase-js';
import type { IInviteRepository, InvitePreview } from '../../domain/invite/IInviteRepository.js';

interface Row { id: string; name: string; system_id: string; dm_name: string; seats: number; taken: number }

/** Reads `campaign_invite_preview(code)` with the service role (the RPC is not granted to anon). */
export class SupabaseInviteRepo implements IInviteRepository {
  constructor(private readonly db: SupabaseClient) {}

  async preview(code: string): Promise<InvitePreview | null> {
    const { data, error } = await this.db.rpc('campaign_invite_preview', { code });
    if (error) throw new Error(error.message);
    const row = (data as Row[] | null)?.[0];
    if (!row) return null;
    return { code, campaignName: row.name, systemId: row.system_id, dmName: row.dm_name, seatsFree: Math.max(0, row.seats - row.taken) };
  }
}
