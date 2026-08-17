import type { SharedResourceState } from '@rolvium/core';
import type { Campaign, CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';

export interface PresenceInfo { userId: string; devices: number; }

export interface TableSnapshot {
  campaign: Campaign;
  members: CampaignMember[];
  resources: Record<string, SharedResourceState>;
  presence: PresenceInfo[];
  activeSceneId: string | null;
}

export interface TableViewer { userId: string; role: TableRole; name: string; }

export type ResourceError = 'pool_empty' | 'per_take_max' | 'resource_missing' | 'not_member' | 'forbidden' | 'unknown';
export type TableTab = 'sheet' | 'group' | 'scene' | 'bestiary' | 'improve' | 'create';
