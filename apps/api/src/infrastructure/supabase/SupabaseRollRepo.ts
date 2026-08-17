import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRollRepository, RollCommitErrorCode, RollCommitInput } from '../../domain/roll/IRollRepository.js';

const codeFor = (message: string): RollCommitErrorCode | 'DB_ERROR' =>
  /pool_empty/i.test(message) ? 'POOL_EMPTY' : /not_member|not_authenticated|bad_visibility/i.test(message) ? 'FORBIDDEN' : 'DB_ERROR';

/** Service-role adapter over `dice_commit_roll` (membership as the actor + hand debit + insert, one transaction). */
export class SupabaseRollRepo implements IRollRepository {
  constructor(private readonly db: SupabaseClient) {}

  async commit(input: RollCommitInput): Promise<{ id: string }> {
    const { data, error } = await this.db.rpc('dice_commit_roll', {
      actor: input.actorId, cid: input.campaignId, char_id: input.characterId, sys_id: input.systemId, kind: input.kind, title: input.title,
      request: input.request, dice: input.dice, result: input.result, visibility: input.visibility, shared: input.shared, corrects: input.correctsId ?? null,
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { id: String(data) };
  }
}
