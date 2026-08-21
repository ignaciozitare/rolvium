/**
 * Reglas del Bestiario (H5) — spec: specs/modules/bestiary/SPEC.md
 *
 * El listado del director une DOS fuentes con formas distintas: los bloques del manual (`CatalogItem`
 * del paquete del sistema, con la etiqueta como clave i18n) y sus entradas propias (filas ya mapeadas).
 * Aquí se normalizan a una sola forma para que el resto del hexágono no tenga que saber de cuál viene.
 *
 * Lo que NO está aquí, a propósito: el buscador (`filterEntries`) y las iniciales del token (`initialsOf`)
 * ya existen en `maps` y se reutilizan tal cual. Son genéricas y candidatas a subir a `packages/`, pero
 * moverlas ahora sería tocar `maps` sin que nadie lo haya pedido.
 */
import type { CatalogItem } from '@rolvium/core';
import type { StatId } from '@rolvium/system-plenilunio';
import type { BestiaryEntry, CreatureData, NewBestiaryEntry, OriginFilter } from '../entities/BestiaryEntry';

/** Resistencia = Aguante × 3 (p.25). Nunca se teclea ni se guarda en la fila: se calcula. */
export const resistanceOf = (data: Pick<CreatureData, 'endurance'>): number => data.endurance * 3;

const EMPTY: CreatureData = { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {} };

/**
 * Un bloque del manual, normalizado. `label` es una clave i18n, así que el nombre ya traducido entra
 * por parámetro — el dominio no traduce.
 */
export function fromCatalog(item: CatalogItem, name: string, notes: string): BestiaryEntry {
  const d = (item.data ?? {}) as Partial<CreatureData>;
  return {
    id: item.id,
    origin: 'manual',
    name,
    notes,
    tokenUrl: null,
    sourceRef: null,
    campaignId: null,
    editable: false,           // las del manual no se editan ni se borran: se duplican
    data: {
      stats: d.stats ?? {},
      endurance: d.endurance ?? 0,
      destiny: d.destiny ?? 0,
      protection: d.protection ?? 0,
      abilities: d.abilities ?? [],
      capabilities: d.capabilities ?? [],
      attacks: d.attacks ?? [],
      specialties: d.specialties ?? {},
      page: d.page,
    },
  };
}

/**
 * Devuelve la entrada con la forma de `CatalogItem` que ya consumen `EncounterMenu` y `tokenFromBestiary`
 * de `maps`. Así colocar en escena sigue siendo el camino que ya funciona, sin tocarlo.
 *
 * `resistance` viaja en `data` porque es lo que `tokenFromBestiary` copia al estado de la instancia: es
 * ahí donde vive la Resistencia de ESE ogro concreto, y por eso herir a uno no hiere al otro.
 */
export function toCatalogItem(entry: BestiaryEntry): CatalogItem {
  return {
    id: entry.id,
    label: entry.name,          // ya traducido; `EncounterMenu` recibe su propio `labelOf`
    ref: 'bestiary',
    data: {
      resistance: resistanceOf(entry.data),
      protection: entry.data.protection,
      origin: entry.origin,
      tokenUrl: entry.tokenUrl,
      /** Sólo las propias tienen fila; es lo que rellena `maps_tokens.bestiary_entry_id`. */
      entryId: entry.origin === 'manual' ? null : entry.id,
    },
  };
}

/**
 * El listado completo: primero las del manual, después las propias. El orden importa poco, pero ser
 * estable importa mucho — un listado que se reordena solo al recargar es imposible de usar.
 */
export function mergeEntries(manual: BestiaryEntry[], own: BestiaryEntry[]): BestiaryEntry[] {
  return [...manual, ...own].sort((a, b) => a.name.localeCompare(b.name));
}

/** Filtro de origen del listado. `npc` son los PNJ con ficha completa; `custom` los encuentros propios. */
export const byOrigin = (entries: BestiaryEntry[], filter: OriginFilter): BestiaryEntry[] =>
  filter === 'all' ? entries : entries.filter(e => e.origin === filter);

/**
 * Duplicar («otro mutante»). La copia es SIEMPRE propia y editable, aunque venga del manual — es la única
 * manera de ajustar un bloque del libro sin tocarlo.
 *
 * El nombre lleva un número para que dos copias no se confundan en el listado; se cuenta sobre los nombres
 * que ya existen, no sobre un contador guardado, porque el director puede haber borrado la del medio.
 */
export function duplicateOf(entry: BestiaryEntry, existing: BestiaryEntry[], campaignId: string | null, systemId: string): NewBestiaryEntry {
  const base = entry.name.replace(/\s*\(\d+\)\s*$/, '');
  const taken = new Set(existing.map(e => e.name));
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return {
    campaignId,
    systemId,
    origin: entry.origin === 'npc' ? 'npc' : 'custom',
    name: `${base} (${n})`,
    data: structuredClone(entry.data),
    notes: entry.notes,
    tokenUrl: entry.tokenUrl,
    // Si se duplica una copia, la referencia apunta al bloque original del manual, no a la copia:
    // así la página del libro no se pierde a la segunda generación.
    sourceRef: entry.origin === 'manual' ? entry.id : entry.sourceRef,
  };
}

/** Una entrada propia vacía, para el formulario de «crear encuentro». */
export const emptyEntry = (campaignId: string | null, systemId: string, name: string): NewBestiaryEntry =>
  ({ campaignId, systemId, origin: 'custom', name, data: structuredClone(EMPTY), notes: '', tokenUrl: null, sourceRef: null });

/** Un PNJ aliado recién creado: misma entrada, pero con ficha de personaje en vez de bloque de criatura. */
export const emptyNpc = (campaignId: string | null, systemId: string, name: string): NewBestiaryEntry =>
  ({ campaignId, systemId, origin: 'npc', name, data: { ...structuredClone(EMPTY), sheet: {} }, notes: '', tokenUrl: null, sourceRef: null });

/**
 * Los valores de juego que el listado enseña de una entrada.
 *
 * Un PNJ con ficha NO los tiene sueltos: salen de su ficha, y quien sabe leerla es el motor del sistema
 * (`engine.derived`). Por eso entra por parámetro en vez de leerse aquí — el dominio del bestiario no
 * conoce el esquema de fichas de ningún sistema.
 */
export function gameValuesOf(entry: BestiaryEntry, derive?: (sheet: Record<string, unknown>) => Record<string, unknown>): { resistance: number; protection: number } {
  if (entry.origin === 'npc' && entry.data.sheet && derive) {
    const d = derive(entry.data.sheet);
    const n = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);
    return { resistance: n(d['resistance'] ?? d['resistanceMax'], resistanceOf(entry.data)), protection: n(d['protection'], entry.data.protection) };
  }
  return { resistance: resistanceOf(entry.data), protection: entry.data.protection };
}

/**
 * Las especialidades que el director puede marcar al tirar por esta criatura con esa característica.
 * Vacío = ninguna, y entonces no se ofrece la casilla: el bloque pone «-» donde la característica es 0.
 */
export const specialtiesFor = (entry: BestiaryEntry, stat: StatId): string[] => entry.data.specialties[stat] ?? [];

/**
 * Si el director puede tirar esa característica. El manual deja características SIN VALOR en los bloques
 * que no publica enteros (el mutante): ausente no es 0 — es «el libro no lo dice», y no se inventa.
 */
export const canRoll = (entry: BestiaryEntry, stat: StatId): boolean => entry.data.stats[stat] !== undefined;
