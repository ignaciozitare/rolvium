import { describe, it, expect, vi } from 'vitest';
import { ownDiceForStat } from './gameSystem';
import type { Engine, SheetData } from './gameSystem';
import type { RollRequest } from './rolls';

/**
 * Un motor de mentira que hace lo que hacen los de verdad: el puñado sale de la característica menos lo que
 * la ficha diga que le resta, y las opciones que le pasan mandan sobre lo que la ficha traiga puesto.
 */
const engineOf = (over: Partial<Engine> = {}): Engine => ({
  derived: () => ({}),
  poolFor: (sheet, action) => {
    const o = (action.options ?? {}) as Record<string, number>;
    const value = Number((sheet as Record<string, number>)[action.stat] ?? 0);
    const penalty = Number(sheet['penalty'] ?? 0);
    const extra = Number(o['extraDice'] ?? sheet['extraDice'] ?? 0);
    const difficulty = Number(o['difficulty'] ?? sheet['difficulty'] ?? 0);
    const groups = [{ count: Math.max(0, value - penalty + extra), sides: 6, tag: 'own' }];
    if (difficulty > 0) groups.push({ count: difficulty, sides: 6, tag: 'opposition' });
    return { systemId: 's', kind: 'system', title: 't', groups, visibility: 'table' } as RollRequest;
  },
  resolve: () => ({ summary: 'x' }),
  ...over,
});
const system = (over: Partial<Engine> = {}) => ({ engine: engineOf(over) });
const sheet = (o: Record<string, unknown> = {}): SheetData => ({ combat: 4, ...o });

describe('ownDiceForStat', () => {
  it('le pregunta al sistema cuántos dados propios da esa característica', () => {
    expect(ownDiceForStat(system(), sheet(), 'combat')).toBe(4);
  });
  /** Lo que el sistema reste vive en el sistema: aquí no se replica ni se corrige. */
  it('respeta lo que el motor reste, sea lo que sea', () => {
    expect(ownDiceForStat(system(), sheet({ penalty: 1 }), 'combat')).toBe(3);
  });
  /** Es «cuánto vale su característica», no «cómo sería esta tirada»: el bloque de tirada de la ficha no cuenta. */
  it('no arrastra la dificultad ni los dados extra que la ficha traiga puestos', () => {
    expect(ownDiceForStat(system(), sheet({ difficulty: 5, extraDice: 3 }), 'combat')).toBe(4);
  });
  it('la oposición nunca cuenta: no son dados suyos', () => {
    const withOpposition = system({
      poolFor: () => ({ systemId: 's', kind: 'system', title: 't', visibility: 'table', groups: [{ count: 4, sides: 6, tag: 'own' }, { count: 9, sides: 6, tag: 'opposition' }] }),
    });
    expect(ownDiceForStat(withOpposition, sheet(), 'combat')).toBe(4);
  });
  it('suma todos los grupos propios, no sólo el primero', () => {
    const twoGroups = system({
      poolFor: () => ({ systemId: 's', kind: 'system', title: 't', visibility: 'table', groups: [{ count: 4, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'bonus' }] }),
    });
    expect(ownDiceForStat(twoGroups, sheet(), 'combat')).toBe(6);
  });
  /** `null` no es 0: es «no sabemos», y quien pregunta necesita distinguirlas. */
  it('sin característica devuelve null', () => {
    expect(ownDiceForStat(system(), sheet(), null)).toBeNull();
    expect(ownDiceForStat(system(), sheet(), '')).toBeNull();
  });
  it('si el sistema revienta devuelve null en vez de tumbar a quien pregunta', () => {
    const broken = system({ poolFor: vi.fn(() => { throw new Error('boom'); }) });
    expect(ownDiceForStat(broken, sheet(), 'combat')).toBeNull();
  });
  it('una característica que el sistema no conoce no puede dar dados negativos', () => {
    expect(ownDiceForStat(system(), sheet({ penalty: 9 }), 'combat')).toBe(0);
  });
});
