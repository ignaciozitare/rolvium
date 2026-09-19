/**
 * EL DOCUMENTO DE TEXTO ENRIQUECIDO — un solo vocabulario para las tres superficies que se escriben:
 * Notas y Bitácora (`journal`, H9) y Aventuras (`adventures`, H12).
 * Specs: specs/modules/adventures/SPEC.md § «El documento (`doc`)» · specs/modules/journal/SPEC.md
 *
 * ⚠️ **La forma la fija el spec de `adventures`, cerrado el 2026-08-19**, y aquí se respeta al pie de la letra
 * (`heading` con su `level`, `paragraph`, `quote`, `list`, `divider`, `sceneRef`, `table`; los tramos de texto
 * como `{ t, b, i }`). Lo único que se añade es un `id` por bloque, que es a donde salta el índice.
 *
 * Reglas que esto hace cumplir, y por las que vive en `core` y no en la UI:
 * - **Es JSON, nunca HTML.** El cliente PINTA los bloques; nada se inyecta como marcado (regla de XSS del
 *   proyecto). Por eso no hay ningún campo `html` en toda la estructura.
 * - **Un solo árbol para las tres.** `journal` usa el subconjunto; `adventures` añade los suyos (`table`,
 *   `sceneRef`). Un solo vocabulario y un solo pintor, que es lo que permite construir UN editor compartido.
 * - **El índice se calcula, nunca se guarda** (`buildDocIndex`): se lee de los títulos cada vez que se abre,
 *   así que no puede quedarse viejo.
 * - **Lo que viene de la base es `jsonb` desconocido**: `parseDoc` es la única puerta de entrada, y nunca
 *   devuelve algo con una forma que el pintor no entienda.
 */

/** Un tramo de texto con su formato: «una palabra **en negrita**». Negrita y cursiva, y poco más (spec). */
export interface RichSpan {
  /** El texto del tramo. Se llama `t` porque así lo fijó el spec, y un documento guardado no se renombra. */
  t: string;
  b?: boolean;
  i?: boolean;
}

/** El texto de un bloque: una fila de tramos. Un párrafo sin formato es un solo tramo. */
export type RichText = readonly RichSpan[];

/** Los dos niveles de título que ofrece el editor, y los dos que salen en el índice. */
export type HeadingLevel = 1 | 2;

/** Un título. Es lo único que el índice mira. */
export interface HeadingBlock { id: string; type: 'heading'; level: HeadingLevel; text: RichText }
/** Un párrafo corriente. */
export interface ParagraphBlock { id: string; type: 'paragraph'; text: RichText }
/** La caja de leer en voz alta. */
export interface QuoteBlock { id: string; type: 'quote'; text: RichText }
/** Lista con puntos o numerada (`ordered`). Cada punto es texto con formato, no un bloque anidado. */
export interface ListBlock { id: string; type: 'list'; ordered: boolean; items: readonly RichText[] }
/** Separador. No lleva nada dentro. */
export interface DividerBlock { id: string; type: 'divider' }

/**
 * SÓLO EN AVENTURAS — el enlace a una escena, que la abre en la mesa. El `label` es el nombre con el que se
 * escribió: la escena puede renombrarse o irse, y el documento no puede romperse por eso.
 */
export interface SceneRefBlock { id: string; type: 'sceneRef'; sceneId: string; label: string }

/**
 * SÓLO EN AVENTURAS — la tabla de PNJ o de encuentro, que en la v1 es texto dentro del documento, como en un
 * manual impreso (spec, punto 2: enlazar PNJ de verdad necesita el Bestiario, y es otra rebanada).
 */
export interface TableBlock {
  id: string;
  type: 'table';
  kind: 'npc' | 'encounter' | 'plain';
  columns: readonly string[];
  rows: readonly TableRow[];
}

export interface TableRow {
  cells: readonly RichText[];
  /**
   * EL HUECO DEL BESTIARIO (H5), en cada fila **desde el día uno** y siempre `null` en la v1 (decisión del
   * spec). Cuando el Bestiario exista, enlazar un PNJ de verdad no obligará a migrar ni un solo documento.
   */
  npcId: string | null;
}

export type RichBlock =
  | HeadingBlock | ParagraphBlock | QuoteBlock | ListBlock | DividerBlock | SceneRefBlock | TableBlock;

export interface RichDoc {
  /** Versión del vocabulario. Hoy 1; si algún día cambia, `parseDoc` es quien traduce. */
  v: 1;
  blocks: readonly RichBlock[];
}

/** Los bloques que entiende `journal`: Notas y Bitácora no tienen tablas de encuentro ni enlaces a escena. */
export const JOURNAL_BLOCK_TYPES = ['heading', 'paragraph', 'quote', 'list', 'divider'] as const;
export type JournalBlockType = (typeof JOURNAL_BLOCK_TYPES)[number];

/** Tope de tamaño de un documento, el mismo para las tres superficies (specs § Rules & limits). */
export const DOC_MAX_BYTES = 200 * 1024;

export const emptyDoc = (): RichDoc => ({ v: 1, blocks: [] });

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const parseText = (raw: unknown): RichText => {
  if (typeof raw === 'string') return raw ? [{ t: raw }] : [];
  if (!Array.isArray(raw)) return [];
  const spans: RichSpan[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || typeof item.t !== 'string') continue;
    const span: RichSpan = { t: item.t };
    if (item.b === true) span.b = true;
    if (item.i === true) span.i = true;
    spans.push(span);
  }
  return spans;
};

const parseRow = (raw: unknown): TableRow => {
  if (!isPlainObject(raw)) return { cells: [], npcId: null };
  return {
    cells: Array.isArray(raw.cells) ? raw.cells.map(parseText) : [],
    npcId: typeof raw.npcId === 'string' && raw.npcId ? raw.npcId : null,
  };
};

const parseBlock = (raw: unknown): RichBlock | null => {
  if (!isPlainObject(raw) || typeof raw.type !== 'string') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  if (!id) return null;
  switch (raw.type) {
    case 'heading':
      return { id, type: 'heading', level: raw.level === 2 ? 2 : 1, text: parseText(raw.text) };
    case 'paragraph':
      return { id, type: 'paragraph', text: parseText(raw.text) };
    case 'quote':
      return { id, type: 'quote', text: parseText(raw.text) };
    case 'list':
      return { id, type: 'list', ordered: raw.ordered === true, items: Array.isArray(raw.items) ? raw.items.map(parseText) : [] };
    case 'divider':
      return { id, type: 'divider' };
    case 'sceneRef':
      return typeof raw.sceneId === 'string' && raw.sceneId
        ? { id, type: 'sceneRef', sceneId: raw.sceneId, label: typeof raw.label === 'string' ? raw.label : '' }
        : null;
    case 'table': {
      const kind = raw.kind === 'encounter' ? 'encounter' : raw.kind === 'plain' ? 'plain' : 'npc';
      return {
        id, type: 'table', kind,
        columns: Array.isArray(raw.columns) ? raw.columns.filter((c): c is string => typeof c === 'string') : [],
        rows: Array.isArray(raw.rows) ? raw.rows.map(parseRow) : [],
      };
    }
    default:
      // Un bloque de una versión más nueva de la herramienta: se ignora, no se rompe la pantalla.
      return null;
  }
};

/**
 * La ÚNICA puerta de entrada de lo que viene de la base (`doc jsonb`). Nunca lanza: lo que no se entiende se
 * queda fuera y lo demás se pinta. Un documento vacío y uno con forma rara acaban igual: `{ v: 1, blocks: [] }`.
 */
export function parseDoc(raw: unknown): RichDoc {
  if (!isPlainObject(raw) || !Array.isArray(raw.blocks)) return emptyDoc();
  const blocks: RichBlock[] = [];
  for (const item of raw.blocks) {
    const block = parseBlock(item);
    if (block) blocks.push(block);
  }
  return { v: 1, blocks };
}

/** El texto plano de un bloque de texto: para el índice, para buscar y para medir. */
export const plainText = (text: RichText): string => text.map(s => s.t).join('');

export interface DocIndexEntry {
  /** El id del bloque del título: es a donde salta el clic. */
  id: string;
  text: string;
  /** Los títulos de nivel 2 que viven DENTRO de este de nivel 1. */
  children: readonly DocIndexEntry[];
}

/**
 * EL ÍNDICE (orden suya, 2026-09-19: «*le das al botón índice y te indexa todo lo que sea H1 y H2 de lo que
 * esté en el h1 padre*»). Los H2 cuelgan del H1 que los contiene; los que se escriben antes de cualquier H1
 * cuelgan de la raíz. No se guarda: se calcula cada vez, así que no puede quedarse viejo.
 */
export function buildDocIndex(doc: RichDoc): readonly DocIndexEntry[] {
  const entries: DocIndexEntry[] = [];
  let current: { id: string; text: string; children: DocIndexEntry[] } | null = null;
  for (const block of doc.blocks) {
    if (block.type !== 'heading') continue;
    const entry = { id: block.id, text: plainText(block.text), children: [] as DocIndexEntry[] };
    if (block.level === 1) {
      current = entry;
      entries.push(entry);
    } else if (current) {
      current.children.push(entry);
    } else {
      entries.push(entry);
    }
  }
  return entries;
}

/** Cuánto ocupa el documento tal y como se guarda. Con `DOC_MAX_BYTES` decide si cabe. */
export const docByteSize = (doc: RichDoc): number =>
  typeof TextEncoder === 'undefined' ? JSON.stringify(doc).length : new TextEncoder().encode(JSON.stringify(doc)).length;

export const docFitsLimit = (doc: RichDoc): boolean => docByteSize(doc) <= DOC_MAX_BYTES;

/** ¿Este bloque vale en Notas y Bitácora? Las tablas y los enlaces a escena son sólo de una aventura. */
export const isJournalBlock = (block: RichBlock): boolean =>
  (JOURNAL_BLOCK_TYPES as readonly string[]).includes(block.type);
