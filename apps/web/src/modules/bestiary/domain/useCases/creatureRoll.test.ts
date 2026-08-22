import { describe, it, expect, vi } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { creatureAttackRequest, creatureBlastRequest, creatureRollRequest, ownDiceOf, type CreatureRollChoice } from './creatureRoll';
import type { BestiaryEntry } from '../entities/BestiaryEntry';

const poolFor = (sheet: Record<string, unknown>, action: { stat: string; options?: Record<string, unknown> }) =>
  plenilunio.engine.poolFor(sheet, action);

const ogre = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: '', tokenUrl: null, sourceRef: 'ogre',
  campaignId: 'c1', editable: true,
  data: {
    stats: { fortitude: 8, combat: 4, will: 1 }, endurance: 10, destiny: 0, protection: 3,
    abilities: [], specialties: { combat: ['ogre.club'] }, page: 152,
  },
  ...over,
});

const choice = (over: Partial<CreatureRollChoice> = {}): CreatureRollChoice =>
  ({ stat: 'combat', specialty: false, difficulty: 2, extraDice: 0, visibility: 'table', ...over });

describe('creatureRollRequest — tirar en nombre de una criatura', () => {
  /**
   * Las capacidades del bloque (p.107–108) viajan con la ficha que ve el motor: hay reglas que aplica
   * solo a partir de ellas —Piel gruesa es protección, Inmune al dolor no resta dados—, y sin este
   * paso el bloque las tendría y el motor no las vería.
   */
  it('lleva las capacidades del bloque a la ficha que ve el motor', () => {
    const withHide = ogre({ data: { ...ogre().data, capabilities: [{ id: 'thickHide', level: 3 }] } });
    const seen: Record<string, unknown>[] = [];
    creatureRollRequest(withHide, choice(), (sheet, action) => { seen.push(sheet); return poolFor(sheet, action); }, 'Combate');
    expect(seen[0]?.['capabilities']).toEqual([{ id: 'thickHide', level: 3 }]);
    // Un bloque sin capacidades manda lista vacía, no `undefined`.
    creatureRollRequest(ogre(), choice(), (sheet, action) => { seen.push(sheet); return poolFor(sheet, action); }, 'Combate');
    expect(seen[1]?.['capabilities']).toEqual([]);
  });

  it('tira los dados de SU característica, no un puñado suelto', () => {
    const req = creatureRollRequest(ogre(), choice(), poolFor, 'Combate');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(4);   // Combate 4
    expect(req.kind).toBe('system');
    expect(req.systemId).toBe(plenilunio.id);
  });

  it('la dificultad entra como dados de oposición', () => {
    const req = creatureRollRequest(ogre(), choice({ difficulty: 5 }), poolFor, 'Combate');
    expect(req.groups.find(g => g.tag === 'opposition')?.count).toBe(5);
  });

  /** Lo que justificó meter las especialidades como dato: sin esto el motor no dobla los triunfos. */
  it('lleva la especialidad SÓLO cuando el director la marca', () => {
    expect(creatureRollRequest(ogre(), choice(), poolFor, 'C').options?.['specialty']).toBe(false);
    expect(creatureRollRequest(ogre(), choice({ specialty: true }), poolFor, 'C').options?.['specialty']).toBe(true);
  });

  it('los dados extra se suman a los propios', () => {
    const req = creatureRollRequest(ogre(), choice({ extraDice: 2 }), poolFor, 'Combate');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(6);
  });

  /**
   * La Reserva de Destino es de la mesa, de los jugadores (p.88). Si una criatura cogiera dados de ahí,
   * el director le estaría robando la reserva al grupo sin que nadie lo viera.
   */
  it('nunca coge dados de la Reserva de Destino', () => {
    const req = creatureRollRequest(ogre(), choice(), poolFor, 'Combate');
    expect(req.groups.some(g => g.tag === 'destiny')).toBe(false);
    expect(req.sharedResources).toBeUndefined();
  });

  it('respeta la visibilidad que elige el director', () => {
    expect(creatureRollRequest(ogre(), choice({ visibility: 'secret' }), poolFor, 'C').visibility).toBe('secret');
    expect(creatureRollRequest(ogre(), choice({ visibility: 'dm' }), poolFor, 'C').visibility).toBe('dm');
  });

  it('el Registro dice de quién es la tirada, no sólo la característica', () => {
    expect(creatureRollRequest(ogre(), choice(), poolFor, 'Combate').title).toBe('Ogro con antorcha · Combate');
  });

  /**
   * Una criatura lleva Resistencia, no estado de salud: el manual no le resta dados por estar dañada.
   * Restárselos sería inventarse una regla, así que el bloque entra siempre «sano».
   */
  it('no le resta dados por heridas: eso es de los personajes', () => {
    const req = creatureRollRequest(ogre(), choice({ stat: 'fortitude' }), poolFor, 'Fortaleza');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(8);   // Fortaleza 8, entera
  });

  /** Un PNJ aliado tiene ficha de personaje de verdad: tira como un jugador, con lo suyo. */
  it('un PNJ aliado tira con SU ficha, no con un bloque de criatura', () => {
    const npc = ogre({
      origin: 'npc',
      data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {}, sheet: { combat: 6, health: 'healthy' } },
    });
    const req = creatureRollRequest(npc, choice(), poolFor, 'Combate');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(6);
  });
});

describe('ownDiceOf — cuántos dados salen, para poder enseñarlo antes de tirar', () => {
  it('suma los propios y deja fuera la oposición', () => {
    const req = creatureRollRequest(ogre(), choice({ difficulty: 3 }), poolFor, 'Combate');
    expect(ownDiceOf(req)).toBe(4);
  });
});

/**
 * Los ataques en caja y las capacidades (RULES.md §8.0 y §7.b.1). El ejemplo es Baal (p.126).
 */
const baal = (): BestiaryEntry => ({
  id: 'be-2', origin: 'manual', name: 'Baal', notes: '', tokenUrl: null, sourceRef: null,
  campaignId: null, editable: false,
  data: {
    stats: { fortitude: 7, combat: 8, will: 5, cunning: 4, subtlety: 5, presence: 3, culture: 8 },
    endurance: 12, destiny: 9, protection: 0, page: 126, abilities: [],
    capabilities: [{ id: 'nightShelter', level: 3 }, { id: 'blast', level: 5 }],
    attacks: [{ label: 'catalog.creatureAttacks.espadaOriental', attack: 9, damage: 10 }],
    specialties: {},
  },
});

describe('creatureRollRequest — los ataques que imprime la caja', () => {
  it('tira los dados del ataque impreso, no los de la característica', () => {
    const req = creatureRollRequest(baal(), { ...choice(), attack: baal().data.attacks![0] }, poolFor, 'Espada oriental');
    // 9 = su Combate 8 + la bonificación del arma, que es la diferencia con el ataque impreso. No se recalcula.
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(9);
    expect(req.options).toMatchObject({ weaponDamage: 10, bonusDice: 1, weaponId: 'catalog.creatureAttacks.espadaOriental' });
    expect(req.title).toBe('Baal · Espada oriental');
  });

  it('sin ataque elegido sigue tirando su característica', () => {
    const req = creatureRollRequest(baal(), choice(), poolFor, 'Combate');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(8);
    expect(req.options?.['weaponId']).toBeUndefined();
  });

  it('lleva la noche, los éxitos automáticos y la Ira solar a la tirada', () => {
    const req = creatureRollRequest(baal(),
      { ...choice(), night: true, autoSuccesses: 3, autoSuccessFrom: 'nightShelter', solarWrath: 6 }, poolFor, 'Combate');
    expect(req.options).toMatchObject({ night: true, autoSuccesses: 3, autoSuccessFrom: 'nightShelter', solarWrath: 6 });
  });
});

describe('creatureBlastRequest — la Deflagración (p.108)', () => {
  const blast = (over = {}) => ({ level: 5, metres: 2, dice: 3, difficulty: 1, visibility: 'table' as const, ...over });

  it('tira los dados que le quedan a esa distancia, contra un reto a dificultad 1', () => {
    const req = creatureBlastRequest(baal(), blast(), poolFor, 'Deflagración');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(3);
    expect(req.groups.find(g => g.tag === 'opposition')?.count).toBe(1);
    expect(req.options).toMatchObject({ difficulty: 1, weaponDamage: 5, blastLevel: 5, blastMetres: 2 });
    expect(req.title).toBe('Baal · Deflagración');
    expect(req.systemId).toBe(plenilunio.id);
  });

  /** Sin característica a propósito: el desglose prefiere callar antes que decir «3 Combate». */
  it('no viaja con característica', () => {
    expect(creatureBlastRequest(baal(), blast(), poolFor, 'Deflagración').options?.['stat']).toBeUndefined();
  });

  it('fuera del radio no hay ataque: cero dados y ningún grupo de oposición si no hay reto', () => {
    const req = creatureBlastRequest(baal(), blast({ dice: 0, difficulty: 0 }), poolFor, 'Deflagración');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(0);
    expect(req.groups.some(g => g.tag === 'opposition')).toBe(false);
  });
});

describe('creatureAttackRequest — atacar desde el token (`.pen` columna 6)', () => {
  const atk = (over = {}) => ({ dice: 4, range: 'melee' as const, difficulty: 0, visibility: 'table' as const, ...over });

  it('pone los dados que dice el director, no los suyos de oficio', () => {
    const req = creatureAttackRequest(ogre(), atk({ dice: 2 }), poolFor, 'Ogro ataca a Karen');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(2);   // reparte su Combate 4 (p.94)
    expect(req.title).toBe('Ogro ataca a Karen');
  });

  /** Cuerpo a cuerpo es un CONFLICTO (p.93): los dados de enfrente son la defensa del jugador, que aún no existe. */
  it('cuerpo a cuerpo va sin oposición', () => {
    const req = creatureAttackRequest(ogre(), atk(), poolFor, 'x');
    expect(req.groups.some(g => g.tag === 'opposition')).toBe(false);
    expect(req.options?.['ranged']).toBe(false);
  });

  it('un disparo es un reto contra la dificultad del alcance (p.96)', () => {
    const req = creatureAttackRequest(ogre(), atk({ range: 'medium', difficulty: 3 }), poolFor, 'x');
    expect(req.groups.find(g => g.tag === 'opposition')?.count).toBe(3);
    expect(req.options).toMatchObject({ ranged: true, range: 'medium' });
  });

  /** Sin ataque impreso pega sin armas, y la tabla de armas paga eso con su Fortaleza (p.97). */
  it('sin ataque impreso el daño es su Fortaleza', () => {
    expect(creatureAttackRequest(ogre(), atk(), poolFor, 'x').options).toMatchObject({
      weaponId: 'catalog.weapons.unarmed', weaponDamage: 8,
    });
  });

  it('con ataque impreso manda el daño impreso, y la Ira solar viaja aparte', () => {
    const attack = { label: 'catalog.creatureAttacks.espada', attack: 10, damage: 9 };
    const req = creatureAttackRequest(ogre(), atk({ attack, solarWrath: 3 }), poolFor, 'x');
    expect(req.options).toMatchObject({ weaponId: 'catalog.creatureAttacks.espada', weaponDamage: 9, solarWrath: 3 });
  });

  /**
   * Regresión del techo de dados extra (2026-08-21). El ataque impreso es Combate más la bonificación del
   * arma (p.97), así que va como bonificación y NO gasta del techo de dados extra del manual («uno o dos»
   * por herramientas, p.87). Con el ataque metido en `extraDice` se lo comía el techo: Luz-Malefic ataca a
   * dos manos con 10 y su Combate es 6 (p.163), y tiraba 8 dados en vez de 10.
   */
  it('el ataque impreso NO gasta del techo de dados extra: tira sus dados enteros (p.97)', () => {
    const luz = ogre({ data: { ...ogre().data, stats: { fortitude: 4, combat: 6, will: 5 } } });
    const attack = { label: 'catalog.creatureAttacks.maleficDosManos', attack: 10, damage: 10 };
    const req = creatureAttackRequest(luz, atk({ dice: 10, attack }), poolFor, 'x');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(10);
    // La diferencia con su Combate viaja donde viaja la de un arma, y no queda ni un dado extra a mano.
    expect(req.options).toMatchObject({ bonusDice: 4, extraDice: 0 });
  });

  /**
   * Y lo que el director sube A MANO sobre ese puñado sí es un dado extra, con su techo. Se capa la subida
   * y nunca la bajada: repartir su Combate entre los ataques del turno (p.94) es un `extraDice` negativo.
   */
  it('lo añadido a mano sí tiene techo, y bajar dados sigue libre (p.87, p.94)', () => {
    expect(ownDiceOf(creatureAttackRequest(ogre(), atk({ dice: 9 }), poolFor, 'x'))).toBe(6);   // Combate 4 + 2 de techo
    expect(ownDiceOf(creatureAttackRequest(ogre(), atk({ dice: 1 }), poolFor, 'x'))).toBe(1);   // bajar no se toca
  });
});
