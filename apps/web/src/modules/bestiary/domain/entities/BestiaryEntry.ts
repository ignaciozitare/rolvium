/**
 * Bestiario (H5) — spec: specs/modules/bestiary/SPEC.md
 *
 * Una entrada del listado del director puede venir de DOS sitios y el hexágono las trata igual:
 *  - del **manual**: `catalogs.bestiary` del paquete del sistema, 45 bloques. No tienen fila en la base,
 *    no se editan y no se borran (para cambiar una, se duplica).
 *  - **propias** del director: filas de `bestiary_entries`, que sí se crean, editan, duplican y borran.
 *
 * Lo que se coloca en la escena no es ninguna de las dos: es una INSTANCIA, un token de `maps` con su
 * propia Resistencia. Herir a un ogro no hiere al otro ni toca la plantilla.
 */
import type { StatId } from '@rolvium/system-plenilunio';

/** De dónde sale una entrada. `manual` no existe en la base: es el catálogo del sistema. */
export type EntryOrigin = 'manual' | 'custom' | 'npc';

/** Filtros del listado. `all` no filtra nada. */
export type OriginFilter = 'all' | EntryOrigin;

/**
 * Los valores de juego de una criatura, con la misma forma que `BestiaryData` del paquete del sistema.
 * Una característica **ausente** significa que el libro no la publica (el mutante): se pinta «—» y no se
 * inventa. Distinto de valer 0, que sí es un valor impreso (el ogro tiene Cultura 0).
 */
export interface CreatureData {
  stats: Partial<Record<StatId, number>>;
  /** Aguante impreso en el bloque, modificador de tamaño ya incluido (p.25). */
  endurance: number;
  destiny: number;
  /** Protección natural por capacidad (Piel gruesa N…), no una armadura. 0 = ninguna. */
  protection: number;
  /** Capacidades del bloque (p.107–108), como texto para que el director las lea. */
  abilities: string[];
  /** Una por característica, como las imprime el bloque. Ids de `SPECIALTY_ITEMS` o `creature.*`. */
  specialties: Partial<Record<StatId, string[]>>;
  /** Página del manual, cuando la entrada viene de él o se duplicó de una que venía. */
  page?: number;
}

/** Una entrada del listado, ya unificadas las dos fuentes. */
export interface BestiaryEntry {
  /** Id de fila para las propias; id del catálogo (`ogre`, `harpy`) para las del manual. */
  id: string;
  origin: EntryOrigin;
  /** Nombre ya resuelto al idioma del usuario: las del manual llegan como clave i18n y se traducen antes. */
  name: string;
  data: CreatureData;
  notes: string;
  tokenUrl: string | null;
  /** Bloque del catálogo del que se duplicó, si es el caso. Conserva la referencia a la página. */
  sourceRef: string | null;
  /** `null` en las del manual y en las propias guardadas «para todas mis campañas». */
  campaignId: string | null;
  /** Sólo las propias; las del manual no tienen fila y no se pueden tocar. */
  editable: boolean;
}

/** Lo que hace falta para crear una entrada propia. */
export interface NewBestiaryEntry {
  /** `null` = «guardar para todas mis campañas». */
  campaignId: string | null;
  systemId: string;
  origin: Exclude<EntryOrigin, 'manual'>;
  name: string;
  data: CreatureData;
  notes?: string;
  tokenUrl?: string | null;
  sourceRef?: string | null;
}

/** Campos editables de una entrada propia. Todo opcional: se manda sólo lo que cambia. */
export interface BestiaryEntryPatch {
  name?: string;
  data?: CreatureData;
  notes?: string;
  tokenUrl?: string | null;
  /** Mover entre «sólo esta campaña» (id) y «todas mis campañas» (null). */
  campaignId?: string | null;
}
