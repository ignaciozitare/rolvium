export type CampaignVisibility = 'open' | 'invite';
export type TableRole = 'dm' | 'player';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  systemId: string;
  systemVersion: string;
  dmId: string;
  dmName: string;
  visibility: CampaignVisibility;
  seats: number;
  inviteCode: string | null;        // only visible to the DM
  progressionEnabled: boolean;
  playersCount: number;
  nextSessionAt: string | null;
  lastSessionAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  /** Present when the current user is a member. */
  myRole?: TableRole;
  myCharacterId?: string | null;
}

export interface CampaignMember {
  campaignId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: TableRole;
  characterId: string | null;
  joinedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  systemId: string;
  systemVersion: string;
  visibility: CampaignVisibility;
  seats: number;
  progressionEnabled: boolean;
  sharedResources: Record<string, unknown>;
  locale?: string;
}

export type JoinError = 'invalid_code' | 'campaign_full' | 'not_authenticated' | 'unknown';
