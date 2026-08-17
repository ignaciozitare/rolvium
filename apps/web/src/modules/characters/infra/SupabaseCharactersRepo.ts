import type { SupabaseClient } from '@supabase/supabase-js';
import type { SheetData } from '@rolvium/core';
import type { Character, CharacterAuditEntry, CharacterPatch, CreateCharacterInput, WriteOrigin } from '../domain/entities/Character';
import type { CharactersPort } from '../domain/ports/CharactersPort';
import type { SheetSavePort, SheetSaveResult, SheetSaveError } from '../domain/ports/SheetSavePort';
import { HttpSheetAdapter } from './HttpSheetAdapter';

interface Row {
  id: string; campaign_id: string; owner_id: string | null; kind: 'pc' | 'npc'; name: string; concept: string | null;
  avatar_url: string | null; token_url: string | null; color: string | null; data: SheetData; derived: Record<string, unknown>;
  health: string | null; xp: number; archived_at: string | null; created_at: string; updated_at: string;
  campaign: { name: string; system_id: string } | { name: string; system_id: string }[] | null;
  owner: { name: string; alias: string | null } | { name: string; alias: string | null }[] | null;
}
const SELECT = 'id, campaign_id, owner_id, kind, name, concept, avatar_url, token_url, color, data, derived, health, xp, archived_at, created_at, updated_at, campaign:campaigns_campaigns ( name, system_id ), owner:users!characters_owner_id_fkey ( name, alias )';

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export function mapCharacterRow(r: Row): Character {
  const camp = one(r.campaign); const owner = one(r.owner);
  return {
    id: r.id, campaignId: r.campaign_id, campaignName: camp?.name ?? '', systemId: camp?.system_id ?? '',
    ownerId: r.owner_id, ownerName: owner ? (owner.alias?.trim() || owner.name) : null, kind: r.kind, name: r.name, concept: r.concept,
    avatarUrl: r.avatar_url, tokenUrl: r.token_url, color: r.color, data: r.data ?? {}, derived: r.derived ?? {},
    health: r.health, xp: r.xp, archivedAt: r.archived_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export class SupabaseCharactersRepo implements CharactersPort {
  constructor(private readonly db: SupabaseClient, private readonly sheetSaver: SheetSavePort = new HttpSheetAdapter()) {}

  async saveSheet(id: string, patch: CharacterPatch & { data: SheetData }, origin: WriteOrigin): Promise<SheetSaveResult | { error: SheetSaveError }> {
    return this.sheetSaver.save(id, patch.data, origin, patch.xp);
  }

  private async me(): Promise<string | null> {
    const { data: { session } } = await this.db.auth.getSession();
    return session?.user.id ?? null;
  }

  async listMine(): Promise<Character[]> {
    const me = await this.me();
    if (!me) return [];
    const { data, error } = await this.db.from('characters').select(SELECT).eq('owner_id', me).is('archived_at', null).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as Row[]).map(mapCharacterRow);
  }

  async listByCampaign(campaignId: string): Promise<Character[]> {
    const { data, error } = await this.db.from('characters').select(SELECT).eq('campaign_id', campaignId).is('archived_at', null).order('created_at');
    if (error) throw error;
    return (data as unknown as Row[]).map(mapCharacterRow);
  }

  async getById(id: string): Promise<Character | null> {
    const { data, error } = await this.db.from('characters').select(SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapCharacterRow(data as unknown as Row) : null;
  }

  async create(input: CreateCharacterInput): Promise<Character> {
    const me = await this.me();
    const row = {
      campaign_id: input.campaignId, name: input.name.trim(), concept: input.concept ?? null, kind: input.kind ?? 'pc',
      owner_id: input.ownerId === undefined ? me : input.ownerId, data: input.data, derived: input.derived ?? {},
      health: input.health ?? null, color: input.color ?? null, created_by: me,
    };
    const { data, error } = await this.db.from('characters').insert(row).select(SELECT).single();
    if (error) throw error;
    const c = mapCharacterRow(data as unknown as Row);
    // Link my member row to my own PC (players may only update character_id on their row).
    if (c.ownerId && c.ownerId === me && c.kind === 'pc') {
      await this.db.from('campaigns_members').update({ character_id: c.id }).eq('campaign_id', c.campaignId).eq('user_id', me);
    }
    return c;
  }

  async update(id: string, patch: CharacterPatch, origin: WriteOrigin = 'sheet'): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row['name'] = patch.name.trim();
    if (patch.concept !== undefined) row['concept'] = patch.concept;
    if (patch.data !== undefined) row['data'] = patch.data;
    if (patch.derived !== undefined) row['derived'] = patch.derived;
    if (patch.health !== undefined) row['health'] = patch.health;
    if (patch.xp !== undefined) row['xp'] = patch.xp;
    if (patch.color !== undefined) row['color'] = patch.color;
    if (patch.avatarUrl !== undefined) row['avatar_url'] = patch.avatarUrl;
    if (patch.tokenUrl !== undefined) row['token_url'] = patch.tokenUrl;
    if (Object.keys(row).length === 0) return;
    if (origin !== 'sheet') {
      // Tell the audit trigger where this change comes from (same transaction is not guaranteed over REST,
      // so the RPC sets it and performs the update itself).
      const { error } = await this.db.rpc('characters_update_with_origin', { cid: id, patch: row, origin });
      if (error) throw error;
      return;
    }
    const { error } = await this.db.from('characters').update(row).eq('id', id);
    if (error) throw error;
  }

  async claim(id: string): Promise<void> {
    const { error } = await this.db.rpc('characters_claim', { cid: id });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('characters').delete().eq('id', id);
    if (error) throw error;
  }

  async listAudit(characterId: string): Promise<CharacterAuditEntry[]> {
    const { data, error } = await this.db.from('characters_audit').select('id, character_id, author_id, origin, field, before, after, at').eq('character_id', characterId).order('id', { ascending: false }).limit(200);
    if (error) throw error;
    return ((data ?? []) as { id: number; character_id: string; author_id: string | null; origin: CharacterAuditEntry['origin']; field: string; before: unknown; after: unknown; at: string }[])
      .map(r => ({ id: r.id, characterId: r.character_id, authorId: r.author_id, origin: r.origin, field: r.field, before: r.before, after: r.after, at: r.at }));
  }

  async uploadImage(kind: 'avatar' | 'token', characterId: string, file: Blob): Promise<string> {
    const me = await this.me();
    if (!me) throw new Error('not_authenticated');
    const bucket = kind === 'avatar' ? 'avatars' : 'tokens';
    const path = `${me}/characters/${characterId}.png`;
    const { error } = await this.db.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || 'image/png', cacheControl: '3600' });
    if (error) throw new Error(error.message);
    const url = `${this.db.storage.from(bucket).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    await this.update(characterId, kind === 'avatar' ? { avatarUrl: url } : { tokenUrl: url });
    return url;
  }
}
