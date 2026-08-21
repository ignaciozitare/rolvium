import { apiFetch } from '@/shared/lib/api';
import type { AttacksPort } from '../domain/ports/AttacksPort';
import type { OpenAttackInput } from '../domain/entities/Attack';
import type { RollOutcome } from '../domain/entities/Roll';

/**
 * `POST /attacks` y `POST /attacks/:id/answer` en la API de Rolvium. Los fallos se tragan en `null`, como
 * `HttpRollsAdapter`: ni el modal de atacar ni el aviso del jugador pueden quedarse colgados por un error
 * de red — enseñan que no se pudo y siguen usables.
 */
export class HttpAttacksAdapter implements AttacksPort {
  constructor(private readonly fetcher: typeof apiFetch = apiFetch) {}

  async open(input: OpenAttackInput): Promise<{ id: string } | null> {
    try {
      const res = await this.fetcher<{ id: string }>('/attacks', { method: 'POST', body: JSON.stringify(input) });
      return res && res.id ? res : null;
    } catch {
      return null;
    }
  }

  async answer(attackId: string, defence: number): Promise<RollOutcome | null> {
    try {
      const res = await this.fetcher<RollOutcome>(`/attacks/${attackId}/answer`, { method: 'POST', body: JSON.stringify({ defence }) });
      return res && res.result ? res : null;
    } catch {
      return null;
    }
  }
}
