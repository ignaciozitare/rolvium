import type { SupabaseClient } from '@supabase/supabase-js';
import type { RollRequest, RollResult, RolledDice } from '@rolvium/core';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import type { ChatDirectoryEntry, ChatMessage, ChatMessageKind } from '../domain/entities/Chat';
import type { ChatPort, Unsubscribe } from '../domain/ports/ChatPort';

const MESSAGE_SELECT = `id, conversation_id, author_id, kind, body, character_id, system_id, roll_kind, roll_request, roll_dice, roll_result, roll_ref_id, created_at,
  author:users!chat_messages_author_id_fkey(name, alias, avatar_url), character:characters(name)`;

interface MessageRow {
  id: string; conversation_id: string; author_id: string; kind: ChatMessageKind; body: string | null;
  character_id: string | null; system_id: string | null; roll_kind: 'system' | 'free' | null;
  roll_request: RollRequest | null; roll_dice: RolledDice | null; roll_result: RollResult | null;
  roll_ref_id: string | null; created_at: string;
  author: { name: string; alias?: string | null; avatar_url: string | null } | { name: string; alias?: string | null; avatar_url: string | null }[] | null;
  character: { name: string } | { name: string }[] | null;
}
const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export function mapMessageRow(r: MessageRow): ChatMessage {
  const author = one(r.author);
  const character = one(r.character);
  return {
    // Quién escribe se nombra como en el Registro (`SupabaseRollLogRepo`): el alias de la mesa si lo tiene, si no el nombre de la cuenta.
    id: r.id, conversationId: r.conversation_id, authorId: r.author_id, authorName: author?.alias?.trim() || author?.name || '', authorAvatarUrl: author?.avatar_url ?? null,
    kind: r.kind, body: r.body, characterId: r.character_id, characterName: character?.name ?? null, systemId: r.system_id,
    rollKind: r.roll_kind, rollRequest: r.roll_request, rollDice: r.roll_dice, rollResult: r.roll_result, rollRefId: r.roll_ref_id, createdAt: r.created_at,
  };
}

interface DirectoryRow {
  conversation_id: string; member_count: number; other_user_id: string | null;
  last_kind: ChatMessageKind | null; last_body: string | null; unread_count: number;
}

/**
 * SUSURROS reads: the directory merges the campaign roster (`CampaignsPort`, same as the rest of the table)
 * with `chat_list_directory`/`chat_group_member_names` (SQL helpers that shape the per-conversation preview
 * and unread count — see `supabase/migrations/20260915150000_chat_susurros.sql`). Messages and the create/
 * mark-read writes go straight to Supabase under RLS; `kind = 'roll'` is NOT written here (see `ChatRollsPort`).
 */
export class SupabaseChatRepo implements ChatPort {
  constructor(private readonly db: SupabaseClient, private readonly campaigns: CampaignsPort) {}

  async listDirectory(campaignId: string, myUserId: string): Promise<ChatDirectoryEntry[]> {
    const [members, { data, error }] = await Promise.all([
      this.campaigns.listMembers(campaignId),
      this.db.rpc('chat_list_directory', { cid: campaignId }),
    ]);
    if (error) throw error;
    const rows = (data ?? []) as DirectoryRow[];
    const byOtherUser = new Map(rows.filter(r => r.other_user_id).map(r => [r.other_user_id as string, r]));
    const groupRows = rows.filter(r => !r.other_user_id);

    const memberEntries: ChatDirectoryEntry[] = members.filter(m => m.userId !== myUserId).map(m => {
      const row = byOtherUser.get(m.userId);
      return {
        key: m.userId, conversationId: row?.conversation_id ?? null, isGroup: false, title: m.name, role: m.role,
        memberCount: null, memberIds: [m.userId], lastKind: row?.last_kind ?? null, lastBody: row?.last_body ?? null, unreadCount: row?.unread_count ?? 0,
      };
    });

    const groupEntries: ChatDirectoryEntry[] = await Promise.all(groupRows.map(async row => {
      const { data: names, error: namesErr } = await this.db.rpc('chat_group_member_names', { conv_id: row.conversation_id });
      if (namesErr) throw namesErr;
      const title = ((names ?? []) as { name: string }[]).map(n => n.name).join(', ');
      return {
        key: row.conversation_id, conversationId: row.conversation_id, isGroup: true, title, role: null,
        memberCount: row.member_count, memberIds: [], lastKind: row.last_kind, lastBody: row.last_body, unreadCount: row.unread_count,
      };
    }));

    return [...memberEntries, ...groupEntries];
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.db.from('chat_messages').select(MESSAGE_SELECT).eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MessageRow[]).map(mapMessageRow);
  }

  async openConversation(campaignId: string, memberIds: string[]): Promise<string> {
    const { data, error } = await this.db.rpc('chat_create_conversation', { cid: campaignId, member_ids: memberIds });
    if (error) throw error;
    return String(data);
  }

  async sendText(conversationId: string, authorId: string, body: string): Promise<void> {
    const { error } = await this.db.from('chat_messages').insert({ conversation_id: conversationId, author_id: authorId, kind: 'text', body });
    if (error) throw error;
  }

  async markRead(conversationId: string): Promise<void> {
    const { error } = await this.db.rpc('chat_mark_read', { cid: conversationId });
    if (error) throw error;
  }

  subscribeMessages(campaignId: string, onInsert: (message: ChatMessage) => void): Unsubscribe {
    // Un nombre ÚNICO por llamada, no `chat:${campaignId}` a secas: a diferencia del Registro (un solo
    // `RollLog` en toda la mesa), aquí puede haber varios suscriptores del mismo canal a la vez —
    // `WhisperWatcher` (toda la partida) y `ConversationView` (cada conversación abierta) — y Supabase
    // devuelve el MISMO objeto de canal para el mismo nombre; añadir oyentes a uno ya suscrito revienta
    // («cannot add postgres_changes callbacks... after subscribe()»). Cada uno recibe igual los mismos
    // eventos: el nombre es sólo la etiqueta del cliente, no afecta a qué le llega.
    const channel = this.db.channel(`chat:${campaignId}:${crypto.randomUUID()}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `campaign_id=eq.${campaignId}` }, payload => {
        const id = (payload.new as { id?: string }).id;
        if (id) void this.fetchOne(id).then(m => { if (m) onInsert(m); });
      })
      .subscribe();
    return () => { void this.db.removeChannel(channel); };
  }

  private async fetchOne(id: string): Promise<ChatMessage | null> {
    const { data, error } = await this.db.from('chat_messages').select(MESSAGE_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapMessageRow(data as MessageRow) : null;
  }
}
