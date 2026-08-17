import type { SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, CampaignMember, CreateCampaignInput, JoinError } from '../domain/entities/Campaign';
import type { CampaignsPort } from '../domain/ports/CampaignsPort';
import { normalizeInviteCode } from '../domain/useCases/campaignRules';

interface Row {
  id: string; name: string; description: string; system_id: string; system_version: string; dm_id: string;
  visibility: 'open' | 'invite'; seats: number; invite_code: string | null; progression_enabled: boolean;
  next_session_at: string | null; last_session_at: string | null; archived_at: string | null; created_at: string;
  dm: { name: string } | { name: string }[] | null;
  members: { user_id: string; role: 'dm' | 'player'; character_id: string | null }[] | null;
}
const SELECT = 'id, name, description, system_id, system_version, dm_id, visibility, seats, invite_code, progression_enabled, next_session_at, last_session_at, archived_at, created_at, dm:users!campaigns_campaigns_dm_id_fkey ( name ), members:campaigns_members ( user_id, role, character_id )';

function mapRow(r: Row, me: string | null): Campaign {
  const dm = Array.isArray(r.dm) ? r.dm[0] : r.dm;
  const members = r.members ?? [];
  const mine = me ? members.find(m => m.user_id === me) : undefined;
  const c: Campaign = {
    id: r.id, name: r.name, description: r.description, systemId: r.system_id, systemVersion: r.system_version,
    dmId: r.dm_id, dmName: dm?.name ?? '', visibility: r.visibility, seats: r.seats,
    inviteCode: r.dm_id === me ? r.invite_code : null, progressionEnabled: r.progression_enabled,
    playersCount: members.filter(m => m.role === 'player').length,
    nextSessionAt: r.next_session_at, lastSessionAt: r.last_session_at, archivedAt: r.archived_at, createdAt: r.created_at,
  };
  if (mine) { c.myRole = mine.role; c.myCharacterId = mine.character_id; }
  return c;
}

export class SupabaseCampaignsRepo implements CampaignsPort {
  constructor(private readonly db: SupabaseClient) {}

  private async me(): Promise<string | null> {
    const { data: { session } } = await this.db.auth.getSession();
    return session?.user.id ?? null;
  }

  async listMine(): Promise<Campaign[]> {
    const me = await this.me();
    if (!me) return [];
    const { data, error } = await this.db.from('campaigns_campaigns').select(SELECT).is('archived_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as Row[]).map(r => mapRow(r, me)).filter(c => !!c.myRole);
  }

  async listOpen(): Promise<Campaign[]> {
    const me = await this.me();
    const { data, error } = await this.db.from('campaigns_campaigns').select(SELECT).eq('visibility', 'open').is('archived_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as Row[]).map(r => mapRow(r, me)).filter(c => !c.myRole);
  }

  async getById(id: string): Promise<Campaign | null> {
    const me = await this.me();
    const { data, error } = await this.db.from('campaigns_campaigns').select(SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return mapRow(data as unknown as Row, me);
  }

  async listMembers(campaignId: string): Promise<CampaignMember[]> {
    const { data, error } = await this.db.from('campaigns_members').select('campaign_id, user_id, role, character_id, joined_at, user:users ( name, avatar_url )').eq('campaign_id', campaignId);
    if (error) throw error;
    return (data as unknown as { campaign_id: string; user_id: string; role: 'dm' | 'player'; character_id: string | null; joined_at: string; user: { name: string; avatar_url: string | null } | { name: string; avatar_url: string | null }[] | null }[]).map(m => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return { campaignId: m.campaign_id, userId: m.user_id, role: m.role, characterId: m.character_id, joinedAt: m.joined_at, name: u?.name ?? '', avatarUrl: u?.avatar_url ?? null };
    });
  }

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const me = await this.me();
    if (!me) throw new Error('not_authenticated');
    const { data, error } = await this.db.from('campaigns_campaigns').insert({
      name: input.name.trim(), description: input.description ?? '', system_id: input.systemId, system_version: input.systemVersion,
      dm_id: me, visibility: input.visibility, seats: input.seats, progression_enabled: input.progressionEnabled,
      shared_resources: input.sharedResources, locale: input.locale ?? 'es',
    }).select(SELECT).single();
    if (error) throw error;
    return mapRow(data as unknown as Row, me);
  }

  async joinByCode(code: string): Promise<{ campaignId: string } | { error: JoinError }> {
    const { data, error } = await this.db.rpc('join_campaign_by_code', { code: normalizeInviteCode(code) });
    if (error) {
      const msg = error.message ?? '';
      const known: JoinError[] = ['invalid_code', 'campaign_full', 'not_authenticated'];
      return { error: known.find(k => msg.includes(k)) ?? 'unknown' };
    }
    return { campaignId: data as string };
  }

  async requestJoin(campaignId: string, message = ''): Promise<void> {
    const me = await this.me();
    if (!me) throw new Error('not_authenticated');
    const { error } = await this.db.from('campaigns_requests').insert({ campaign_id: campaignId, user_id: me, message });
    if (error && !/duplicate/i.test(error.message)) throw error;
  }

  async leave(campaignId: string): Promise<void> {
    const me = await this.me();
    if (!me) return;
    const { error } = await this.db.from('campaigns_members').delete().eq('campaign_id', campaignId).eq('user_id', me);
    if (error) throw error;
  }

  async update(id: string, patch: Partial<Pick<Campaign, 'name' | 'description' | 'visibility' | 'seats' | 'progressionEnabled' | 'nextSessionAt'>>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.visibility !== undefined) row.visibility = patch.visibility;
    if (patch.seats !== undefined) row.seats = patch.seats;
    if (patch.progressionEnabled !== undefined) row.progression_enabled = patch.progressionEnabled;
    if (patch.nextSessionAt !== undefined) row.next_session_at = patch.nextSessionAt;
    const { error } = await this.db.from('campaigns_campaigns').update(row).eq('id', id);
    if (error) throw error;
  }

  async regenerateInviteCode(id: string): Promise<string> {
    const { data, error } = await this.db.rpc('campaigns_new_code');
    if (error) throw error;
    const code = data as string;
    const { error: e2 } = await this.db.from('campaigns_campaigns').update({ invite_code: code }).eq('id', id);
    if (e2) throw e2;
    return code;
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.db.from('campaigns_campaigns').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }
}
