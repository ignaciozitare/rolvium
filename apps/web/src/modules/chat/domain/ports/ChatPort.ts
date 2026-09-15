import type { ChatDirectoryEntry, ChatMessage } from '../entities/Chat';

export type Unsubscribe = () => void;

/**
 * SUSURROS (H8): the directory, conversations and text messages. Reads go straight to Supabase under RLS
 * (`chat_conversations`/`chat_conversation_members`/`chat_messages` only let a participant see their own —
 * no admin bypass, the owner asked for that expressly). Writing a `kind = 'roll'` message is NOT here: a
 * whispered roll needs server-generated dice, see `ChatRollsPort`.
 */
export interface ChatPort {
  /** One row per campaign member (talked to or not) plus one per group you're in. */
  listDirectory(campaignId: string, myUserId: string): Promise<ChatDirectoryEntry[]>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  /** `chat_create_conversation`: reopens the existing 1:1 with the same person, always creates a new group (3+). */
  openConversation(campaignId: string, memberIds: string[]): Promise<string>;
  sendText(conversationId: string, authorId: string, body: string): Promise<void>;
  /** `chat_mark_read`: only ever the caller's own row. */
  markRead(conversationId: string): Promise<void>;
  /** Campaign-wide feed (not scoped to one conversation): callers filter by `conversationId`/`authorId` themselves. */
  subscribeMessages(campaignId: string, onInsert: (message: ChatMessage) => void): Unsubscribe;
}
