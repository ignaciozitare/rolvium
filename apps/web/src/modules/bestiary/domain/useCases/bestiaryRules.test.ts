import { describe, it, expect } from 'vitest';
import type { CatalogItem } from '@rolvium/core';
import type { BestiaryEntry, CreatureData } from '../entities/BestiaryEntry';
import { byOrigin, canRoll, duplicateOf, emptyEntry, fromCatalog, mergeEntries, resistanceOf, specialtiesFor, toCatalogItem } from './bestiaryRules';

const data = (over: Partial<CreatureData> = {}): CreatureData =>
  ({ stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3, abilities: ['Piel gruesa 3'], specialties: { combat: ['creature.garrote'] }, ...over });

const entry = (over: Partial<BestiaryEntry> = {}): BestiaryEntry =>
  ({ id: 'e1', origin: 'custom', name: 'Ogro', data: data(), notes: '', tokenUrl: null, sourceRef: null, campaignId: 'c1', editable: true, ...over });

describe('bestiaryRules — valores de juego', () => {
  it('la Resistencia se calcula, no se guarda: Aguante × 3 (p.25)', () => {
    expect(resistanceOf({ endurance: 10 })).toBe(30);
    // El fantasma no tiene cuerpo: Aguante 0 → Resistencia 0, y eso es un valor válido, no un hueco.
    expect(resistanceOf({ endurance: 0 })).toBe(0);
  });

  /**
   * Ausente ≠ 0. El manual deja características SIN VALOR en los bloques que no publica enteros (el
   * mutante, p.98): ahí la ficha pinta «—» y el director no puede tirar. El ogro sí tiene Cultura 0,
   * que es un valor impreso y sí se puede tirar (con 0 dados). Confundirlos inventa reglas.
   */
  it('sólo se puede tirar una característica que el libro publique — 0 sí, ausente no', () => {
    const mutant = entry({ data: data({ stats: { fortitude: 3, combat: 3, will: 1 } }) });
    expect(canRoll(mutant, 'fortitude')).toBe(true);
    expect(canRoll(mutant, 'cunning')).toBe(false);
    const ogre = entry({ data: data({ stats: { fortitude: 8, culture: 0 } }) });
    expect(canRoll(ogre, 'culture')).toBe(true);
  });

  it('las especialidades salen por característica, y vacío si el bloque pone «-»', () => {
    expect(specialtiesFor(entry(), 'combat')).toEqual(['creature.garrote']);
    expect(specialtiesFor(entry(), 'culture')).toEqual([]);
  });
});

describe('bestiaryRules — las dos fuentes del listado', () => {
  it('un bloque del manual se normaliza y queda NO editable', () => {
    const item: CatalogItem = { id: 'ogre', label: 'catalog.bestiary.ogre.name', ref: 'bestiary', data: { ...data(), page: 152 } };
    const e = fromCatalog(item, 'Ogro', 'Gigante violento');
    expect(e).toMatchObject({ id: 'ogre', origin: 'manual', name: 'Ogro', editable: false, campaignId: null });
    expect(e.data.page).toBe(152);
  });

  it('un bloque del manual trae también sus capacidades y sus ataques', () => {
    const item: CatalogItem = {
      id: 'gabriel', label: 'catalog.bestiary.gabriel.name', ref: 'bestiary',
      data: { ...data(), page: 134, capabilities: [{ id: 'solarWrath', level: 3 }], attacks: [{ label: 'catalog.creatureAttacks.espada', attack: 10, damage: 9 }] },
    };
    const e = fromCatalog(item, 'Gabriel', '');
    expect(e.data.capabilities).toEqual([{ id: 'solarWrath', level: 3 }]);
    expect(e.data.attacks).toEqual([{ label: 'catalog.creatureAttacks.espada', attack: 10, damage: 9 }]);
  });

  it('un bloque incompleto no se rellena con ceros inventados', () => {
    const e = fromCatalog({ id: 'x', label: 'l', data: {} }, 'X', '');
    expect(e.data.stats).toEqual({});
    expect(e.data.specialties).toEqual({});
    expect(e.data.capabilities).toEqual([]);
    expect(e.data.attacks).toEqual([]);
    expect(e.data.page).toBeUndefined();
  });

  it('el listado une las dos fuentes en orden estable por nombre', () => {
    const merged = mergeEntries(
      [entry({ id: 'ogre', origin: 'manual', name: 'Ogro' })],
      [entry({ id: 'e2', name: 'Aliado' }), entry({ id: 'e3', name: 'Zombi' })],
    );
    expect(merged.map(e => e.name)).toEqual(['Aliado', 'Ogro', 'Zombi']);
  });

  it('los filtros del listado separan manual, propios y PNJ', () => {
    const list = [entry({ id: 'a', origin: 'manual' }), entry({ id: 'b', origin: 'custom' }), entry({ id: 'c', origin: 'npc' })];
    expect(byOrigin(list, 'all')).toHaveLength(3);
    expect(byOrigin(list, 'manual').map(e => e.id)).toEqual(['a']);
    expect(byOrigin(list, 'npc').map(e => e.id)).toEqual(['c']);
  });
});

describe('bestiaryRules — colocar en escena', () => {
  /**
   * La Resistencia viaja en `data` porque es lo que `tokenFromBestiary` de `maps` copia al estado de la
   * instancia. Si dejara de viajar, dos ogros compartirían heridas sin que nada fallara a gritos.
   */
  it('la entrada se adapta a lo que ya consume la escena, con su Resistencia', () => {
    const item = toCatalogItem(entry());
    expect(item.data).toMatchObject({ resistance: 30, protection: 3, origin: 'custom', entryId: 'e1' });
  });

  it('una criatura del manual no tiene fila, así que no enlaza a ninguna', () => {
    expect(toCatalogItem(entry({ id: 'ogre', origin: 'manual' })).data?.entryId).toBeNull();
  });
});

describe('bestiaryRules — duplicar («otro mutante»)', () => {
  it('la copia de un bloque del manual es propia y editable, y guarda de cuál salió', () => {
    const d = duplicateOf(entry({ id: 'ogre', origin: 'manual', name: 'Ogro' }), [], 'c1', 'plenilunio');
    expect(d).toMatchObject({ origin: 'custom', name: 'Ogro (2)', sourceRef: 'ogre', campaignId: 'c1' });
  });

  it('el número salta los nombres ya cogidos, no cuenta copias', () => {
    const existing = [entry({ name: 'Ogro (2)' }), entry({ name: 'Ogro (3)' })];
    expect(duplicateOf(entry({ name: 'Ogro' }), existing, 'c1', 'plenilunio').name).toBe('Ogro (4)');
    // Duplicar una copia no encadena paréntesis: «Ogro (2)» → «Ogro (4)», no «Ogro (2) (2)».
    expect(duplicateOf(entry({ name: 'Ogro (2)' }), existing, 'c1', 'plenilunio').name).toBe('Ogro (4)');
  });

  it('duplicar una copia conserva la referencia al bloque original, no a la copia', () => {
    const copy = entry({ id: 'e9', origin: 'custom', sourceRef: 'ogre' });
    expect(duplicateOf(copy, [], null, 'plenilunio').sourceRef).toBe('ogre');
  });

  it('la copia no comparte los datos con el original', () => {
    const src = entry();
    const d = duplicateOf(src, [], 'c1', 'plenilunio');
    d.data.endurance = 99;
    expect(src.data.endurance).toBe(10);
  });

  it('«guardar para todas mis campañas» se representa sin campaña', () => {
    expect(duplicateOf(entry(), [], null, 'plenilunio').campaignId).toBeNull();
    expect(emptyEntry(null, 'plenilunio', 'Nuevo').campaignId).toBeNull();
  });

  it('un PNJ con ficha duplicado sigue siendo PNJ, no se degrada a encuentro', () => {
    expect(duplicateOf(entry({ origin: 'npc' }), [], 'c1', 'plenilunio').origin).toBe('npc');
  });
});
