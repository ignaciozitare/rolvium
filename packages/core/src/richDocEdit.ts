import type { HeadingLevel, RichBlock, RichDoc, RichText, TableBlock } from './richDoc';

/**
 * LAS OPERACIONES DEL DOCUMENTO — puras, sin React y sin DOM, para que el editor compartido de `packages/ui`
 * sea sólo el pintor y todo lo que se puede equivocar se pueda probar sin montar una pantalla.
 * Specs: specs/modules/adventures/SPEC.md § «The document (`doc`)» · specs/modules/journal/SPEC.md
 *
 * Todas devuelven un documento NUEVO: nada se muta, que es lo que deja comparar «lo que hay» con «lo guardado»
 * para saber si hace falta guardar.
 */

/** Un id de bloque. `crypto.randomUUID` está en el navegador y en Node; si faltara, se cae a algo bueno igual. */
export function newBlockId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const paragraph = (text: RichText = []): RichBlock => ({ id: newBlockId(), type: 'paragraph', text });
export const heading = (level: HeadingLevel, text: RichText = []): RichBlock => ({ id: newBlockId(), type: 'heading', level, text });
export const quote = (text: RichText = []): RichBlock => ({ id: newBlockId(), type: 'quote', text });
export const list = (ordered: boolean, items: readonly RichText[] = [[]]): RichBlock => ({ id: newBlockId(), type: 'list', ordered, items });
export const divider = (): RichBlock => ({ id: newBlockId(), type: 'divider' });
export const sceneRef = (sceneId: string, label: string): RichBlock => ({ id: newBlockId(), type: 'sceneRef', sceneId, label });

/**
 * LAS DOS TABLAS QUE PIDE EL SPEC, con sus columnas ya puestas (punto 2 del 19-08: se escriben como en un
 * manual impreso). Las cabeceras son datos del documento, no texto de pantalla: quien llama pasa las suyas ya
 * traducidas, y lo que quede escrito es lo que se guarda.
 */
export function table(kind: TableBlock['kind'], columns: readonly string[], rows = 2): TableBlock {
  return {
    id: newBlockId(), type: 'table', kind, columns,
    rows: Array.from({ length: rows }, () => ({ cells: columns.map(() => [] as RichText), npcId: null })),
  };
}

const withBlocks = (doc: RichDoc, blocks: readonly RichBlock[]): RichDoc => ({ v: 1, blocks });

export const indexOfBlock = (doc: RichDoc, blockId: string): number => doc.blocks.findIndex(b => b.id === blockId);

/** Cambia un bloque por otro (mismo id o no). Si el id no está, el documento se devuelve igual. */
export function replaceBlock(doc: RichDoc, blockId: string, block: RichBlock): RichDoc {
  const i = indexOfBlock(doc, blockId);
  if (i < 0) return doc;
  return withBlocks(doc, doc.blocks.map((b, n) => (n === i ? block : b)));
}

/** Mete un bloque DESPUÉS de otro. Con `blockId` desconocido o nulo, al final. */
export function insertAfter(doc: RichDoc, blockId: string | null, block: RichBlock): RichDoc {
  const i = blockId ? indexOfBlock(doc, blockId) : -1;
  if (i < 0) return withBlocks(doc, [...doc.blocks, block]);
  return withBlocks(doc, [...doc.blocks.slice(0, i + 1), block, ...doc.blocks.slice(i + 1)]);
}

/**
 * Quita un bloque. **Un documento nunca se queda sin nada**: si era el último, queda un párrafo vacío, para que
 * siempre haya dónde escribir (y para que el cursor tenga a dónde ir).
 */
export function removeBlock(doc: RichDoc, blockId: string): RichDoc {
  const rest = doc.blocks.filter(b => b.id !== blockId);
  return withBlocks(doc, rest.length ? rest : [paragraph()]);
}

/** Cambia el texto de un bloque de texto (título, párrafo o cita). En los demás no hace nada. */
export function setText(doc: RichDoc, blockId: string, text: RichText): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block) return doc;
  if (block.type !== 'heading' && block.type !== 'paragraph' && block.type !== 'quote') return doc;
  return replaceBlock(doc, blockId, { ...block, text });
}

/** Cambia un punto de una lista. Con `text` vacío el punto SIGUE ahí: borrarlo es otra cosa (`removeItem`). */
export function setItem(doc: RichDoc, blockId: string, index: number, text: RichText): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block || block.type !== 'list' || index < 0 || index >= block.items.length) return doc;
  return replaceBlock(doc, blockId, { ...block, items: block.items.map((it, n) => (n === index ? text : it)) });
}

/** Mete un punto nuevo detrás de otro. Es lo que hace el Intro dentro de una lista. */
export function insertItemAfter(doc: RichDoc, blockId: string, index: number): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block || block.type !== 'list') return doc;
  const items = [...block.items.slice(0, index + 1), [] as RichText, ...block.items.slice(index + 1)];
  return replaceBlock(doc, blockId, { ...block, items });
}

/** Quita un punto. Si era el último, el bloque entero se va (una lista sin puntos no es nada). */
export function removeItem(doc: RichDoc, blockId: string, index: number): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block || block.type !== 'list') return doc;
  if (block.items.length <= 1) return removeBlock(doc, blockId);
  return replaceBlock(doc, blockId, { ...block, items: block.items.filter((_, n) => n !== index) });
}

/** Cambia una celda de una tabla. El `npcId` de la fila se conserva: es el hueco del Bestiario. */
export function setCell(doc: RichDoc, blockId: string, row: number, col: number, text: RichText): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block || block.type !== 'table') return doc;
  const rows = block.rows.map((r, n) => (n === row ? { ...r, cells: r.cells.map((c, m) => (m === col ? text : c)) } : r));
  return replaceBlock(doc, blockId, { ...block, rows });
}

/** Una fila más, vacía, al final de la tabla. */
export function addTableRow(doc: RichDoc, blockId: string): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block || block.type !== 'table') return doc;
  return replaceBlock(doc, blockId, { ...block, rows: [...block.rows, { cells: block.columns.map(() => [] as RichText), npcId: null }] });
}

export type TextBlockStyle = 'paragraph' | 'quote' | 'h1' | 'h2';

/**
 * EL BOTÓN H1 / H2 / CITA de la barra. Es un interruptor: volver a pulsar el estilo que ya tiene lo devuelve a
 * párrafo, que es como se comporta cualquier editor y evita quedarse encerrado en un título.
 * **Conserva el texto y el id**: cambiar de estilo no puede perder lo escrito ni romper el índice abierto.
 */
export function setTextStyle(doc: RichDoc, blockId: string, style: TextBlockStyle): RichDoc {
  const block = doc.blocks.find(b => b.id === blockId);
  if (!block) return doc;
  if (block.type !== 'heading' && block.type !== 'paragraph' && block.type !== 'quote') return doc;
  const current = textBlockStyle(block);
  const target: TextBlockStyle = current === style ? 'paragraph' : style;
  const { id, text } = block;
  if (target === 'h1') return replaceBlock(doc, blockId, { id, type: 'heading', level: 1, text });
  if (target === 'h2') return replaceBlock(doc, blockId, { id, type: 'heading', level: 2, text });
  if (target === 'quote') return replaceBlock(doc, blockId, { id, type: 'quote', text });
  return replaceBlock(doc, blockId, { id, type: 'paragraph', text });
}

/** Qué estilo tiene hoy un bloque de texto — para pintar el botón de la barra como activo. */
export function textBlockStyle(block: RichBlock): TextBlockStyle | null {
  if (block.type === 'paragraph') return 'paragraph';
  if (block.type === 'quote') return 'quote';
  if (block.type === 'heading') return block.level === 1 ? 'h1' : 'h2';
  return null;
}

/** Un documento vacío del todo se abre con un párrafo, para que haya dónde poner el cursor. */
export const docForEditing = (doc: RichDoc): RichDoc => (doc.blocks.length ? doc : withBlocks(doc, [paragraph()]));
