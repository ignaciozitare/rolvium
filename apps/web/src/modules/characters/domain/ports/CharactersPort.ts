import type { Character, CharacterAuditEntry, CharacterPatch, CreateCharacterInput, WriteOrigin } from '../entities/Character';

export interface CharactersPort {
  /** Every character I own, across campaigns (for /characters). */
  listMine(): Promise<Character[]>;
  /** Characters visible to me in a campaign (all PCs; NPCs only for the DM). */
  listByCampaign(campaignId: string): Promise<Character[]>;
  getById(id: string): Promise<Character | null>;
  create(input: CreateCharacterInput): Promise<Character>;
  /** `origin` is recorded by the audit trigger (default 'sheet'). */
  update(id: string, patch: CharacterPatch, origin?: WriteOrigin): Promise<void>;
  /** Take an unassigned PC (DM-made) and link it to my member row. */
  claim(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** DM only (RLS). Newest first. */
  listAudit(characterId: string): Promise<CharacterAuditEntry[]>;
  uploadImage(kind: 'avatar' | 'token', characterId: string, file: Blob): Promise<string>;
}
