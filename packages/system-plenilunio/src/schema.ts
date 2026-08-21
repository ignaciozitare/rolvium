// ─── Sheet schema · Malefic Time: Plenilunio ─────────────────────────────────
// Declares the character sheet as data (sections + fields) so the platform's
// generic <Sheet> renders it. Field ids are the keys of the sheet's `data` jsonb.
// Derived fields (`derived: true`) are computed by engine.derived and are not
// stored by newSheet(). Manual pages: stats p.20–21, roll p.82–84, state p.98–99, p.88–89. See RULES.md.
import type { FieldDef, SectionDef, SheetData, SheetSchema } from '@rolvium/core';
import {
  ARMOURS, DIFFICULTIES, EQUIPMENT, GIFTS, HEALTH_LEVELS, SIZES, STAT_IDS, WEAPONS, isCapabilityId, specialtiesFor, weaponById,
  type CreatureCapability, type HealthId, type StatId,
} from './catalogs';

export const SHEET_VERSION = '1';

/** Value stored under each stat field id (`fortitude`, `combat`…). */
export interface StatValue { value: number; specialties: string[] }
/** Row of the `weapons` table. `id` is a catalog weapon id (or a custom id when `custom` is set). */
export interface WeaponRow { id: string; ammo: number | null; custom?: { label: string; bonus: number; damage: number; strength: boolean; range: string; magazine: number | null } }
/** Row of the `gifts` list. */
export interface GiftRow { id: string; level: number }
/** Row of the `equipment` list. */
export interface EquipmentRow { id: string; label?: string }

/** Character-creation presets (points / max per stat), manual p.21: 16/5 · 21/5 · 25/6 · 30/10. */
export const PRESETS = [
  { id: 'human', points: 16, maxStat: 5 },
  { id: 'standard', points: 21, maxStat: 5 },
  { id: 'legendary', points: 25, maxStat: 6 },
  { id: 'mythic', points: 30, maxStat: 10 },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];
export const DEFAULT_PRESET: PresetId = 'standard';

const yesNo = (id: string, label: string, ref?: string, hidden = false): FieldDef => ({
  id, type: 'select', label, ...(ref ? { ref } : {}), ...(hidden ? { hidden: true } : {}),
  options: [{ value: 'no', label: 'sheet.common.no' }, { value: 'yes', label: 'sheet.common.yes' }],
});

const statField = (id: StatId): FieldDef => ({
  id, type: 'stat', label: `sheet.stats.${id}`, ref: 'stats', min: 1, max: 10, action: 'roll',
  itemFields: [{ id: 'specialties', type: 'select', label: 'sheet.stats.specialty', ref: 'specialty', options: specialtiesFor(id).map(s => ({ value: s.id, label: s.label })) }],
});

export const sections: SectionDef[] = [
  { id: 'identity', label: 'sheet.sections.identity', layout: 'grid', fields: [
    { id: 'name', type: 'text', label: 'sheet.identity.name' },
    { id: 'player', type: 'text', label: 'sheet.identity.player' },
    { id: 'concept', type: 'text', label: 'sheet.identity.concept' },
    { id: 'avatar', type: 'image', label: 'sheet.identity.avatar' },
    { id: 'size', type: 'select', label: 'sheet.identity.size', ref: 'size', options: SIZES.map(s => ({ value: s.id, label: `catalog.sizes.${s.id}` })) },
  ] },
  { id: 'roll', label: 'sheet.sections.roll', layout: 'row', fields: [
    { id: 'difficulty', type: 'select', label: 'sheet.roll.difficulty', ref: 'difficulty', options: DIFFICULTIES.map(d => ({ value: String(d.value), label: `roll.difficulty.${d.id}` })) },
    yesNo('useSpecialty', 'sheet.roll.specialty', 'specialty'),
    yesNo('useArmour', 'sheet.roll.armour', 'armours'),
    { id: 'extraDice', type: 'number', label: 'sheet.roll.extra', min: 0, max: 5 },
  ] },
  { id: 'stats', label: 'sheet.sections.stats', layout: 'stack', fields: STAT_IDS.map(statField) },
  // ⚠ NADA de `span: 2` aquí. Se probó para cerrar el hueco de la derecha de Estado y salió peor: la
  // tarjeta se quedó con el doble de ancho y el mismo contenido, o sea un vacío enorme bajo «Recibir
  // daño» (visto en producción por el dueño, 2026-08-19). El hueco no se arregla ensanchando: se
  // arregla componiendo los 12 campos de la sección como los tiene el `.pen`, y eso es su propia tanda.
  // Orden pensado, no el que salió: primero los tres numeros que MIDEN el cuerpo (aguante, la
  // Resistencia maxima que permite tu estado y la penalizacion que arrastra), luego los dos marcadores
  // que se tocan en mesa (las casillas y las lunas), y al final los recursos que se gastan (destino,
  // fortuna, experiencia) con sus calculados debajo.
  // Los numeros CALCULADOS van SEGUIDOS: la ficha agrupa cada tanda en una fila de tarjetas cuadradas
  // centradas (`groupTiles` → `rv-sheet-tiles`), y una tarjeta sola en su fila se ve descolgada.
  // «Resistencia recuperable descansando» YA NO EXISTE: era el mismo numero que «Resistencia maxima»
  // con otro nombre (p.101, RULES.md §6.3). Y «Inconsciente» tampoco: no se elige a mano — sale como
  // aviso bajo las lunas (`note`). Al salir los dos de la rejilla, Destino · Fortuna · Experiencia
  // caben en UNA fila de tres, que es justo como los pidio el dueno (2026-08-19).
  { id: 'state', label: 'sheet.sections.state', layout: 'grid', fields: [
    { id: 'endurance', type: 'number', label: 'sheet.state.endurance', ref: 'endurance', derived: true },
    // `ref: 'recovery'` (p.101) y no `'resistance'` (p.98): este numero SALE de la tabla de
    // recuperacion —lo baja el estado de salud—, y al desaparecer «Resistencia recuperable» esa
    // referencia se quedo sin ningun campo que la enseñara. Asi el tooltip explica por que pone 12
    // y no 18. La regla base de la Resistencia sigue en las casillas, que llevan `ref: 'resistance'`.
    { id: 'resistanceMax', type: 'number', label: 'sheet.state.resistanceMax', ref: 'recovery', derived: true },
    { id: 'dicePenalty', type: 'number', label: 'sheet.state.dicePenalty', ref: 'health', derived: true },
    { id: 'resistance', type: 'boxes', label: 'sheet.state.resistance', ref: 'resistance', min: 0, max: 66 },
    // El sexto nivel de salud del manual (p.101) NO es una fase de luna: se puede estar Herido E
    // Inconsciente a la vez, y no se elige — lo calcula `applyDamage` al quedarse sin Resistencia.
    { id: 'health', type: 'health', label: 'sheet.state.health', ref: 'health', options: HEALTH_LEVELS.map(h => ({ value: h.id, label: `sheet.health.${h.id}` })), note: sheet => (sheet.unconscious === 'yes' || sheet.unconscious === true ? 'sheet.state.unconsciousNote' : null) },
    // Los tres contadores llenan la fila de la rejilla, y debajo la pareja de calculados que arrastran:
    // Fortuna maxima cae centrada justo bajo Fortuna. La Fortuna NO lleva `max` propio: su techo es el
    // Destino (p.90, tope duro) y la ficha lo lee de `fortuneMax`, como las casillas leen su maximo.
    // Se GUARDA (lo escriben `applyDamage` y `rest`) y por eso sigue declarado —`validateSheet` rechaza
    // toda clave que el esquema no conozca—, pero no se pinta como campo: sale de `note`, arriba.
    yesNo('unconscious', 'sheet.state.unconscious', 'health', true),
    { id: 'destiny', type: 'counter', label: 'sheet.state.destiny', ref: 'destiny', min: 1, max: 10 },
    { id: 'fortune', type: 'counter', label: 'sheet.state.fortune', ref: 'fortune', min: 0 },
    { id: 'xp', type: 'counter', label: 'sheet.state.xp', ref: 'xp', min: 0 },
    { id: 'fortuneMax', type: 'number', label: 'sheet.state.fortuneMax', ref: 'fortune', derived: true },
    { id: 'giftPoints', type: 'number', label: 'sheet.state.giftPoints', ref: 'gifts', derived: true },
  ] },
  { id: 'weapons', label: 'sheet.sections.weapons', layout: 'stack', fields: [
    { id: 'weapons', type: 'table', label: 'sheet.weapons.list', ref: 'weapons', action: 'attack', columns: [
      { id: 'id', type: 'select', label: 'sheet.weapons.name', options: WEAPONS.map(x => ({ value: x.id, label: x.label })) },
      { id: 'bonus', type: 'number', label: 'sheet.weapons.bonus', derived: true },
      { id: 'damage', type: 'text', label: 'sheet.weapons.damage', derived: true },
      // El alcance se lee «Medio» y los metros con la dificultad salen en un tooltip (`hint`): en linea
      // ocupaban media tabla. Cuerpo a cuerpo no lleva pista — no tiene metros ni reto (p.95–96).
      { id: 'range', type: 'text', label: 'sheet.weapons.range', derived: true, options: (['melee', 'short', 'medium', 'long', 'veryLong'] as const).map(r => ({ value: r, label: `sheet.range.${r}`, ...(r === 'melee' ? {} : { hint: `sheet.rangeHint.${r}` }) })) },
      // Sólo las armas de fuego tienen cargador: el libro pone «-» en las nueve de cuerpo a cuerpo
      // (p.97) y `magazine` es null en el catálogo. Sin esto salían unas Nudilleras con 14 balas.
      // Dos columnas distintas y a menudo confundidas: `ammo` es lo que hay EN el cargador y `reserve`
      // las balas sueltas que llevas encima. Recargar mueve de la segunda a la primera. Ninguna aparece
      // en las armas cuerpo a cuerpo: el libro les pone «-» en Cargador (p.97).
      // El cargador NO se toca a mano (dueño): lo bajan los disparos y lo sube el botón de recargar.
      // `derived` aquí no significa «calculado del catálogo», significa «no editable en la tabla»:
      // la celda pinta el valor que la fila ya guarda.
      { id: 'ammo', type: 'counter', label: 'sheet.weapons.ammo', min: 0, derived: true, appliesToRow: row => weaponById(str(row['id']))?.data.magazine != null },
      // La Municion no pasa de lo que cabe en el cargador (dueno, 2026-08-21): sin techo el contador
      // subia sin fin, y recargar nunca podia traspasar mas de una carga de todos modos. Se capa la
      // SUBIDA, nunca la bajada: una ficha guardada con mas balas conserva las suyas y puede gastarlas.
      { id: 'reserve', type: 'counter', label: 'sheet.weapons.reserve', min: 0, appliesToRow: row => weaponById(str(row['id']))?.data.magazine != null, maxForRow: row => weaponById(str(row['id']))?.data.magazine ?? undefined },
    ] },
  ] },
  { id: 'gifts', label: 'sheet.sections.gifts', layout: 'stack', span: 2, fields: [
    { id: 'gifts', type: 'list', label: 'sheet.gifts.list', ref: 'gifts', action: 'gift.activate', itemFields: [
      { id: 'id', type: 'select', label: 'sheet.gifts.name', options: GIFTS.map(g => ({ value: g.id, label: g.label })) },
      { id: 'level', type: 'counter', label: 'sheet.gifts.level', min: 1, max: 5 },
    ] },
  ] },
  { id: 'equipment', label: 'sheet.sections.equipment', layout: 'stack', span: 2, fields: [
    { id: 'equipment', type: 'list', label: 'sheet.equipment.list', itemFields: [
      { id: 'id', type: 'select', label: 'sheet.equipment.name', options: EQUIPMENT.map(e => ({ value: e.id, label: e.label })) },
    ] },
  ] },
  // `stack` y no `row`: `row` la marca como ancha y ocupaba una fila entera. El dueño la quiere en
  // columna, junto a Dones y Equipo, con Armas encima a todo el ancho (rolvium.pen, ficha 2026-08-19).
  { id: 'armour', label: 'sheet.sections.armour', layout: 'stack', span: 2, fields: [
    { id: 'armour', type: 'select', label: 'sheet.armour.worn', ref: 'armours', options: ARMOURS.map(x => ({ value: x.id, label: x.label })) },
    { id: 'protection', type: 'number', label: 'sheet.armour.protection', ref: 'armours', derived: true },
    { id: 'armourPenalty', type: 'number', label: 'sheet.armour.penalty', ref: 'armours', derived: true },
  ] },
  { id: 'story', label: 'sheet.sections.story', layout: 'stack', fields: [
    { id: 'story', type: 'longtext', label: 'sheet.story.text' },
  ] },
  { id: 'creation', label: 'sheet.sections.creation', layout: 'row', fields: [
    { id: 'preset', type: 'select', label: 'sheet.creation.preset', ref: 'stats', options: PRESETS.map(p => ({ value: p.id, label: `generator.preset.${p.id}` })) },
    { id: 'specialtyTrade', type: 'counter', label: 'sheet.creation.specialtyTrade', ref: 'specialty', min: 0, max: 2 },
    { id: 'giftTrade', type: 'counter', label: 'sheet.creation.giftTrade', ref: 'gifts', min: 0, max: 2 },   // máx. 2 canjes, el segundo con permiso del DJ (RULES.md §1.5), igual que specialtyTrade
  ] },
];

export const sheetSchema: SheetSchema = { version: SHEET_VERSION, sections };

/** All non-derived field defs, flattened (top level only). */
export const storedFields = (): FieldDef[] => sections.flatMap(s => s.fields).filter(f => !f.derived);
export const fieldById = (id: string): FieldDef | null => sections.flatMap(s => s.fields).find(f => f.id === id) ?? null;

/** Default value for a field, per its type and per Plenilunio rules (destiny 3, health healthy…). */
export function defaultFor(field: FieldDef): unknown {
  switch (field.id) {
    case 'destiny': return 3;
    case 'fortune': return 3;
    case 'difficulty': return '2';
    case 'size': return 'medium';
    case 'armour': return 'none';
    case 'health': return 'healthy' satisfies HealthId;
    case 'preset': return DEFAULT_PRESET;
    case 'resistance': return 6; // (1+1)×3 for a blank sheet; the generator recomputes it
  }
  switch (field.type) {
    case 'text': case 'longtext': case 'image': return '';
    case 'number': case 'counter': case 'boxes': return field.min ?? 0;
    case 'select': return field.options?.[0]?.value ?? '';
    case 'list': case 'table': return [];
    case 'health': return HEALTH_LEVELS[0].id;
    case 'stat': return { value: 1, specialties: [] } satisfies StatValue;
  }
  /* c8 ignore next */
  return null;
}

/** Blank sheet respecting the schema: every stored field present with its default; derived fields absent. */
export function newSheet(): SheetData {
  return Object.fromEntries(storedFields().map(f => [f.id, defaultFor(f)]));
}

// ─── Typed readers (tolerant: never throw on malformed jsonb) ────────────────
export const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
export function statOf(sheet: SheetData, id: StatId): StatValue {
  const raw = sheet[id];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return { value: num(o.value, 1), specialties: Array.isArray(o.specialties) ? o.specialties.filter((s): s is string => typeof s === 'string') : [] };
  }
  return { value: num(raw, 1), specialties: [] };
}
export const healthOf = (sheet: SheetData): HealthId => {
  const h = sheet.health;
  return HEALTH_LEVELS.some(l => l.id === h) ? (h as HealthId) : 'healthy';
};
export const weaponsOf = (sheet: SheetData): WeaponRow[] => (Array.isArray(sheet.weapons) ? sheet.weapons as WeaponRow[] : []);
export const giftsOf = (sheet: SheetData): GiftRow[] => (Array.isArray(sheet.gifts) ? sheet.gifts as GiftRow[] : []);
/**
 * Las capacidades de una criatura (p.107–108), cuando la «ficha» que recibe el motor es un bloque del
 * bestiario. Las fichas de personaje no llevan ninguna y devuelven la lista vacía: las capacidades son
 * poderes innatos de las criaturas no humanas, no algo que un jugador pueda tener.
 *
 * No está en el esquema de la ficha a propósito —no es un campo que nadie teclee— y por eso se lee
 * tolerante, como el resto: un `jsonb` malformado devuelve vacío en vez de reventar la tirada.
 */
export const capabilitiesOf = (sheet: SheetData): CreatureCapability[] =>
  (Array.isArray(sheet.capabilities) ? sheet.capabilities : [])
    .filter((c): c is CreatureCapability => !!c && typeof c === 'object' && isCapabilityId((c as { id?: unknown }).id));
