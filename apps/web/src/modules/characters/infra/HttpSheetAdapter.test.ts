import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/lib/api', () => {
  class ApiError extends Error { constructor(readonly code: string, message: string, readonly status: number) { super(message); } }
  return { apiFetch: vi.fn(), ApiError };
});
import { apiFetch, ApiError } from '@/shared/lib/api';
import { HttpSheetAdapter } from './HttpSheetAdapter';

describe('HttpSheetAdapter', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());
  it('PUTs data/origin/xp and returns derived + health', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ derived: { endurance: 7 }, health: 'healthy' });
    const r = await new HttpSheetAdapter().save('ch1', { name: 'K' }, 'damage', 5);
    expect(apiFetch).toHaveBeenCalledWith('/characters/ch1/sheet', { method: 'PUT', body: JSON.stringify({ data: { name: 'K' }, origin: 'damage', xp: 5 }) });
    expect(r).toEqual({ derived: { endurance: 7 }, health: 'healthy' });
  });
  it('maps API errors', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('INVALID_SHEET', 'x', 400));
    expect(await new HttpSheetAdapter().save('ch1', {}, 'sheet')).toEqual({ error: 'invalid_sheet' });
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('FORBIDDEN', 'x', 403));
    expect(await new HttpSheetAdapter().save('ch1', {}, 'sheet')).toEqual({ error: 'forbidden' });
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('net'));
    expect(await new HttpSheetAdapter().save('ch1', {}, 'sheet')).toEqual({ error: 'unknown' });
  });
});
