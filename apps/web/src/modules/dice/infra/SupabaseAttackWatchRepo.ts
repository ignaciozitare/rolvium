import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { RollRequest } from '@rolvium/core';
import type { PendingAttack } from '../domain/entities/Attack';
import type { AttackWatchPort } from '../domain/ports/AttackWatchPort';
import type { Unsubscribe } from '../domain/ports/RollLogPort';

interface Row {
  id: string; campaign_id: string; attacker_name: string; target_character_id: string | null;
  dice: number; request: RollRequest; created_at: string;
}

/**
 * De la petición guardada, la entidad sólo se queda con la CARACTERÍSTICA: es lo único que el aviso
 * necesita, y así el resto —el daño del arma, los éxitos automáticos de sus capacidades— no anda suelto
 * por la pantalla del jugador esperando a que alguien lo pinte sin querer.
 *
 * ⚠ **No es una protección.** La fila viaja entera en el `select`, y aunque no viajase, la RLS deja al
 * atacado leerla completa: si alguna vez importa de verdad que no vea los números de la criatura, eso se
 * arregla en la política, no aquí.
 */
const statOfRequest = (request: RollRequest): string | null => {
  const stat = (request?.options as Record<string, unknown> | undefined)?.['stat'];
  return typeof stat === 'string' && stat ? stat : null;
};

export const mapAttackRow = (r: Row): PendingAttack => ({
  id: r.id, campaignId: r.campaign_id, attackerName: r.attacker_name,
  targetCharacterId: r.target_character_id ?? null, dice: r.dice,
  stat: statOfRequest(r.request), createdAt: r.created_at,
});

const SELECT = 'id, campaign_id, attacker_name, target_character_id, dice, request, created_at';

/**
 * Lee `dice_attacks` bajo RLS —el director ve los de su mesa, el jugador sólo los suyos— y sigue la tabla
 * en vivo. Al llegar cualquier cambio se vuelve a pedir la lista entera en vez de parchear el estado con lo
 * que trae el evento: son como mucho un puñado de filas, y así un ataque que deja de estar pendiente
 * desaparece por el mismo camino por el que apareció.
 *
 * **Los más viejos primero**: si a un jugador le llegan dos, contesta en el orden en que le atacaron.
 */
export class SupabaseAttackWatchRepo implements AttackWatchPort {
  constructor(private readonly db: SupabaseClient) {}

  async listPending(campaignId: string): Promise<PendingAttack[]> {
    const { data, error } = await this.db.from('dice_attacks').select(SELECT)
      .eq('campaign_id', campaignId).eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Row[]).map(mapAttackRow);
  }

  subscribe(campaignId: string, onChange: () => void): Unsubscribe {
    const channel: RealtimeChannel = this.db.channel(`campaign-attacks:${campaignId}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dice_attacks', filter: `campaign_id=eq.${campaignId}` }, () => onChange())
      .subscribe();
    return () => { void this.db.removeChannel(channel); };
  }
}
