import type { PendingRollRequest } from '../entities/RollRequestAsk';
import type { Unsubscribe } from './RollLogPort';

/**
 * Vigila las peticiones de tirada que me esperan (`dice_roll_requests`, RLS: el director ve las de su mesa
 * y el jugador sólo las suyas) y sigue la tabla en vivo — el aviso «Tirada pedida» tiene que SALTAR.
 */
export interface RollRequestWatchPort {
  listPending(campaignId: string): Promise<PendingRollRequest[]>;
  subscribe(campaignId: string, onChange: () => void): Unsubscribe;
}
