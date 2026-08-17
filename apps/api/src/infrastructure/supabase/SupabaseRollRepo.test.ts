import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRollRepo } from './SupabaseRollRepo.js';
import type { RollCommitInput } from '../../domain/roll/IRollRepository.js';

const INPUT: RollCommitInput = {
  actorId: 'u1', campaignId: 'c1', characterId: 'ch1', systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat',
  request: { systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' },
  dice: [[6, 2]], result: { summary: 'roll.degree.success.1', total: 1 }, visibility: 'table', shared: { destiny: 1 },
};
const db = (rpcResult: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};

describe('SupabaseRollRepo', () => {
  it('commits through dice_commit_roll with the actor, the campaign and the shared dice; returns the new id', async () => {
    const { db: d, rpc } = db({ data: 'roll-1' });
    expect(await new SupabaseRollRepo(d).commit(INPUT)).toEqual({ id: 'roll-1' });
    expect(rpc).toHaveBeenCalledWith('dice_commit_roll', expect.objectContaining({ actor: 'u1', cid: 'c1', char_id: 'ch1', sys_id: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', dice: [[6, 2]], visibility: 'table', shared: { destiny: 1 }, corrects: null }));
  });
  it('maps pool_empty → POOL_EMPTY, not_member → FORBIDDEN, anything else → DB_ERROR', async () => {
    await expect(new SupabaseRollRepo(db({ error: { message: 'pool_empty' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'POOL_EMPTY' });
    await expect(new SupabaseRollRepo(db({ error: { message: 'not_member' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseRollRepo(db({ error: { message: 'timeout' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
});
