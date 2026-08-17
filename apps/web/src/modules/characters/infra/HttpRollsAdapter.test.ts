import { describe, it, expect, vi } from 'vitest';
import type { RollRequest } from '@rolvium/core';
import { HttpRollsAdapter } from './HttpRollsAdapter';

const REQ: RollRequest = { systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', groups: [{ count: 4, sides: 6, tag: 'own' }], visibility: 'table' };

describe('HttpRollsAdapter', () => {
  it('posts the request to /rolls and returns the result', async () => {
    const fetcher = vi.fn().mockResolvedValue({ summary: 'ok', total: 2 });
    const res = await new HttpRollsAdapter(fetcher as never).roll(REQ);
    expect(fetcher).toHaveBeenCalledWith('/rolls', expect.objectContaining({ method: 'POST', body: JSON.stringify(REQ) }));
    expect(res).toEqual({ summary: 'ok', total: 2 });
  });
  it('unwraps { result } envelopes', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: { summary: 'wrapped' } });
    expect(await new HttpRollsAdapter(fetcher as never).roll(REQ)).toEqual({ summary: 'wrapped' });
  });
  it('returns null on failure or empty body', async () => {
    expect(await new HttpRollsAdapter(vi.fn().mockRejectedValue(new Error('down')) as never).roll(REQ)).toBeNull();
    expect(await new HttpRollsAdapter(vi.fn().mockResolvedValue(undefined) as never).roll(REQ)).toBeNull();
  });
});
