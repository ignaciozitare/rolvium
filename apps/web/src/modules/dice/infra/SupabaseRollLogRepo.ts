import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { RollRequest, RollResult, RollVisibility, RolledDice } from '@rolvium/core';
import type { Roll } from '../domain/entities/Roll';
import type { RollLogPort, Unsubscribe } from '../domain/ports/RollLogPort';

interface Row {
  id: string; campaign_id: string; character_id: string | null; author_id: string; system_id: string | null; kind: 'system' | 'free'; title: string;
  request: RollRequest; dice: RolledDice; result: RollResult; visibility: RollVisibility; corrects_id: string | null; created_at: string;
  author: { name: string | null; alias: string | null; avatar_url: string | null } | { name: string | null; alias: string | null; avatar_url: string | null }[] | null;
}
const SELECT = 'id, campaign_id, character_id, author_id, system_id, kind, title, request, dice, result, visibility, corrects_id, created_at, author:users!dice_rolls_author_id_fkey ( name, alias, avatar_url )';
export const DEFAULT_LIMIT = 50;

export function mapRollRow(r: Row): Roll {
  const a = Array.isArray(r.author) ? r.author[0] : r.author;
  return {
    id: r.id, campaignId: r.campaign_id, characterId: r.character_id, authorId: r.author_id,
    authorName: a?.alias?.trim() || a?.name || null, authorAvatarUrl: a?.avatar_url ?? null,
    systemId: r.system_id, kind: r.kind, title: r.title, request: r.request, dice: r.dice, result: r.result,
    visibility: r.visibility, correctsId: r.corrects_id, createdAt: r.created_at,
  };
}

/** Reads `dice_rolls` under RLS (visibility is filtered server-side) and follows inserts on the campaign's roll channel. */
export class SupabaseRollLogRepo implements RollLogPort {
  constructor(private readonly db: SupabaseClient) {}

  async listRecent(campaignId: string, limit = DEFAULT_LIMIT): Promise<Roll[]> {
    const { data, error } = await this.db.from('dice_rolls').select(SELECT).eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).map(mapRollRow);
  }

  private async fetchOne(id: string): Promise<Roll | null> {
    const { data, error } = await this.db.from('dice_rolls').select(SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return mapRollRow(data as unknown as Row);
  }

  subscribe(campaignId: string, onInsert: (roll: Roll) => void): Unsubscribe {
    const channel: RealtimeChannel = this.db.channel(`campaign-rolls:${campaignId}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` }, payload => {
        // The event carries the bare row; refetch it with the author join (RLS decides again whether I may see it).
        const id = (payload.new as { id?: string }).id;
        if (id) void this.fetchOne(id).then(r => { if (r) onInsert(r); });
      })
      .subscribe();
    return () => { void this.db.removeChannel(channel); };
  }
}
