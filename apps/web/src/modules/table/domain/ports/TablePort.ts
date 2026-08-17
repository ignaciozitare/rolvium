import type { SharedResourceState } from '@rolvium/core';
import type { ResourceError, TableSnapshot } from '../entities/Table';

export type Unsubscribe = () => void;
export type ResourceResult = { state: SharedResourceState } | { error: ResourceError };

export interface TablePort {
  load(campaignId: string): Promise<TableSnapshot | null>;
  /** Live updates: resources / active scene / members / presence. Also joins presence for the current user+device. */
  subscribe(campaignId: string, onChange: (partial: Partial<TableSnapshot>) => void): Unsubscribe;
  takeResource(campaignId: string, resourceId: string, n: number, perTakeMax: number): Promise<ResourceResult>;
  returnResource(campaignId: string, resourceId: string, n?: number): Promise<ResourceResult>;
  resetResource(campaignId: string, resourceId: string): Promise<ResourceResult>;
}
