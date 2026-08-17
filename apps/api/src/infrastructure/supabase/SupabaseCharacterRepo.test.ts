import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCharacterRepo } from './SupabaseCharacterRepo.js';

const ROW = { id: 'ch1', campaign_id: 'c1', owner_id: 'u-owner', data: { name: 'K' }, campaign: { system_id: 'plenilunio', dm_id: 'u-dm' } };

/** Minimal chainable stub: `from(table)` → select/eq/maybeSingle; `rpc` records its args. */
function fakeDb(over: { character?: unknown; member?: unknown; rpcError?: { message: string } | null } = {}) {
  const rpc = vi.fn().mockResolvedValue({ error: over.rpcError ?? null });
  const from = vi.fn((table: string) => {
    const result = table === 'characters' ? { data: over.character === undefined ? ROW : over.character, error: null } : { data: over.member === undefined ? null : over.member, error: null };
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => q; q.maybeSingle = async () => result;
    return q;
  });
  return { db: { from, rpc } as unknown as SupabaseClient, rpc };
}

describe('SupabaseCharacterRepo (service role)', () => {
  it('computes owner/dm/member rights explicitly for the actor', async () => {
    const owner = await new SupabaseCharacterRepo(fakeDb({ member: { user_id: 'u-owner' } }).db).findForActor('ch1', 'u-owner');
    expect(owner).toMatchObject({ id: 'ch1', systemId: 'plenilunio', isOwner: true, isDm: false, isMember: true });
    const dm = await new SupabaseCharacterRepo(fakeDb().db).findForActor('ch1', 'u-dm');
    expect(dm).toMatchObject({ isOwner: false, isDm: true, isMember: true });
    const stranger = await new SupabaseCharacterRepo(fakeDb().db).findForActor('ch1', 'u-x');
    expect(stranger).toMatchObject({ isOwner: false, isDm: false, isMember: false });
    expect(await new SupabaseCharacterRepo(fakeDb({ character: null }).db).findForActor('nope', 'u-x')).toBeNull();
  });
  it('writes through characters_api_update as the actor with origin, only sending optional columns when given', async () => {
    const { db, rpc } = fakeDb();
    await new SupabaseCharacterRepo(db).saveSheet('ch1', 'u-owner', { data: { name: 'K' }, derived: { endurance: 7 }, health: 'healthy', xp: 3 }, 'progression');
    expect(rpc).toHaveBeenCalledWith('characters_api_update', { cid: 'ch1', patch: { data: { name: 'K' }, derived: { endurance: 7 }, health: 'healthy', xp: 3 }, origin: 'progression', actor: 'u-owner' });
  });
  it('maps DB permission errors to FORBIDDEN and everything else to DB_ERROR', async () => {
    await expect(new SupabaseCharacterRepo(fakeDb({ rpcError: { message: 'progression_disabled' } }).db).saveSheet('ch1', 'u', { data: {}, derived: {}, health: null }, 'sheet')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(new SupabaseCharacterRepo(fakeDb({ rpcError: { message: 'connection reset' } }).db).saveSheet('ch1', 'u', { data: {}, derived: {}, health: null }, 'sheet')).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
});
