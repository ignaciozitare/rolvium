import { ownDiceForStat, type DiceGroup, type GameSystem, type RollRequest, type SheetData } from '@rolvium/core';
import type { IAttackRepository, OpenAttackInput, OpenPlayerAttackInput } from '../../domain/attack/IAttackRepository.js';
import { performRoll, type PerformRollDeps, type PerformedRoll } from '../rolls/performRoll.js';

export interface AttackDeps extends PerformRollDeps { attacks: IAttackRepository }

export type AttackErrorResult = { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'NOT_PENDING' | 'POOL_EMPTY' | 'SYSTEM_NOT_INSTALLED' };
export type OpenAttackResult = { ok: true; data: { id: string } } | AttackErrorResult;
export type AnswerAttackResult = { ok: true; data: PerformedRoll & { defence: number } } | AttackErrorResult;

/** Los errores que las funciones SQL levantan llegan aquí como `{ code }`; lo demás sube tal cual. */
const known = (e: unknown): 'FORBIDDEN' | 'NOT_PENDING' | null => {
  const code = (e as { code?: string }).code;
  return code === 'FORBIDDEN' || code === 'NOT_PENDING' ? code : null;
};

/**
 * Mete los dados de defensa del jugador en la petición guardada, como grupo `opposition`.
 *
 * Tres cosas a propósito:
 * - **Se tira la oposición que hubiera** antes de añadir la nueva: la petición la guardó el navegador del
 *   director y no se fía de ella para esto. Sólo la respuesta del jugador pone dados enfrente.
 * - **`difficulty` se pone igual que los dados**, para que las opciones y los grupos digan lo mismo. Si
 *   algún día alguien rearma el puñado desde las opciones, saldrá esta misma tirada y no otra.
 * - **`conflict`** marca que los dados de enfrente son un rival y no una dificultad, que es lo único que
 *   distingue esto de un reto (p.93 contra p.84). Sin ello el desglose del Registro diría «reto a
 *   dificultad 2» de algo que el manual llama conflicto.
 */
export function withDefence(request: RollRequest, defence: number): RollRequest {
  const n = Math.max(0, Math.floor(defence));
  const groups: DiceGroup[] = request.groups.filter(g => g.tag !== 'opposition');
  if (n > 0) groups.push({ count: n, sides: 6, tag: 'opposition' });
  return { ...request, groups, options: { ...(request.options ?? {}), conflict: true, difficulty: n } };
}

/** El director abre un ataque cuerpo a cuerpo: se guarda la intención y el jugador recibe el aviso. */
export async function openAttack(deps: Pick<AttackDeps, 'attacks'>, input: OpenAttackInput): Promise<OpenAttackResult> {
  try {
    return { ok: true, data: await deps.attacks.open(input) };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/**
 * El techo de dados de defensa: los que le da su característica AHORA MISMO, según su propia ficha.
 *
 * Se recorta, no se rechaza, y por el mismo motivo por el que `performRoll` rearma el puñado desde la ficha
 * en vez de fiarse de los grupos que manda el navegador: la petición viene de fuera y **no es autoridad de
 * nada**. Sin esto, un `{"defence": 40}` a pelo le daba 40 dados de defensa a un personaje con Combate 4.
 *
 * Sin característica guardada el techo es **0**: es exactamente lo que la pantalla le ofrece —sólo «no me
 * defiendo»—, así que el servidor no puede aceptar más de lo que se le pudo pedir.
 */
export function defenceCap(system: GameSystem | null, sheet: SheetData, request: RollRequest): number {
  if (!system) return 0;
  const stat = request.options?.['stat'];
  return ownDiceForStat(system, sheet, typeof stat === 'string' ? stat : null) ?? 0;
}

/**
 * El jugador contesta: **la tirada sale ahora**, con sus dados de defensa enfrente.
 *
 * El orden importa. Primero se lee el ataque y la ficha de quien contesta —que es lo que dice cuántos
 * dados puede poner— y sólo con el número ya recortado se llama a `answer`, para que lo que quede escrito
 * en `defence_dice` sea lo que de verdad se tiró y no lo que alguien pidió.
 *
 * El autor de la tirada es el DIRECTOR (`createdBy`), no quien contesta: quien ataca es su criatura, y el
 * Registro tiene que decir eso. La fila se cierra DESPUÉS de que la tirada haya salido bien; si falla, se
 * queda en `pending` y el jugador puede volver a contestar en vez de quedarse con un ataque muerto.
 */
export async function answerAttack(deps: AttackDeps, input: { actorId: string; attackId: string; defence: number }): Promise<AnswerAttackResult> {
  const attack = await deps.attacks.findById(input.attackId);
  if (!attack) return { ok: false, code: 'NOT_FOUND' };
  if (attack.status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  // Sin personaje atacado, la fila es del ESPEJO (un PJ ataca a una criatura): la contesta el director por
  // `answerPlayerAttack`, no este camino.
  if (attack.targetCharacterId === null) return { ok: false, code: 'FORBIDDEN' };
  // Quien contesta tiene que ser el DUEÑO del personaje atacado. Lo vuelve a comprobar `dice_answer_attack`
  // en SQL; aquí hace falta además porque su ficha es de donde sale el techo de dados.
  const character = await deps.characters.findForActor(attack.targetCharacterId, input.actorId);
  if (!character || !character.isOwner) return { ok: false, code: 'FORBIDDEN' };
  const system = attack.request.systemId ? deps.systemById(attack.request.systemId) : null;
  if (attack.request.kind === 'system' && !system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };
  const asked = Math.max(0, Math.floor(input.defence));
  const capped = Math.min(asked, defenceCap(system, character.data, attack.request));

  let accepted: number;
  try {
    accepted = await deps.attacks.answer(input.actorId, input.attackId, capped);
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
  const r = await performRoll(deps, {
    actorId: attack.createdBy, campaignId: attack.campaignId, request: withDefence(attack.request, accepted),
  });
  if (!r.ok) return r;
  await deps.attacks.close(attack.id, r.data.id, 'resolved');
  return { ok: true, data: { ...r.data, defence: accepted } };
}

/** El ESPEJO: el jugador abre su ataque c/c contra una criatura y el aviso le salta al DIRECTOR. */
export async function openPlayerAttack(deps: Pick<AttackDeps, 'attacks'>, input: OpenPlayerAttackInput): Promise<OpenAttackResult> {
  try {
    return { ok: true, data: await deps.attacks.openPlayer(input) };
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
}

/**
 * El DIRECTOR contesta el espejo con los dados de defensa de su criatura, y la tirada sale ahí mismo.
 *
 * Mismo reparto que `answerAttack`, con dos diferencias dichas:
 * - **Quién contesta lo comprueba SQL** (`dice_answer_player_attack`: sólo el director de esa campaña).
 * - **El techo de la defensa es la palabra del director** (clamp de cordura 0–40 en SQL): su criatura no
 *   tiene ficha que consultar — es el mismo perímetro que toda tirada de criatura, que hoy arma su puñado
 *   el cliente del director (deuda anotada en la spec del bestiario).
 *
 * El AUTOR de la tirada es quien abrió el ataque — el JUGADOR: quien ataca es su personaje, y el Registro
 * tiene que decir eso (espejo exacto de la columna 5, donde el autor era el director).
 */
export async function answerPlayerAttack(deps: AttackDeps, input: { actorId: string; attackId: string; defence: number }): Promise<AnswerAttackResult> {
  const attack = await deps.attacks.findById(input.attackId);
  if (!attack) return { ok: false, code: 'NOT_FOUND' };
  if (attack.status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  if (attack.targetCharacterId !== null) return { ok: false, code: 'FORBIDDEN' };
  const system = attack.request.systemId ? deps.systemById(attack.request.systemId) : null;
  if (attack.request.kind === 'system' && !system) return { ok: false, code: 'SYSTEM_NOT_INSTALLED' };

  let accepted: number;
  try {
    accepted = await deps.attacks.answerPlayer(input.actorId, input.attackId, Math.max(0, Math.floor(input.defence)));
  } catch (e) {
    const code = known(e);
    if (code) return { ok: false, code };
    throw e;
  }
  const r = await performRoll(deps, {
    actorId: attack.createdBy, campaignId: attack.campaignId, request: withDefence(attack.request, accepted),
  });
  if (!r.ok) return r;
  await deps.attacks.close(attack.id, r.data.id, 'resolved');
  return { ok: true, data: { ...r.data, defence: accepted } };
}
