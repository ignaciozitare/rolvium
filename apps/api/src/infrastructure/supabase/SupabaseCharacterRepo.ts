import type { SupabaseClient } from '@supabase/supabase-js';
import type { SheetData } from '@rolvium/core';
import type { CharacterAccess, ICharacterRepository, SaveOrigin } from '../../domain/character/ICharacterRepository.js';

interface Row { id: string; campaign_id: string; owner_id: string | null; data: SheetData; campaign: { system_id: string; dm_id: string } | { system_id: string; dm_id: string }[] | null }

/** Service-role adapter: rights are computed explicitly (RLS is bypassed), writes go through `characters_api_update` as the actor. */
export class SupabaseCharacterRepo implements ICharacterRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findForActor(characterId: string, actorId: string): Promise<CharacterAccess | null> {
    const { data, error } = await this.db.from('characters').select('id, campaign_id, owner_id, data, campaign:campaigns_campaigns ( system_id, dm_id )').eq('id', characterId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const r = data as unknown as Row;
    const camp = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
    const isDm = camp?.dm_id === actorId;
    const isMember = isDm || await this.isCampaignMember(r.campaign_id, actorId);
    return { id: r.id, campaignId: r.campaign_id, systemId: camp?.system_id ?? '', ownerId: r.owner_id, data: r.data ?? {}, isOwner: r.owner_id === actorId, isDm, isMember };
  }

  async saveSheet(characterId: string, actorId: string, patch: { data: SheetData; derived: Record<string, unknown>; health: string | null; xp?: number; name?: string; concept?: string | null }, origin: SaveOrigin): Promise<void> {
    const body: Record<string, unknown> = { data: patch.data, derived: patch.derived, health: patch.health };
    if (patch.xp !== undefined) body['xp'] = patch.xp;
    if (patch.name !== undefined) body['name'] = patch.name;
    if (patch.concept !== undefined) body['concept'] = patch.concept;
    const { error } = await this.db.rpc('characters_api_update', { cid: characterId, patch: body, origin, actor: actorId });
    if (error) throw Object.assign(new Error(error.message), { code: /forbidden|not_found|not_authenticated|progression_disabled|players may not/i.test(error.message) ? 'FORBIDDEN' : 'DB_ERROR' });
  }

  async isCampaignMember(campaignId: string, actorId: string): Promise<boolean> {
    const { data, error } = await this.db.from('campaigns_members').select('user_id').eq('campaign_id', campaignId).eq('user_id', actorId).maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  }

  async isCampaignDm(campaignId: string, actorId: string): Promise<boolean> {
    const { data, error } = await this.db.from('campaigns_campaigns').select('dm_id').eq('id', campaignId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { dm_id?: string } | null)?.dm_id === actorId;
  }
}
