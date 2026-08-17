import type { RollRequest, RollResult, RolledDice } from './rolls';

export type Locale = 'es' | 'en';
/** Translation key inside the system's own locale files. */
export type I18nKey = string;
export type Messages = Record<string, unknown>;

// ─── Sheet schema ─────────────────────────────────────────────────────────────
export type FieldType = 'text' | 'longtext' | 'number' | 'counter' | 'boxes' | 'select' | 'list' | 'table' | 'health' | 'stat' | 'image';

export interface FieldDef {
  id: string;
  type: FieldType;
  label: I18nKey;
  ref?: string;                 // rule reference key → tooltip + manual page
  min?: number; max?: number;
  options?: { value: string; label: I18nKey }[];
  columns?: FieldDef[];         // for 'table'
  itemFields?: FieldDef[];      // for 'list'
  derived?: boolean;            // computed by engine.derived, read-only in the sheet
  action?: string;              // ActionDef.id rendered as an icon button on this field/row
}

export interface SectionDef { id: string; label: I18nKey; fields: FieldDef[]; layout?: 'grid' | 'stack' | 'row'; }
export interface SheetSchema { version: string; sections: SectionDef[]; }

/** A sheet's data is opaque JSON validated against the schema by the API. */
export type SheetData = Record<string, unknown>;
export type SheetPatch = Record<string, unknown>;

// ─── Catalogs / references / theme ───────────────────────────────────────────
export interface CatalogItem { id: string; label: I18nKey; ref?: string; data?: Record<string, unknown>; }
export type Catalogs = Record<string, CatalogItem[]>;

export interface RuleReference { page: number; title: I18nKey; summary: I18nKey; }
export type References = Record<string, RuleReference>;

export interface VisualTheme {
  /** CSS custom properties applied on the table container as `--sys-<name>`. */
  vars: Record<string, string>;
  fonts?: { display?: string; body?: string; url?: string };
  /** Runtime path of the background texture (under /systems/<id>/). */
  backgroundImage?: string;
  /** Icon set names used by the sheet (e.g. moon, health disc). */
  icons?: Record<string, string>;
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export interface SharedResourceDef {
  id: string;                    // 'destiny'
  label: I18nKey;
  ref?: string;
  max: number;
  initial: number;
  perTakeMax: number;            // dice a player may take per roll
  whoCanTake: 'player' | 'dm' | 'all';
  whoCanReset: 'dm';
  /** Prevents taking when a sheet condition holds (e.g. Destiny 10). Message key explains why. */
  blockedIf?: (sheet: SheetData) => I18nKey | null;
}

export interface ActionDef {
  id: string;                    // 'attack.melee' | 'gift.activate'
  icon: string;                  // Material Symbols name
  label: I18nKey;
  appliesTo: string;             // field/list id in the schema, e.g. 'weapons' | 'gifts' | 'stats'
  cost?: I18nKey;
  toRoll: (sheet: SheetData, itemId: string, options?: Record<string, unknown>) => RollRequest;
}

export interface ProgressionRules {
  /** Returns the XP cost of a change or null if not allowed. */
  cost: (sheet: SheetData, change: { kind: string; target: string; to?: unknown }) => number | null;
  apply: (sheet: SheetData, change: { kind: string; target: string; to?: unknown }) => SheetPatch;
}

export interface Engine {
  derived: (sheet: SheetData) => Record<string, unknown>;
  poolFor: (sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }) => RollRequest;
  resolve: (request: RollRequest, dice: RolledDice, sheet?: SheetData) => RollResult;
  applyDamage: (sheet: SheetData, damage: number) => SheetPatch;
  progression: ProgressionRules;
  sharedResources?: SharedResourceDef[];
  actions?: ActionDef[];
}

// ─── Generator ───────────────────────────────────────────────────────────────
export interface GeneratorStep {
  id: string;
  label: I18nKey;
  /** Which schema fields this step edits, in order. */
  fields: string[];
  /** Validation for advancing; returns an error key or null. */
  canAdvance: (draft: SheetData) => I18nKey | null;
  /** Point economy shown in the header (e.g. remaining stat points). */
  budget?: (draft: SheetData) => { label: I18nKey; remaining: number; detail?: string };
}

// ─── The port ────────────────────────────────────────────────────────────────
export interface GameSystem {
  id: string;
  version: string;
  name: I18nKey;
  publisher?: string;
  locales: Partial<Record<Locale, Messages>>;
  sheetSchema: SheetSchema;
  catalogs: Catalogs;
  references: References;
  theme: VisualTheme;
  engine: Engine;
  generator: GeneratorStep[];
  /** Blank sheet respecting the schema. */
  newSheet: () => SheetData;
}

/** State shape of one shared resource inside `campaigns.shared_resources`. */
export interface SharedResourceState { value: number; max: number; hands: Record<string, number>; }
/** Initial `shared_resources` jsonb for a new campaign of this system. */
export function initialSharedResources(system: Pick<GameSystem, 'engine'>): Record<string, SharedResourceState> {
  return Object.fromEntries((system.engine.sharedResources ?? []).map(r => [r.id, { value: r.initial, max: r.max, hands: {} }]));
}
