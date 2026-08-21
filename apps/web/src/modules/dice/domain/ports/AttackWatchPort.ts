import type { PendingAttack } from '../entities/Attack';
import type { Unsubscribe } from './RollLogPort';

/**
 * Los ataques que me esperan. Se lee de `dice_attacks` bajo RLS —que sólo deja ver los del director y los
 * del dueño del personaje atacado— y se sigue en vivo, porque el aviso tiene que SALTAR sin recargar
 * («le salta al jugador cuando le atacan», `rolvium.pen` columna 5).
 */
export interface AttackWatchPort {
  listPending(campaignId: string): Promise<PendingAttack[]>;
  /** Avisa de cualquier cambio en los ataques de la campaña; quien escucha vuelve a pedir la lista. */
  subscribe(campaignId: string, onChange: () => void): Unsubscribe;
}
