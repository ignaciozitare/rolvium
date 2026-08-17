import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/api', () => {
  class ApiError extends Error { constructor(readonly code: string, message: string, readonly status: number) { super(message); } }
  return { apiFetch: vi.fn(), ApiError };
});
import { apiFetch, ApiError } from '@/shared/lib/api';
import { HttpInviteAdapter } from './HttpInviteAdapter';

describe('HttpInviteAdapter', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());
  it('maps the API dto', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ code: 'LUNA-4F7K', campaignName: 'C', systemId: 'plenilunio', dmName: 'I', seatsFree: 2 });
    expect(await new HttpInviteAdapter().preview('LUNA-4F7K')).toEqual({ code: 'LUNA-4F7K', campaignName: 'C', systemId: 'plenilunio', dmName: 'I', seatsFree: 2 });
    expect(apiFetch).toHaveBeenCalledWith('/invites/LUNA-4F7K');
  });
  it('returns null on 404 and rethrows other errors', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('INVALID_CODE', 'nope', 404));
    expect(await new HttpInviteAdapter().preview('XXXX-XXXX')).toBeNull();
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('HTTP_ERROR', 'down', 500));
    await expect(new HttpInviteAdapter().preview('XXXX-XXXX')).rejects.toThrow('down');
  });
});
