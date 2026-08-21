import type { RollRequest } from '@rolvium/core';

/**
 * Un ataque cuerpo a cuerpo A LA ESPERA de que el jugador conteste (`dice_attacks`).
 *
 * El manual lo resuelve como un CONFLICTO (p.93): los dados de enfrente no son una dificultad que ponga
 * el director, son los que el atacado decida gastar en defenderse. Por eso la tirada no puede salir en el
 * momento — se guarda la intención, le llega al jugador, y sólo cuando contesta se tira.
 */
export interface PendingAttack {
  id: string;
  campaignId: string;
  targetCharacterId: string;
  /** Quién lo abrió: el DIRECTOR. Es el autor de la tirada cuando por fin salga, no quien contesta. */
  createdBy: string;
  dice: number;
  /** La petición ya armada por el sistema, SIN el grupo de oposición: ése sale de la respuesta. */
  request: RollRequest;
  status: 'pending' | 'resolved' | 'cancelled';
}

export interface OpenAttackInput {
  actorId: string;
  campaignId: string;
  sceneId: string | null;
  attackerTokenId: string | null;
  targetTokenId: string | null;
  /** Copiado, no leído del token: el aviso dice «te ataca un ogro» aunque el token ya no exista. */
  attackerName: string;
  targetCharacterId: string;
  dice: number;
  request: RollRequest;
}

/** `FORBIDDEN` (no es el director, o no es el dueño del personaje) · `NOT_PENDING` (ya contestado o cancelado). */
export type AttackErrorCode = 'FORBIDDEN' | 'NOT_PENDING';

export interface IAttackRepository {
  /** `dice_open_attack`: comprueba que el actor es el director y que el atacado es de esa mesa. */
  open(input: OpenAttackInput): Promise<{ id: string }>;
  /** `dice_answer_attack`: sólo el dueño del personaje. Devuelve los dados de defensa aceptados (0 vale). */
  answer(actorId: string, attackId: string, defence: number): Promise<number>;
  findById(id: string): Promise<PendingAttack | null>;
  /** `dice_close_attack`: apunta la tirada que salió, o lo cancela. */
  close(attackId: string, rollId: string | null, status: 'resolved' | 'cancelled'): Promise<void>;
}
