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

describe('rollDice — sheet-aware resolution and Fudge', () => {
  it('passes the sheet to the engine so effects carry the authoritative patch (Destiny triumph → +1 Destino)', () => {
    const sheet = { ...plenilunio.newSheet(), destiny: 2, fortune: 0 };
    const req = { systemId: 'plenilunio', kind: 'system' as const, title: 't', groups: [{ count: 0, sides: 6, tag: 'own' }, { count: 1, sides: 6, tag: 'destiny' }], options: { stat: 'combat', destinyDice: 1 }, visibility: 'table' as const };
    expect(rollDice(req, plenilunio, () => 6).result.effects?.['patch']).toBeUndefined();
    expect(rollDice(req, plenilunio, () => 6, sheet).result.effects?.['patch']).toEqual({ destiny: 3, fortune: 3 });
  });
  it('Fudge dice (tag fudge, 3 faces) count −1/0/+1 towards a free total', () => {
    let i = 0; const seq = [1, 2, 3, 3];
    const out = rollDice({ systemId: null, kind: 'free', title: '4dF', groups: [{ count: 4, sides: 3, tag: 'fudge' }], visibility: 'table', modifier: 1 }, null, () => seq[i++] ?? 2);
    expect(out.result.total).toBe(-1 + 0 + 1 + 1 + 1);
  });
});
