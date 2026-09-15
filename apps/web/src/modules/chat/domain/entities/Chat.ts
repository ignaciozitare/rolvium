import type { RollRequest, RollResult, RolledDice } from '@rolvium/core';

export type ChatMemberRole = 'dm' | 'player';
export type ChatMessageKind = 'text' | 'roll' | 'roll_ref';

/** One row of `chat_messages`, joined for display (author/character name from Supabase). */
export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  kind: ChatMessageKind;
  body: string | null;
  characterId: string | null;
  characterName: string | null;
  systemId: string | null;
  /** Only for `kind = 'roll'`: same shape as a Registro roll, so it can share `describeRoll`. */
  rollKind: 'system' | 'free' | null;
  rollRequest: RollRequest | null;
  rollDice: RolledDice | null;
  rollResult: RollResult | null;
  /** Only for `kind = 'roll_ref'`: the referenced `dice_rolls.id` — the message never copies the result. */
  rollRefId: string | null;
  createdAt: string;
}

/**
 * One row of the SUSURROS directory (`rolvium.pen Panel/Susurros · directorio`): one per campaign member you
 * haven't necessarily talked to yet (`conversationId` is `null` until you do), plus one per group you're in.
 */
export interface ChatDirectoryEntry {
  /** React key + click target: the other member's userId for a 1:1 slot, the conversation id for a group. */
  key: string;
  conversationId: string | null;
  isGroup: boolean;
  /** The member's name, or the comma-joined names of a group's members. */
  title: string;
  /** Set for a 1:1 slot (drives the "· directora"/"· jugador" subtitle); `null` for a group. */
  role: ChatMemberRole | null;
  /** Set for a group (drives "Grupo · N personas"); `null` for a 1:1 slot. */
  memberCount: number | null;
  /** To open/create the conversation from this row (`ChatPort.openConversation`). */
  memberIds: string[];
  lastKind: ChatMessageKind | null;
  lastBody: string | null;
  unreadCount: number;
}
