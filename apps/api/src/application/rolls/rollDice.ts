import { randomInt } from 'node:crypto';
import type { GameSystem, RollRequest, RollResult, RolledDice, SheetData } from '@rolvium/core';

export interface RollOutcome { request: RollRequest; dice: RolledDice; result: RollResult; rolledAt: string }

/** Face value of a die towards a free total: Fudge dice (tag `fudge`, 3 faces) count −1 / 0 / +1. */
const faceValue = (v: number, tag: string | undefined): number => (tag === 'fudge' ? v - 2 : v);

/**
 * Server-side dice: CSPRNG per die, then the system resolves (with the sheet when the roll belongs to a character,
 * so effects such as «+1 Destino» can be computed authoritatively). Free rolls (`systemId` null) just sum.
 */
export function rollDice(request: RollRequest, system: GameSystem | null, rng: (sides: number) => number = (s) => randomInt(1, s + 1), sheet?: SheetData): RollOutcome {
  const dice: RolledDice = request.groups.map(g => Array.from({ length: Math.max(0, Math.min(100, g.count)) }, () => rng(g.sides)));
  const result: RollResult = system
    ? system.engine.resolve(request, dice, sheet)
    : { summary: 'roll.free', total: request.groups.reduce((acc, g, i) => acc + (dice[i] ?? []).reduce((a, v) => a + faceValue(v, g.tag), 0), 0) + (request.modifier ?? 0), detail: { dice } };
  return { request, dice, result, rolledAt: new Date().toISOString() };
}
