import { orderTurns, type GameSystem, type SheetData, type TurnParticipant } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { CombatSlotInput, ICombatRepository } from '../../domain/combat/ICombatRepository.js';
import { saveSheet } from '../characters/saveSheet.js';

export interface CombatDeps {
  characters: ICharacterRepository;
  combats: ICombatRepository;
  systemById: (id: string) => GameSystem | null;
}

export type CombatErrorResult = {
  ok: false;
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'NOT_ACTIVE' | 'COMBAT_ACTIVE' | 'CANNOT_ADVANCE' | 'NO_FORTUNE' | 'SYSTEM_NOT_INSTALLED' | 'NO_SLOTS';
};
/** Los empates que el sistema no supo deshacer y el manual manda preguntarle al director (p.92–93). */
export type UndecidedResult = { ok: false; code: 'UNDECIDED'; undecided: string[][] };
export type OpenCombatResult = { ok: true; data: { id: string; order: string[] } } | CombatErrorResult | UndecidedResult;
export type NextTurnResult = { ok: true; data: { position: number; round: number } } | CombatErrorResult;
export type CloseCombatResult = { ok: true } | CombatErrorResult;
export type AdvanceTurnResult = { ok: true; data: { position: number; fortune: number } } | CombatErrorResult;

const known = (e: unknown): CombatErrorResult['code'] | null => {
  const code = (e as { code?: string }).code;
  return code === 'FORBIDDEN' || code === 'NOT_ACTIVE' || code === 'COMBAT_ACTIVE' || code === 'CANNOT_ADVANCE' ? code : null;
};

/** Uno de los que entran al combate, tal y como lo pide quien abre. */
export interface CombatCandidate {
  /** Identificador propio dentro de la petición: es lo que devuelve el orden y con lo que se desempata. */
  key: string;
  tokenId: string | null;
  characterId: string | null;
  name: string;
  /**
   * Los valores de la CRIATURA (Destino, Combate…), que pone el director. Se ignoran cuando el puesto lleva
   * personaje: la ficha de un personaje la lee el servidor de la base y no se fía de lo que le manden.
   *
   * Es el mismo perímetro de confianza que ya tienen las tiradas de criatura —su puñado lo arma el cliente
   * del director, deuda anotada en la spec del bestiario—: quien las mueve es quien dirige la mesa.
   */
  stats?: Record<string, number>;
}

export interface OpenCombatInput {
  actorId: string;
  campaignId: string;
  sceneId: string;
  systemId: string;
  candidates: CombatCandidate[];
  /**
   * El desempate del director, por `key`: dentro de un grupo empatado manda el orden en que aparecen aquí.
   * Sin él —o si no cubre un grupo entero— el combate NO se abre y se devuelven los empates, para que la
   * app se lo pregunte. La plataforma no elige por él: la regla termina en «decide el director de juego».
   */
  tiebreak?: string[];
}

/**
 * Reordena DENTRO de cada grupo empatado con la palabra del director, y dice si alguno sigue sin resolver.
 *
 * Un grupo se da por resuelto sólo cuando el desempate nombra a TODOS los suyos: con dos de tres, el tercero
 * seguiría colocado por el orden de llegada, que no es una decisión de nadie.
 */
export function applyTiebreak(order: string[], undecided: string[][], tiebreak: string[]): { order: string[]; pending: string[][] } {
  const rank = new Map(tiebreak.map((k, i) => [k, i]));
  const next = [...order];
  const pending: string[][] = [];
  for (const group of undecided) {
    if (!group.every(k => rank.has(k))) { pending.push(group); continue; }
    const slots = group.map(k => next.indexOf(k)).sort((a, b) => a - b);
    const chosen = [...group].sort((a, b) => rank.get(a)! - rank.get(b)!);
    slots.forEach((slot, i) => { next[slot] = chosen[i]!; });
  }
  return { order: next, pending };
}

/**
 * El director abre el combate: el SERVIDOR pone el orden.
 *
 * Quién es «personaje jugador» para el desempate del libro (p.92) se DEDUCE, no se pregunta: quien abre es
 * el director, así que un personaje de otro dueño es de un jugador y uno suyo no lo es. Preguntárselo al
 * cliente sería dejar que quien llama se dé a sí mismo la ventaja del empate.
 *
 * ⚠ Anotado: un PNJ aliado asignado a un jugador cuenta aquí como personaje jugador, porque quien lo lleva
 * es un jugador. Es la misma zona gris que ya está apuntada en «pedir tirada» y se decide junto con ella.
 */
export async function openCombat(deps: CombatDeps, input: OpenCombatInput): Promise<OpenCombatResult> {
  const system = deps.systemById(input.systemId);
  if (!system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };
  if (!input.candidates.length) return { ok: false, code: 'NO_SLOTS' };
  if (!(await deps.characters.isCampaignDm(input.campaignId, input.actorId))) return { ok: false, code: 'FORBIDDEN' };

  const participants: TurnParticipant[] = [];
  const byKey = new Map<string, CombatCandidate>();
  for (const c of input.candidates) {
    byKey.set(c.key, c);
    let sheet: SheetData = { ...(c.stats ?? {}) };
    let isPlayerCharacter = false;
    if (c.characterId) {
      const ch = await deps.characters.findForActor(c.characterId, input.actorId);
      if (!ch || ch.campaignId !== input.campaignId) return { ok: false, code: 'NOT_FOUND' };
      sheet = ch.data;
      isPlayerCharacter = !!ch.ownerId && ch.ownerId !== input.actorId;
    }
    participants.push({ id: c.key, sheet, isPlayerCharacter });
  }

  const computed = orderTurns(system, participants);
  const { order, pending } = input.tiebreak?.length
    ? applyTiebreak(computed.order, computed.undecided, input.tiebreak)
    : { order: computed.order, pending: computed.undecided };
  if (pending.length) return { ok: false, code: 'UNDECIDED', undecided: pending };

  const slots: CombatSlotInput[] = order.map(key => {
    const c = byKey.get(key)!;
    return { tokenId: c.tokenId, characterId: c.characterId, name: c.name };
  });
  try {
    const { id } = await deps.combats.open({ actorId: input.actorId, campaignId: input.campaignId, sceneId: input.sceneId, slots });
    return { ok: true, data: { id, order } };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/** Pasar al turno siguiente. Sólo el director; lo comprueba SQL, que es quien mueve la fila. */
export async function nextTurn(deps: Pick<CombatDeps, 'combats'>, input: { actorId: string; combatId: string }): Promise<NextTurnResult> {
  try {
    return { ok: true, data: await deps.combats.next(input.combatId, input.actorId) };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/** Cerrar el combate. */
export async function closeCombat(deps: Pick<CombatDeps, 'combats'>, input: { actorId: string; combatId: string }): Promise<CloseCombatResult> {
  try {
    await deps.combats.close(input.combatId, input.actorId);
    return { ok: true };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/**
 * Adelantarse gastando 1 punto de Fortuna (p.89 uso 5 · p.92).
 *
 * El orden importa, y es el mismo reparto que ya usan los ataques: primero se comprueba que puede pagar,
 * luego se mueve el puesto —que es el paso con autoridad, guardado en SQL— y sólo si el puesto se movió de
 * verdad se le cobra. Al revés se le podría cobrar por un adelanto que no ocurrió.
 *
 * ⚠ Si el cobro fallara después de moverse, el adelanto queda gratis. Es la misma clase de hueco que
 * «cerrar el ataque después de que la tirada salga», y se prefiere en la misma dirección: antes regalar que
 * cobrar de más.
 */
export async function advanceTurn(deps: CombatDeps, input: { actorId: string; combatId: string; slotId: string }): Promise<AdvanceTurnResult> {
  const slot = await deps.combats.findSlot(input.slotId);
  if (!slot || slot.combatId !== input.combatId) return { ok: false, code: 'NOT_FOUND' };
  if (!slot.characterId) return { ok: false, code: 'FORBIDDEN' };
  const ch = await deps.characters.findForActor(slot.characterId, input.actorId);
  if (!ch) return { ok: false, code: 'NOT_FOUND' };
  // Lo vuelve a comprobar `dice_advance_turn`; aquí hace falta además porque de esta ficha sale la Fortuna.
  if (!ch.isOwner) return { ok: false, code: 'FORBIDDEN' };
  const fortune = typeof ch.data['fortune'] === 'number' ? (ch.data['fortune'] as number) : 0;
  if (fortune < 1) return { ok: false, code: 'NO_FORTUNE' };

  let position: number;
  try {
    position = await deps.combats.advance(input.combatId, input.actorId, input.slotId);
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
  await saveSheet(deps, { characterId: slot.characterId, actorId: input.actorId, data: { ...ch.data, fortune: fortune - 1 }, origin: 'roll' });
  return { ok: true, data: { position, fortune: fortune - 1 } };
}
