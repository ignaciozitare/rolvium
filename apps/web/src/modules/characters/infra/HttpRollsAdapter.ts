import type { RollRequest, RollResult } from '@rolvium/core';
import { apiFetch } from '@/shared/lib/api';
import type { RollsPort } from '../domain/ports/RollsPort';

/** `POST /rolls` on the Rolvium API (dice are generated server-side). Swallows failures into `null` so the sheet stays usable. */
export class HttpRollsAdapter implements RollsPort {
  constructor(private readonly fetcher: typeof apiFetch = apiFetch) {}
  async roll(req: RollRequest): Promise<RollResult | null> {
    try {
      const res = await this.fetcher<RollResult | { result: RollResult }>('/rolls', { method: 'POST', body: JSON.stringify(req) });
      if (!res) return null;
      return 'result' in res && res.result ? res.result : (res as RollResult);
    } catch {
      return null;
    }
  }
}
