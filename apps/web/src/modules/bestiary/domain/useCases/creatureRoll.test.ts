import { describe, it, expect, vi } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { creatureRollRequest, ownDiceOf, type CreatureRollChoice } from './creatureRoll';
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
