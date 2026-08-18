import type { Campaign, CampaignMember, CreateCampaignInput, JoinError, JoinRequest } from '../entities/Campaign';

export interface CampaignsPort {
  /** Campaigns where the current user is DM or player. */
  listMine(): Promise<Campaign[]>;
  /** Open, non-archived campaigns the user is NOT a member of. */
  listOpen(): Promise<Campaign[]>;
  getById(id: string): Promise<Campaign | null>;
  listMembers(campaignId: string): Promise<CampaignMember[]>;
  create(input: CreateCampaignInput): Promise<Campaign>;
  /** Returns the campaign id joined (idempotent if already a member). */
  joinByCode(code: string): Promise<{ campaignId: string } | { error: JoinError }>;
  requestJoin(campaignId: string, message?: string): Promise<void>;
  leave(campaignId: string): Promise<void>;
  /** DM only. */
  update(id: string, patch: Partial<Pick<Campaign, 'name' | 'description' | 'visibility' | 'seats' | 'progressionEnabled' | 'nextSessionAt'>>): Promise<void>;
  /** DM only: the invite code (never included in listings). */
  getInviteCode(id: string): Promise<string | null>;
  regenerateInviteCode(id: string): Promise<string>;
  archive(id: string): Promise<void>;
  /** DM only: pending join requests of an open campaign. */
  listRequests(campaignId: string): Promise<JoinRequest[]>;
  /** DM only: accept (→ member) or reject a pending request (`campaigns_resolve_request`). */
  resolveRequest(requestId: string, accept: boolean): Promise<void>;
  /** DM only: expel a player (deletes the member row). */
  removeMember(campaignId: string, userId: string): Promise<void>;
}
