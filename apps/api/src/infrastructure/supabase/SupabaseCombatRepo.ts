import type { SupabaseClient } from '@supabase/supabase-js';
import type { CombatErrorCode, CombatSlot, ICombatRepository, OpenCombatInput } from '../../domain/combat/ICombatRepository.js';

const codeFor = (message: string): CombatErrorCode | 'DB_ERROR' =>
  /combat_active/i.test(message) ? 'COMBAT_ACTIVE'
    : /cannot_advance/i.test(message) ? 'CANNOT_ADVANCE'
      : /not_active|not_found/i.test(message) ? 'NOT_ACTIVE'
        : /not_dm|not_member|not_authenticated|not_owner|not_scene|not_token/i.test(message) ? 'FORBIDDEN'
          : 'DB_ERROR';

interface SlotRow { id: string; combat_id: string; campaign_id: string; position: number; character_id: string | null }

/**
 * Adaptador de service role sobre las cuatro funciones del orden de turnos.
 *
 * Ninguna de ellas ordena: los puestos llegan ya en su sitio porque el criterio (Destino, p.92) es del
 * SISTEMA y lo aplica el caso de uso con `orderTurns`. Aquí sólo se mueven filas, y quién puede moverlas
 * lo vuelve a comprobar cada función en SQL.
 */
export class SupabaseCombatRepo implements ICombatRepository {
  constructor(private readonly db: SupabaseClient) {}

  async open(input: OpenCombatInput): Promise<{ id: string }> {
    const { data, error } = await this.db.rpc('dice_open_combat', {
      actor: input.actorId, cid: input.campaignId, sid: input.sceneId,
      slots: input.slots.map(s => ({ tokenId: s.tokenId, characterId: s.characterId, name: s.name })),
    });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return { id: String(data) };
  }

  async next(combatId: string, actorId: string): Promise<{ position: number; round: number }> {
    const { data, error } = await this.db.rpc('dice_next_turn', { kid: combatId, actor: actorId });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    const r = (data ?? {}) as { position?: number; round?: number };
    return { position: Number(r.position ?? 0), round: Number(r.round ?? 1) };
  }

  async close(combatId: string, actorId: string): Promise<void> {
    const { error } = await this.db.rpc('dice_close_combat', { kid: combatId, actor: actorId });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
  }

  async advance(combatId: string, actorId: string, slotId: string): Promise<number> {
    const { data, error } = await this.db.rpc('dice_advance_turn', { kid: combatId, actor: actorId, slot: slotId });
    if (error) throw Object.assign(new Error(error.message), { code: codeFor(error.message) });
    return Number(data ?? 0);
  }

  async findSlot(slotId: string): Promise<CombatSlot | null> {
    const { data, error } = await this.db
      .from('dice_combat_slots').select('id, combat_id, campaign_id, position, character_id').eq('id', slotId).maybeSingle();
    if (error || !data) return null;
    const r = data as unknown as SlotRow;
    return { id: r.id, combatId: r.combat_id, campaignId: r.campaign_id, position: r.position, characterId: r.character_id };
  }
}
