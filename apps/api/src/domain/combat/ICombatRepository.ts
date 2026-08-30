/**
 * El ORDEN DE TURNOS de un combate (`dice_combats` + `dice_combat_slots`, p.92–94).
 *
 * Un combate vive en una ESCENA y sólo puede haber uno activo por escena. Los puestos guardan el orden de
 * actuación, a quién le toca y la ronda. Nadie los escribe desde el navegador: la tabla no tiene políticas
 * de escritura para `authenticated` y las cuatro funciones son API-only, igual que las de los ataques.
 */

/** Un puesto tal y como llega para abrir el combate. YA ORDENADO: el criterio lo aplicó `orderTurns`. */
export interface CombatSlotInput {
  /** El token en la escena, si lo tiene. Un PNJ puede no estar colocado. */
  tokenId: string | null;
  /** El personaje, si es de alguien. Una criatura del bestiario no tiene. */
  characterId: string | null;
  /** Copiado, como `attacker_name`: el orden tiene que decir «el ogro» aunque el token ya no exista. */
  name: string;
}

export interface OpenCombatInput {
  actorId: string;
  campaignId: string;
  sceneId: string;
  slots: CombatSlotInput[];
}

/** Lo mínimo de un puesto que el caso de uso necesita para cobrar la Fortuna del que se adelanta. */
export interface CombatSlot {
  id: string;
  combatId: string;
  campaignId: string;
  position: number;
  characterId: string | null;
}

/**
 * `FORBIDDEN` (no es el director, o no es el dueño del personaje del puesto) ·
 * `NOT_ACTIVE` (no existe o ya está cerrado) · `COMBAT_ACTIVE` (esa escena ya tiene uno) ·
 * `CANNOT_ADVANCE` (no se puede saltar por encima de quien actúa ni de los que ya actuaron).
 */
export type CombatErrorCode = 'FORBIDDEN' | 'NOT_ACTIVE' | 'COMBAT_ACTIVE' | 'CANNOT_ADVANCE';

export interface ICombatRepository {
  /** `dice_open_combat`: sólo el director; la escena, de su mesa; uno activo por escena. */
  open(input: OpenCombatInput): Promise<{ id: string }>;
  /** `dice_next_turn`: sólo el director. Al dar la vuelta sube la ronda y salda la deuda del que actuó. */
  next(combatId: string, actorId: string): Promise<{ position: number; round: number }>;
  /** `dice_close_combat`: sólo el director. */
  close(combatId: string, actorId: string): Promise<void>;
  /** `dice_advance_turn`: sólo el DUEÑO del personaje del puesto. Devuelve su posición nueva. */
  advance(combatId: string, actorId: string, slotId: string): Promise<number>;
  findSlot(slotId: string): Promise<CombatSlot | null>;
}
