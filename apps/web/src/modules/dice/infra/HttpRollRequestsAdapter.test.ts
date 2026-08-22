import { describe, it, expect, vi } from 'vitest';
import type { OpenRollRequestsInput } from '../domain/entities/RollRequestAsk';
import { HttpRollRequestsAdapter } from './HttpRollRequestsAdapter';

const INPUT: OpenRollRequestsInput = {
  campaignId: 'c1', targetCharacterIds: ['ch1', 'ch2'], stat: 'fortitude', difficulty: 2, specialtyAllowed: true,
};
const REQ = { systemId: 'plenilunio', kind: 'system' as const, title: 'sheet.stats.fortitude', groups: [{ count: 4, sides: 6, tag: 'own' }], visibility: 'table' as const };
const OUT = { id: 'r1', request: REQ, dice: [[6, 2, 4, 1]], result: { summary: 'ok', total: 2 }, rolledAt: 't' };

describe('HttpRollRequestsAdapter', () => {
  it('abre el lote en /roll-requests y devuelve su id', async () => {
    const fetcher = vi.fn().mockResolvedValue({ batchId: 'b-1' });
    expect(await new HttpRollRequestsAdapter(fetcher as never).open(INPUT)).toEqual({ batchId: 'b-1' });
    expect(fetcher).toHaveBeenCalledWith('/roll-requests', expect.objectContaining({ method: 'POST', body: JSON.stringify(INPUT) }));
  });
  /** Contestar no lleva cuerpo: el puñado lo rearma el servidor con la ficha — el navegador no manda nada. */
  it('contesta en /roll-requests/:id/answer sin cuerpo y devuelve la tirada que salió', async () => {
    const fetcher = vi.fn().mockResolvedValue(OUT);
    expect(await new HttpRollRequestsAdapter(fetcher as never).answer('req-1')).toEqual(OUT);
    expect(fetcher).toHaveBeenCalledWith('/roll-requests/req-1/answer', expect.objectContaining({ method: 'POST' }));
    expect((fetcher.mock.calls[0]![1] as Record<string, unknown>)['body']).toBeUndefined();
  });
  it('devuelve null si falla, si no llega nada o si el cuerpo no trae lo esperado', async () => {
    const down = new HttpRollRequestsAdapter(vi.fn().mockRejectedValue(new Error('down')) as never);
    expect(await down.open(INPUT)).toBeNull();
    expect(await down.answer('req-1')).toBeNull();
    expect(await new HttpRollRequestsAdapter(vi.fn().mockResolvedValue(undefined) as never).open(INPUT)).toBeNull();
    expect(await new HttpRollRequestsAdapter(vi.fn().mockResolvedValue({ batchId: 'x' }) as never).answer('req-1')).toBeNull();
  });
});
