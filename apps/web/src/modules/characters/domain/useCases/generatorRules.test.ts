import { describe, it, expect } from 'vitest';
import { budgetAllows } from './generatorRules';

describe('budgetAllows — el guardia de presupuesto del generador', () => {
  it('un paso sin presupuesto no veta nada', () => {
    expect(budgetAllows(undefined, undefined)).toBe(true);
  });
  it('deja gastar mientras quede algo, y no deja pasarse', () => {
    expect(budgetAllows(0, 1)).toBe(true);
    expect(budgetAllows(-1, 0)).toBe(false);
  });
  it('con el paso en números rojos deja arreglarlo: reducir sí, empeorar no', () => {
    expect(budgetAllows(-1, -2)).toBe(true);
    expect(budgetAllows(-3, -2)).toBe(false);
  });
  it('y deja el cambio que no cuesta nada — el don que rebotaba (2026-08-19)', () => {
    // cambiar QUÉ don es una fila no mueve el presupuesto; vetarlo no protegía nada
    expect(budgetAllows(-2, -2)).toBe(true);
  });
  it('si el paso de partida no tenía presupuesto, entrar en rojo se veta igual', () => {
    // `before` ausente cuenta como 0: nadie puede estrenar números rojos «gratis»
    expect(budgetAllows(-1, undefined)).toBe(false);
    expect(budgetAllows(0, undefined)).toBe(true);
  });
});
