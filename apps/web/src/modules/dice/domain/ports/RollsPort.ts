import type { RollRequest } from '@rolvium/core';
import type { RollOutcome } from '../entities/Roll';

/** A roll request as the API takes it: the system/free intention plus the campaign it belongs to. */
export type RollInput = RollRequest & { campaignId: string };

/** Asks the server to roll (CSPRNG dice + `engine.resolve` + immutable log + sheet effects). */
export interface RollsPort {
  /** Null when the roll could not be made (offline, rejected, pool empty). */
  roll(req: RollInput): Promise<RollOutcome | null>;
}
