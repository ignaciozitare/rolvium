import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseChatRollRepo } from './SupabaseChatRollRepo.js';
import type { ChatRollCommitInput } from '../../domain/chatRoll/IChatRollRepository.js';

const INPUT: ChatRollCommitInput = {
  actorId: 'u1', conversationId: 'conv1', characterId: 'ch1', systemId: 'plenilunio', rollKind: 'system', title: 'Astucia',
  request: { systemId: 'plenilunio', kind: 'system', title: 'Astucia', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' },
  dice: [[4, 2]], result: { summary: 'roll.degree.setback', total: 6 },
};
const rpcDb = (rpcResult: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};

describe('SupabaseChatRollRepo', () => {
  it('commits through chat_commit_roll with the actor, the conversation and no visibility; returns the new id', async () => {
    const { db, rpc } = rpcDb({ data: 'msg-1' });
    expect(await new SupabaseChatRollRepo(db).commit(INPUT)).toEqual({ id: 'msg-1' });
    expect(rpc).toHaveBeenCalledWith('chat_commit_roll', {
      actor: 'u1', conv_id: 'conv1', char_id: 'ch1', sys_id: 'plenilunio', roll_kind: 'system', title: 'Astucia',
      request: INPUT.request, dice: [[4, 2]], result: INPUT.result,
    });
  });
  it('maps not_member/not_authenticated/bad_roll_kind → FORBIDDEN, anything else → DB_ERROR', async () => {
    await expect(new SupabaseChatRollRepo(rpcDb({ error: { message: 'not_member' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseChatRollRepo(rpcDb({ error: { message: 'bad_roll_kind' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseChatRollRepo(rpcDb({ error: { message: 'timeout' } }).db).commit(INPUT)).rejects.toMatchObject({ code: 'DB_ERROR' });
  });

  it('campaignOf: the campaign when the actor participates, null when the conversation is missing or they do not', async () => {
    const from = vi.fn((_table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q; q.eq = () => q;
      q.maybeSingle = async () => ({ data: { campaign_id: 'camp1' }, error: null });
      return q;
    });
    const db = { from } as unknown as SupabaseClient;
    expect(await new SupabaseChatRollRepo(db).campaignOf('conv1', 'u1')).toBe('camp1');

    const notFound = { from: vi.fn(() => { const q: Record<string, unknown> = {}; q.select = () => q; q.eq = () => q; q.maybeSingle = async () => ({ data: null, error: null }); return q; }) } as unknown as SupabaseClient;
    expect(await new SupabaseChatRollRepo(notFound).campaignOf('conv1', 'u-stranger')).toBeNull();
  });
});
