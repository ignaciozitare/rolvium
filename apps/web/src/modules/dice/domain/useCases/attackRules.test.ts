import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { GameSystem, SheetData } from '@rolvium/core';
import { defenceDiceFor } from './attackRules';

const stat = (value: number) => ({ value, specialties: [] });
const karen = (over: Record<string, unknown> = {}): SheetData =>
  ({ ...plenilunio.newSheet(), combat: stat(4), fortitude: stat(3), destiny: 3, ...over });

describe('defenceDiceFor', () => {
  it('da los dados que le daría su característica: Combate 4 → 4 dados (p.93)', () => {
    expect(defenceDiceFor(plenilunio, karen(), 'combat')).toBe(4);
  });
  /**
   * La penalización por heridas entra por donde entra siempre —la del motor—, y no por una segunda cuenta
   * que pudiera contradecirla: un herido tira un dado menos, también cuando se defiende (p.99).
   */
  it('herido pone un dado menos, porque es el mismo puñado que tiraría', () => {
    expect(defenceDiceFor(plenilunio, karen({ health: 'wounded' }), 'combat')).toBe(3);
    expect(defenceDiceFor(plenilunio, karen({ health: 'badlyWounded' }), 'combat')).toBe(2);
  });
  /** Lo que la ficha tenga puesto en su bloque de tirada es para una tirada SUYA, no para su defensa. */
  it('no arrastra la dificultad ni los dados extra del bloque de tirada de la ficha', () => {
    expect(defenceDiceFor(plenilunio, karen({ difficulty: 5, extraDice: 3 }), 'combat')).toBe(4);
  });
  it('sin característica no se inventa un número', () => {
    expect(defenceDiceFor(plenilunio, karen(), null)).toBeNull();
  });
  it('si el sistema revienta al armar el puñado, calla en vez de romper el aviso', () => {
    const broken = { ...plenilunio, engine: { ...plenilunio.engine, poolFor: () => { throw new Error('boom'); } } } as unknown as GameSystem;
    expect(defenceDiceFor(broken, karen(), 'combat')).toBeNull();
  });
});
