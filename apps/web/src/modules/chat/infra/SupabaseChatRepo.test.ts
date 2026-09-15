import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import { mapMessageRow, SupabaseChatRepo } from './SupabaseChatRepo';

const ROW = {
  id: 'm1', conversation_id: 'conv1', author_id: 'u1', kind: 'text' as const, body: 'hola',
  character_id: null, system_id: null, roll_kind: null, roll_request: null, roll_dice: null, roll_result: null, roll_ref_id: null,
  created_at: '2026-09-15T21:04:00Z', author: { name: 'Laura', avatar_url: null }, character: null,
};

const campaigns = (members: { userId: string; name: string; role: 'dm' | 'player' }[]): CampaignsPort => ({
  listMine: async () => [], listOpen: async () => [], getById: async () => null,
  listMembers: async () => members.map(m => ({ campaignId: 'c1', userId: m.userId, name: m.name, avatarUrl: null, role: m.role, characterId: null, joinedAt: '' })),
  create: async () => { throw new Error('unused'); }, joinByCode: async () => { throw new Error('unused'); },
  requestJoin: async () => undefined, leave: async () => undefined, update: async () => undefined,
  getInviteCode: async () => null, regenerateInviteCode: async () => '', archive: async () => undefined,
  listRequests: async () => [], resolveRequest: async () => undefined, removeMember: async () => undefined,
});

describe('mapMessageRow', () => {
  it('maps a text row (author join object)', () => {
    expect(mapMessageRow(ROW)).toMatchObject({ id: 'm1', conversationId: 'conv1', authorName: 'Laura', kind: 'text', body: 'hola', characterName: null });
  });
  it('unwraps an author/character join returned as an array, and falls back to empty/null', () => {
    expect(mapMessageRow({ ...ROW, author: [{ name: 'Karen', avatar_url: 'u' }] }).authorName).toBe('Karen');
    expect(mapMessageRow({ ...ROW, author: null }).authorName).toBe('');
    expect(mapMessageRow({ ...ROW, character: [{ name: 'Nix' }] }).characterName).toBe('Nix');
  });
  it('prefiere el ALIAS de la mesa al nombre de la cuenta (como el Registro); sin alias o en blanco, el nombre', () => {
    expect(mapMessageRow({ ...ROW, author: { name: 'Laura', alias: 'La Directora', avatar_url: null } }).authorName).toBe('La Directora');
    expect(mapMessageRow({ ...ROW, author: { name: 'Laura', alias: '   ', avatar_url: null } }).authorName).toBe('Laura');
    expect(mapMessageRow({ ...ROW, author: { name: 'Laura', alias: null, avatar_url: null } }).authorName).toBe('Laura');
  });

  it('carries the roll fields through untouched for a roll message', () => {
    const roll = { ...ROW, kind: 'roll' as const, body: null, character_id: 'ch1', roll_kind: 'system' as const, roll_request: { a: 1 }, roll_dice: [[4, 2]], roll_result: { total: 6 } };
    expect(mapMessageRow(roll as never)).toMatchObject({ kind: 'roll', rollKind: 'system', rollDice: [[4, 2]], rollResult: { total: 6 } });
  });
});

describe('SupabaseChatRepo.listDirectory', () => {
  it('one row per OTHER campaign member with its conversation preview/unread when it has one, plus one row per group', async () => {
    const m = createSupabaseMock();
    m.client['rpc'] = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'chat_list_directory') return {
        data: [
          { conversation_id: 'conv-laura', member_count: 2, other_user_id: 'laura', last_kind: 'text', last_body: 'hola', unread_count: 1 },
          { conversation_id: 'conv-group', member_count: 3, other_user_id: null, last_kind: null, last_body: null, unread_count: 0 },
        ], error: null,
      };
      if (fn === 'chat_group_member_names') return { data: args['conv_id'] === 'conv-group' ? [{ name: 'Marta' }, { name: 'Dani' }] : [], error: null };
      throw new Error(`unexpected rpc ${fn}`);
    });
    const repo = new SupabaseChatRepo(m.client as unknown as SupabaseClient, campaigns([
      { userId: 'me', name: 'Me', role: 'player' },
      { userId: 'laura', name: 'Laura', role: 'dm' },
      { userId: 'karen', name: 'Karen', role: 'player' },
    ]));
    const rows = await repo.listDirectory('c1', 'me');
    expect(rows.find(r => r.key === 'me')).toBeUndefined();
    expect(rows.find(r => r.key === 'laura')).toMatchObject({ conversationId: 'conv-laura', isGroup: false, title: 'Laura', role: 'dm', lastBody: 'hola', unreadCount: 1 });
    expect(rows.find(r => r.key === 'karen')).toMatchObject({ conversationId: null, isGroup: false, title: 'Karen', unreadCount: 0 });
    expect(rows.find(r => r.key === 'conv-group')).toMatchObject({ isGroup: true, title: 'Marta, Dani', memberCount: 3 });
  });
});

describe('SupabaseChatRepo — writes and reads', () => {
  it('listMessages selects chat_messages of the conversation, oldest first', async () => {
    const m = createSupabaseMock({ tables: { chat_messages: { data: [ROW], error: null } } });
    const repo = new SupabaseChatRepo(m.client as unknown as SupabaseClient, campaigns([]));
    const list = await repo.listMessages('conv1');
    expect(list).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('chat_messages');
    const chain = (m.client.from as ReturnType<typeof vi.fn>).mock.results[0]!.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(chain['eq']).toHaveBeenCalledWith('conversation_id', 'conv1');
    expect(chain['order']).toHaveBeenCalledWith('created_at', { ascending: true });
  });
  it('openConversation calls chat_create_conversation with the campaign and member ids', async () => {
    const m = createSupabaseMock();
    m.client['rpc'] = vi.fn().mockResolvedValue({ data: 'conv-new', error: null });
    const id = await new SupabaseChatRepo(m.client as unknown as SupabaseClient, campaigns([])).openConversation('c1', ['u2']);
    expect(id).toBe('conv-new');
    expect(m.client['rpc']).toHaveBeenCalledWith('chat_create_conversation', { cid: 'c1', member_ids: ['u2'] });
  });
  it('sendText inserts a text message as the given author', async () => {
    const m = createSupabaseMock({ tables: { chat_messages: { data: null, error: null } } });
    await new SupabaseChatRepo(m.client as unknown as SupabaseClient, campaigns([])).sendText('conv1', 'u1', 'hola');
    expect(m.insertSpy).toHaveBeenCalledWith({ conversation_id: 'conv1', author_id: 'u1', kind: 'text', body: 'hola' });
  });
  it('markRead calls chat_mark_read with the conversation id', async () => {
    const m = createSupabaseMock();
    m.client['rpc'] = vi.fn().mockResolvedValue({ data: null, error: null });
    await new SupabaseChatRepo(m.client as unknown as SupabaseClient, campaigns([])).markRead('conv1');
    expect(m.client['rpc']).toHaveBeenCalledWith('chat_mark_read', { cid: 'conv1' });
  });
  it('subscribeMessages listens to INSERTs on chat_messages filtered by campaign, refetches the row and unsubscribes by removing the channel', async () => {
    const m = createSupabaseMock({ tables: { chat_messages: { data: ROW, error: null } } });
    const handlers: { filter: Record<string, string>; cb: (p: { new: unknown }) => void }[] = [];
    const channel = { on: vi.fn((_: string, filter: Record<string, string>, cb: (p: { new: unknown }) => void) => { handlers.push({ filter, cb }); return channel; }), subscribe: vi.fn(() => channel) };
    const client = { ...m.client, channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repo = new SupabaseChatRepo(client as unknown as SupabaseClient, campaigns([]));
    const onInsert = vi.fn();
    const off = repo.subscribeMessages('c1', onInsert);
    // Nombre único por llamada (no "chat:c1" a secas): dos suscriptores a la vez (WhisperWatcher +
    // ConversationView) no pueden compartir canal — Supabase devuelve el mismo objeto para el mismo
    // nombre, y añadir oyentes a uno ya suscrito revienta.
    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^chat:c1:.+/));
    expect(handlers[0]!.filter).toMatchObject({ event: 'INSERT', table: 'chat_messages', filter: 'campaign_id=eq.c1' });
    handlers[0]!.cb({ new: { id: 'm1' } });
    await vi.waitFor(() => expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', authorName: 'Laura' })));
    off();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
  /**
   * Pin: `WhisperWatcher` (toda la partida) y `ConversationView` (una conversación abierta) suscriben la
   * MISMA campaña a la vez. Con un nombre de canal compartido (`chat:<campaignId>`), Supabase devuelve el
   * mismo canal a los dos, y el segundo `.on(...)` revienta («cannot add postgres_changes callbacks...
   * after subscribe()») — se vio en pantalla, en real, antes de este arreglo: la conversación se quedaba
   * en negro entero al abrirla. Dos llamadas simultáneas para la misma campaña deben pedir DOS canales.
   */
  it('dos suscriptores a la vez para la MISMA campaña piden canales distintos (nunca comparten uno)', () => {
    const m = createSupabaseMock({ tables: { chat_messages: { data: ROW, error: null } } });
    const names: string[] = [];
    const client = { ...m.client, channel: vi.fn((name: string) => { names.push(name); return { on: () => ({ subscribe: () => ({}) }) }; }), removeChannel: vi.fn() };
    const repo = new SupabaseChatRepo(client as unknown as SupabaseClient, campaigns([]));
    repo.subscribeMessages('c1', () => {});
    repo.subscribeMessages('c1', () => {});
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
  });
});
