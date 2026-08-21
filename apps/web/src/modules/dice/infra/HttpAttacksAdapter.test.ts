import { describe, it, expect, vi } from 'vitest';
import type { OpenAttackInput } from '../domain/entities/Attack';
import { HttpAttacksAdapter } from './HttpAttacksAdapter';

const REQ = { systemId: 'plenilunio', kind: 'system' as const, title: 'Ogro ataca a Karen', groups: [{ count: 4, sides: 6, tag: 'own' }], visibility: 'table' as const };
const INPUT: OpenAttackInput = {
  campaignId: 'c1', sceneId: 'sc1', attackerTokenId: 'tk-ogro', targetTokenId: 'tk-karen',
  attackerName: 'Ogro', targetCharacterId: 'ch1', dice: 4, request: REQ,
};
const OUT = { id: 'r1', request: REQ, dice: [[6, 2, 4, 1]], result: { summary: 'ok', total: 2 }, rolledAt: 't' };

describe('HttpAttacksAdapter', () => {
  it('abre el ataque en /attacks y devuelve su id', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'atk-1' });
    expect(await new HttpAttacksAdapter(fetcher as never).open(INPUT)).toEqual({ id: 'atk-1' });
    expect(fetcher).toHaveBeenCalledWith('/attacks', expect.objectContaining({ method: 'POST', body: JSON.stringify(INPUT) }));
  });
  it('contesta en /attacks/:id/answer y devuelve la tirada que salió', async () => {
    const fetcher = vi.fn().mockResolvedValue(OUT);
    expect(await new HttpAttacksAdapter(fetcher as never).answer('atk-1', 2)).toEqual(OUT);
    expect(fetcher).toHaveBeenCalledWith('/attacks/atk-1/answer', expect.objectContaining({ method: 'POST', body: JSON.stringify({ defence: 2 }) }));
  });
  /** «No me defiendo» es una respuesta: 0 tiene que viajar, no convertirse en «no contestó». */
  it('manda el 0 de «no me defiendo» tal cual', async () => {
    const fetcher = vi.fn().mockResolvedValue(OUT);
    await new HttpAttacksAdapter(fetcher as never).answer('atk-1', 0);
    expect(fetcher).toHaveBeenCalledWith('/attacks/atk-1/answer', expect.objectContaining({ body: JSON.stringify({ defence: 0 }) }));
  });
  it('devuelve null si falla, si no llega nada o si el cuerpo no trae lo esperado', async () => {
    const down = new HttpAttacksAdapter(vi.fn().mockRejectedValue(new Error('down')) as never);
    expect(await down.open(INPUT)).toBeNull();
    expect(await down.answer('atk-1', 1)).toBeNull();
    expect(await new HttpAttacksAdapter(vi.fn().mockResolvedValue(undefined) as never).open(INPUT)).toBeNull();
    expect(await new HttpAttacksAdapter(vi.fn().mockResolvedValue({ id: 'x' }) as never).answer('atk-1', 1)).toBeNull();
  });
});
