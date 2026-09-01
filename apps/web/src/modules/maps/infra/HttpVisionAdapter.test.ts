import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/api', () => {
  class ApiError extends Error { constructor(readonly code: string, message: string, readonly status: number) { super(message); } }
  return { apiFetch: vi.fn(), ApiError };
});
import { apiFetch, ApiError } from '@/shared/lib/api';
import { HttpVisionAdapter } from './HttpVisionAdapter';

const VISION = { vision: [[[0, 0], [10, 0], [10, 10]]], explored: [[0, 0], [1, 0]], radiusPx: null };

describe('HttpVisionAdapter', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('`refresh` POSTs to /scenes/:id/vision with no body and returns what the server saw for me', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(VISION);
    expect(await new HttpVisionAdapter().refresh('sc-1')).toEqual(VISION);
    expect(apiFetch).toHaveBeenCalledWith('/scenes/sc-1/vision', { method: 'POST' });
  });

  /** La sonda de prueba (§ 7.3): un PUNTO, no una ficha. Es la diferencia que evita el mapa en negro. */
  it('`refresh` con sonda manda el punto en el cuerpo', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(VISION);
    await new HttpVisionAdapter().refresh('sc-1', undefined, { probe: { x: 120, y: 80 } });
    expect(apiFetch).toHaveBeenCalledWith('/scenes/sc-1/vision', { method: 'POST', body: JSON.stringify({ probe: { x: 120, y: 80 } }) });
  });

  it('`paint` POSTs the brush disc to /scenes/:id/fog', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...VISION, vision: [] });
    const res = await new HttpVisionAdapter().paint('sc-1', 'hide', { x: 100, y: 200, radius: 81 });
    expect(res.vision).toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith('/scenes/sc-1/fog', {
      method: 'POST',
      body: JSON.stringify({ op: 'hide', at: { x: 100, y: 200, radius: 81 } }),
    });
  });

  it('`paintAll` asks for the whole scene instead of a disc', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(VISION);
    await new HttpVisionAdapter().paintAll('sc-1', 'reveal');
    expect(apiFetch).toHaveBeenCalledWith('/scenes/sc-1/fog', { method: 'POST', body: JSON.stringify({ op: 'reveal', all: true }) });
  });

  it('propagates the API error instead of swallowing it — the caller decides what a blind client does', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('FORBIDDEN', 'forbidden', 403));
    await expect(new HttpVisionAdapter().refresh('sc-1')).rejects.toThrow('forbidden');
  });
});
