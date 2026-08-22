import { apiFetch } from '@/shared/lib/api';
import type { RollRequestsPort } from '../domain/ports/RollRequestsPort';
import type { OpenRollRequestsInput } from '../domain/entities/RollRequestAsk';
import type { RollOutcome } from '../domain/entities/Roll';

/**
 * `POST /roll-requests` y `POST /roll-requests/:id/answer` en la API de Rolvium. Los fallos se tragan en
 * `null`, como `HttpAttacksAdapter`: ni el panel del director ni el aviso del jugador pueden quedarse
 * colgados por un error de red — enseñan que no se pudo y siguen usables.
 */
export class HttpRollRequestsAdapter implements RollRequestsPort {
  constructor(private readonly fetcher: typeof apiFetch = apiFetch) {}

  async open(input: OpenRollRequestsInput): Promise<{ batchId: string } | null> {
    try {
      const res = await this.fetcher<{ batchId: string }>('/roll-requests', { method: 'POST', body: JSON.stringify(input) });
      return res && res.batchId ? res : null;
    } catch {
      return null;
    }
  }

  async answer(requestId: string): Promise<RollOutcome | null> {
    try {
      const res = await this.fetcher<RollOutcome>(`/roll-requests/${requestId}/answer`, { method: 'POST' });
      return res && res.result ? res : null;
    } catch {
      return null;
    }
  }
}
