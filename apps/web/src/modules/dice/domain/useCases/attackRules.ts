import { ownDiceForStat, type GameSystem, type SheetData } from '@rolvium/core';

/**
 * Cuántos dados puede gastar en defenderse quien recibe un ataque cuerpo a cuerpo.
 *
 * **No se inventa nada aquí**: son los dados que le daría esa característica ahora mismo, que se los pone
 * el propio sistema (`ownDiceForStat`). Así la penalización por heridas —u lo que cada sistema tenga—
 * entra por donde entra siempre, y no hay una segunda cuenta que pueda contradecir a la del motor.
 *
 * La característica es **la del ataque**, no una elegida aquí: cuerpo a cuerpo es Combate contra Combate
 * (RULES.md §5.2, p.93). Sin ella —un ataque viejo que no la guardó— devuelve `null`, y el aviso enseña lo
 * que puede en vez de inventarse un número.
 *
 * ⚠ Esto es lo que se PINTA. El techo de verdad lo pone el servidor con esta misma cuenta al contestar
 * (`apps/api/src/application/attacks/answerAttack.ts`): aquí sólo se decide qué fichas ofrecer.
 */
export function defenceDiceFor(system: GameSystem, sheet: SheetData, stat: string | null): number | null {
  return ownDiceForStat(system, sheet, stat);
}
