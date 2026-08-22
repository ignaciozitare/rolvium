import type { RollOutcome } from '../entities/Roll';
import type { OpenRollRequestsInput } from '../entities/RollRequestAsk';

/**
 * Pedir tiradas y contestarlas. Va por la API, igual que `AttacksPort`: los dados los genera el servidor y
 * el puñado del que contesta lo rearma `poolFor` con SU ficha — el navegador no manda ni grupos ni opciones.
 */
export interface RollRequestsPort {
  /** `POST /roll-requests` — sólo el director. «A TODOS» = varios personajes, mismo lote. `null` si no se pudo. */
  open(input: OpenRollRequestsInput): Promise<{ batchId: string } | null>;
  /** `POST /roll-requests/:id/answer` — sólo el dueño del personaje. La tirada sale ahí mismo, o `null`. */
  answer(requestId: string): Promise<RollOutcome | null>;
}
