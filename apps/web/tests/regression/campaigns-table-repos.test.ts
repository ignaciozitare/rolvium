import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../helpers/supabaseMock';
import { SupabaseCampaignsRepo } from '@/modules/campaigns/infra/SupabaseCampaignsRepo';
import { SupabaseTableRepo } from '@/modules/table/infra/SupabaseTableRepo';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import { CAMPAIGN_MINE, fakeCampaignsRepo } from '../helpers/fakes';

const ROW = {
  id: 'c1', name: 'Queens', description: '', system_id: 'plenilunio', system_version: '0.1.0', dm_id: 'dm-1',
  visibility: 'invite', seats: 5, invite_code: 'LUNA-4F7K', progression_enabled: false,
  next_session_at: null, last_session_at: null, archived_at: null, created_at: '2026-08-17T00:00:00Z',
  dm: { name: 'Laura' },
  members: [{ user_id: 'dm-1', role: 'dm', character_id: null }, { user_id: 'u-pip', role: 'player', character_id: null }],
};

function client(me: string | null, tables: Record<string, { data: unknown; error: Error | null }>, rpc?: { data: unknown; error: { message: string } | null }) {
  const h = createSupabaseMock({ tables });
  (h.client.auth as { getSession: ReturnType<typeof vi.fn> }).getSession = vi.fn().mockResolvedValue({ data: { session: me ? { user: { id: me } } : null } });
  if (rpc) (h.client.rpc as ReturnType<typeof vi.fn>).mockResolvedValue(rpc);
  return h.client as unknown as SupabaseClient;
}

describe('SupabaseCampaignsRepo (row mapping + rpc error mapping)', () => {
  it('hides the invite code from non-DMs and computes playersCount / myRole', async () => {
    const repo = new SupabaseCampaignsRepo(client('u-pip', { campaigns_campaigns: { data: [ROW], error: null } }));
    const [c] = await repo.listMine();
    expect(c).toMatchObject({ id: 'c1', dmName: 'Laura', playersCount: 1, myRole: 'player', inviteCode: null });
  });
  it('never exposes the invite code in listings (DM fetches it via RPC)', async () => {
    const repo = new SupabaseCampaignsRepo(client('dm-1', { campaigns_campaigns: { data: [ROW], error: null } }));
    const [c] = await repo.listMine();
    expect(c?.inviteCode).toBeNull();
    expect(c?.myRole).toBe('dm');
  });
  it('listOpen excludes campaigns I am already in; listMine returns [] when signed out', async () => {
    expect(await new SupabaseCampaignsRepo(client('u-pip', { campaigns_campaigns: { data: [ROW], error: null } })).listOpen()).toEqual([]);
    expect(await new SupabaseCampaignsRepo(client(null, { campaigns_campaigns: { data: [ROW], error: null } })).listMine()).toEqual([]);
  });
  it('maps join_campaign_by_code errors to stable JoinError codes', async () => {
    const full = new SupabaseCampaignsRepo(client('u', {}, { data: null, error: { message: 'campaign_full' } }));
    expect(await full.joinByCode('luna4f7k')).toEqual({ error: 'campaign_full' });
    const weird = new SupabaseCampaignsRepo(client('u', {}, { data: null, error: { message: 'boom' } }));
    expect(await weird.joinByCode('luna4f7k')).toEqual({ error: 'unknown' });
    const ok = new SupabaseCampaignsRepo(client('u', {}, { data: 'c9', error: null }));
    expect(await ok.joinByCode('luna4f7k')).toEqual({ campaignId: 'c9' });
  });
});

describe('SupabaseCampaignsRepo (DM management)', () => {
  it('listRequests maps pending rows with the requester profile', async () => {
    const h = createSupabaseMock({ tables: { campaigns_requests: { data: [{ id: 'rq-1', campaign_id: 'c2', user_id: 'u-marta', message: 'Hola', status: 'pending', created_at: '2026-08-17T03:00:00Z', user: [{ name: 'Marta', avatar_url: null }] }], error: null } } });
    const repo = new SupabaseCampaignsRepo(h.client as unknown as SupabaseClient);
    const [r] = await repo.listRequests('c2');
    expect(r).toEqual({ id: 'rq-1', campaignId: 'c2', userId: 'u-marta', name: 'Marta', avatarUrl: null, message: 'Hola', status: 'pending', createdAt: '2026-08-17T03:00:00Z' });
    expect(h.fromSpy).toHaveBeenCalledWith('campaigns_requests');
  });
  it('resolveRequest calls campaigns_resolve_request and surfaces errors', async () => {
    const h = createSupabaseMock();
    const rpc = h.client.rpc as ReturnType<typeof vi.fn>;
    const repo = new SupabaseCampaignsRepo(h.client as unknown as SupabaseClient);
    await repo.resolveRequest('rq-1', true);
    expect(rpc).toHaveBeenCalledWith('campaigns_resolve_request', { req: 'rq-1', accept: true });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'campaign_full' } });
    await expect(repo.resolveRequest('rq-1', true)).rejects.toMatchObject({ message: 'campaign_full' });
  });
  it('removeMember deletes the player row of that campaign (DM policy)', async () => {
    const h = createSupabaseMock();
    const repo = new SupabaseCampaignsRepo(h.client as unknown as SupabaseClient);
    await repo.removeMember('c2', 'u-pip');
    expect(h.fromSpy).toHaveBeenCalledWith('campaigns_members');
    expect(h.deleteSpy).toHaveBeenCalled();
    const chain = h.deleteSpy.mock.results[0]!.value as { eq: ReturnType<typeof vi.fn> };
    expect(chain.eq).toHaveBeenCalledWith('campaign_id', 'c2');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-pip');
    expect(chain.eq).toHaveBeenCalledWith('role', 'player');
  });
});

describe('SupabaseTableRepo', () => {
  const campaigns: CampaignsPort = { ...fakeCampaignsRepo({ mine: [CAMPAIGN_MINE] }), listMembers: async () => [] };
  it('load returns null for non-members and a snapshot for members', async () => {
    const db = client('u-pip', { campaigns_campaigns: { data: { shared_resources: { destiny: { value: 3, max: 10, hands: {} } }, active_scene_id: null }, error: null } });
    const snap = await new SupabaseTableRepo(db, campaigns).load('c1');
    expect(snap?.resources.destiny?.value).toBe(3);
    expect(snap?.campaign.id).toBe('c1');
    const stranger: CampaignsPort = { ...campaigns, getById: async () => ({ ...CAMPAIGN_MINE, myRole: undefined }) };
    expect(await new SupabaseTableRepo(db, stranger).load('c1')).toBeNull();
  });
  it('maps resource rpc errors to ResourceError and returns state on success', async () => {
    const err = new SupabaseTableRepo(client('u', {}, { data: null, error: { message: 'P0001: per_take_max' } }), campaigns);
    expect(await err.takeResource('c1', 'destiny', 1)).toEqual({ error: 'per_take_max' });
    const ok = new SupabaseTableRepo(client('u', {}, { data: { value: 9, max: 10, hands: {} }, error: null }), campaigns);
    expect(await ok.returnResource('c1', 'destiny')).toEqual({ state: { value: 9, max: 10, hands: {} } });
  });
});
