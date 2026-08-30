import { describe, it, expect, vi } from 'vitest';
import { orderTurns, ownDiceForStat } from './gameSystem';
import type { Engine, SheetData, TurnParticipant } from './gameSystem';
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

describe('orderTurns', () => {
  const p = (id: string, destiny: number, isPlayerCharacter = true): TurnParticipant =>
    ({ id, sheet: { destiny }, isPlayerCharacter });
  /** Un comparador de mentira con la forma del real: mayor primero, y `0` = «no sé desempatar». */
  const byDestiny = (a: TurnParticipant, b: TurnParticipant) =>
    Number(b.sheet['destiny']) - Number(a.sheet['destiny']);

  it('ordena con el criterio del sistema', () => {
    const r = orderTurns(system({ turnOrder: byDestiny }), [p('a', 3), p('b', 7), p('c', 5)]);
    expect(r.order).toEqual(['b', 'c', 'a']);
    expect(r.undecided).toEqual([]);
  });

  it('un sistema SIN regla de orden deja a todos como llegaron', () => {
    const r = orderTurns(system(), [p('a', 3), p('b', 7)]);
    expect(r.order).toEqual(['a', 'b']);
    expect(r.undecided).toEqual([]);
  });

  /**
   * El caso que justifica que esto no sea un `sort` a secas: `0` no es un fallo del sistema, es el hueco que
   * el manual le deja a quien dirige. Si se perdiera, la plataforma estaría eligiendo por él en silencio.
   */
  it('saca aparte a los que el sistema dejó EMPATADOS, sin elegir por él', () => {
    const r = orderTurns(system({ turnOrder: byDestiny }), [p('a', 5), p('b', 7), p('c', 5), p('d', 5)]);
    expect(r.order).toEqual(['b', 'a', 'c', 'd']);
    expect(r.undecided).toEqual([['a', 'c', 'd']]);
  });

  it('dos empates separados salen como dos grupos', () => {
    const r = orderTurns(system({ turnOrder: byDestiny }), [p('a', 5), p('b', 8), p('c', 5), p('d', 8)]);
    expect(r.undecided).toEqual([['b', 'd'], ['a', 'c']]);
  });

  /** Estable: dos empatados conservan el orden en que llegaron, así que el resultado no baila entre llamadas. */
  it('el orden es estable y no muta la lista que le pasan', () => {
    const input = [p('a', 5), p('c', 5), p('b', 5)];
    expect(orderTurns(system({ turnOrder: byDestiny }), input).order).toEqual(['a', 'c', 'b']);
    expect(input.map(x => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('sin nadie dentro no se rompe', () => {
    expect(orderTurns(system({ turnOrder: byDestiny }), [])).toEqual({ order: [], undecided: [] });
  });
});
