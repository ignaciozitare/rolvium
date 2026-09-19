import { describe, it, expect } from 'vitest';
import type { RichDoc } from './richDoc';
import {
  addTableRow, docForEditing, heading, insertAfter, insertItemAfter, list, newBlockId, paragraph, quote,
  removeBlock, removeItem, replaceBlock, setCell, setItem, setText, setTextStyle, table, textBlockStyle,
} from './richDocEdit';

const t = (s: string) => [{ t: s }];
const doc = (...blocks: RichDoc['blocks']): RichDoc => ({ v: 1, blocks });

describe('crear bloques', () => {
  it('cada bloque nace con su propio id', () => {
    expect(newBlockId()).not.toBe(newBlockId());
    expect(paragraph().id).not.toBe(paragraph().id);
  });

  it('la tabla nace con sus columnas y sus filas vacías, y el hueco del Bestiario en cada una', () => {
    const b = table('encounter', ['PNJ', 'N.º', 'Notas']);
    expect(b.rows).toHaveLength(2);
    expect(b.rows[0]).toEqual({ cells: [[], [], []], npcId: null });
    expect(table('npc', ['a'], 3).rows).toHaveLength(3);
  });

  it('una lista nace con un punto, no vacía', () => {
    expect(list(false).items).toEqual([[]]);
  });
});

describe('mover y quitar bloques', () => {
  const base = doc(paragraph(t('uno')), paragraph(t('dos')));

  it('mete un bloque justo detrás del que se dice', () => {
    const nuevo = paragraph(t('medio'));
    const out = insertAfter(base, base.blocks[0]!.id, nuevo);
    expect(out.blocks.map(b => b.id)).toEqual([base.blocks[0]!.id, nuevo.id, base.blocks[1]!.id]);
  });

  it('con un bloque que no existe, o sin decir cuál, lo pone al final', () => {
    expect(insertAfter(base, 'no-existe', paragraph(t('x'))).blocks).toHaveLength(3);
    expect(insertAfter(base, null, paragraph(t('x'))).blocks[2]).toMatchObject({ text: t('x') });
  });

  it('quitar el último bloque deja un párrafo vacío: siempre hay dónde escribir', () => {
    const solo = doc(paragraph(t('adiós')));
    const out = removeBlock(solo, solo.blocks[0]!.id);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0]).toMatchObject({ type: 'paragraph', text: [] });
    expect(out.blocks[0]!.id).not.toBe(solo.blocks[0]!.id);
  });

  it('cambiar o tocar un bloque que no existe deja el documento igual', () => {
    expect(replaceBlock(base, 'nope', paragraph())).toBe(base);
    expect(setText(base, 'nope', t('x'))).toBe(base);
  });

  it('un documento vacío se abre con un párrafo', () => {
    expect(docForEditing({ v: 1, blocks: [] }).blocks).toHaveLength(1);
    expect(docForEditing(base)).toBe(base);
  });
});

describe('escribir', () => {
  it('cambia el texto de un título, un párrafo o una cita', () => {
    const d = doc(heading(1, t('viejo')));
    expect(setText(d, d.blocks[0]!.id, t('nuevo')).blocks[0]).toMatchObject({ type: 'heading', level: 1, text: t('nuevo') });
  });

  it('no toca lo que no tiene texto suelto (separador, tabla, enlace a escena)', () => {
    const d = doc(table('npc', ['a']));
    expect(setText(d, d.blocks[0]!.id, t('x'))).toBe(d);
  });
});

describe('listas', () => {
  const d = doc(list(false, [t('uno'), t('dos')]));
  const id = d.blocks[0]!.id;

  it('cambia un punto sin tocar los demás', () => {
    expect(setItem(d, id, 1, t('DOS')).blocks[0]).toMatchObject({ items: [t('uno'), t('DOS')] });
    expect(setItem(d, id, 9, t('x'))).toBe(d);
  });

  it('el Intro mete un punto nuevo justo detrás', () => {
    expect(insertItemAfter(d, id, 0).blocks[0]).toMatchObject({ items: [t('uno'), [], t('dos')] });
  });

  it('quitar el último punto se lleva la lista entera', () => {
    const uno = doc(list(true, [t('solo')]));
    expect(removeItem(uno, uno.blocks[0]!.id, 0).blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(removeItem(d, id, 0).blocks[0]).toMatchObject({ items: [t('dos')] });
  });
});

describe('tablas', () => {
  const d = doc(table('encounter', ['PNJ', 'N.º']));
  const id = d.blocks[0]!.id;

  it('escribe en una celda y conserva el hueco de PNJ de la fila', () => {
    const out = setCell(d, id, 0, 1, t('3'));
    expect(out.blocks[0]).toMatchObject({ rows: [{ cells: [[], t('3')], npcId: null }, { cells: [[], []], npcId: null }] });
  });

  it('añade una fila vacía con tantas celdas como columnas', () => {
    const out = addTableRow(d, id);
    expect(out.blocks[0]).toMatchObject({ rows: [{}, {}, { cells: [[], []], npcId: null }] });
  });
});

describe('los botones de estilo de la barra', () => {
  it('convierte un párrafo en H1 conservando el texto Y el id (el índice abierto no se rompe)', () => {
    const d = doc(paragraph(t('El almacén')));
    const id = d.blocks[0]!.id;
    const out = setTextStyle(d, id, 'h1');
    expect(out.blocks[0]).toEqual({ id, type: 'heading', level: 1, text: t('El almacén') });
  });

  it('es un interruptor: volver a pulsar el estilo que ya tiene devuelve a párrafo', () => {
    const d = doc(heading(2, t('x')));
    const id = d.blocks[0]!.id;
    expect(setTextStyle(d, id, 'h2').blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(setTextStyle(d, id, 'h1').blocks[0]).toMatchObject({ type: 'heading', level: 1 });
  });

  it('la cita va y vuelve igual', () => {
    const d = doc(paragraph(t('leer en voz alta')));
    const id = d.blocks[0]!.id;
    const conCita = setTextStyle(d, id, 'quote');
    expect(conCita.blocks[0]).toMatchObject({ type: 'quote', text: t('leer en voz alta') });
    expect(setTextStyle(conCita, id, 'quote').blocks[0]).toMatchObject({ type: 'paragraph' });
  });

  it('dice qué estilo tiene cada bloque, y nada para los que no son de texto', () => {
    expect(textBlockStyle(paragraph())).toBe('paragraph');
    expect(textBlockStyle(heading(1))).toBe('h1');
    expect(textBlockStyle(heading(2))).toBe('h2');
    expect(textBlockStyle(quote())).toBe('quote');
    expect(textBlockStyle(table('npc', []))).toBeNull();
  });
});
