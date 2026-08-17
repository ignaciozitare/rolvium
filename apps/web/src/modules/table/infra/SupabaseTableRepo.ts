import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { SharedResourceState } from '@rolvium/core';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import type { PresenceInfo, ResourceError, TableSnapshot } from '../domain/entities/Table';
import type { ResourceResult, TablePort, Unsubscribe } from '../domain/ports/TablePort';

const KNOWN: ResourceError[] = ['pool_empty', 'per_take_max', 'resource_missing', 'not_member', 'forbidden'];
const toError = (msg: string): ResourceError => KNOWN.find(k => msg.includes(k)) ?? 'unknown';

export class SupabaseTableRepo implements TablePort {
  constructor(private readonly db: SupabaseClient, private readonly campaigns: CampaignsPort) {}

  async load(campaignId: string): Promise<TableSnapshot | null> {
    const campaign = await this.campaigns.getById(campaignId);
    if (!campaign || !campaign.myRole) return null;
    const [members, row] = await Promise.all([
      this.campaigns.listMembers(campaignId),
      this.db.from('campaigns_campaigns').select('shared_resources, active_scene_id').eq('id', campaignId).maybeSingle(),
    ]);
    const data = (row.data ?? {}) as { shared_resources?: Record<string, SharedResourceState>; active_scene_id?: string | null };
    return { campaign, members, resources: data.shared_resources ?? {}, presence: [], activeSceneId: data.active_scene_id ?? null };
  }

  subscribe(campaignId: string, onChange: (p: Partial<TableSnapshot>) => void): Unsubscribe {
    const channel: RealtimeChannel = this.db.channel(`campaign:${campaignId}`, { config: { presence: { key: 'user' } } });
    channel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns_campaigns', filter: `id=eq.${campaignId}` }, payload => {
        const n = payload.new as { shared_resources?: Record<string, SharedResourceState>; active_scene_id?: string | null };
        onChange({ resources: n.shared_resources ?? {}, activeSceneId: n.active_scene_id ?? null });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns_members', filter: `campaign_id=eq.${campaignId}` }, () => {
        void this.campaigns.listMembers(campaignId).then(members => onChange({ members }));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string }>();
        const byUser = new Map<string, number>();
        Object.values(state).flat().forEach(p => byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + 1));
        const presence: PresenceInfo[] = [...byUser.entries()].map(([userId, devices]) => ({ userId, devices }));
        onChange({ presence });
      })
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED') return;
        const { data: { session } } = await this.db.auth.getSession();
        if (session) await channel.track({ userId: session.user.id, device: navigator.userAgent.slice(0, 40), at: Date.now() });
      });
    return () => { void this.db.removeChannel(channel); };
  }

  private async rpc(fn: string, args: Record<string, unknown>): Promise<ResourceResult> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) return { error: toError(error.message ?? '') };
    return { state: data as SharedResourceState };
  }
  takeResource(cid: string, rid: string, n: number) { return this.rpc('table_take_resource', { cid, rid, n }); }
  returnResource(cid: string, rid: string, n?: number) { return this.rpc('table_return_resource', { cid, rid, n: n ?? null }); }
  resetResource(cid: string, rid: string) { return this.rpc('table_reset_resource', { cid, rid, to_value: null }); }
}
