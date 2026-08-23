import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { PendingRollRequest } from '../domain/entities/RollRequestAsk';
import type { RollRequestWatchPort } from '../domain/ports/RollRequestWatchPort';
import type { Unsubscribe } from '../domain/ports/RollLogPort';

interface Row {
  id: string; campaign_id: string; batch_id: string; target_character_id: string;
  stat: string; difficulty: number; specialty_allowed: boolean; created_at: string;
}

export const mapRequestRow = (r: Row): PendingRollRequest => ({
  id: r.id, campaignId: r.campaign_id, batchId: r.batch_id, targetCharacterId: r.target_character_id,
  stat: r.stat, difficulty: r.difficulty, specialtyAllowed: r.specialty_allowed, createdAt: r.created_at,
});

const SELECT = 'id, campaign_id, batch_id, target_character_id, stat, difficulty, specialty_allowed, created_at';

/**
 * Lee `dice_roll_requests` bajo RLS y sigue la tabla en vivo — mismo reparto que `SupabaseAttackWatchRepo`:
 * al llegar cualquier cambio se vuelve a pedir la lista entera (son un puñado de filas) y una petición que
 * deja de estar pendiente desaparece por el mismo camino por el que apareció. Los más viejos primero.
 */
export class SupabaseRollRequestWatchRepo implements RollRequestWatchPort {
  constructor(private readonly db: SupabaseClient) {}

  async listPending(campaignId: string): Promise<PendingRollRequest[]> {
    const { data, error } = await this.db.from('dice_roll_requests').select(SELECT)
      .eq('campaign_id', campaignId).eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).map(mapRequestRow);
  }

  subscribe(campaignId: string, onChange: () => void): Unsubscribe {
    const channel: RealtimeChannel = this.db.channel(`campaign-roll-requests:${campaignId}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dice_roll_requests', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
      .subscribe();
    return () => { void this.db.removeChannel(channel); };
  }
}
