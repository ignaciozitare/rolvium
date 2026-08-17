import type { RollRequest, RollResult, RollVisibility, RolledDice } from '@rolvium/core';

/** Everything `dice_commit_roll` needs: the intention, the server dice, the system's verdict and who/where. */
export interface RollCommitInput {
  actorId: string;
  campaignId: string;
  characterId: string | null;
  systemId: string | null;
  kind: 'system' | 'free';
  title: string;
  request: RollRequest;
  dice: RolledDice;
  result: RollResult;
  visibility: RollVisibility;
  /** Shared-resource dice spent from the actor's hand in the same transaction, e.g. { destiny: 2 }. */
  shared: Record<string, number>;
  correctsId?: string;
}

/** Errors the adapter maps from the DB: `FORBIDDEN` (not a member / bad character) or `POOL_EMPTY` (hand smaller than `shared`). */
export type RollCommitErrorCode = 'FORBIDDEN' | 'POOL_EMPTY';

export interface IRollRepository {
  /** Persists the roll (immutable) and debits shared dice atomically. Throws `{ code: RollCommitErrorCode }` on the known failures. */
  commit(input: RollCommitInput): Promise<{ id: string }>;
}
