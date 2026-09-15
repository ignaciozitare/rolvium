import type { RollRequest } from '@rolvium/core';

export type ChatRollInput = RollRequest & { conversationId: string };

/**
 * Asks the server to roll privately inside a conversation (`POST /chat/rolls`) — the row lands in
 * `chat_messages`, never `dice_rolls`. Only the new id comes back; the fully-joined message (author name,
 * etc.) arrives the same way it does for every other participant — through `ChatPort.subscribeMessages`,
 * since the whisperer is a participant too and sees their own insert via realtime.
 */
export interface ChatRollsPort {
  /** `null` when the roll could not be made (offline, rejected). */
  roll(req: ChatRollInput): Promise<{ id: string } | null>;
}
