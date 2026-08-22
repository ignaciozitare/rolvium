import type { SupabaseClient } from '@supabase/supabase-js';
import type { RollRequest } from '@rolvium/core';
import type { AttackErrorCode, IAttackRepository, OpenAttackInput, OpenPlayerAttackInput, PendingAttack } from '../../domain/attack/IAttackRepository.js';

const codeFor = (message: string): AttackErrorCode | 'DB_ERROR' =>
  /not_pending/i.test(message) ? 'NOT_PENDING'
    : /not_dm|not_member|not_authenticated|not_owner|not_creature/i.test(message) ? 'FORBIDDEN'
      : 'DB_ERROR';

interface Row {
  id: string; campaign_id: string; target_character_id: string | null; attacker_character_id: string | null;
  created_by: string; dice: number; request: RollRequest; status: PendingAttack['status'];
}

const SELECT = 'id, campaign_id, target_character_id, attacker_character_id, created_by, dice, request, status';

/**
 * Adaptador de service role sobre las tres funciones de `dice_attacks` (abrir · contestar · cerrar).
 *
 * Nadie escribe esta tabla desde el navegador: no hay políticas de escritura para `authenticated`. Los
 * dados los genera el servidor, igual que en `dice_commit_roll`, y quién puede abrir (el director) y
 * quién puede contestar (el dueño del personaje atacado) lo comprueba la propia función en SQL.
 */
export class SupabaseAttackRepo implements IAttackRepository {
  constructor(private readonly db: SupabaseClient) {}

  async open(input: OpenAttackInput): Promise<{ id: string }> {
    const { data, error } = await this.db.rpc('dice_open_attack', {
      actor: input.actorId, cid: input.campaignId, sid: input.sceneId,
      attacker_token: input.attackerTokenId, target_token: input.targetTokenId,
      attacker: input.attackerName, target_char: input.targetCharacterId,
      dice_count: input.dice, req: input.request,
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { id: String(data) };
  }

  async openPlayer(input: OpenPlayerAttackInput): Promise<{ id: string }> {
    const { data, error } = await this.db.rpc('dice_open_player_attack', {
      actor: input.actorId, cid: input.campaignId, sid: input.sceneId,
      attacker_char: input.attackerCharacterId, attacker_token: input.attackerTokenId,
      target_token: input.targetTokenId, attacker: input.attackerName,
      dice_count: input.dice, req: input.request,
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { id: String(data) };
  }

  async answerPlayer(actorId: string, attackId: string, defence: number): Promise<number> {
    const { data, error } = await this.db.rpc('dice_answer_player_attack', { aid: attackId, actor: actorId, defence });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return Number(data ?? 0);
  }

  async answer(actorId: string, attackId: string, defence: number): Promise<number> {
    const { data, error } = await this.db.rpc('dice_answer_attack', { actor: actorId, aid: attackId, defence });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return Number(data ?? 0);
  }

  async findById(id: string): Promise<PendingAttack | null> {
    const { data, error } = await this.db.from('dice_attacks').select(SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    const r = data as unknown as Row;
    return {
      id: r.id, campaignId: r.campaign_id, targetCharacterId: r.target_character_id,
      attackerCharacterId: r.attacker_character_id ?? null,
      createdBy: r.created_by, dice: r.dice, request: r.request, status: r.status,
    };
  }

  async close(attackId: string, rollId: string | null, status: 'resolved' | 'cancelled'): Promise<void> {
    const { error } = await this.db.rpc('dice_close_attack', { aid: attackId, rid: rollId, new_status: status });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
  }
}
