import type { RollRequest, RollResult, RolledDice } from '@rolvium/core';

/** Everything `chat_commit_roll` needs: the intention, the server dice and the system's verdict. */
export interface ChatRollCommitInput {
  actorId: string;
  conversationId: string;
  characterId: string | null;
  systemId: string | null;
  rollKind: 'system' | 'free';
  title: string;
  request: RollRequest;
  dice: RolledDice;
  result: RollResult;
}

/** `FORBIDDEN` covers not-a-participant and a character outside the conversation's campaign. */
export type ChatRollCommitErrorCode = 'FORBIDDEN';

export interface IChatRollRepository {
  /** Persists the roll into `chat_messages` (never `dice_rolls`) — immutable, no trace in the Registro. */
  commit(input: ChatRollCommitInput): Promise<{ id: string }>;
  /** The conversation's campaign, or `null` when it does not exist or the actor is not a participant. */
  campaignOf(conversationId: string, actorId: string): Promise<string | null>;
}
