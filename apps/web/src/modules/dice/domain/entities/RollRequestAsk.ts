/** Una petición de tirada del director A LA ESPERA de que el jugador conteste (`dice_roll_requests`). */
export interface PendingRollRequest {
  id: string;
  campaignId: string;
  batchId: string;
  targetCharacterId: string;
  /** La característica y la dificultad que eligió el director con el mantener-pulsado (p.84). */
  stat: string;
  difficulty: number;
  /** «Le vale su especialidad — lo decides tú (p.83)»: la decidió el director al pedir. */
  specialtyAllowed: boolean;
  createdAt: string;
}

export interface OpenRollRequestsInput {
  campaignId: string;
  targetCharacterIds: string[];
  stat: string;
  difficulty: number;
  specialtyAllowed: boolean;
}
