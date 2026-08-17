import { apiFetch, ApiError } from '@/shared/lib/api';
import type { InvitePort } from '../domain/ports/InvitePort';
import type { InvitePreview } from '../domain/entities/Identity';

interface Dto { code: string; campaignName: string; systemId: string; dmName: string; seatsFree: number }

/** `GET /invites/:code` — public endpoint; the API resolves it with the service role. */
export class HttpInviteAdapter implements InvitePort {
  async preview(code: string): Promise<InvitePreview | null> {
    try {
      const d = await apiFetch<Dto>(`/invites/${encodeURIComponent(code)}`);
      return { code: d.code, campaignName: d.campaignName, systemId: d.systemId, dmName: d.dmName, seatsFree: d.seatsFree };
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
      throw e;
    }
  }
}
