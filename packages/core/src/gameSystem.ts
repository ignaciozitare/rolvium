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

/** Una línea del desglose, ya compuesta por el sistema, con la página del manual cuando la tiene. */
export interface ExplainLine { text: string; page?: number }
/**
 * El desglose de una tirada, tal y como lo enseña el Registro al pasar por encima
 * (rolvium.pen «Mesa/Tiradas · rediseño», `Tooltip/Desglose`).
 */
export interface RollExplain {
  /** De dónde salieron los dados y contra qué se tiró. */
  head: ExplainLine[];
  /** «Lo que se aplicó»: lo que las reglas metieron o dejaron fuera sin preguntar. */
  applied: ExplainLine[];
  /** El cierre: «1 éxito contra 2 de dificultad = grado de fallo 1». */
  verdict?: string;
}

/** El techo de dados extra de UNA tirada, con el porqué: lo declara el sistema, lo pinta la plataforma. */
export interface ExtraDiceCap {
  /** Cuántos dados extra admite esta tirada como mucho. */
  max: number;
  /** Clave i18n del sistema que dice DE DÓNDE sale el techo («herramientas», «atención médica»…). */
  reason: I18nKey;
  /** Clave de `references` para la página del manual del tooltip. */
  ref?: string;
}

export interface Engine {
  derived: (sheet: SheetData) => Record<string, unknown>;
  poolFor: (sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }) => RollRequest;
  /**
   * Cuántos dados extra puede añadir a mano quien tira, y POR QUÉ. Lo declara el sistema porque el techo es
   * una regla suya: la plataforma no sabe de dónde salen los dados de más ni cuándo hay más de lo normal.
   *
   * `poolFor` lo aplica siempre, y la pantalla lo lee sólo para apagar el «+» y decir de dónde viene. Cuando
   * la tirada lleva ficha el servidor rehace los grupos con ese mismo `poolFor` y no se fía de los del
   * cliente, así que ahí el techo NO vive en el navegador; una tirada sin ficha no se rehace y el techo sí se
   * queda del lado del cliente. Como en el resto de la ficha se capa la SUBIDA y nunca la bajada.
   *
   * Opcional: un sistema que no lo declare no tiene techo, que es como estaba todo antes.
   */
  extraDiceMax?: (sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }) => ExtraDiceCap | null;
  /**
   * Cuántas CASILLAS ocupa de ancho el token de esta ficha en el mapa. Lo declara el sistema porque el tamaño
   * de una criatura es una regla suya: la plataforma no sabe que un ogro es más grande que un gato.
   *
   * `null` (o no declararlo) = la ficha no dice de qué tamaño es, y el mapa usa su propio tamaño por defecto.
   * Antes TODO token nacía de una casilla, gato y dragón por igual.
   */
  tokenCells?: (sheet: SheetData) => number | null;
  resolve: (request: RollRequest, dice: RolledDice, sheet?: SheetData) => RollResult;
  applyDamage: (sheet: SheetData, damage: number) => SheetPatch;
  progression: ProgressionRules;
  sharedResources?: SharedResourceDef[];
  actions?: ActionDef[];
  /**
   * El desglose que el Registro enseña al pasar por encima de una tirada. Lo escribe el SISTEMA, porque
   * es el único que sabe qué reglas se aplicaron y en qué página del manual están; la plataforma sólo lo
   * pinta. `ts` resuelve las claves del propio sistema en el idioma de quien mira.
   *
   * Se calcula desde la tirada YA GUARDADA (petición + dados + resultado), nunca desde la ficha de
   * ahora: una tirada es inmutable y su desglose tiene que seguir diciendo lo mismo dentro de un mes,
   * con el personaje ya curado y con otra armadura puesta.
   *
   * Opcional: un sistema que no lo declare simplemente no enseña desglose.
   */
  explain?: (roll: { request: RollRequest; dice: RolledDice; result: RollResult }, ts: (key: string) => string) => RollExplain | null;
  /**
   * En qué orden actúan los que entran a un combate. Lo declara el SISTEMA porque el criterio es una regla
   * suya: la plataforma no sabe que en Plenilunio manda el Destino, ni que un PJ gana el empate a un PNJ.
   *
   * Contrato de comparador de toda la vida —negativo: `a` actúa antes; positivo: después—, con un matiz que
   * es la razón de que esto no sea un simple `sort`: **`0` significa que el sistema NO puede desempatar**, y
   * eso es un resultado legítimo, no un fallo. El manual de Plenilunio termina su regla diciendo que ahí
   * «decide el director de juego» (p.92–93), así que la plataforma tiene que poder distinguir «van en este
   * orden» de «estos dos están empatados y falta que alguien elija». `orderTurns` lo devuelve por separado.
   *
   * Opcional: un sistema que no lo declare no ordena, y quien entra se queda en el orden en que le pasaron.
   */
  turnOrder?: (a: TurnParticipant, b: TurnParticipant) => number;
}

// ─── Orden de turnos ─────────────────────────────────────────────────────────
/** Uno de los que entran al combate, tal y como el sistema necesita verlo para ordenarlo. */
export interface TurnParticipant {
  /** Identificador del puesto. La plataforma lo pone y es lo que le devuelve el orden. */
  id: string;
  /** Su ficha: la del personaje, o la del bloque de la criatura. El sistema lee de aquí lo que le importe. */
  sheet: SheetData;
  /**
   * Es el personaje de un JUGADOR (no un PNJ ni una criatura). Va aparte de la ficha porque no es un valor
   * de juego: es quién lo lleva, y eso lo sabe la plataforma, no el sistema.
   */
  isPlayerCharacter: boolean;
}

export interface TurnOrder {
  /** Los ids, ya en el orden en que actúan. */
  order: string[];
  /**
   * Los grupos que el sistema dejó EMPATADOS (comparador `0`), cada uno con sus ids en el orden en que
   * quedaron. Vacío si no hubo ninguno. Quien llama decide qué hacer con ellos —en Plenilunio, preguntarle
   * al director (p.92–93)—; lo que no puede hacer la plataforma es elegir por su cuenta y llamarlo regla.
   */
  undecided: string[][];
}

/**
 * Pone en orden a los que entran al combate, con el criterio del sistema.
 *
 * Vive en `core` y no en cada orilla por lo mismo que `ownDiceForStat`: lo van a usar el servidor (que crea
 * los puestos) y el navegador (que enseña el orden antes de abrirlo), y no pueden discrepar.
 *
 * El orden es ESTABLE —`Array.prototype.sort` lo es desde ES2019—, así que dos empatados conservan el orden
 * en que llegaron y el resultado es el mismo cada vez que se calcula. Los empates se detectan comparando
 * cada uno con el siguiente YA ORDENADO: para una regla como la de Plenilunio (mismo Destino, mismo bando,
 * mismo Combate) el empate es transitivo y agrupar vecinos los junta a todos.
 */
export function orderTurns(system: Pick<GameSystem, 'engine'>, participants: TurnParticipant[]): TurnOrder {
  const cmp = system.engine.turnOrder;
  if (!cmp) return { order: participants.map(p => p.id), undecided: [] };
  const sorted = [...participants].sort(cmp);
  const undecided: string[][] = [];
  let run: TurnParticipant[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const tiedWithNext = i < sorted.length - 1 && cmp(sorted[i]!, sorted[i + 1]!) === 0;
    if (tiedWithNext) run.push(sorted[i]!);
    else {
      if (run.length) { run.push(sorted[i]!); undecided.push(run.map(p => p.id)); }
      run = [];
    }
  }
  return { order: sorted.map(p => p.id), undecided };
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

/**
 * Cuántos dados PROPIOS le da a esta ficha una característica, ahora mismo.
 *
 * Se le pregunta al sistema (`engine.poolFor`) en vez de leer la ficha a mano: lo que cada sistema
 * suma o resta —una penalización por heridas, un tamaño, lo que sea— vive ahí y sólo ahí. Cualquier
 * segunda cuenta acabaría contradiciendo a la del motor el día que el motor cambie.
 *
 * Se le quita lo que la ficha traiga puesto en su bloque de tirada (dificultad, dados extra,
 * bonificación de arma): esto responde a «cuánto vale su característica», no a «cómo sería esta tirada».
 * La oposición no cuenta, porque no son dados suyos.
 *
 * Devuelve `null` sin característica, o si el sistema no sabe armar ese puñado: es la diferencia entre
 * «no puede poner dados» y «no sabemos cuántos», y quien pregunta necesita distinguirlas.
 */
export function ownDiceForStat(system: Pick<GameSystem, 'engine'>, sheet: SheetData, stat: string | null): number | null {
  if (!stat) return null;
  try {
    const req = system.engine.poolFor(sheet, { stat, options: { destinyDice: 0, difficulty: 0, extraDice: 0, bonusDice: 0 } });
    return req.groups.filter(g => g.tag !== 'opposition').reduce((n, g) => n + g.count, 0);
  } catch {
    return null;
  }
}
