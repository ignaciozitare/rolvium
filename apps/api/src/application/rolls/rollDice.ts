import { randomInt } from 'node:crypto';
import type { GameSystem, RollRequest, RollResult, RolledDice } from '@rolvium/core';

export interface RollOutcome { request: RollRequest; dice: RolledDice; result: RollResult; rolledAt: string }

/** Server-side dice: CSPRNG per die, then the system resolves. Free rolls (`systemId` null) just sum. */
export function rollDice(request: RollRequest, system: GameSystem | null, rng: (sides: number) => number = (s) => randomInt(1, s + 1)): RollOutcome {
  const dice: RolledDice = request.groups.map(g => Array.from({ length: Math.max(0, Math.min(100, g.count)) }, () => rng(g.sides)));
  const result: RollResult = system
    ? system.engine.resolve(request, dice)
    : { summary: 'roll.free', total: dice.flat().reduce((a, b) => a + b, 0) + (request.modifier ?? 0), detail: { dice } };
  return { request, dice, result, rolledAt: new Date().toISOString() };
}
