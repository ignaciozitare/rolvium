import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRollRequestRepo } from './SupabaseRollRequestRepo.js';
import type { OpenRollRequestsInput } from '../../domain/rollRequest/IRollRequestRepository.js';

/** Calcado de SupabaseAttackRepo.test.ts: mismo reparto rpc/select, misma tabla de traducción de errores. */
const INPUT: OpenRollRequestsInput = {
  actorId: 'dm1', campaignId: 'c1', targetCharacterIds: ['ch1', 'ch2'], stat: 'combat', difficulty: 2, specialtyAllowed: true,
};

const rpcDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};
const selectDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { db: { from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient, select };
};

describe('SupabaseRollRequestRepo', () => {
  it('abre el lote por `dice_open_roll_requests` con el actor y los personajes; devuelve el batchId', async () => {
    const { db, rpc } = rpcDb({ data: 'batch-1' });
    expect(await new SupabaseRollRequestRepo(db).openBatch(INPUT)).toEqual({ batchId: 'batch-1' });
    expect(rpc).toHaveBeenCalledWith('dice_open_roll_requests', {
      actor: 'dm1', cid: 'c1', target_chars: ['ch1', 'ch2'], stat_key: 'combat', diff: 2, specialty: true,
    });
  });
  it('cierra por `dice_close_roll_request` apuntando la tirada con la que se contestó', async () => {
    const { db, rpc } = rpcDb({});
    await new SupabaseRollRequestRepo(db).close('req-1', 'roll-1', 'resolved');
    expect(rpc).toHaveBeenCalledWith('dice_close_roll_request', { rid: 'req-1', roll: 'roll-1', new_status: 'resolved' });
  });
  it('traduce los errores de SQL: not_pending → NOT_PENDING, not_dm/not_member/no_targets → FORBIDDEN, el resto → DB_ERROR', async () => {
    await expect(new SupabaseRollRequestRepo(rpcDb({ error: { message: 'not_pending' } }).db).close('r', null, 'resolved')).rejects.toMatchObject({ code: 'NOT_PENDING' });
    await expect(new SupabaseRollRequestRepo(rpcDb({ error: { message: 'not_dm' } }).db).openBatch(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseRollRequestRepo(rpcDb({ error: { message: 'not_member' } }).db).openBatch(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseRollRequestRepo(rpcDb({ error: { message: 'no_targets' } }).db).openBatch(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseRollRequestRepo(rpcDb({ error: { message: 'timeout' } }).db).openBatch(INPUT)).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
  it('lee la fila y la traduce a la entidad del dominio', async () => {
    const { db } = selectDb({
      data: {
        id: 'req-1', campaign_id: 'c1', batch_id: 'batch-1', target_character_id: 'ch1', created_by: 'dm1',
        stat: 'combat', difficulty: 2, specialty_allowed: true, status: 'pending',
      },
    });
    expect(await new SupabaseRollRequestRepo(db).findById('req-1')).toEqual({
      id: 'req-1', campaignId: 'c1', batchId: 'batch-1', targetCharacterId: 'ch1', createdBy: 'dm1',
      stat: 'combat', difficulty: 2, specialtyAllowed: true, status: 'pending',
    });
  });
  it('una fila que no está da null en vez de reventar', async () => {
    expect(await new SupabaseRollRequestRepo(selectDb({ error: { message: 'no rows' } }).db).findById('req-9')).toBeNull();
  });
});
