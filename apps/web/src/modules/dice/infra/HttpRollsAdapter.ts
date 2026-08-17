import { apiFetch } from '@/shared/lib/api';
import type { RollInput, RollsPort } from '../domain/ports/RollsPort';
import type { RollOutcome } from '../domain/entities/Roll';

/** `POST /rolls` on the Rolvium API (dice are generated and logged server-side). Swallows failures into `null` so the sheet stays usable. */
export class HttpRollsAdapter implements RollsPort {
  constructor(private readonly fetcher: typeof apiFetch = apiFetch) {}
  async roll(req: RollInput): Promise<RollOutcome | null> {
    try {
      const res = await this.fetcher<RollOutcome>('/rolls', { method: 'POST', body: JSON.stringify(req) });
      return res && res.result ? res : null;
    } catch {
      return null;
    }
  }
}
