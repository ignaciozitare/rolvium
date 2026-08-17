import { describe, it, expect, vi } from 'vitest';
import type { RollInput } from '../domain/ports/RollsPort';
import { HttpRollsAdapter } from './HttpRollsAdapter';

const REQ: RollInput = { campaignId: 'c1', systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', groups: [{ count: 4, sides: 6, tag: 'own' }], visibility: 'table' };
const OUT = { id: 'r1', request: REQ, dice: [[6, 2, 4, 1]], result: { summary: 'ok', total: 2 }, rolledAt: 't' };

describe('HttpRollsAdapter', () => {
  it('posts the request (with campaignId) to /rolls and returns the outcome', async () => {
    const fetcher = vi.fn().mockResolvedValue(OUT);
    const res = await new HttpRollsAdapter(fetcher as never).roll(REQ);
    expect(fetcher).toHaveBeenCalledWith('/rolls', expect.objectContaining({ method: 'POST', body: JSON.stringify(REQ) }));
    expect(res).toEqual(OUT);
  });
  it('returns null on failure, empty body or a body without result', async () => {
    expect(await new HttpRollsAdapter(vi.fn().mockRejectedValue(new Error('down')) as never).roll(REQ)).toBeNull();
    expect(await new HttpRollsAdapter(vi.fn().mockResolvedValue(undefined) as never).roll(REQ)).toBeNull();
    expect(await new HttpRollsAdapter(vi.fn().mockResolvedValue({ id: 'x' }) as never).roll(REQ)).toBeNull();
  });
});
