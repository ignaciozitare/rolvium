import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatRollCommitErrorCode, ChatRollCommitInput, IChatRollRepository } from '../../domain/chatRoll/IChatRollRepository.js';

const codeFor = (message: string): ChatRollCommitErrorCode | 'DB_ERROR' => (/not_member|not_authenticated|bad_roll_kind/i.test(message) ? 'FORBIDDEN' : 'DB_ERROR');

/** Service-role adapter over `chat_commit_roll` (participant check + insert into `chat_messages`, never `dice_rolls`). */
export class SupabaseChatRollRepo implements IChatRollRepository {
  constructor(private readonly db: SupabaseClient) {}

  async commit(input: ChatRollCommitInput): Promise<{ id: string }> {
    const { data, error } = await this.db.rpc('chat_commit_roll', {
      actor: input.actorId, conv_id: input.conversationId, char_id: input.characterId, sys_id: input.systemId,
      roll_kind: input.rollKind, title: input.title, request: input.request, dice: input.dice, result: input.result,
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { id: String(data) };
  }

  async campaignOf(conversationId: string, actorId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('chat_conversations')
      .select('campaign_id, members:chat_conversation_members!inner(user_id)')
      .eq('id', conversationId)
      .eq('members.user_id', actorId)
      .maybeSingle();
    if (error) throw error;
    return data?.campaign_id ?? null;
  }
}
