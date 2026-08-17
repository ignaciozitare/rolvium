import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { rollDice } from './rollDice';

describe('rollDice', () => {
  it('uses the injected rng per die and lets the system resolve', () => {
    let i = 0; const seq = [6, 6, 4, 1];
    const out = rollDice({ systemId: 'plenilunio', kind: 'system', title: 't', groups: [{ count: 3, sides: 6, tag: 'own' }, { count: 1, sides: 6, tag: 'destiny' }], options: { stat: 'combat' }, visibility: 'table' }, plenilunio, () => seq[i++] ?? 1);
    expect(out.dice).toEqual([[6, 6, 4], [1]]);
    expect(out.result.detail).toBeDefined();
  });
  it('free roll totals + modifier, caps 100 dice per group', () => {
    const out = rollDice({ systemId: null, kind: 'free', title: 'd20', groups: [{ count: 500, sides: 20 }], visibility: 'table', modifier: 2 }, null, () => 20);
    expect(out.dice[0]).toHaveLength(100);
    expect(out.result.total).toBe(2002);
  });
});
