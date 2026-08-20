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
  /** Capacidades del bloque (p.107–108), como texto del libro para que el director las lea. */
  abilities: string[];
  /** Página del manual donde está el bloque. */
  page: number;
  /** Resistencia = Aguante × 3 (p.25). Se guarda calculada para no repetir la cuenta en cada consumidor. */
  resistance: number;
  /** Una especialidad por característica, como las imprime el bloque. Ids de `SPECIALTY_ITEMS` o `creature.*`. */
  specialties: Partial<Record<StatId, string[]>>;
  notes: string;
}
type Block = { stats: Partial<Record<StatId, number>>; endurance: number; destiny: number; protection?: number; abilities?: string[]; page: number };
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
  { id: 'creature.espadasYCuchillosSamurais', label: 'catalog.creatureSpecialties.espadasYCuchillosSamurais', ref: 'specialty' },
  { id: 'creature.fijacion', label: 'catalog.creatureSpecialties.fijacion', ref: 'specialty' },
  { id: 'creature.garrote', label: 'catalog.creatureSpecialties.garrote', ref: 'specialty' },
  { id: 'creature.hachasYMachetes', label: 'catalog.creatureSpecialties.hachasYMachetes', ref: 'specialty' },
  { id: 'creature.hachuelaDeCocina', label: 'catalog.creatureSpecialties.hachuelaDeCocina', ref: 'specialty' },
  { id: 'creature.lanzaYEspada', label: 'catalog.creatureSpecialties.lanzaYEspada', ref: 'specialty' },
  { id: 'creature.mandoble', label: 'catalog.creatureSpecialties.mandoble', ref: 'specialty' },
  { id: 'creature.mantenerseDePie', label: 'catalog.creatureSpecialties.mantenerseDePie', ref: 'specialty' },
  { id: 'creature.mordisco', label: 'catalog.creatureSpecialties.mordisco', ref: 'specialty' },
  { id: 'creature.obedienciaCiega', label: 'catalog.creatureSpecialties.obedienciaCiega', ref: 'specialty' },
  { id: 'creature.permanecerInmovil', label: 'catalog.creatureSpecialties.permanecerInmovil', ref: 'specialty' },
  { id: 'creature.persecucionALaCarrera', label: 'catalog.creatureSpecialties.persecucionALaCarrera', ref: 'specialty' },
  { id: 'creature.picadoDeGarras', label: 'catalog.creatureSpecialties.picadoDeGarras', ref: 'specialty' },
  { id: 'creature.predicar', label: 'catalog.creatureSpecialties.predicar', ref: 'specialty' },
  { id: 'creature.saltarALaEspaldaDeLaVictima', label: 'catalog.creatureSpecialties.saltarALaEspaldaDeLaVictima', ref: 'specialty' },
  { id: 'creature.temeridad', label: 'catalog.creatureSpecialties.temeridad', ref: 'specialty' },
  { id: 'creature.tijeras', label: 'catalog.creatureSpecialties.tijeras', ref: 'specialty' },
  { id: 'creature.unasYDientes', label: 'catalog.creatureSpecialties.unasYDientes', ref: 'specialty' },
  { id: 'creature.volarLargasDistancias', label: 'catalog.creatureSpecialties.volarLargasDistancias', ref: 'specialty' },
  { id: 'creature.vueloAcrobatico', label: 'catalog.creatureSpecialties.vueloAcrobatico', ref: 'specialty' },
  { id: 'creature.vueloEnPicado', label: 'catalog.creatureSpecialties.vueloEnPicado', ref: 'specialty' },
];

const b = (id: string, k: Block): CatalogItem & { data: BestiaryData } => ({
  id, label: `catalog.bestiary.${id}.name`, ref: 'bestiary',
  data: { stats: k.stats, endurance: k.endurance, destiny: k.destiny, protection: k.protection ?? 0, abilities: k.abilities ?? [], page: k.page, resistance: k.endurance * 3, specialties: CREATURE_SPECIALTIES[id] ?? {}, notes: `catalog.bestiary.${id}.notes` },
});
const st = (fortitude: number, combat: number, will: number, cunning: number, subtlety: number, presence: number, culture: number) =>
  ({ fortitude, combat, will, cunning, subtlety, presence, culture });

export const BESTIARY = [
  // Criaturas (capítulo de criaturas, pp. 147–155)
  b('hungry', { stats: st(3, 3, 1, 4, 0, 0, 0), endurance: 4, destiny: 0, abilities: ['Hambre inhumana'], page: 150 }),
  b('ogre', { stats: st(8, 4, 1, 3, 1, 1, 0), endurance: 10, destiny: 0, protection: 3, abilities: ['Piel gruesa 3'], page: 152 }),
  b('ghost', { stats: st(0, 0, 3, 2, 2, 1, 3), endurance: 0, destiny: 10, abilities: ['Ancla terrenal', 'Incorpóreo', 'Mano inmaterial 3'], page: 149 }),
  b('possessed', { stats: st(2, 2, 2, 2, 0, 0, 0), endurance: 4, destiny: 0, abilities: ['Inmune al dolor'], page: 149 }),
  b('cherub', { stats: st(2, 2, 2, 1, 3, 0, 0), endurance: 3, destiny: 0, abilities: ['Ponzoña 3', 'Visión en la oscuridad'], page: 155 }),
  b('harpy', { stats: st(4, 3, 1, 4, 4, 0, 0), endurance: 5, destiny: 2, abilities: ['Alado', 'Visión en la oscuridad'], page: 147 }),
  // Sobrenaturales (lunares y solares)
  b('lunar', { stats: st(7, 6, 3, 4, 3, 2, 3), endurance: 10, destiny: 7, abilities: ['Alado', 'Aura sombría 2', 'Piel de humano'], page: 120 }),
  b('fallenElite', { stats: st(7, 7, 4, 4, 3, 3, 4), endurance: 11, destiny: 8, abilities: ['Alado', 'Aura sombría 3', 'Piel de humano'], page: 124 }),
  b('solar', { stats: st(6, 7, 4, 3, 2, 3, 3), endurance: 10, destiny: 7, abilities: ['Alado', 'Aura 2', 'Disfraz terrenal', 'Ira solar 2'], page: 132 }),
  b('solarPaladin', { stats: st(6, 8, 5, 3, 2, 4, 4), endurance: 7, destiny: 8, abilities: ['Alado', 'Aura 3', 'Disfraz terrenal', 'Ira solar 3'], page: 132 }),
  b('aamel', { stats: st(6, 8, 5, 4, 3, 4, 5), endurance: 11, destiny: 8, abilities: ['Alado', 'Aura 3', 'Disfraz terrenal', 'Ira solar 2'], page: 132 }),
  b('azelias', { stats: st(6, 7, 4, 3, 5, 5, 5), endurance: 10, destiny: 8, abilities: ['Alado', 'Aura 2', 'Disfraz terrenal', 'Ira solar 3'], page: 132 }),
  // Humanos hostiles y figuras de la ambientación (pp. 44–74, 98)
  b('mutant', { stats: { fortitude: 3, combat: 3, will: 1 }, endurance: 4, destiny: 0, protection: 2, abilities: ['Piel curtida'], page: 98 }),
  b('scavenger', { stats: st(3, 3, 3, 2, 2, 3, 2), endurance: 6, destiny: 1, page: 74 }),
  b('wanderer', { stats: st(2, 1, 3, 3, 1, 4, 3), endurance: 5, destiny: 4, page: 69 }),
  b('gangster', { stats: st(2, 3, 1, 3, 1, 3, 2), endurance: 3, destiny: 1, page: 62 }),
  b('jihadist', { stats: st(2, 3, 3, 2, 3, 2, 2), endurance: 5, destiny: 2, page: 62 }),
  b('dragon', { stats: st(3, 2, 3, 2, 1, 2, 1), endurance: 6, destiny: 1, page: 63 }),
  b('latinGang', { stats: st(3, 2, 2, 3, 1, 2, 1), endurance: 5, destiny: 1, page: 61 }),
  b('paramilitary', { stats: st(3, 3, 1, 3, 1, 2, 2), endurance: 4, destiny: 2, page: 61 }),
  b('edenSeeker', { stats: st(2, 1, 2, 2, 3, 2, 2), endurance: 4, destiny: 1, page: 61 }),
  b('kibbutzMember', { stats: st(1, 1, 2, 2, 3, 3, 2), endurance: 3, destiny: 2, page: 61 }),
  b('paradiseMartyr', { stats: st(2, 2, 2, 3, 3, 2, 2), endurance: 4, destiny: 2, page: 57 }),
  b('occultNetizen', { stats: st(2, 1, 2, 2, 3, 2, 3), endurance: 4, destiny: 1, page: 59 }),
  b('dimaGang', { stats: st(3, 4, 2, 3, 1, 2, 3), endurance: 5, destiny: 1, page: 59 }),
  b('newOrderFollower', { stats: st(2, 1, 3, 2, 2, 2, 3), endurance: 5, destiny: 1, page: 59 }),
  b('illuminatiCharlatan', { stats: st(2, 1, 1, 3, 3, 3, 3), endurance: 5, destiny: 1, page: 63 }),
  b('miyamotoSoldier', { stats: st(2, 3, 2, 3, 2, 2, 1), endurance: 4, destiny: 1, page: 64 }),
  b('littleTokyoThug', { stats: st(3, 3, 2, 2, 3, 1, 1), endurance: 5, destiny: 2, page: 65 }),
  b('cannibalCook', { stats: st(2, 3, 1, 3, 2, 1, 1), endurance: 3, destiny: 7, page: 69 }),
  b('maggie', { stats: st(2, 1, 3, 3, 3, 3, 1), endurance: 5, destiny: 7, page: 68 }),
  b('fluteFool', { stats: st(4, 1, 3, 1, 2, 1, 4), endurance: 7, destiny: 4, page: 69 }),
  b('ramirez', { stats: st(4, 4, 2, 4, 2, 2, 2), endurance: 6, destiny: 2, page: 69 }),
  b('jellybean', { stats: st(2, 1, 2, 2, 2, 3, 4), endurance: 4, destiny: 3, page: 74 }),
  b('hermes', { stats: st(1, 1, 3, 3, 2, 2, 4), endurance: 4, destiny: 4, page: 67 }),
  b('judith', { stats: st(2, 1, 3, 3, 1, 4, 3), endurance: 5, destiny: 4, page: 67 }),
  b('henryPutnam', { stats: st(1, 2, 4, 3, 4, 3, 2), endurance: 5, destiny: 8, page: 44 }),
  b('dorcy', { stats: st(2, 1, 3, 1, 3, 3, 1), endurance: 5, destiny: 6, page: 44 }),
  b('silhouette', { stats: st(3, 3, 1, 2, 2, 2, 1), endurance: 4, destiny: 1, page: 57 }),
  b('bigDima', { stats: st(4, 4, 3, 4, 3, 3, 4), endurance: 7, destiny: 7, page: 59 }),
  b('thirteenMoonsSister', { stats: st(4, 5, 3, 4, 4, 2, 3), endurance: 7, destiny: 4, abilities: ['Defensa de acero 2', 'Movimientos felinos 2'], page: 67 }),
  b('jacobite', { stats: st(2, 2, 3, 1, 2, 3, 2), endurance: 6, destiny: 1, page: 67 }),
  b('george', { stats: st(3, 3, 1, 3, 2, 2, 1), endurance: 4, destiny: 7, page: 68 }),
  b('diane', { stats: st(2, 3, 3, 3, 3, 2, 2), endurance: 5, destiny: 2, page: 74 }),
  b('allenDallas', { stats: st(2, 1, 3, 3, 4, 1, 5), endurance: 5, destiny: 7, page: 74 }),
];

// ─── Difficulty presets (manual p.84) ────────────────────────────────────────
export const DIFFICULTIES = [
  { id: 'easy', value: 1 }, { id: 'medium', value: 2 }, { id: 'hard', value: 3 }, { id: 'veryHard', value: 5 }, { id: 'epic', value: 6 },
] as const;
/** Ranged attacks are challenges against the range's difficulty (manual p.96). */
export const RANGE_DIFFICULTY: Record<Exclude<WeaponRange, 'melee'>, number> = { short: 2, medium: 3, long: 5, veryLong: 6 };

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
  bestiary: BESTIARY,
};

export const weaponById = (id: string) => WEAPONS.find(x => x.id === id) ?? null;
export const armourById = (id: string) => ARMOURS.find(x => x.id === id) ?? null;
export const sizeMod = (id: unknown): number => SIZES.find(s => s.id === id)?.mod ?? 0;
