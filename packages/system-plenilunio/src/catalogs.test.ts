import { describe, expect, it } from 'vitest';
import { ARMOURS, BESTIARY, CAPABILITIES, CAPABILITY_IDS, CREATURE_SPECIALTY_ITEMS, DIFFICULTIES, GIFTS, GIFT_IDS, MELEE_METRES, RANGE_DIFFICULTY, RANGES, rangeForMetres, RECOVERY, SIZES, SPECIALTIES, SPECIALTY_ITEMS, STAT_IDS, WEAPONS, capabilityLevel, catalogs, hasCapability, isMelee, specialtiesFor, specialtyById, weaponById } from './catalogs';
import { references } from './references';
import { lookup, messages } from './locales';

const resolves = (key: string) => { for (const loc of ['es', 'en'] as const) expect(lookup(messages[loc], key), `${loc}:${key}`).toBeTruthy(); };

describe('catalogs', () => {
  it('has 27 gifts with name and summary in both locales', () => {
    expect(GIFT_IDS).toHaveLength(27);
    expect(GIFTS).toHaveLength(27);
    expect(new Set(GIFT_IDS).size).toBe(27);
    for (const g of GIFTS) { resolves(g.label); resolves(String(g.data?.summary)); }
  });
  it('weapons: 20 entries, melee/ranged split, F+n vs fixed damage, ammo', () => {
    expect(WEAPONS).toHaveLength(20);
    const melee = WEAPONS.filter(w => isMelee(w.data));
    expect(melee).toHaveLength(9);
    expect(WEAPONS.length - melee.length).toBe(11);
    expect(weaponById('bat')?.data).toEqual({ bonus: 1, damage: 1, strength: true, range: 'melee', magazine: null });
    expect(weaponById('magnum44')?.data).toEqual({ bonus: 1, damage: 7, strength: false, range: 'medium', magazine: 6 });
    expect(weaponById('crossbow')?.data.strength).toBe(false);
    expect(weaponById('nope')).toBeNull();
    for (const w of WEAPONS) resolves(w.label);
  });
  it('armours: 10 entries with protection/penalty', () => {
    expect(ARMOURS).toHaveLength(10);
    expect(ARMOURS.find(a => a.id === 'bulletproofVest')?.data).toEqual({ protection: 6, penalty: 2 });
    for (const a of ARMOURS) resolves(a.label);
  });
  it('p.21–22 specialties per stat (19/21/18/21/16/16/16) with labels in both locales', () => {
    expect(Object.keys(SPECIALTIES)).toEqual([...STAT_IDS]);
    expect(STAT_IDS.map(s => SPECIALTIES[s].length)).toEqual([19, 21, 18, 21, 16, 16, 16]);
    expect(specialtiesFor('culture')).toHaveLength(16);
    expect(SPECIALTIES.combat).toContain('nets');
    for (const s of SPECIALTY_ITEMS) resolves(s.label);
  });
  it('p.97 weapons table values', () => {
    const t = Object.fromEntries(WEAPONS.map(w => [w.id, [w.data.bonus, w.data.damage, w.data.strength, w.data.range, w.data.magazine]]));
    expect(t.unarmed).toEqual([0, 0, true, 'melee', null]);
    expect(t.swordSpear).toEqual([1, 2, true, 'melee', null]);
    expect(t.maceAxe).toEqual([0, 3, true, 'melee', null]);
    expect(t.greatsword).toEqual([2, 3, true, 'melee', null]);
    expect(t.twoHandedAxe).toEqual([1, 4, true, 'melee', null]);
    expect(t.compoundBow).toEqual([0, 3, true, 'long', 1]);
    expect(t.crossbow).toEqual([0, 5, false, 'medium', 1]);
    expect(t.pistol9mm).toEqual([1, 6, false, 'medium', 15]);
    expect(t.shotgun10).toEqual([1, 10, false, 'medium', 5]);
    expect(t.shotgun12).toEqual([1, 9, false, 'medium', 5]);
    expect(t.assaultRifle).toEqual([1, 8, false, 'long', 30]);
    expect(t.sniperRifle).toEqual([0, 10, false, 'veryLong', 15]);
    expect(t.grenades).toEqual([0, 8, false, 'short', 1]);
  });
  it('p.98 armours table values', () => {
    expect(Object.fromEntries(ARMOURS.map(a => [a.id, [a.data.protection, a.data.penalty]]))).toEqual({
      none: [0, 0], leatherJacket: [1, 1], leatherArmour: [2, 1], breastplate: [3, 1], furs: [3, 2], mailShirt: [5, 3], bulletproofVest: [6, 2],
      smallShield: [1, 0], largeShield: [2, 1], riotShield: [3, 2],
    });
  });
  it('p.25 sizes, p.84 difficulties, p.96 range difficulties, p.101 recovery table', () => {
    expect(SIZES.map(s => s.mod)).toEqual([-2, -1, 0, 1, 2]);
    expect(DIFFICULTIES.map(d => d.value)).toEqual([1, 2, 3, 5, 6]);
    expect(RANGE_DIFFICULTY).toEqual({ short: 2, medium: 3, long: 5, veryLong: 6 });
    // Los mismos alcances, ya en `catalogs` y EN ORDEN: el orden es lo que dice cuáles quedan fuera del
    // arma en el desplegable de disparar, así que si alguien los reordena aquí, esto lo caza.
    expect(RANGES.map(r => r.id)).toEqual(['short', 'medium', 'long', 'veryLong']);
    expect(RANGES.map(r => r.data.difficulty)).toEqual([2, 3, 5, 6]);
    expect(catalogs.ranges).toBe(RANGES);
    expect(RECOVERY.bruised).toEqual({ days: 1, difficulty: 2, restFactor: 3 });
    expect(RECOVERY.wounded).toEqual({ days: 7, difficulty: 3, restFactor: 2 });
    expect(RECOVERY.badlyWounded).toEqual({ days: 14, difficulty: 4, restFactor: 1 });
  });
  /**
   * El bestiario son BLOQUES DEL MANUAL copiados uno a uno, no plantillas nuestras: el director tiene que poder
   * coger un encuentro y tirar por él (dueño, 2026-08-20). Antes había cuatro entradas con sólo Resistencia y
   * protección —y dos, `loner` y `scavenger`, inventadas—, así que no se podía tirar nada.
   */
  it('cada criatura trae el bloque del manual: siete características, Aguante, Destino y página', () => {
    expect(BESTIARY.length).toBeGreaterThanOrEqual(16);
    for (const b of BESTIARY) {
      resolves(b.label); resolves(b.data.notes);
      expect(b.data.page, b.id).toBeGreaterThan(0);
      expect(b.data.resistance, b.id).toBe(b.data.endurance * 3);   // Resistencia = Aguante × 3 (p.25)
      expect(b.data.destiny, b.id).toBeGreaterThanOrEqual(0);
      for (const [k, v] of Object.entries(b.data.stats)) expect(v, `${b.id}.${k}`).toBeGreaterThanOrEqual(0);
    }
    // Ogro p.152: Fortaleza 8, Combate 4, Aguante 10 → Resistencia 30; su Piel gruesa 3 es protección 3 (p.108).
    expect(BESTIARY.find(b => b.id === 'ogre')?.data).toMatchObject({ endurance: 10, resistance: 30, protection: 3, page: 152 });
    expect(BESTIARY.find(b => b.id === 'ogre')?.data.stats).toMatchObject({ fortitude: 8, combat: 4 });
    // Hambriento p.150.
    expect(BESTIARY.find(b => b.id === 'hungry')?.data.stats).toMatchObject({ fortitude: 3, combat: 3, cunning: 4 });
    // Del mutante el libro sólo publica tres características: las demás NO se inventan.
    const mutant = BESTIARY.find(b => b.id === 'mutant')!;
    expect(mutant.data).toMatchObject({ endurance: 4, resistance: 12, protection: 2 });
    expect(Object.keys(mutant.data.stats).sort()).toEqual(['combat', 'fortitude', 'will']);
    // El fantasma no tiene cuerpo: Fortaleza y Combate a 0, y Aguante 0 (p.149).
    expect(BESTIARY.find(b => b.id === 'ghost')?.data).toMatchObject({ endurance: 0, resistance: 0, destiny: 10 });
  });
  /**
   * Las especialidades de las criaturas, como DATO (dueño, 2026-08-20). El manual las imprime dentro del propio
   * bloque, una por característica —el ogro «Fortaleza 8: Derribar paredes», «Combate 4: Garrote»— y sin ellas el
   * motor no puede doblarles los triunfos (p.83) aunque ya sepa hacerlo. Se fija aquí que sean ids REALES: el
   * fallo que importa es una especialidad escrita a mano que no resuelve a ninguna etiqueta y sale en blanco.
   */
  it('cada especialidad de criatura es un id real, de jugador o propia de criatura', () => {
    const known = new Set([...SPECIALTY_ITEMS, ...CREATURE_SPECIALTY_ITEMS].map(i => i.id));
    for (const b of BESTIARY) {
      for (const [stat, ids] of Object.entries(b.data.specialties)) {
        expect(STAT_IDS, `${b.id}.${stat}`).toContain(stat);
        for (const id of ids) expect(known.has(id), `${b.id}.${stat} → ${id}`).toBe(true);
        // Una especialidad sin puntuación no puede existir: el bloque pone «-» donde la característica es 0.
        expect(b.data.stats[stat as keyof typeof b.data.stats], `${b.id}.${stat} sin puntuación`).toBeDefined();
      }
    }
    for (const it of CREATURE_SPECIALTY_ITEMS) resolves(it.label);
  });
  it('las especialidades reutilizan la clave de jugador cuando el nombre coincide', () => {
    // «Ocultismo» y «Percepción» ya existían como especialidad de jugador: NO se duplican con clave nueva.
    expect(BESTIARY.find(b => b.id === 'ghost')!.data.specialties).toMatchObject({ culture: ['culture.occultism'], cunning: ['cunning.perception'] });
    // «Garrote» y «Mordisco» no las tiene ningún personaje: clave propia de criatura.
    expect(BESTIARY.find(b => b.id === 'ogre')!.data.specialties).toMatchObject({ fortitude: ['creature.derribarParedes'], combat: ['creature.garrote'] });
    expect(BESTIARY.find(b => b.id === 'hungry')!.data.specialties.combat).toEqual(['creature.mordisco']);
    // Un bloque puede traer DOS en la misma característica (Trece Lunas: «Acrobacias, Equilibrio»).
    expect(BESTIARY.find(b => b.id === 'thirteenMoonsSister')!.data.specialties.fortitude).toHaveLength(2);
    // Del mutante el libro no imprime bloque: ni características completas ni especialidades. No se inventan.
    expect(BESTIARY.find(b => b.id === 'mutant')!.data.specialties).toEqual({});
  });
  /**
   * Los 8 bloques que le faltaban al catálogo, encontrados leyendo el PDF para sacar las especialidades. El
   * comentario decía «los 37 bloques completos, contados uno a uno sobre el PDF» y eran 45.
   */
  it('están los 45 bloques en lista y los 12 en caja: 57', () => {
    expect(BESTIARY).toHaveLength(57);
    // Azelías, el segundo lugarteniente solar: mismo bloque que Aamel salvo Aura e Ira solar (p.132).
    expect(BESTIARY.find(b => b.id === 'azelias')?.data).toMatchObject({ endurance: 10, destiny: 8, page: 132 });
    /**
     * En el PDF la línea de capacidades de estos dos ENVUELVE a una segunda línea («…Piel de / humano,
     * Amparo de la noche N.») y al copiarla se cortó por la mitad: los dos se quedaron sin «Amparo de la
     * noche», que de noche les añade éxitos automáticos al Combate (p.107). Verificado contra el PDF el
     * 2026-08-21 a petición del dueño. Este test es el pin para que no se vuelva a caer.
     */
    expect(BESTIARY.find(b => b.id === 'lunar')?.data.abilities).toEqual(['Alado', 'Aura sombría 2', 'Piel de humano', 'Amparo de la noche 2']);
    expect(BESTIARY.find(b => b.id === 'fallenElite')?.data.abilities).toEqual(['Alado', 'Aura sombría 3', 'Piel de humano', 'Amparo de la noche 3']);
    // George es el TERCER cocinero caníbal: el catálogo sólo tenía a Maggie (p.68) y a Will (`cannibalCook`, p.69).
    expect(BESTIARY.find(b => b.id === 'george')?.data).toMatchObject({ endurance: 4, destiny: 7, page: 68 });
    // Diane es la segunda carroñera: `scavenger` es Kharla (p.74).
    expect(BESTIARY.find(b => b.id === 'diane')?.data.stats).toMatchObject({ combat: 3, cunning: 3 });
    for (const id of ['azelias', 'silhouette', 'bigDima', 'thirteenMoonsSister', 'jacobite', 'george', 'diane', 'allenDallas'])
      expect(BESTIARY.find(b => b.id === id), id).toBeDefined();
  });
  it('every catalog label and every reference resolves in es and en', () => {
    for (const items of Object.values(catalogs)) for (const it of items) { resolves(it.label); if (it.ref) expect(references[it.ref], it.ref).toBeDefined(); }
    for (const [key, r] of Object.entries(references)) { expect(r.page).toBeGreaterThan(0); resolves(r.title); resolves(r.summary); expect(r.title).toBe(`ref.${key}.title`); }
  });
  it('specialtyById encuentra las de jugador y las de criatura, y nada más', () => {
    expect(specialtyById('combat.shortWeapons')?.label).toBe('catalog.specialties.combat.shortWeapons');
    expect(specialtyById('creature.garrote')?.label).toBe('catalog.creatureSpecialties.garrote');
    expect(specialtyById('noExiste')).toBeNull();
  });
  /**
   * Los DOCE bloques en caja (RULES.md §8.0): los once personajes con nombre —que el libro imprime en cajas de
   * lunas, no en lista, y por eso no se copiaron con los otros 45— y el Salteador de la aventura de ejemplo.
   * Leídos del PDF página a página como imagen el 2026-08-21, porque `pdftotext` parte las cajas.
   */
  it('los doce bloques en caja traen sus siete características, Aguante, Destino y ataques', () => {
    for (const id of ['nathael', 'luz', 'soum', 'nergal', 'samael', 'lucifer', 'baal', 'gabriel', 'marduk', 'adam', 'luzMalefic', 'highwayman'])
      expect(BESTIARY.find(b => b.id === id), id).toBeDefined();
    // Marduk p.136: el más fuerte de los solares, Combate 10.
    expect(BESTIARY.find(b => b.id === 'marduk')?.data).toMatchObject({ endurance: 11, destiny: 8, page: 136 });
    expect(BESTIARY.find(b => b.id === 'marduk')?.data.stats).toEqual({ fortitude: 8, combat: 10, will: 4, cunning: 3, subtlety: 3, presence: 6, culture: 6 });
    // El escudo de Gabriel NO es un ataque: es protección 5 (p.134).
    const gabriel = BESTIARY.find(b => b.id === 'gabriel')!;
    expect(gabriel.data.protection).toBe(5);
    expect(gabriel.data.attacks).toEqual([{ label: 'catalog.creatureAttacks.espada', attack: 10, damage: 9 }]);
    // Los ataques se COPIAN, no se recalculan: Nergal tiene Fortaleza 6 y su martillo hace 10, no 9 (§8.0).
    expect(BESTIARY.find(b => b.id === 'nergal')?.data.attacks[0]).toMatchObject({ attack: 10, damage: 10 });
    expect(BESTIARY.find(b => b.id === 'lucifer')?.data.attacks[0]).toMatchObject({ attack: 11, damage: 12 });
    // Malefic (p.163): a una mano 8, a dos manos 10 y cuesta 1 de Fortuna.
    expect(BESTIARY.find(b => b.id === 'luzMalefic')?.data.attacks).toEqual([
      { label: 'catalog.creatureAttacks.maleficUnaMano', attack: 8, damage: 8 },
      { label: 'catalog.creatureAttacks.maleficDosManos', attack: 10, damage: 10, fortuneCost: 1 },
    ]);
    // Soum lleva dos ataques; el Salteador ninguno («elige las armas de la tabla de la p.97»).
    expect(BESTIARY.find(b => b.id === 'soum')?.data.attacks).toHaveLength(2);
    expect(BESTIARY.find(b => b.id === 'highwayman')?.data.attacks).toEqual([]);
    for (const b of BESTIARY) for (const a of b.data.attacks) {
      resolves(a.label);
      expect(a.attack, `${b.id} ataque`).toBeGreaterThan(0);
      expect(a.damage, `${b.id} daño`).toBeGreaterThan(0);
    }
  });
  it('las quince capacidades del libro, con nombre y resumen en los dos idiomas', () => {
    expect(CAPABILITY_IDS).toHaveLength(15);
    expect(new Set(CAPABILITY_IDS).size).toBe(15);
    for (const c of CAPABILITIES) { resolves(c.label); resolves(c.data.summary); }
    // Las siete que puntúan son las del `*` de la p.107.
    expect(CAPABILITIES.filter(c => c.data.scored).map(c => c.id))
      .toEqual(['aura', 'darkAura', 'nightShelter', 'solarWrath', 'venom', 'thickHide', 'blast']);
    // Las cuatro que dependen de la hora: el Aura sólo de día, las dos nocturnas sólo de noche.
    expect(CAPABILITIES.filter(c => c.data.timeOfDay === 'day').map(c => c.id)).toEqual(['aura']);
    expect(CAPABILITIES.filter(c => c.data.timeOfDay === 'night').map(c => c.id)).toEqual(['darkAura', 'nightShelter']);
    expect(hasCapability([{ id: 'thickHide', level: 3 }], 'thickHide')).toBe(true);
    expect(hasCapability([{ id: 'thickHide', level: 3 }], 'blast')).toBe(false);
    expect(capabilityLevel([{ id: 'thickHide', level: 3 }], 'thickHide')).toBe(3);
    expect(capabilityLevel([{ id: 'winged' }], 'winged')).toBe(0);
    expect(capabilityLevel(undefined, 'aura')).toBe(0);
  });
  /**
   * `abilities` es la línea impresa del bloque y `capabilities` el mismo contenido como dato: si una se
   * corrige y la otra no, el director lee una cosa y el motor aplica otra. Este test las ata leyendo los
   * NOMBRES en español del propio catálogo, así que también caza una capacidad mal escrita o un don que
   * no existe. Es el test de paridad que pedía el plan (WORK_STATE, tanda 1).
   */
  it('la línea impresa y las capacidades como dato dicen lo mismo', () => {
    const es = messages.es as Record<string, never>;
    const nameOf = (key: string) => String(lookup(es, key));
    const byName = new Map(CAPABILITY_IDS.map(id => [nameOf(`catalog.capabilities.${id}.name`), id]));
    const giftNames = new Set(GIFT_IDS.map(id => nameOf(`catalog.gifts.${id}.name`)));
    /** «Aura sobrenatural» sólo sale en la caja de Nathael y no está en la lista de pp.107–108: se trata
     *  como «Aura», porque todos los demás solares del libro la llevan (decisión del dueño, 2026-08-21). */
    const ALIAS: Record<string, string> = { 'Aura sobrenatural': 'aura' };
    /** La «piel curtida» del mutante es la descripción del libro (p.98), no una capacidad de la lista;
     *  su efecto ya está donde tiene que estar, en `protection`. */
    const NOT_A_CAPABILITY = ['Piel curtida'];
    for (const b of BESTIARY) {
      const seen: string[] = [];
      for (const line of b.data.abilities) {
        const m = /^(.*?)(?:\s+(\d+))?$/.exec(line);
        const name = m?.[1] ?? line;
        const level = m?.[2] === undefined ? undefined : Number(m[2]);
        if (NOT_A_CAPABILITY.includes(name)) continue;
        const id = ALIAS[name] ?? byName.get(name);
        if (!id) { expect(giftNames.has(name), `${b.id}: «${line}» no es ni capacidad ni don`).toBe(true); continue; }
        seen.push(id);
        const cap = b.data.capabilities.find(c => c.id === id);
        expect(cap, `${b.id}: «${line}» falta en capabilities`).toBeDefined();
        expect(cap!.level, `${b.id}: nivel de «${line}»`).toBe(level);
      }
      // Y al revés: ninguna capacidad de dato sin su línea impresa.
      expect(b.data.capabilities.map(c => c.id).sort(), `${b.id}: capacidades de más`).toEqual(seen.sort());
    }
    // Dos que importan: el ogro (Piel gruesa 3 = su protección) y Baal, el único con Deflagración.
    expect(BESTIARY.find(b => b.id === 'ogre')!.data.capabilities).toEqual([{ id: 'thickHide', level: 3 }]);
    expect(BESTIARY.find(b => b.id === 'baal')!.data.capabilities).toContainEqual({ id: 'blast', level: 5 });
    // El fantasma lleva DOS capacidades y un don: el don no entra en `capabilities`.
    expect(BESTIARY.find(b => b.id === 'ghost')!.data.capabilities).toEqual([{ id: 'earthlyAnchor' }, { id: 'incorporeal' }]);
  });
  it('las siete especialidades nuevas de las cajas tienen clave e etiqueta', () => {
    for (const id of ['vuelo', 'espadaSamurai', 'martilloDeGuerra', 'espadasSamurais', 'recorrerDistancias', 'espadaYEscudo', 'sables'])
      expect(specialtyById(`creature.${id}`), id).not.toBeNull();
    // Reutilizan clave las que ya existían: «Cuchillos» de Soum es la de criatura, no `combat.knives` («Navajas y cuchillos»).
    expect(BESTIARY.find(b => b.id === 'soum')!.data.specialties.combat).toEqual(['creature.cuchillos', 'combat.swords']);
    expect(BESTIARY.find(b => b.id === 'nathael')!.data.specialties.fortitude).toEqual(['creature.vuelo']);
  });
  it('el alcance sale de los metros (p.95–96), y más allá del muy largo no se dispara', () => {
    expect(rangeForMetres(0)).toBe('melee');
    expect(rangeForMetres(MELEE_METRES)).toBe('melee');       // dos casillas del mapa, lectura nuestra
    expect(rangeForMetres(3.1)).toBe('short');
    expect(rangeForMetres(20)).toBe('short');
    expect(rangeForMetres(21)).toBe('medium');
    expect(rangeForMetres(50)).toBe('medium');
    expect(rangeForMetres(200)).toBe('long');
    expect(rangeForMetres(800)).toBe('veryLong');
    expect(rangeForMetres(801)).toBeNull();
    // Cada alcance lleva su tope y su dificultad juntos, para que el mapa no tenga que saber la tabla.
    expect(RANGES.map(r => r.data)).toEqual([
      { difficulty: 2, maxMetres: 20 }, { difficulty: 3, maxMetres: 50 },
      { difficulty: 5, maxMetres: 200 }, { difficulty: 6, maxMetres: 800 },
    ]);
  });
  it('reference pages match RULES.md §9', () => {
    const pages = Object.fromEntries(Object.entries(references).map(([k, r]) => [k, r.page]));
    expect(pages).toEqual({
      stats: 20, specialty: 83, roll: 82, difficulty: 84, degree: 85, setback: 86, destinyPool: 88, destiny: 88, fortune: 89,
      endurance: 98, resistance: 98, health: 99, damage: 97, weapons: 97, melee: 93, ranged: 96, armours: 98, recovery: 101, gifts: 102, xp: 91, size: 25,
      bestiary: 107,
    });
  });
});
