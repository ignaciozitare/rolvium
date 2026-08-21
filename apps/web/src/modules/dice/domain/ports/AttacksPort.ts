import type { RollOutcome } from '../entities/Roll';
import type { OpenAttackInput } from '../entities/Attack';

/**
 * Abrir un ataque a la espera y contestarlo. Va por la API, igual que `RollsPort`: los dados los genera el
 * servidor y la tabla no tiene políticas de escritura para el navegador.
 */
export interface AttacksPort {
  /** `POST /attacks` — sólo el director. `null` si no se pudo abrir. */
  open(input: OpenAttackInput): Promise<{ id: string } | null>;
  /**
   * `POST /attacks/:id/answer` — sólo el dueño del personaje atacado. `defence` 0 es «no me defiendo», que
   * es una respuesta. Devuelve la tirada que salió, o `null` si no se pudo contestar.
   */
  answer(attackId: string, defence: number): Promise<RollOutcome | null>;
}
