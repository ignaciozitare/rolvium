// ─── Catalogs · Malefic Time: Plenilunio ─────────────────────────────────────
// Game values (weapons p.97, armours p.98, gifts p.102+, specialties p.21–22,
// sizes p.25) as data. Labels are i18n keys of this package (`catalog.*`);
// no manual text is reproduced here — see references.ts / locales.ts.
import type { CatalogItem, Catalogs } from '@rolvium/core';

// ─── Stats ───────────────────────────────────────────────────────────────────
/** The seven characteristics, in sheet order (manual p.20). */
export const STAT_IDS = ['fortitude', 'combat', 'will', 'cunning', 'subtlety', 'presence', 'culture'] as const;
export type StatId = (typeof STAT_IDS)[number];
export const isStatId = (v: unknown): v is StatId => typeof v === 'string' && (STAT_IDS as readonly string[]).includes(v);

// ─── Health levels ───────────────────────────────────────────────────────────
/** Health levels and their dice penalty (manual p.98–99). Order matters: index = severity. Unconscious (Resistance spent) is a separate flag. */
export const HEALTH_LEVELS = [
  { id: 'healthy', penalty: 0 },
  { id: 'bruised', penalty: 0 },
  { id: 'wounded', penalty: 1 },
  { id: 'badlyWounded', penalty: 2 },
  { id: 'dead', penalty: 0 },
] as const;
export type HealthId = (typeof HEALTH_LEVELS)[number]['id'];
export const HEALTH_IDS = HEALTH_LEVELS.map(h => h.id) as HealthId[];

// ─── Sizes ───────────────────────────────────────────────────────────────────
/** Size modifier applied to Endurance (manual p.25). */
export const SIZES = [
  { id: 'tiny', mod: -2 }, { id: 'small', mod: -1 }, { id: 'medium', mod: 0 }, { id: 'large', mod: 1 }, { id: 'huge', mod: 2 },
] as const;
export type SizeId = (typeof SIZES)[number]['id'];

// ─── Weapons (manual p.97) ───────────────────────────────────────────────────
export type WeaponRange = 'melee' | 'short' | 'medium' | 'long' | 'veryLong';
export interface WeaponData {
  /** Extra dice on the Combat roll. Applies in melee only. */
  bonus: number;
  /** Damage per triumph: `strength: true` → Fortitude + damage; else fixed. */
  damage: number;
  strength: boolean;
  range: WeaponRange;
  /** Rounds per magazine; null for weapons without ammo. */
  magazine: number | null;
}
const w = (id: string, bonus: number, damage: number, strength: boolean, range: WeaponRange, magazine: number | null): CatalogItem & { data: WeaponData } =>
  ({ id, label: `catalog.weapons.${id}`, ref: 'weapons', data: { bonus, damage, strength, range, magazine } });

export const WEAPONS = [
  w('unarmed', 0, 0, true, 'melee', null),
  w('knuckles', 0, 1, true, 'melee', null),
  w('knife', 0, 1, true, 'melee', null),
  w('bat', 1, 1, true, 'melee', null),
  w('staff', 1, 1, true, 'melee', null),
  w('swordSpear', 1, 2, true, 'melee', null),
  w('maceAxe', 0, 3, true, 'melee', null),
  w('greatsword', 2, 3, true, 'melee', null),
  w('twoHandedAxe', 1, 4, true, 'melee', null),
  w('slingshot', 0, 1, true, 'medium', 1),
  w('compoundBow', 0, 3, true, 'long', 1),
  w('crossbow', 0, 5, false, 'medium', 1),
  w('pistol9mm', 1, 6, false, 'medium', 15),
  w('magnum44', 1, 7, false, 'medium', 6),
  w('smg', 1, 8, false, 'medium', 30),
  w('shotgun12', 1, 9, false, 'medium', 5),
  w('shotgun10', 1, 10, false, 'medium', 5),
  w('assaultRifle', 1, 8, false, 'long', 30),
  w('sniperRifle', 0, 10, false, 'veryLong', 15),
  w('grenades', 0, 8, false, 'short', 1),
];
export const isMelee = (d: WeaponData) => d.range === 'melee';

// ─── Armours (manual p.98) ───────────────────────────────────────────────────
export interface ArmourData { protection: number; penalty: number }
const a = (id: string, protection: number, penalty: number): CatalogItem & { data: ArmourData } =>
  ({ id, label: `catalog.armours.${id}`, ref: 'armours', data: { protection, penalty } });
export const ARMOURS = [
  a('none', 0, 0), a('leatherJacket', 1, 1), a('leatherArmour', 2, 1), a('breastplate', 3, 1), a('furs', 3, 2),
  a('mailShirt', 5, 3), a('bulletproofVest', 6, 2), a('smallShield', 1, 0), a('largeShield', 2, 1), a('riotShield', 3, 2),
];

// ─── Equipment ───────────────────────────────────────────────────────────────
export const EQUIPMENT_IDS = [
  'dynamoTorch', 'improvisedFirstAidKit', 'rope15m', 'lockpicks', 'portableTorch', 'gasMask', 'shortwaveRadio', 'canteen',
  'sleepingBag', 'binoculars', 'ductTape', 'fuelCan', 'looseAmmo', 'rationsThreeDays', 'multitool', 'flintLighter', 'notebookPencil', 'coarseSalt',
] as const;
export const EQUIPMENT: CatalogItem[] = EQUIPMENT_IDS.map(id => ({ id, label: `catalog.equipment.${id}` }));

// ─── Gifts (manual p.102–107) ────────────────────────────────────────────────
/** 27 gifts (activation 1 Fortune, levels 1–5). Names are game values; the summary key holds our own one-liner. */
export const GIFT_IDS = [
  'realityAllegory', 'steelDefense', 'meltIntoShadows', 'titanFury', 'illOmenGesture', 'preciseStrike', 'wordGuardian',
  'spiritThreads', 'beastTongue', 'spiritualCleansing', 'innerSpring', 'immaterialHand', 'healingHands', 'protectionMantle',
  'felineMoves', 'shedSkin', 'eyesOfTime', 'wordOfDoom', 'unknownDoor', 'revealWeakness', 'lifeTheft', 'spiritualSeparation',
  'serendipity', 'knowledgeWeb', 'destinyTrance', 'seeTheSigns', 'innerVoice',
] as const;
export type GiftId = (typeof GIFT_IDS)[number];
export const GIFT_MAX_LEVEL = 5;
/**
 * Canjes de un punto de característica. Especialidades (p.23): «solo se puede gastar un único punto
 * de característica de este modo, pero si el director de juego lo permite, el jugador podría cambiar
 * un segundo punto». Dones (p.25) no lleva cláusula de límite y se lee calcado a especialidades —
 * ⚠ interpretación del dueño, declarada en RULES.md §1.5.
 *
 * Viven aquí, y no en `generator.ts`, porque el tope tiene que regir las DOS lecturas de la regla: el
 * presupuesto de creación (`budgetOf`) y los puntos de don de la ficha viva (`derived`). Cuando sólo
 * lo aplicaba el generador, una ficha guardada con más canjes enseñaba puntos de don inflados para
 * siempre — hallazgo del QA, 2026-08-19. `generator.ts` no puede ser la casa: `engine.ts` no puede
 * importar de él sin ciclo.
 */
export const MAX_SPECIALTY_TRADES = 2;
export const MAX_GIFT_TRADES = 2;
export const GIFTS: CatalogItem[] = GIFT_IDS.map(id => ({
  id, label: `catalog.gifts.${id}.name`, ref: 'gifts', data: { summary: `catalog.gifts.${id}.summary`, maxLevel: GIFT_MAX_LEVEL },
}));

// ─── Specialties per stat (manual p.21–22; open list, 19/21/18/21/16/16/16 entries) ──
export const SPECIALTIES: Record<StatId, readonly string[]> = {
  fortitude: ['acrobatics', 'athletics', 'drinking', 'diving', 'carrying', 'cycling', 'dancing', 'breakingDoors', 'balance', 'escapology', 'sprinting', 'stayingAwake', 'riding', 'swimming', 'parkour', 'jumping', 'climbing', 'vigour', 'breakingFree'],
  combat: ['bows', 'thrownWeapons', 'bluntWeapons', 'shortWeapons', 'improvisedWeapons', 'heavyWeapons', 'martialArts', 'crossbows', 'staves', 'shotguns', 'shields', 'swords', 'axes', 'spears', 'wrestling', 'maces', 'knives', 'dirtyFighting', 'nets', 'rifles', 'submachineGuns'],
  will: ['divination', 'selfEsteem', 'concentration', 'constancy', 'fanaticism', 'faith', 'hypnosis', 'innocence', 'integrity', 'intuition', 'keepingFace', 'meditation', 'patience', 'perseverance', 'painResistance', 'rites', 'temperance', 'courage'],
  cunning: ['anticipation', 'searching', 'streetwise', 'carpentry', 'cooking', 'driving', 'lieDetection', 'riddles', 'animalTraining', 'smithing', 'investigation', 'movingBlind', 'orientation', 'perception', 'piloting', 'dangerSense', 'timeSense', 'lightSleep', 'survival', 'vigilance', 'keenSight'],
  subtlety: ['acting', 'camouflage', 'blackmail', 'disguise', 'dissembling', 'ambush', 'hiding', 'feigning', 'imitation', 'gambling', 'knack', 'silentMovement', 'concealment', 'haggling', 'shadowing', 'ventriloquism'],
  presence: ['singing', 'charlatanry', 'courtesy', 'empathy', 'eroticism', 'humour', 'inspiring', 'interrogation', 'intimidation', 'leadership', 'mime', 'negotiation', 'poetry', 'seduction', 'torture', 'animalHandling'],
  culture: ['art', 'sciences', 'history', 'humanities', 'languages', 'computing', 'legends', 'medicine', 'newYork', 'occultism', 'firstAid', 'psychology', 'religion', 'tactics', 'technology', 'conspiracyTheory'],
};
/** Flat catalog of specialties; `data.stat` says which characteristic they belong to. */
export const SPECIALTY_ITEMS: CatalogItem[] = STAT_IDS.flatMap(stat =>
  SPECIALTIES[stat].map(id => ({ id: `${stat}.${id}`, label: `catalog.specialties.${stat}.${id}`, ref: 'specialty', data: { stat } })));
export const specialtiesFor = (stat: StatId): CatalogItem[] => SPECIALTY_ITEMS.filter(s => s.data?.stat === stat);

// ─── Capacidades de las criaturas (manual p.107–108) ─────────────────────────
/**
 * Poderes innatos de las criaturas no humanas: «no requieren activarse ni involucran gasto de Fortuna.
 * Simplemente pueden usarse a voluntad» (p.107). Son las quince de la lista del libro, ni una más.
 *
 * Van como DATO, y no sólo como la línea de texto del bloque (`BestiaryData.abilities`), porque el motor
 * tiene que poder aplicarlas: la Ira solar suma daño, el Amparo de la noche da éxitos automáticos, el
 * Ancla terrenal impide morir. La línea impresa se queda igualmente, tal y como la imprime la caja,
 * porque además de capacidades trae DONES (§7), que no son lo mismo y cuestan Fortuna. Un test de
 * paridad ata las dos para que no se separen nunca.
 *
 * `scored` son las que el libro marca con `*`: llevan puntuación, como los dones. `timeOfDay` es la hora
 * en la que valen — el Aura sólo de día, el Aura sombría y el Amparo de la noche sólo de noche.
 */
export const CAPABILITY_IDS = [
  'winged', 'aura', 'darkAura', 'nightShelter', 'earthlyDisguise', 'humanSkin', 'solarWrath', 'venom',
  'thickHide', 'inhumanHunger', 'earthlyAnchor', 'incorporeal', 'painImmune', 'blast', 'darkvision',
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];
export const isCapabilityId = (v: unknown): v is CapabilityId => typeof v === 'string' && (CAPABILITY_IDS as readonly string[]).includes(v);

export type CapabilityData = {
  /** Lleva puntuación (las del `*` de la p.107). Las demás son todo o nada. */
  scored: boolean;
  /** Cuándo vale: sólo de día, sólo de noche, o siempre (`null`). */
  timeOfDay: 'day' | 'night' | null;
  /** Nuestro resumen de la regla, como clave i18n. */
  summary: string;
};
const CAPABILITY_DATA: Record<CapabilityId, Omit<CapabilityData, 'summary'>> = {
  winged: { scored: false, timeOfDay: null },
  aura: { scored: true, timeOfDay: 'day' },
  darkAura: { scored: true, timeOfDay: 'night' },
  nightShelter: { scored: true, timeOfDay: 'night' },
  earthlyDisguise: { scored: false, timeOfDay: null },
  humanSkin: { scored: false, timeOfDay: null },
  solarWrath: { scored: true, timeOfDay: null },
  venom: { scored: true, timeOfDay: null },
  thickHide: { scored: true, timeOfDay: null },
  inhumanHunger: { scored: false, timeOfDay: null },
  earthlyAnchor: { scored: false, timeOfDay: null },
  incorporeal: { scored: false, timeOfDay: null },
  painImmune: { scored: false, timeOfDay: null },
  blast: { scored: true, timeOfDay: null },
  darkvision: { scored: false, timeOfDay: null },
};
export const CAPABILITIES: (CatalogItem & { data: CapabilityData })[] = CAPABILITY_IDS.map(id => ({
  id, label: `catalog.capabilities.${id}.name`, ref: 'bestiary',
  data: { ...CAPABILITY_DATA[id], summary: `catalog.capabilities.${id}.summary` },
}));

/** Una capacidad de un bloque concreto. `level` sólo en las que puntúan (Piel gruesa 3, Aura 5…). */
export interface CreatureCapability { id: CapabilityId; level?: number }
const c = (id: CapabilityId, level?: number): CreatureCapability => (level === undefined ? { id } : { id, level });

export const capabilityById = (id: string) => CAPABILITIES.find(x => x.id === id) ?? null;
export const hasCapability = (caps: readonly CreatureCapability[] | undefined, id: CapabilityId): boolean => !!caps?.some(x => x.id === id);
/** Puntuación de la capacidad; 0 si la criatura no la tiene o si la capacidad no puntúa. */
export const capabilityLevel = (caps: readonly CreatureCapability[] | undefined, id: CapabilityId): number =>
  caps?.find(x => x.id === id)?.level ?? 0;

// ─── Los ATAQUES que imprimen las cajas (manual, bloques en caja) ────────────
/**
 * Las cajas de los personajes con nombre traen un apartado `ATAQUES` con el arma, su puntuación de ataque
 * y su daño YA calculados. **Se copian, no se recalculan**: la cuenta del libro es «Combate + bonificación»
 * y «Fortaleza + daño del arma» (p.97) pero no cuadra siempre —Nergal tiene Fortaleza 6 y su martillo hace
 * 10, no 9; Lucifer tiene 8 y su mandoble hace 12, no 11—, así que recalcularlos sería corregirle el libro.
 *
 * ⚠ La **Ira solar NO está sumada** en el daño impreso: se comprueba con Gabriel, que tiene Ira solar 3 y
 * un daño de 9 = Fortaleza 7 + 2 de una espada de la tabla. La capacidad suma ENCIMA (RULES.md §8.0).
 */
export interface CreatureAttack {
  /** Nombre del arma tal y como lo imprime la caja, como clave i18n. */
  label: string;
  /** Dados de ataque impresos. */
  attack: number;
  /** Daño impreso, sin la Ira solar. */
  damage: number;
  /** Fortuna que cuesta usarlo (Malefic a dos manos, p.163). Ausente = gratis. */
  fortuneCost?: number;
  /**
   * Es un ataque A DISTANCIA (p.95: «sin ellas simplemente no se puede atacar a distancia»). Ausente = cuerpo
   * a cuerpo. Los ataques impresos de los bloques en caja son todos de c/c; los de los bloques humanos salen
   * DERIVADOS de su especialidad de Combate con la tabla de la p.97 (los bloques no imprimen armas — RULES.md
   * §8.6, ⚠ interpretación), y son los únicos que llevan esta marca.
   */
  ranged?: boolean;
}
const at = (key: string, attack: number, damage: number, fortuneCost?: number): CreatureAttack =>
  ({ label: `catalog.creatureAttacks.${key}`, attack, damage, ...(fortuneCost === undefined ? {} : { fortuneCost }) });
/**
 * El arma A DISTANCIA de un bloque humano (RULES.md §8.6): el arma de la tabla de la p.97 que nombra su
 * especialidad de Combate. El ataque derivado es el DISPARO: `attack` es su Combate A SECAS, porque al
 * disparar no se suma bonificación (p.95–96) — así `attack - combat` (lo que viaja como `bonusDice`) queda
 * en 0, calcado al flujo de la ficha de jugador (`ranged ? 0 : bonus`). ⚠ Usada EN c/c, un arma de fuego
 * daría +1 (p.95): no cabe en este único número y queda como deuda en §8.6 (el director puede sumarlo a
 * mano). El label reutiliza la clave del catálogo de armas: mismo nombre traducido en las dos lenguas y sin
 * segunda verdad de valores; no coincide con ningún `WEAPONS.id` a secas, así que el gasto de munición de
 * una ficha (`spendAmmo` busca por id) no puede dispararse por error.
 */
const rat = (weaponId: string, attack: number, damage: number): CreatureAttack =>
  ({ label: `catalog.weapons.${weaponId}`, attack, damage, ranged: true });

// ─── Bestiario: bloques del manual, copiados uno a uno ───────────────────────
/**
 * Cada entrada es un bloque de criatura del libro, con sus SIETE características, su Aguante y su Destino tal y
 * como los imprime (el Aguante del bloque **ya trae el modificador de tamaño**: el ogro tiene Fortaleza 8 y
 * Voluntad 1 pero Aguante 10, porque es Grande). `resistance` no se guarda: es Aguante × 3 (p.25).
 *
 * `protection` sale de las **capacidades** (p.107–108), no de una armadura: «Piel gruesa*: cuenta como una armadura
 * natural cuya protección es igual a la puntuación de esta capacidad». El mutante la tiene por su piel curtida (p.98).
 *
 * ⚠ Del mutante el libro sólo publica lo que se ve en sus ejemplos —Fortaleza 3 y Voluntad 1 (p.98), Combate 3
 * (p.94), protección 2— así que el resto de sus características van SIN VALOR en vez de inventadas: la ficha las
 * pinta «—» y el director tira con lo que hay.
 *
 * Las **especialidades** de cada bloque (el ogro «Garrote» en Combate, el hambriento «Mordisco») SÍ se guardan,
 * en `CREATURE_SPECIALTIES` — el manual las imprime dentro del propio bloque, una por característica.
 */
export interface BestiaryData {
  /** Las que el manual publica. Ausente = el bloque no la da (no la inventamos). */
  stats: Partial<Record<StatId, number>>;
  /** Aguante impreso en el bloque, modificador de tamaño incluido. */
  endurance: number;
  destiny: number;
  /** Protección natural por capacidad (Piel gruesa N, piel curtida…). 0 = ninguna. */
  protection: number;
  /** La línea impresa del bloque (p.107–108), tal cual: mezcla capacidades y DONES, y se lee tal y como está. */
  abilities: string[];
  /** Las capacidades de esa línea, ya como dato, para que el motor pueda aplicarlas (§7.b.1). */
  capabilities: CreatureCapability[];
  /** Los ATAQUES que imprimen los bloques en caja, con arma y daño ya calculados por el libro. Vacío en los bloques en lista. */
  attacks: CreatureAttack[];
  /** Página del manual donde está el bloque. */
  page: number;
  /** Resistencia = Aguante × 3 (p.25). Se guarda calculada para no repetir la cuenta en cada consumidor. */
  resistance: number;
  /** Una especialidad por característica, como las imprime el bloque. Ids de `SPECIALTY_ITEMS` o `creature.*`. */
  specialties: Partial<Record<StatId, string[]>>;
  notes: string;
}
type Block = { stats: Partial<Record<StatId, number>>; endurance: number; destiny: number; protection?: number; abilities?: string[]; capabilities?: CreatureCapability[]; attacks?: CreatureAttack[]; page: number };
// ─── Especialidades de las criaturas (dato, no adorno) ───────────────────────
/**
 * Cada bloque del manual imprime UNA especialidad por característica junto a su puntuación (el ogro:
 * «Fortaleza 8 — Derribar paredes», «Combate 4 — Garrote»), y un guion cuando no la hay. Sin esto el motor
 * no puede doblarles los triunfos (p.83) aunque ya sepa hacerlo: el director las ve al tirar y marca la que aplica.
 *
 * De los 133 nombres distintos que usa el bestiario, **104 ya existen** como especialidad de jugador y reutilizan
 * su clave (`combat.firearms`…). Sólo los 30 restantes son propios de criatura y llevan clave nueva
 * (`creature.*`): son los de sabor —Garrote, Mordisco, Picado de garras, Uñas y dientes—, que ningún personaje tiene.
 */
export const CREATURE_SPECIALTIES: Record<string, Partial<Record<StatId, string[]>>> = {
  hungry: { fortitude: ['creature.persecucionALaCarrera'], combat: ['creature.mordisco'], will: ['creature.temeridad'], cunning: ['cunning.searching'] },
  ogre: { fortitude: ['creature.derribarParedes'], combat: ['creature.garrote'], will: ['will.constancy'], cunning: ['cunning.movingBlind'], subtlety: ['creature.permanecerInmovil'], presence: ['presence.intimidation'] },
  ghost: { will: ['creature.fijacion'], cunning: ['cunning.perception'], subtlety: ['subtlety.acting'], presence: ['presence.intimidation'], culture: ['culture.occultism'] },
  possessed: { fortitude: ['creature.mantenerseDePie'], combat: ['creature.tijeras'], will: ['creature.dominarCuerpo'], cunning: ['cunning.movingBlind'] },
  cherub: { fortitude: ['creature.saltarALaEspaldaDeLaVictima'], combat: ['creature.unasYDientes'], will: ['creature.obedienciaCiega'], cunning: ['cunning.anticipation'], subtlety: ['subtlety.ambush'] },
  harpy: { fortitude: ['creature.atraparVictimasAlVuelo'], combat: ['creature.picadoDeGarras'], will: ['will.patience'], cunning: ['cunning.keenSight'], subtlety: ['creature.acechar'] },
  lunar: { fortitude: ['fortitude.carrying'], combat: ['combat.bluntWeapons'], will: ['will.courage'], cunning: ['cunning.dangerSense'], subtlety: ['subtlety.hiding'], presence: ['presence.intimidation'], culture: ['culture.history'] },
  fallenElite: { fortitude: ['creature.volarLargasDistancias'], combat: ['creature.hachasYMachetes'], will: ['will.fanaticism'], cunning: ['cunning.dangerSense'], subtlety: ['subtlety.ambush'], presence: ['presence.intimidation'], culture: ['culture.tactics'] },
  solar: { fortitude: ['creature.vueloEnPicado'], combat: ['creature.lanzaYEspada'], will: ['will.faith'], cunning: ['cunning.keenSight'], subtlety: ['creature.acechar'], presence: ['presence.seduction'], culture: ['culture.history'] },
  solarPaladin: { fortitude: ['fortitude.vigour'], combat: ['creature.lanzaYEspada'], will: ['will.fanaticism'], cunning: ['cunning.lieDetection'], subtlety: ['creature.acechar'], presence: ['presence.interrogation'], culture: ['culture.religion'] },
  aamel: { fortitude: ['will.painResistance'], combat: ['creature.mandoble'], will: ['will.integrity'], cunning: ['cunning.investigation'], subtlety: ['presence.courtesy'], presence: ['presence.inspiring'], culture: ['culture.legends'] },
  scavenger: { fortitude: ['fortitude.carrying'], combat: ['combat.crossbows'], will: ['will.constancy'], cunning: ['cunning.searching'], subtlety: ['subtlety.dissembling'], presence: ['presence.negotiation'], culture: ['culture.languages'] },
  wanderer: { fortitude: ['fortitude.carrying'], combat: ['combat.improvisedWeapons'], will: ['will.intuition'], cunning: ['cunning.dangerSense'], subtlety: ['subtlety.concealment'], presence: ['presence.empathy'], culture: ['culture.humanities'] },
  gangster: { fortitude: ['fortitude.drinking'], combat: ['combat.submachineGuns'], will: ['will.constancy'], cunning: ['cunning.searching'], subtlety: ['subtlety.gambling'], presence: ['subtlety.blackmail'], culture: ['culture.newYork'] },
  jihadist: { fortitude: ['fortitude.sprinting'], combat: ['combat.rifles'], will: ['will.courage'], cunning: ['cunning.lightSleep'], subtlety: ['subtlety.disguise'], presence: ['presence.torture'], culture: ['culture.tactics'] },
  dragon: { fortitude: ['fortitude.athletics'], combat: ['creature.artesMarcialesMixtas'], will: ['will.selfEsteem'], cunning: ['cunning.lightSleep'], subtlety: ['subtlety.gambling'], presence: ['presence.intimidation'], culture: ['culture.legends'] },
  latinGang: { fortitude: ['fortitude.breakingDoors'], combat: ['combat.wrestling'], will: ['will.integrity'], cunning: ['cunning.streetwise'], subtlety: ['subtlety.concealment'], presence: ['presence.torture'], culture: ['culture.languages'] },
  paramilitary: { fortitude: ['fortitude.athletics'], combat: ['combat.heavyWeapons'], will: ['will.courage'], cunning: ['cunning.lightSleep'], subtlety: ['subtlety.camouflage'], presence: ['presence.interrogation'], culture: ['culture.tactics'] },
  edenSeeker: { fortitude: ['fortitude.riding'], combat: ['combat.bows'], will: ['will.rites'], cunning: ['cunning.animalTraining'], subtlety: ['presence.poetry'], presence: ['presence.animalHandling'], culture: ['culture.conspiracyTheory'] },
  kibbutzMember: { fortitude: ['fortitude.carrying'], combat: ['creature.artesMarcialesKravMaga'], will: ['will.patience'], cunning: ['cunning.carpentry'], subtlety: ['subtlety.haggling'], presence: ['presence.negotiation'], culture: ['culture.art'] },
  paradiseMartyr: { fortitude: ['fortitude.carrying'], combat: ['combat.spears'], will: ['will.fanaticism'], cunning: ['subtlety.feigning'], subtlety: ['subtlety.blackmail'], presence: ['presence.empathy'], culture: ['culture.religion'] },
  occultNetizen: { fortitude: ['fortitude.stayingAwake'], combat: ['combat.shortWeapons'], will: ['will.divination'], cunning: ['cunning.riddles'], subtlety: ['subtlety.gambling'], presence: ['presence.charlatanry'], culture: ['culture.occultism'] },
  dimaGang: { fortitude: ['cunning.driving'], combat: ['combat.shotguns'], will: ['will.constancy'], cunning: ['cunning.streetwise'], subtlety: ['subtlety.haggling'], presence: ['presence.intimidation'], culture: ['culture.technology'] },
  newOrderFollower: { fortitude: ['fortitude.vigour'], combat: ['combat.bows'], will: ['will.fanaticism'], cunning: ['cunning.carpentry'], subtlety: ['subtlety.hiding'], presence: ['presence.empathy'], culture: ['culture.conspiracyTheory'] },
  illuminatiCharlatan: { fortitude: ['fortitude.drinking'], combat: ['combat.knives'], will: ['will.keepingFace'], cunning: ['cunning.lieDetection'], subtlety: ['subtlety.feigning'], presence: ['presence.charlatanry'], culture: ['culture.religion'] },
  miyamotoSoldier: { fortitude: ['fortitude.escapology'], combat: ['combat.shortWeapons'], will: ['will.temperance'], cunning: ['cunning.movingBlind'], subtlety: ['subtlety.haggling'], presence: ['subtlety.blackmail'], culture: ['culture.technology'] },
  littleTokyoThug: { fortitude: ['fortitude.parkour'], combat: ['combat.dirtyFighting'], will: ['will.selfEsteem'], cunning: ['cunning.perception'], subtlety: ['subtlety.knack'], presence: ['presence.singing'], culture: ['creature.artePintadas'] },
  cannibalCook: { fortitude: ['fortitude.carrying'], combat: ['creature.cuchillos'], will: ['will.painResistance'], cunning: ['cunning.streetwise'], subtlety: ['subtlety.knack'], presence: ['presence.torture'], culture: ['culture.legends'] },
  maggie: { fortitude: ['fortitude.vigour'], combat: ['creature.hachuelaDeCocina'], will: ['will.intuition'], cunning: ['cunning.orientation'], subtlety: ['subtlety.feigning'], presence: ['presence.courtesy'], culture: ['culture.firstAid'] },
  fluteFool: { fortitude: ['fortitude.dancing'], combat: ['combat.improvisedWeapons'], will: ['will.concentration'], cunning: ['cunning.perception'], subtlety: ['subtlety.ventriloquism'], presence: ['presence.singing'], culture: ['culture.languages'] },
  ramirez: { fortitude: ['cunning.driving'], combat: ['combat.shortWeapons'], will: ['will.intuition'], cunning: ['cunning.survival'], subtlety: ['subtlety.knack'], presence: ['presence.intimidation'], culture: ['culture.newYork'] },
  jellybean: { fortitude: ['fortitude.cycling'], combat: ['combat.shortWeapons'], will: ['will.patience'], cunning: ['cunning.riddles'], subtlety: ['subtlety.haggling'], presence: ['presence.negotiation'], culture: ['culture.technology'] },
  hermes: { fortitude: ['fortitude.stayingAwake'], combat: ['combat.bluntWeapons'], will: ['will.concentration'], cunning: ['cunning.investigation'], subtlety: ['subtlety.feigning'], presence: ['presence.courtesy'], culture: ['culture.history'] },
  judith: { fortitude: ['fortitude.carrying'], combat: ['combat.improvisedWeapons'], will: ['will.intuition'], cunning: ['cunning.dangerSense'], subtlety: ['subtlety.concealment'], presence: ['presence.empathy'], culture: ['culture.humanities'] },
  henryPutnam: { fortitude: ['fortitude.stayingAwake'], combat: ['combat.staves'], will: ['will.fanaticism'], cunning: ['creature.buscarInfieles'], subtlety: ['creature.predicar'], presence: ['presence.inspiring'], culture: ['culture.religion'] },
  dorcy: { fortitude: ['fortitude.carrying'], combat: ['combat.knives'], will: ['will.faith'], cunning: ['cunning.lieDetection'], subtlety: ['subtlety.imitation'], presence: ['presence.courtesy'], culture: ['culture.firstAid'] },
  azelias: { fortitude: ['creature.vueloAcrobatico'], combat: ['combat.swords'], will: ['will.keepingFace'], cunning: ['cunning.perception'], subtlety: ['subtlety.dissembling'], presence: ['subtlety.blackmail'], culture: ['culture.occultism'] },
  silhouette: { fortitude: ['fortitude.parkour'], combat: ['combat.submachineGuns'], will: ['will.rites'], cunning: ['cunning.streetwise'], subtlety: ['subtlety.acting'], presence: ['presence.mime'], culture: ['culture.newYork'] },
  bigDima: { fortitude: ['fortitude.drinking'], combat: ['combat.shortWeapons'], will: ['will.integrity'], cunning: ['cunning.timeSense'], subtlety: ['subtlety.knack'], presence: ['presence.leadership'], culture: ['culture.newYork'] },
  thirteenMoonsSister: { fortitude: ['fortitude.acrobatics', 'fortitude.balance'], combat: ['creature.espadasYCuchillosSamurais'], will: ['will.constancy'], cunning: ['cunning.movingBlind'], subtlety: ['subtlety.camouflage'], presence: ['presence.seduction'], culture: ['culture.legends'] },
  jacobite: { fortitude: ['fortitude.riding'], combat: ['combat.spears'], will: ['will.faith'], cunning: ['cunning.timeSense'], subtlety: ['subtlety.imitation'], presence: ['presence.charlatanry'], culture: ['culture.psychology'] },
  george: { fortitude: ['fortitude.drinking'], combat: ['creature.cuchillos'], will: ['will.constancy'], cunning: ['cunning.streetwise'], subtlety: ['subtlety.gambling'], presence: ['presence.humour'], culture: ['culture.medicine'] },
  diane: { fortitude: ['fortitude.vigour'], combat: ['combat.crossbows'], will: ['will.courage'], cunning: ['cunning.keenSight'], subtlety: ['subtlety.concealment'], presence: ['presence.poetry'], culture: ['culture.firstAid'] },
  allenDallas: { fortitude: ['fortitude.stayingAwake'], combat: ['combat.bluntWeapons'], will: ['will.constancy'], cunning: ['cunning.investigation'], subtlety: ['subtlety.dissembling'], presence: ['presence.humour'], culture: ['culture.computing'] },
  // Los doce bloques EN CAJA (§8.0). Erratas del libro corregidas al escribir la etiqueta, no al copiar el
  // dato: Luz-Malefic imprime «Inpirar» y el Salteador «Perserverar».
  nathael: { fortitude: ['creature.vuelo'], combat: ['combat.swords'], will: ['will.perseverance'], cunning: ['cunning.keenSight'], subtlety: ['subtlety.acting'], presence: ['presence.intimidation'], culture: ['culture.religion'] },
  luz: { fortitude: ['fortitude.acrobatics'], combat: ['creature.espadaSamurai'], will: ['will.intuition'], cunning: ['cunning.dangerSense'], subtlety: ['subtlety.hiding'], presence: ['presence.inspiring'], culture: ['culture.occultism'] },
  soum: { fortitude: ['fortitude.acrobatics', 'fortitude.balance', 'fortitude.climbing'], combat: ['creature.cuchillos', 'combat.swords'], will: ['will.meditation'], cunning: ['cunning.anticipation'], subtlety: ['subtlety.ambush'], presence: ['presence.seduction'], culture: ['culture.legends'] },
  nergal: { fortitude: ['fortitude.vigour'], combat: ['combat.bluntWeapons'], will: ['will.perseverance'], cunning: ['cunning.keenSight'], subtlety: ['subtlety.acting'], presence: ['presence.intimidation'], culture: ['culture.religion'] },
  samael: { fortitude: ['fortitude.vigour'], combat: ['creature.martilloDeGuerra'], will: ['will.painResistance'], cunning: ['cunning.anticipation'], subtlety: ['creature.acechar'], presence: ['presence.inspiring'], culture: ['culture.legends'] },
  lucifer: { fortitude: ['will.painResistance'], combat: ['combat.swords'], will: ['will.courage'], cunning: ['cunning.keenSight'], subtlety: ['subtlety.ambush'], presence: ['presence.leadership'], culture: ['culture.legends'] },
  baal: { fortitude: ['fortitude.vigour'], combat: ['creature.espadasSamurais'], will: ['will.rites'], cunning: ['cunning.lieDetection'], subtlety: ['subtlety.hiding'], presence: ['presence.leadership'], culture: ['culture.occultism'] },
  gabriel: { fortitude: ['creature.recorrerDistancias'], combat: ['creature.espadaYEscudo'], will: ['will.constancy'], cunning: ['cunning.perception'], subtlety: ['subtlety.ambush'], presence: ['presence.seduction'], culture: ['culture.history'] },
  marduk: { fortitude: ['fortitude.vigour'], combat: ['creature.sables'], will: ['will.temperance'], cunning: ['cunning.anticipation'], subtlety: ['creature.acechar'], presence: ['presence.inspiring'], culture: ['culture.history'] },
  adam: { fortitude: ['fortitude.vigour'], combat: ['creature.cuchillos'], will: ['will.keepingFace'], cunning: ['cunning.keenSight'], subtlety: ['subtlety.blackmail'], presence: ['presence.charlatanry'], culture: ['culture.psychology'] },
  luzMalefic: { fortitude: ['fortitude.acrobatics'], combat: ['combat.swords'], will: ['will.temperance'], cunning: ['cunning.movingBlind'], subtlety: ['creature.acechar'], presence: ['presence.inspiring'], culture: ['culture.occultism'] },
  highwayman: { fortitude: ['cunning.driving'], combat: ['combat.bluntWeapons'], will: ['will.perseverance'], cunning: ['cunning.survival'], subtlety: ['subtlety.ambush'], presence: ['presence.interrogation'], culture: ['culture.technology'] },
};

/** Las especialidades que sólo tienen las criaturas. Las compartidas con jugadores viven en `SPECIALTY_ITEMS`. */
export const CREATURE_SPECIALTY_ITEMS: CatalogItem[] = [
  { id: 'creature.acechar', label: 'catalog.creatureSpecialties.acechar', ref: 'specialty' },
  { id: 'creature.artePintadas', label: 'catalog.creatureSpecialties.artePintadas', ref: 'specialty' },
  { id: 'creature.artesMarcialesKravMaga', label: 'catalog.creatureSpecialties.artesMarcialesKravMaga', ref: 'specialty' },
  { id: 'creature.artesMarcialesMixtas', label: 'catalog.creatureSpecialties.artesMarcialesMixtas', ref: 'specialty' },
  { id: 'creature.atraparVictimasAlVuelo', label: 'catalog.creatureSpecialties.atraparVictimasAlVuelo', ref: 'specialty' },
  { id: 'creature.buscarInfieles', label: 'catalog.creatureSpecialties.buscarInfieles', ref: 'specialty' },
  { id: 'creature.cuchillos', label: 'catalog.creatureSpecialties.cuchillos', ref: 'specialty' },
  { id: 'creature.derribarParedes', label: 'catalog.creatureSpecialties.derribarParedes', ref: 'specialty' },
  { id: 'creature.dominarCuerpo', label: 'catalog.creatureSpecialties.dominarCuerpo', ref: 'specialty' },
  { id: 'creature.espadaSamurai', label: 'catalog.creatureSpecialties.espadaSamurai', ref: 'specialty' },
  { id: 'creature.espadaYEscudo', label: 'catalog.creatureSpecialties.espadaYEscudo', ref: 'specialty' },
  { id: 'creature.espadasSamurais', label: 'catalog.creatureSpecialties.espadasSamurais', ref: 'specialty' },
  { id: 'creature.espadasYCuchillosSamurais', label: 'catalog.creatureSpecialties.espadasYCuchillosSamurais', ref: 'specialty' },
  { id: 'creature.fijacion', label: 'catalog.creatureSpecialties.fijacion', ref: 'specialty' },
  { id: 'creature.garrote', label: 'catalog.creatureSpecialties.garrote', ref: 'specialty' },
  { id: 'creature.hachasYMachetes', label: 'catalog.creatureSpecialties.hachasYMachetes', ref: 'specialty' },
  { id: 'creature.hachuelaDeCocina', label: 'catalog.creatureSpecialties.hachuelaDeCocina', ref: 'specialty' },
  { id: 'creature.lanzaYEspada', label: 'catalog.creatureSpecialties.lanzaYEspada', ref: 'specialty' },
  { id: 'creature.mandoble', label: 'catalog.creatureSpecialties.mandoble', ref: 'specialty' },
  { id: 'creature.martilloDeGuerra', label: 'catalog.creatureSpecialties.martilloDeGuerra', ref: 'specialty' },
  { id: 'creature.mantenerseDePie', label: 'catalog.creatureSpecialties.mantenerseDePie', ref: 'specialty' },
  { id: 'creature.mordisco', label: 'catalog.creatureSpecialties.mordisco', ref: 'specialty' },
  { id: 'creature.obedienciaCiega', label: 'catalog.creatureSpecialties.obedienciaCiega', ref: 'specialty' },
  { id: 'creature.permanecerInmovil', label: 'catalog.creatureSpecialties.permanecerInmovil', ref: 'specialty' },
  { id: 'creature.persecucionALaCarrera', label: 'catalog.creatureSpecialties.persecucionALaCarrera', ref: 'specialty' },
  { id: 'creature.picadoDeGarras', label: 'catalog.creatureSpecialties.picadoDeGarras', ref: 'specialty' },
  { id: 'creature.predicar', label: 'catalog.creatureSpecialties.predicar', ref: 'specialty' },
  { id: 'creature.recorrerDistancias', label: 'catalog.creatureSpecialties.recorrerDistancias', ref: 'specialty' },
  { id: 'creature.sables', label: 'catalog.creatureSpecialties.sables', ref: 'specialty' },
  { id: 'creature.saltarALaEspaldaDeLaVictima', label: 'catalog.creatureSpecialties.saltarALaEspaldaDeLaVictima', ref: 'specialty' },
  { id: 'creature.temeridad', label: 'catalog.creatureSpecialties.temeridad', ref: 'specialty' },
  { id: 'creature.tijeras', label: 'catalog.creatureSpecialties.tijeras', ref: 'specialty' },
  { id: 'creature.unasYDientes', label: 'catalog.creatureSpecialties.unasYDientes', ref: 'specialty' },
  { id: 'creature.volarLargasDistancias', label: 'catalog.creatureSpecialties.volarLargasDistancias', ref: 'specialty' },
  { id: 'creature.vuelo', label: 'catalog.creatureSpecialties.vuelo', ref: 'specialty' },
  { id: 'creature.vueloAcrobatico', label: 'catalog.creatureSpecialties.vueloAcrobatico', ref: 'specialty' },
  { id: 'creature.vueloEnPicado', label: 'catalog.creatureSpecialties.vueloEnPicado', ref: 'specialty' },
];

const b = (id: string, k: Block): CatalogItem & { data: BestiaryData } => ({
  id, label: `catalog.bestiary.${id}.name`, ref: 'bestiary',
  data: { stats: k.stats, endurance: k.endurance, destiny: k.destiny, protection: k.protection ?? 0, abilities: k.abilities ?? [], capabilities: k.capabilities ?? [], attacks: k.attacks ?? [], page: k.page, resistance: k.endurance * 3, specialties: CREATURE_SPECIALTIES[id] ?? {}, notes: `catalog.bestiary.${id}.notes` },
});
const st = (fortitude: number, combat: number, will: number, cunning: number, subtlety: number, presence: number, culture: number) =>
  ({ fortitude, combat, will, cunning, subtlety, presence, culture });

export const BESTIARY = [
  // Criaturas (capítulo de criaturas, pp. 147–155)
  b('hungry', { stats: st(3, 3, 1, 4, 0, 0, 0), endurance: 4, destiny: 0, abilities: ['Hambre inhumana'], capabilities: [c('inhumanHunger')], page: 150 }),
  b('ogre', { stats: st(8, 4, 1, 3, 1, 1, 0), endurance: 10, destiny: 0, protection: 3, abilities: ['Piel gruesa 3'], capabilities: [c('thickHide', 3)], page: 152 }),
  b('ghost', { stats: st(0, 0, 3, 2, 2, 1, 3), endurance: 0, destiny: 10, abilities: ['Ancla terrenal', 'Incorpóreo', 'Mano inmaterial 3'], capabilities: [c('earthlyAnchor'), c('incorporeal')], page: 149 }),
  b('possessed', { stats: st(2, 2, 2, 2, 0, 0, 0), endurance: 4, destiny: 0, abilities: ['Inmune al dolor'], capabilities: [c('painImmune')], page: 149 }),
  b('cherub', { stats: st(2, 2, 2, 1, 3, 0, 0), endurance: 3, destiny: 0, abilities: ['Ponzoña 3', 'Visión en la oscuridad'], capabilities: [c('venom', 3), c('darkvision')], page: 155 }),
  b('harpy', { stats: st(4, 3, 1, 4, 4, 0, 0), endurance: 5, destiny: 2, abilities: ['Alado', 'Visión en la oscuridad'], capabilities: [c('winged'), c('darkvision')], page: 147 }),
  // Sobrenaturales (lunares y solares)
  b('lunar', { stats: st(7, 6, 3, 4, 3, 2, 3), endurance: 10, destiny: 7, abilities: ['Alado', 'Aura sombría 2', 'Piel de humano', 'Amparo de la noche 2'], capabilities: [c('winged'), c('darkAura', 2), c('humanSkin'), c('nightShelter', 2)], page: 120 }),
  b('fallenElite', { stats: st(7, 7, 4, 4, 3, 3, 4), endurance: 11, destiny: 8, abilities: ['Alado', 'Aura sombría 3', 'Piel de humano', 'Amparo de la noche 3'], capabilities: [c('winged'), c('darkAura', 3), c('humanSkin'), c('nightShelter', 3)], page: 124 }),
  b('solar', { stats: st(6, 7, 4, 3, 2, 3, 3), endurance: 10, destiny: 7, abilities: ['Alado', 'Aura 2', 'Disfraz terrenal', 'Ira solar 2'], capabilities: [c('winged'), c('aura', 2), c('earthlyDisguise'), c('solarWrath', 2)], page: 132 }),
  b('solarPaladin', { stats: st(6, 8, 5, 3, 2, 4, 4), endurance: 7, destiny: 8, abilities: ['Alado', 'Aura 3', 'Disfraz terrenal', 'Ira solar 3'], capabilities: [c('winged'), c('aura', 3), c('earthlyDisguise'), c('solarWrath', 3)], page: 132 }),
  b('aamel', { stats: st(6, 8, 5, 4, 3, 4, 5), endurance: 11, destiny: 8, abilities: ['Alado', 'Aura 3', 'Disfraz terrenal', 'Ira solar 2'], capabilities: [c('winged'), c('aura', 3), c('earthlyDisguise'), c('solarWrath', 2)], page: 132 }),
  b('azelias', { stats: st(6, 7, 4, 3, 5, 5, 5), endurance: 10, destiny: 8, abilities: ['Alado', 'Aura 2', 'Disfraz terrenal', 'Ira solar 3'], capabilities: [c('winged'), c('aura', 2), c('earthlyDisguise'), c('solarWrath', 3)], page: 132 }),
  // Humanos hostiles y figuras de la ambientación (pp. 44–74, 98)
  b('mutant', { stats: { fortitude: 3, combat: 3, will: 1 }, endurance: 4, destiny: 0, protection: 2, abilities: ['Piel curtida'], page: 98 }),
  b('scavenger', { stats: st(3, 3, 3, 2, 2, 3, 2), endurance: 6, destiny: 1, attacks: [rat('crossbow', 3, 5)], page: 74 }),
  b('wanderer', { stats: st(2, 1, 3, 3, 1, 4, 3), endurance: 5, destiny: 4, page: 69 }),
  b('gangster', { stats: st(2, 3, 1, 3, 1, 3, 2), endurance: 3, destiny: 1, attacks: [rat('smg', 3, 8)], page: 62 }),
  b('jihadist', { stats: st(2, 3, 3, 2, 3, 2, 2), endurance: 5, destiny: 2, attacks: [rat('assaultRifle', 3, 8)], page: 62 }),
  b('dragon', { stats: st(3, 2, 3, 2, 1, 2, 1), endurance: 6, destiny: 1, page: 63 }),
  b('latinGang', { stats: st(3, 2, 2, 3, 1, 2, 1), endurance: 5, destiny: 1, page: 61 }),
  b('paramilitary', { stats: st(3, 3, 1, 3, 1, 2, 2), endurance: 4, destiny: 2, page: 61 }),
  b('edenSeeker', { stats: st(2, 1, 2, 2, 3, 2, 2), endurance: 4, destiny: 1, attacks: [rat('compoundBow', 1, 5)], page: 61 }),
  b('kibbutzMember', { stats: st(1, 1, 2, 2, 3, 3, 2), endurance: 3, destiny: 2, page: 61 }),
  b('paradiseMartyr', { stats: st(2, 2, 2, 3, 3, 2, 2), endurance: 4, destiny: 2, page: 57 }),
  b('occultNetizen', { stats: st(2, 1, 2, 2, 3, 2, 3), endurance: 4, destiny: 1, attacks: [rat('pistol9mm', 1, 6)], page: 59 }),
  b('dimaGang', { stats: st(3, 4, 2, 3, 1, 2, 3), endurance: 5, destiny: 1, attacks: [rat('shotgun12', 4, 9)], page: 59 }),
  b('newOrderFollower', { stats: st(2, 1, 3, 2, 2, 2, 3), endurance: 5, destiny: 1, attacks: [rat('compoundBow', 1, 5)], page: 59 }),
  b('illuminatiCharlatan', { stats: st(2, 1, 1, 3, 3, 3, 3), endurance: 5, destiny: 1, page: 63 }),
  b('miyamotoSoldier', { stats: st(2, 3, 2, 3, 2, 2, 1), endurance: 4, destiny: 1, attacks: [rat('pistol9mm', 3, 6)], page: 64 }),
  b('littleTokyoThug', { stats: st(3, 3, 2, 2, 3, 1, 1), endurance: 5, destiny: 2, page: 65 }),
  b('cannibalCook', { stats: st(2, 3, 1, 3, 2, 1, 1), endurance: 3, destiny: 7, page: 69 }),
  b('maggie', { stats: st(2, 1, 3, 3, 3, 3, 1), endurance: 5, destiny: 7, page: 68 }),
  b('fluteFool', { stats: st(4, 1, 3, 1, 2, 1, 4), endurance: 7, destiny: 4, page: 69 }),
  b('ramirez', { stats: st(4, 4, 2, 4, 2, 2, 2), endurance: 6, destiny: 2, attacks: [rat('pistol9mm', 4, 6)], page: 69 }),
  b('jellybean', { stats: st(2, 1, 2, 2, 2, 3, 4), endurance: 4, destiny: 3, attacks: [rat('pistol9mm', 1, 6)], page: 74 }),
  b('hermes', { stats: st(1, 1, 3, 3, 2, 2, 4), endurance: 4, destiny: 4, page: 67 }),
  b('judith', { stats: st(2, 1, 3, 3, 1, 4, 3), endurance: 5, destiny: 4, page: 67 }),
  b('henryPutnam', { stats: st(1, 2, 4, 3, 4, 3, 2), endurance: 5, destiny: 8, page: 44 }),
  b('dorcy', { stats: st(2, 1, 3, 1, 3, 3, 1), endurance: 5, destiny: 6, page: 44 }),
  b('silhouette', { stats: st(3, 3, 1, 2, 2, 2, 1), endurance: 4, destiny: 1, attacks: [rat('smg', 3, 8)], page: 57 }),
  b('bigDima', { stats: st(4, 4, 3, 4, 3, 3, 4), endurance: 7, destiny: 7, attacks: [rat('pistol9mm', 4, 6)], page: 59 }),
  b('thirteenMoonsSister', { stats: st(4, 5, 3, 4, 4, 2, 3), endurance: 7, destiny: 4, abilities: ['Defensa de acero 2', 'Movimientos felinos 2'], page: 67 }),
  b('jacobite', { stats: st(2, 2, 3, 1, 2, 3, 2), endurance: 6, destiny: 1, page: 67 }),
  b('george', { stats: st(3, 3, 1, 3, 2, 2, 1), endurance: 4, destiny: 7, page: 68 }),
  b('diane', { stats: st(2, 3, 3, 3, 3, 2, 2), endurance: 5, destiny: 2, attacks: [rat('crossbow', 3, 5)], page: 74 }),
  b('allenDallas', { stats: st(2, 1, 3, 3, 4, 1, 5), endurance: 5, destiny: 7, page: 74 }),
  /**
   * Los doce bloques EN CAJA (RULES.md §8.0): los once personajes con nombre, que el libro imprime en cajas de
   * lunas en vez de en lista, y el Salteador de la aventura de ejemplo. `abilities` es la línea impresa entera —
   * mezcla capacidades y dones—; `capabilities` sólo las capacidades, que son las que aplica el motor.
   *
   * ⚠ Los dones de las cajas PASAN de 5, que es el tope de un personaje jugador (Furia de titán 8, Alegoría de
   * la realidad 9). Son seres míticos, como sus características por encima de 6 (p.21): no se capan.
   */
  // ⚠ Nathael imprime Aguante 4 aunque su Fortaleza 7 + Voluntad 5 dan 12. Se copia lo impreso, como el resto
  // del bestiario (el Aguante del bloque manda sobre la cuenta), pero es el único de los doce que se desvía
  // tanto: si algún día se vuelve a abrir el PDF, esta es la línea que hay que mirar (p.49).
  b('nathael', { stats: st(7, 7, 5, 4, 2, 7, 4), endurance: 4, destiny: 4, abilities: ['Alado', 'Aura sobrenatural 5', 'Disfraz terrenal', 'Ira solar 5'], capabilities: [c('winged'), c('aura', 5), c('earthlyDisguise'), c('solarWrath', 5)], attacks: [at('espadaFlamigera', 9, 11)], page: 49 }),
  b('luz', { stats: st(2, 4, 4, 3, 2, 2, 3), endurance: 6, destiny: 6, abilities: ['Golpe certero 3', 'Separación espiritual 1', 'Trance del destino 2'], attacks: [at('katana', 5, 4)], page: 71 }),
  b('soum', { stats: st(4, 5, 4, 4, 3, 3, 4), endurance: 8, destiny: 10, abilities: ['Defensa de acero 3', 'Golpe certero 4', 'Movimientos felinos 5'], attacks: [at('katanaTreceLunas', 6, 7), at('cuchilloTanto', 5, 5)], page: 72 }),
  b('nergal', { stats: st(6, 8, 5, 4, 2, 7, 4), endurance: 12, destiny: 6, abilities: ['Alado', 'Aura sombría 3', 'Disfraz terrenal', 'Amparo de la noche 4'], capabilities: [c('winged'), c('darkAura', 3), c('earthlyDisguise'), c('nightShelter', 4)], attacks: [at('martilloDeGuerra', 10, 10)], page: 120 }),
  b('samael', { stats: st(8, 9, 4, 5, 2, 3, 5), endurance: 12, destiny: 9, abilities: ['Alado', 'Aura sombría 5', 'Piel de humano', 'Furia de titán 8'], capabilities: [c('winged'), c('darkAura', 5), c('humanSkin')], attacks: [at('martilloDeGuerra', 11, 11)], page: 123 }),
  b('lucifer', { stats: st(8, 9, 5, 4, 4, 3, 7), endurance: 13, destiny: 9, abilities: ['Alado', 'Aura sombría 5', 'Piel de humano', 'Amparo de la noche 5'], capabilities: [c('winged'), c('darkAura', 5), c('humanSkin'), c('nightShelter', 5)], attacks: [at('mandoble', 11, 12)], page: 125 }),
  b('baal', { stats: st(7, 8, 5, 4, 5, 3, 8), endurance: 12, destiny: 9, abilities: ['Alado', 'Aura sombría 5', 'Piel de humano', 'Amparo de la noche 3', 'Deflagración 5'], capabilities: [c('winged'), c('darkAura', 5), c('humanSkin'), c('nightShelter', 3), c('blast', 5)], attacks: [at('espadaOriental', 9, 10)], page: 126 }),
  // El escudo de Gabriel NO es un ataque: es protección 5, y por eso va al campo `protection` del bloque.
  b('gabriel', { stats: st(7, 9, 4, 3, 5, 5, 5), endurance: 11, destiny: 8, protection: 5, abilities: ['Alado', 'Aura 5', 'Disfraz terrenal', 'Ira solar 3', 'Guardián de la Palabra 5', 'Manto de protección 5'], capabilities: [c('winged'), c('aura', 5), c('earthlyDisguise'), c('solarWrath', 3)], attacks: [at('espada', 10, 9)], page: 134 }),
  b('marduk', { stats: st(8, 10, 4, 3, 3, 6, 6), endurance: 11, destiny: 8, abilities: ['Alado', 'Aura 6', 'Ira solar 6', 'Guardián de la Palabra 4'], capabilities: [c('winged'), c('aura', 6), c('solarWrath', 6)], attacks: [at('sablesNegros', 11, 11)], page: 136 }),
  b('adam', { stats: st(6, 4, 6, 6, 6, 6, 6), endurance: 11, destiny: 8, abilities: ['Alegoría de la realidad 9'], attacks: [at('navaja', 4, 7)], page: 139 }),
  // Malefic, la espada soberana (p.163): a una mano da +2 a Combate y daño Fortaleza+4; activando el pomo y
  // GASTANDO 1 de Fortuna pasa a dos manos, +4 y daño Fortaleza+6. Con For 4 / Com 6 sale el «8/10» de la caja.
  b('luzMalefic', { stats: st(4, 6, 5, 4, 3, 2, 3), endurance: 9, destiny: 8, abilities: ['Golpe certero 5', 'Trance del destino 5'], attacks: [at('maleficUnaMano', 8, 8), at('maleficDosManos', 10, 10, 1)], page: 142 }),
  // El Salteador no imprime ataques: «puedes elegir las armas que llevan de la tabla de la página 097».
  b('highwayman', { stats: st(2, 2, 2, 2, 3, 2, 2), endurance: 4, destiny: 1, page: 209 }),
];

// ─── Difficulty presets (manual p.84) ────────────────────────────────────────
export const DIFFICULTIES = [
  { id: 'easy', value: 1 }, { id: 'medium', value: 2 }, { id: 'hard', value: 3 }, { id: 'veryHard', value: 5 }, { id: 'epic', value: 6 },
] as const;
/** Ranged attacks are challenges against the range's difficulty (manual p.96). */
export const RANGE_DIFFICULTY: Record<Exclude<WeaponRange, 'melee'>, number> = { short: 2, medium: 3, long: 5, veryLong: 6 };
/**
 * Hasta dónde llega cada alcance, en metros (p.95–96): corto 20 · medio 50 · largo 200 · muy largo 800.
 *
 * Estaban en el libro y en RULES.md §5.3, pero no en el código, así que nadie podía decir a qué alcance
 * está alguien: el mapa mide la distancia y necesita traducirla a la dificultad del reto.
 */
export const RANGE_METRES: Record<Exclude<WeaponRange, 'melee'>, number> = { short: 20, medium: 50, long: 200, veryLong: 800 };
/**
 * A partir de cuántos metros deja de ser cuerpo a cuerpo. El libro SÍ lo dice: a distancia es no poder
 * tocarse rápidamente, «a más de tres pasos» (p.95), y cuerpo a cuerpo «lo suficientemente cerca como para
 * tocarse» (p.92). ⚠ interpretación sólo en la unidad: un paso ≈ 1 m → **3 metros, dos casillas** (1,5 m
 * cada una), que es lo que dibuja el `.pen` («Karen está a 2 casillas: cuerpo a cuerpo»). Y como el libro
 * mide entre los personajes —si pueden tocarse—, la distancia que se compara con esto es el HUECO entre los
 * cuerpos (borde a borde), no entre los centros (RULES.md §5.3): la mide `tokenGapCells` en el mapa.
 */
export const MELEE_METRES = 3;
/**
 * El alcance al que está algo, por su distancia en metros. `melee` mientras esté al alcance de la mano;
 * `null` cuando se pasa del muy largo, que es donde ya no se le puede disparar (p.96).
 */
export function rangeForMetres(metres: number): WeaponRange | null {
  if (metres <= MELEE_METRES) return 'melee';
  for (const id of ['short', 'medium', 'long', 'veryLong'] as const) if (metres <= RANGE_METRES[id]) return id;
  return null;
}

/**
 * Los alcances de disparo, de cerca a lejos (p.95–96). Van en `catalogs` —y no sueltos— para que el
 * desplegable de disparar pueda leerlos sin saber de qué sistema es la ficha: `data.difficulty` es la
 * dificultad del reto, y el orden del array es el que dice cuáles quedan FUERA del arma (un arma llega
 * hasta su propio alcance y no más lejos).
 */
export const RANGES: (CatalogItem & { data: { difficulty: number } })[] =
  (['short', 'medium', 'long', 'veryLong'] as const).map(id => ({ id, label: `sheet.range.${id}`, ref: 'ranged', data: { difficulty: RANGE_DIFFICULTY[id], maxMetres: RANGE_METRES[id] } }));

// ─── Recovery (manual p.101) ─────────────────────────────────────────────────
/** Resting time (days) and Fortitude-roll difficulty to regain one health level; `restFactor` × Endurance = Resistance recoverable by rest. */
export const RECOVERY: Record<HealthId, { days: number | null; difficulty: number | null; restFactor: number }> = {
  healthy: { days: null, difficulty: null, restFactor: 3 },
  bruised: { days: 1, difficulty: 2, restFactor: 3 },
  wounded: { days: 7, difficulty: 3, restFactor: 2 },
  badlyWounded: { days: 14, difficulty: 4, restFactor: 1 },
  dead: { days: null, difficulty: null, restFactor: 0 },
};

// ─── Assembled `GameSystem.catalogs` ─────────────────────────────────────────
export const catalogs: Catalogs = {
  stats: STAT_IDS.map(id => ({ id, label: `sheet.stats.${id}`, ref: 'stats' })),
  weapons: WEAPONS,
  armours: ARMOURS,
  equipment: EQUIPMENT,
  gifts: GIFTS,
  specialties: SPECIALTY_ITEMS,
  creatureSpecialties: CREATURE_SPECIALTY_ITEMS,
  sizes: SIZES.map(s => ({ id: s.id, label: `catalog.sizes.${s.id}`, data: { mod: s.mod } })),
  healthLevels: HEALTH_LEVELS.map(h => ({ id: h.id, label: `sheet.health.${h.id}`, ref: 'health', data: { penalty: h.penalty } })),
  difficulties: DIFFICULTIES.map(d => ({ id: d.id, label: `roll.difficulty.${d.id}`, ref: 'difficulty', data: { value: d.value } })),
  ranges: RANGES,
  bestiary: BESTIARY,
  capabilities: CAPABILITIES,
};

export const weaponById = (id: string) => WEAPONS.find(x => x.id === id) ?? null;
/**
 * Una especialidad por su id (`combat.shortWeapons`, `creature.garrote`), mire quien mire: el desglose
 * del Registro necesita su NOMBRE («Especialidad "Armas cortas"»), y la ficha sólo guarda el id.
 * Busca en las dos listas porque el director tira también en nombre de criaturas, que llevan las suyas.
 */
export const specialtyById = (id: string): CatalogItem | null =>
  SPECIALTY_ITEMS.find(x => x.id === id) ?? CREATURE_SPECIALTY_ITEMS.find(x => x.id === id) ?? null;
export const armourById = (id: string) => ARMOURS.find(x => x.id === id) ?? null;
export const sizeMod = (id: unknown): number => SIZES.find(s => s.id === id)?.mod ?? 0;
