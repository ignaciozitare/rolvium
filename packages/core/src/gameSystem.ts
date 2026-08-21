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
  /**
   * Sólo columnas de tabla: si la columna aplica a ESTA fila. Sin definir = a todas. Lo declara el
   * sistema porque la plataforma no sabe qué fila tiene qué: un arma cuerpo a cuerpo no lleva
   * cargador —el libro pone «-» en las nueve (p.97)— y la tabla pintaba un contador igual, así que
   * salían unas Nudilleras con 14 balas.
   */
  appliesToRow?: (row: Record<string, unknown>) => boolean;
  /**
   * Sólo columnas de tabla: el TECHO de esta celda para ESTA fila, cuando no es el mismo para todas.
   * Lo declara el sistema porque la plataforma no sabe de dónde sale: en Plenilunio la Munición no
   * puede pasar de lo que cabe en el cargador del arma (rifle 30, magnum 6), y sin techo el contador
   * subía sin fin. Como en el resto de la ficha, capa la SUBIDA y nunca la bajada: un valor ya por
   * encima apaga el `+` y deja el `−` vivo, que es como se sale de ahí.
   */
  maxForRow?: (row: Record<string, unknown>) => number | undefined;
  min?: number; max?: number;
  /**
   * `hint`: dato secundario de la opción, que sale en un tooltip y NO en la celda. El alcance de un
   * arma se lee «Medio» y los metros y la dificultad se consultan al pasar por encima (p.95–96):
   * escritos en línea se comían media tabla de Armas (dueño, 2026-08-19).
   */
  options?: { value: string; label: I18nKey; hint?: I18nKey }[];
  columns?: FieldDef[];         // for 'table'
  itemFields?: FieldDef[];      // for 'list'
  derived?: boolean;            // computed by engine.derived, read-only in the sheet
  action?: string;              // ActionDef.id rendered as an icon button on this field/row
  /**
   * Sólo campos `health`: aviso que la ficha pinta BAJO el campo cuando las reglas lo disparan, en
   * rojo. Devuelve la clave i18n del aviso o `null`. Lo declara el sistema porque la plataforma no
   * sabe qué condición avisa: en Plenilunio es «Inconsciente» —el sexto nivel de salud (p.101)—, que
   * no es una fase de luna y no se elige a mano, se cae en él al quedarse sin Resistencia (p.98).
   * Antes era un desplegable «Inconsciente Sí/No» en la rejilla de Estado: un valor que el motor ya
   * calcula, ofrecido como si fuera una decisión del jugador y capaz de contradecirlo — el mismo
   * fallo que el cargador editable a mano que el dueño hizo quitar (2026-08-19).
   */
  note?: (sheet: SheetData) => I18nKey | null;
  /**
   * Campo que existe en el esquema —se guarda, se valida y lo escribe el motor— pero que la ficha NO
   * pinta: no hay nada que decidir en él. `derived` no sirve para esto (un derivado no se guarda y
   * `validateSheet` rechaza como `unknown` cualquier clave que el esquema no declare, así que el
   * `unconscious` que escribe `applyDamage` tumbaría el guardado entero). Plenilunio lo usa para
   * «Inconsciente», que sale como `note` bajo las lunas.
   */
  hidden?: boolean;
}

/**
 * `span`: cuantas columnas del grid de la ficha ocupa la seccion. Lo declara el SISTEMA porque la
 * plataforma no sabe que «Estado» pide mas sitio que «Dones» — igual que no sabe reglas. Sin `span`
 * ocupa una; las secciones con campo `table`/`longtext`/`image` o `layout:'row'` siguen ocupando la
 * fila entera por su cuenta.
 */
/**
 * `span`: cuanto ocupa la seccion en la rejilla de SEIS de la ficha. 6 = fila entera, 3 = media,
 * 2 = un tercio. Lo declara el SISTEMA porque la plataforma no sabe que Estado pide media fila y
 * Armadura un tercio — igual que no sabe reglas. Por defecto 3 (media).
 * Las secciones con campo `table`/`longtext`/`image` o `layout:'row'` ocupan la fila entera solas.
 */
export interface SectionDef { id: string; label: I18nKey; fields: FieldDef[]; layout?: 'grid' | 'stack' | 'row'; span?: number; }
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
  /**
   * Si aplica a ESTA fila. Sin esto la ficha pintaba las dos acciones de arma en todas: unas
   * Nudilleras ofrecian «Disparar». El manual las separa (p.96–97): a distancia es un reto contra la
   * dificultad del alcance y el arma no da dados extra; cuerpo a cuerpo es enfrentado y ahi si suma la
   * bonificacion. Son acciones distintas, y cada arma tiene la suya. Sin definir = aplica a todas.
   */
  appliesToRow?: (row: Record<string, unknown>) => boolean;
  cost?: I18nKey;
  /**
   * Lo que la accion GASTA en la ficha, o `null` si ahora mismo no se puede pagar. Devuelve un patch
   * que la plataforma aplica al lanzar, y `null` apaga el boton.
   *
   * Existe por la municion: la tabla de armas (p.97) da un «Cargador» por arma, y que un arco o una
   * ballesta pongan **Cargador 1** solo tiene sentido si la unidad del cargador es UN disparo — tiras
   * y ya tienes que recargar. Asi que disparar gasta un punto, y sin balas no se dispara.
   */
  spend?: (sheet: SheetData, itemId: string) => SheetPatch | null;
  /** Sin `toRoll` la acción sólo GASTA (recargar): se aplica el `spend` y no se tira nada. */
  toRoll?: (sheet: SheetData, itemId: string, options?: Record<string, unknown>) => RollRequest;
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
  /**
   * Vetoes or normalises one field edit while generating: `null` refuses the edit
   * (the platform greys the control out), otherwise the patch to apply — which may
   * touch more than the edited field, e.g. lowering a preset re-clamps every stat.
   * Without it the platform only checks that `budget.remaining` stays >= 0, which
   * cannot know a system's per-field ceilings.
   */
  applyChange?: (draft: SheetData, fieldId: string, next: unknown) => SheetPatch | null;
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
  /** Values to write when the generator finishes (e.g. fill resources, full resistance). Identity when absent. */
  finalizeDraft?: (draft: SheetData) => SheetData;
}

/** State shape of one shared resource inside `campaigns.shared_resources`. */
export interface SharedResourceState { value: number; max: number; perTakeMax: number; hands: Record<string, number>; }
/** Initial `shared_resources` jsonb for a new campaign of this system. */
export function initialSharedResources(system: Pick<GameSystem, 'engine'>): Record<string, SharedResourceState> {
  return Object.fromEntries((system.engine.sharedResources ?? []).map(r => [r.id, { value: r.initial, max: r.max, perTakeMax: r.perTakeMax, hands: {} }]));
}
