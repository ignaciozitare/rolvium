import type { RollRequest, RollResult } from '@rolvium/core';

/** Asks the server to roll (CSPRNG dice + `engine.resolve` + log). Belongs to `dice` (H6); the sheet only needs this slice. */
export interface RollsPort {
  /** Null when the roll could not be made (offline, rejected). */
  roll(req: RollRequest): Promise<RollResult | null>;
}
