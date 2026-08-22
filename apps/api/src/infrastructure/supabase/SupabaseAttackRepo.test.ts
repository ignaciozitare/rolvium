import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAttackRepo } from './SupabaseAttackRepo.js';
import type { OpenAttackInput } from '../../domain/attack/IAttackRepository.js';

const REQUEST = { systemId: 'plenilunio', kind: 'system' as const, title: 'Ogro ataca a Karen', groups: [{ count: 4, sides: 6, tag: 'own' }], visibility: 'table' as const };
const INPUT: OpenAttackInput = {
  actorId: 'dm1', campaignId: 'c1', sceneId: 'sc1', attackerTokenId: 'tk-ogro', targetTokenId: 'tk-karen',
  attackerName: 'Ogro', targetCharacterId: 'ch1', dice: 4, request: REQUEST,
};

const rpcDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};
const selectDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { db: { from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient, select, eq };
};

describe('SupabaseAttackRepo', () => {
  it('abre el ataque por `dice_open_attack` con el actor, la escena y los tokens; devuelve el id', async () => {
    const { db, rpc } = rpcDb({ data: 'atk-1' });
    expect(await new SupabaseAttackRepo(db).open(INPUT)).toEqual({ id: 'atk-1' });
    expect(rpc).toHaveBeenCalledWith('dice_open_attack', expect.objectContaining({
      actor: 'dm1', cid: 'c1', sid: 'sc1', attacker_token: 'tk-ogro', target_token: 'tk-karen',
      attacker: 'Ogro', target_char: 'ch1', dice_count: 4, req: REQUEST,
    }));
  });
  it('contesta por `dice_answer_attack` y devuelve los dados aceptados; 0 es una respuesta, no un fallo', async () => {
    const { db, rpc } = rpcDb({ data: 0 });
    expect(await new SupabaseAttackRepo(db).answer('u1', 'atk-1', 0)).toBe(0);
    expect(rpc).toHaveBeenCalledWith('dice_answer_attack', { actor: 'u1', aid: 'atk-1', defence: 0 });
  });
  it('cierra por `dice_close_attack` apuntando la tirada que salió', async () => {
    const { db, rpc } = rpcDb({});
    await new SupabaseAttackRepo(db).close('atk-1', 'roll-1', 'resolved');
    expect(rpc).toHaveBeenCalledWith('dice_close_attack', { aid: 'atk-1', rid: 'roll-1', new_status: 'resolved' });
  });
  it('traduce los errores de SQL: not_pending → NOT_PENDING, not_dm/not_member → FORBIDDEN, el resto → DB_ERROR', async () => {
    await expect(new SupabaseAttackRepo(rpcDb({ error: { message: 'not_pending' } }).db).answer('u1', 'a', 1)).rejects.toMatchObject({ code: 'NOT_PENDING' });
    await expect(new SupabaseAttackRepo(rpcDb({ error: { message: 'not_dm' } }).db).open(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseAttackRepo(rpcDb({ error: { message: 'not_member' } }).db).open(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseAttackRepo(rpcDb({ error: { message: 'timeout' } }).db).open(INPUT)).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
  it('lee la fila y la traduce a la entidad del dominio', async () => {
    const { db, select } = selectDb({ data: { id: 'atk-1', campaign_id: 'c1', target_character_id: 'ch1', created_by: 'dm1', dice: 4, request: REQUEST, status: 'pending' } });
    expect(await new SupabaseAttackRepo(db).findById('atk-1')).toEqual({
      id: 'atk-1', campaignId: 'c1', attackerCharacterId: null, targetCharacterId: 'ch1', createdBy: 'dm1', dice: 4, request: REQUEST, status: 'pending',
    });
    expect(select).toHaveBeenCalled();
  });
  it('una fila que no está da null en vez de reventar', async () => {
    expect(await new SupabaseAttackRepo(selectDb({ error: { message: 'no rows' } }).db).findById('atk-9')).toBeNull();
  });
});
