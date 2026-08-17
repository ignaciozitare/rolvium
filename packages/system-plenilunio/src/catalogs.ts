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

// ─── Base bestiary (mutant p.100, ogre p.152; loner/scavenger are prototype templates, not manual blocks) ──
export interface BestiaryData { resistance: number; protection: number; notes: string }
const b = (id: string, resistance: number, protection: number): CatalogItem & { data: BestiaryData } =>
  ({ id, label: `catalog.bestiary.${id}.name`, data: { resistance, protection, notes: `catalog.bestiary.${id}.notes` } });
export const BESTIARY = [b('mutant', 12, 2), b('loner', 18, 0), b('ogre', 30, 3), b('scavenger', 9, 0)];

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
  sizes: SIZES.map(s => ({ id: s.id, label: `catalog.sizes.${s.id}`, data: { mod: s.mod } })),
  healthLevels: HEALTH_LEVELS.map(h => ({ id: h.id, label: `sheet.health.${h.id}`, ref: 'health', data: { penalty: h.penalty } })),
  difficulties: DIFFICULTIES.map(d => ({ id: d.id, label: `roll.difficulty.${d.id}`, ref: 'difficulty', data: { value: d.value } })),
  bestiary: BESTIARY,
};

export const weaponById = (id: string) => WEAPONS.find(x => x.id === id) ?? null;
export const armourById = (id: string) => ARMOURS.find(x => x.id === id) ?? null;
export const sizeMod = (id: unknown): number => SIZES.find(s => s.id === id)?.mod ?? 0;
