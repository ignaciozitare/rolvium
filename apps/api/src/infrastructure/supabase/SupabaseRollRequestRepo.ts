import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRollRequestRepository, OpenRollRequestsInput, PendingRollRequest, RollRequestErrorCode } from '../../domain/rollRequest/IRollRequestRepository.js';

const codeFor = (message: string): RollRequestErrorCode | 'DB_ERROR' =>
  /not_pending/i.test(message) ? 'NOT_PENDING'
    : /not_dm|not_member|not_authenticated|no_targets/i.test(message) ? 'FORBIDDEN'
      : 'DB_ERROR';

interface Row {
  id: string; campaign_id: string; batch_id: string; target_character_id: string; created_by: string;
  stat: string; difficulty: number; specialty_allowed: boolean; status: PendingRollRequest['status'];
}

const SELECT = 'id, campaign_id, batch_id, target_character_id, created_by, stat, difficulty, specialty_allowed, status';

/**
 * Adaptador de service role sobre las funciones de `dice_roll_requests` (abrir lote · cerrar).
 *
 * Nadie escribe esta tabla desde el navegador: quién puede pedir (el director) lo comprueba la función en
 * SQL, y contestar es TIRAR — pasa por `performRoll`, que genera los dados en el servidor.
 */
export class SupabaseRollRequestRepo implements IRollRequestRepository {
  constructor(private readonly db: SupabaseClient) {}

  async openBatch(input: OpenRollRequestsInput): Promise<{ batchId: string }> {
    const { data, error } = await this.db.rpc('dice_open_roll_requests', {
      actor: input.actorId, cid: input.campaignId, target_chars: input.targetCharacterIds,
      stat_key: input.stat, diff: input.difficulty, specialty: input.specialtyAllowed,
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { batchId: String(data) };
  }

  async findById(id: string): Promise<PendingRollRequest | null> {
    const { data, error } = await this.db.from('dice_roll_requests').select(SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    const r = data as unknown as Row;
    return {
      id: r.id, campaignId: r.campaign_id, batchId: r.batch_id, targetCharacterId: r.target_character_id,
      createdBy: r.created_by, stat: r.stat, difficulty: r.difficulty, specialtyAllowed: r.specialty_allowed,
      status: r.status,
    };
  }

  async close(requestId: string, rollId: string | null, status: 'resolved' | 'cancelled'): Promise<void> {
    const { error } = await this.db.rpc('dice_close_roll_request', { rid: requestId, roll: rollId, new_status: status });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
  }
}
