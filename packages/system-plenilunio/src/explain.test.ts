import { describe, expect, it } from 'vitest';
import { explain, fill } from './explain';
import { poolFor, resolve, engine } from './engine';
import { newSheet, type StatValue } from './schema';
import { messages, lookup } from './locales';
import type { Locale, RollRequest, RolledDice } from '@rolvium/core';

const stat = (value: number, specialties: string[] = []): StatValue => ({ value, specialties });
const sheet = (over: Record<string, unknown> = {}) => ({ ...newSheet(), fortitude: stat(3), will: stat(2), combat: stat(4), destiny: 3, fortune: 3, resistance: 15, ...over });
/** El `ts` de verdad: resuelve las claves del paquete en el idioma pedido, como hace la plataforma. */
const ts = (locale: Locale = 'es') => (key: string) => lookup(messages[locale], key) ?? key;
/** Tira de verdad: `poolFor` → `resolve` → `explain`, para que el desglose nunca se pruebe contra datos a mano. */
const roll = (s: Record<string, unknown>, options: Record<string, unknown>, dice: RolledDice, locale: Locale = 'es') => {
  const request: RollRequest = poolFor(s, { stat: String(options.stat ?? 'combat'), options });
  return explain({ request, dice, result: resolve(request, dice, s) }, ts(locale));
};

describe('fill', () => {
  it('rellena {{clave}} y deja intacto lo que no le pasan', () => {
    expect(fill('{{a}} y {{b}}', { a: 1, b: 'dos' })).toBe('1 y dos');
    expect(fill('{{a}} y {{b}}', { a: 1 })).toBe('1 y {{b}}');
  });
});

describe('explain · de dónde salieron los dados (p.82)', () => {
  it('el ejemplo del diseño: 4 Combate − 1 por herido = 3 dados', () => {
    const s = sheet({ health: 'wounded' });
    const e = roll(s, { stat: 'combat', difficulty: 3 }, [[4, 2, 1], [4, 4, 2]]);
    expect(e?.head[0]).toEqual({ text: '4 Combate − 1 por herido = 3 dados', page: 82 });
  });
  it('suma el arma cuerpo a cuerpo y los dados extra', () => {
    const s = sheet({ weapons: [{ id: 'greatsword', ammo: null }] });
    const e = roll(s, { stat: 'combat', difficulty: 0, extraDice: 2, bonusDice: 2, weaponId: 'greatsword' }, [[4, 4, 4, 4, 4, 4, 4, 4]]);
    expect(e?.head[0]?.text).toBe('4 Combate + 2 del arma + 2 extra = 8 dados');
  });
  it('sin la ficha guardada calla la característica y sólo cuenta los dados', () => {
    const request = poolFor(sheet(), { stat: 'combat', options: { difficulty: 0 } });
    const e = explain({ request, dice: [[4, 4, 4, 4]], result: resolve(request, [[4, 4, 4, 4]]) }, ts());
    expect(e?.head[0]).toEqual({ text: '4 dados', page: 82 });
  });
  it('la Reserva de Destino sale en su propia línea (p.88)', () => {
    const s = sheet();
    const e = roll(s, { stat: 'combat', difficulty: 0, destinyDice: 2 }, [[4, 4, 4, 4], [6, 4]]);
    expect(e?.head[1]).toEqual({ text: '2 dados de la Reserva de Destino, que doblan sus triunfos', page: 88 });
  });
});

describe('explain · contra qué se tiró', () => {
  it('reto a dificultad, con el alcance cuando es un disparo (p.96)', () => {
    const s = sheet({ weapons: [{ id: 'magnum44', ammo: 6 }] });
    const e = roll(s, { stat: 'combat', weaponId: 'magnum44', ranged: true, range: 'medium', difficulty: 3 }, [[4, 4, 4, 4], [2, 2, 2]]);
    expect(e?.head.at(-1)).toEqual({ text: 'Reto a dificultad 3 · alcance medio', page: 96 });
  });
  it('sin disparo la línea no lleva alcance y apunta a la dificultad (p.84)', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 2 }, [[4, 4, 4, 4], [2, 2]]);
    expect(e?.head.at(-1)).toEqual({ text: 'Reto a dificultad 2', page: 84 });
  });
  it('sin oposición no hay línea de reto', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0 }, [[4, 4, 4, 4]]);
    expect(e?.head.some(l => l.text.includes('Reto'))).toBe(false);
  });
});

describe('explain · lo que se aplicó', () => {
  it('la especialidad, aplicada o no, con su nombre y su página (p.83)', () => {
    const s = sheet({ combat: stat(4, ['combat.shortWeapons']) });
    const on = roll(s, { stat: 'combat', difficulty: 0, specialty: true }, [[6, 4, 4, 4]]);
    expect(on?.applied[0]).toEqual({ text: 'Especialidad «Armas cortas» — aplicada: sus triunfos cuentan doble', page: 83 });
    const off = roll(s, { stat: 'combat', difficulty: 0, specialty: false }, [[6, 4, 4, 4]]);
    expect(off?.applied[0]).toEqual({ text: 'Especialidad «Armas cortas» — no aplicada por el director', page: 83 });
  });
  it('sin especialidad guardada no dice nada de ella', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0 }, [[4, 4, 4, 4]]);
    expect(e?.applied.some(l => l.text.includes('Especialidad'))).toBe(false);
  });
  it('el arma: a distancia no suma dados, cuerpo a cuerpo sí (p.96–97)', () => {
    const disparo = roll(sheet({ weapons: [{ id: 'magnum44', ammo: 6 }] }), { stat: 'combat', weaponId: 'magnum44', ranged: true, difficulty: 0 }, [[4, 4, 4, 4]]);
    expect(disparo?.applied).toContainEqual({ text: 'El arma no suma dados: a distancia no hay bonificación', page: 96 });
    const golpe = roll(sheet({ weapons: [{ id: 'greatsword', ammo: null }] }), { stat: 'combat', weaponId: 'greatsword', bonusDice: 2, difficulty: 0 }, [[4, 4, 4, 4, 4, 4]]);
    expect(golpe?.applied).toContainEqual({ text: 'El arma suma 2 dados cuerpo a cuerpo', page: 97 });
  });
  it('la armadura distingue «convirtió» de «no hizo falta» (p.98)', () => {
    const s = sheet({ armour: 'bulletproofVest', combat: stat(4) });
    const convierte = roll(s, { stat: 'combat', difficulty: 0, armourPenalty: 2 }, [[6, 6, 4, 1]]);
    expect(convierte?.applied).toContainEqual({ text: 'Chaleco antibalas — salió un fracaso, así que 2 triunfos pasan a éxito normal', page: 98 });
    // Singular y plural son dos frases distintas, no un «triunfo(s)»: el desglose se lee, no se descifra.
    const uno = roll(s, { stat: 'combat', difficulty: 0, armourPenalty: 2 }, [[6, 4, 4, 1]]);
    expect(uno?.applied).toContainEqual({ text: 'Chaleco antibalas — salió un fracaso, así que 1 triunfo pasa a éxito normal', page: 98 });
    const noHizoFalta = roll(s, { stat: 'combat', difficulty: 0, armourPenalty: 2 }, [[6, 6, 4, 4]]);
    expect(noHizoFalta?.applied).toContainEqual({ text: 'Chaleco antibalas — no hizo falta: no salió ningún fracaso', page: 98 });
  });
  it('sin armadura puesta no dice nada de armadura', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0, armourPenalty: 0 }, [[6, 1, 4, 4]]);
    expect(e?.applied.some(l => l.page === 98)).toBe(false);
  });
  it('el don activado, con su nombre (p.102)', () => {
    const e = roll(sheet(), { stat: 'will', difficulty: 0, giftId: 'healingHands' }, [[4, 4]]);
    expect(e?.applied).toContainEqual({ text: 'Don «Manos curativas» activado — cuesta 1 Fortuna', page: 102 });
  });
});

describe('explain · el cierre (p.85)', () => {
  it('el ejemplo del diseño: 1 éxito contra 2 de dificultad = grado de fallo 1', () => {
    const e = roll(sheet({ health: 'wounded' }), { stat: 'combat', difficulty: 3 }, [[4, 2, 1], [4, 4, 2]]);
    expect(e?.verdict).toBe('1 éxito contra 2 de dificultad = grado de fallo 1');
  });
  it('plural, grado de éxito y resultado ambiguo', () => {
    expect(roll(sheet(), { stat: 'combat', difficulty: 1 }, [[4, 4, 4, 4], [2]])?.verdict).toBe('4 éxitos contra 0 de dificultad = grado de éxito 4');
    expect(roll(sheet(), { stat: 'combat', difficulty: 2 }, [[4, 4, 2, 2], [4, 4]])?.verdict).toBe('2 éxitos contra 2 de dificultad = resultado ambiguo');
  });
});

describe('explain · cuándo calla del todo', () => {
  it('devuelve null para una tirada libre', () => {
    const request: RollRequest = { systemId: null, kind: 'free', title: '2D6', groups: [{ count: 2, sides: 6 }], visibility: 'table' };
    expect(explain({ request, dice: [[3, 4]], result: { summary: '' } }, ts())).toBeNull();
  });
  it('devuelve null si la petición no trae característica', () => {
    const request: RollRequest = { systemId: 'plenilunio', kind: 'system', title: 'x', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' };
    expect(explain({ request, dice: [[3, 4]], result: { summary: '' } }, ts())).toBeNull();
  });
});

describe('explain · idioma y enganche', () => {
  it('habla el idioma de quien mira', () => {
    const e = roll(sheet({ health: 'wounded' }), { stat: 'combat', difficulty: 3 }, [[4, 2, 1], [4, 4, 2]], 'en');
    expect(e?.head[0]?.text).toBe('4 Combat − 1 for wounded = 3 dice');
    expect(e?.verdict).toBe('1 success against 2 of difficulty = failure degree 1');
  });
  it('el motor lo expone como `engine.explain`', () => {
    const request = poolFor(sheet(), { stat: 'combat', options: { difficulty: 0 } });
    const result = resolve(request, [[4, 4, 4, 4]], sheet());
    expect(engine.explain?.({ request, dice: [[4, 4, 4, 4]], result }, ts())?.head).toHaveLength(1);
  });
});

describe('explain · las capacidades de una criatura (p.107–108)', () => {
  it('cuenta los éxitos automáticos y de qué capacidad salen', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0, autoSuccesses: 3, autoSuccessFrom: 'nightShelter', night: true }, [[4, 2, 2, 2]]);
    expect(e?.applied).toContainEqual({ text: 'Capacidad «Amparo de la noche» — 3 éxitos automáticos, sin tirar dados', page: 107 });
  });
  it('uno solo se dice en singular, y en inglés también', () => {
    const e = roll(sheet(), { stat: 'presence', difficulty: 0, autoSuccesses: 1, autoSuccessFrom: 'aura' }, [[2]], 'en');
    expect(e?.applied).toContainEqual({ text: 'Capacity “Aura” — 1 automatic success, no dice rolled', page: 107 });
  });
  it('sin saber de qué capacidad salieron, dice el número igualmente', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0, autoSuccesses: 2 }, [[2, 2, 2, 2]]);
    expect(e?.applied).toContainEqual({ text: '2 éxitos automáticos, sin tirar dados', page: 107 });
  });
  it('una tirada sin capacidades no gana ninguna línea', () => {
    const e = roll(sheet(), { stat: 'combat', difficulty: 0 }, [[4, 4, 4, 4]]);
    expect(e?.applied.some(l => l.text.includes('automátic'))).toBe(false);
  });
});
