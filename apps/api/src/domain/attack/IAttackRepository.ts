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
  /**
   * La DIRECCIÓN la dice quién falta: con personaje atacado es una criatura atacando a un PJ (contesta el
   * jugador, columna 5); a `null` es EL ESPEJO — un PJ atacando a una criatura, y contesta el DIRECTOR.
   */
  targetCharacterId: string | null;
  /** En el espejo, quién ataca (el personaje del jugador). `null` en la dirección de la columna 5. */
  attackerCharacterId: string | null;
  /** Quién lo abrió. Es el autor de la tirada cuando por fin salga, no quien contesta. */
  createdBy: string;
  dice: number;
  /** La petición ya armada por el sistema, SIN el grupo de oposición: ése sale de la respuesta. */
  request: RollRequest;
  status: 'pending' | 'resolved' | 'cancelled';
}

export interface OpenPlayerAttackInput {
  actorId: string;
  campaignId: string;
  sceneId: string | null;
  attackerCharacterId: string;
  attackerTokenId: string | null;
  targetTokenId: string;
  /** Copiado: el aviso del director dice «Karen ataca…» aunque el token cambie. */
  attackerName: string;
  dice: number;
  request: RollRequest;
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
  /** `dice_open_player_attack` (el espejo): el actor debe SER DUEÑO del personaje atacante, y el blanco una criatura. */
  openPlayer(input: OpenPlayerAttackInput): Promise<{ id: string }>;
  /** `dice_answer_attack`: sólo el dueño del personaje. Devuelve los dados de defensa aceptados (0 vale). */
  answer(actorId: string, attackId: string, defence: number): Promise<number>;
  /** `dice_answer_player_attack` (el espejo): sólo el DIRECTOR pone la defensa de su criatura. */
  answerPlayer(actorId: string, attackId: string, defence: number): Promise<number>;
  findById(id: string): Promise<PendingAttack | null>;
  /** `dice_close_attack`: apunta la tirada que salió, o lo cancela. */
  close(attackId: string, rollId: string | null, status: 'resolved' | 'cancelled'): Promise<void>;
}
