import type { SheetData } from '@rolvium/core';

export type CharacterKind = 'pc' | 'npc';
/** Where a change comes from — mirrors `characters_audit.origin`. */
export type AuditOrigin = 'sheet' | 'roll' | 'damage' | 'progression' | 'dm' | 'system';
/** Origins a writer may tag ('system' is reserved for the trigger). */
export type WriteOrigin = Exclude<AuditOrigin, 'system'>;

export interface Character {
  id: string;
  campaignId: string;
  campaignName: string;
  systemId: string;
  ownerId: string | null;
  ownerName: string | null;
  kind: CharacterKind;
  name: string;
  concept: string | null;
  avatarUrl: string | null;
  tokenUrl: string | null;
  color: string | null;
  data: SheetData;
  derived: Record<string, unknown>;
  health: string | null;
  xp: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterInput {
  campaignId: string;
  name: string;
  concept?: string;
  kind?: CharacterKind;
  /** DM only: assign to a member, or leave undefined = unassigned. Players always own their own. */
  ownerId?: string | null;
  data: SheetData;
  derived?: Record<string, unknown>;
  health?: string | null;
  color?: string | null;
}

export interface CharacterPatch {
  name?: string;
  concept?: string | null;
  data?: SheetData;
  derived?: Record<string, unknown>;
  health?: string | null;
  xp?: number;
  color?: string | null;
  avatarUrl?: string | null;
  tokenUrl?: string | null;
}

export interface CharacterAuditEntry {
  id: number;
  characterId: string;
  authorId: string | null;
  origin: AuditOrigin;
  field: string;
  before: unknown;
  after: unknown;
  at: string;
}
