/**
 * Una PETICIÓN DE TIRADA del director a un jugador (`dice_roll_requests`, `.pen` columna 4).
 *
 * El director elige característica y dificultad con el mantener-pulsado (p.84) y a quién se la pide;
 * «A TODOS» abre una fila por personaje con el mismo `batchId`. El jugador contesta TIRANDO — los dados
 * los genera el servidor con SU ficha — y la fila queda `resolved` apuntando a la tirada. Si no contesta,
 * la petición espera indefinidamente: nadie tira por él (decisión del dueño, 2026-08-20).
 */
export interface PendingRollRequest {
  id: string;
  campaignId: string;
  batchId: string;
  targetCharacterId: string;
  /** Quién la abrió: el DIRECTOR. La tirada, en cambio, es del JUGADOR que contesta — es su característica. */
  createdBy: string;
  stat: string;
  difficulty: number;
  /** «Le vale su especialidad — lo decides tú (p.83)»: la decide el director al pedir, no el jugador. */
  specialtyAllowed: boolean;
  status: 'pending' | 'resolved' | 'cancelled';
}

export interface OpenRollRequestsInput {
  actorId: string;
  campaignId: string;
  targetCharacterIds: string[];
  stat: string;
  difficulty: number;
  specialtyAllowed: boolean;
}

/** `FORBIDDEN` (no es el director, o no es el dueño) · `NOT_PENDING` (ya contestada o cancelada). */
export type RollRequestErrorCode = 'FORBIDDEN' | 'NOT_PENDING';

export interface IRollRequestRepository {
  /** `dice_open_roll_requests`: comprueba que el actor es el director y cada personaje, de su mesa. */
  openBatch(input: OpenRollRequestsInput): Promise<{ batchId: string }>;
  findById(id: string): Promise<PendingRollRequest | null>;
  /** `dice_close_roll_request`: apunta la tirada con la que se contestó, o la cancela. */
  close(requestId: string, rollId: string | null, status: 'resolved' | 'cancelled'): Promise<void>;
}
