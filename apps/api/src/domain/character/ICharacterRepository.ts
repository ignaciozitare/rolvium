import type { SheetData } from '@rolvium/core';

export interface CharacterAccess {
  id: string;
  campaignId: string;
  systemId: string;
  ownerId: string | null;
  data: SheetData;
  /** Rights of the acting user, computed with the service role (RLS does not apply there). */
  isOwner: boolean;
  isDm: boolean;
  isMember: boolean;
}

export type SaveOrigin = 'sheet' | 'roll' | 'damage' | 'progression' | 'dm';

export interface ICharacterRepository {
  /** Character + the actor's rights, or null when it does not exist. */
  findForActor(characterId: string, actorId: string): Promise<CharacterAccess | null>;
  /** Persists as the actor (guards + audit run under their identity). */
  saveSheet(characterId: string, actorId: string, patch: { data: SheetData; derived: Record<string, unknown>; health: string | null; xp?: number; name?: string; concept?: string | null }, origin: SaveOrigin): Promise<void>;
  /** Membership check for rolls without a character (campaign-level). */
  isCampaignMember(campaignId: string, actorId: string): Promise<boolean>;
  /** Whether the actor directs the campaign (the DM is not in `campaigns_members`). */
  isCampaignDm(campaignId: string, actorId: string): Promise<boolean>;
}
