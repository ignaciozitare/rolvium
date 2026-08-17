import type { Roll } from '../entities/Roll';

export type Unsubscribe = () => void;

/** The campaign's roll log (Registro): what RLS lets me see, newest first, and live inserts. */
export interface RollLogPort {
  listRecent(campaignId: string, limit?: number): Promise<Roll[]>;
  subscribe(campaignId: string, onInsert: (roll: Roll) => void): Unsubscribe;
}
