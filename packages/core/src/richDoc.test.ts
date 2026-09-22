import { describe, it, expect } from 'vitest';
import {
  DOC_MAX_BYTES, buildDocIndex, docByteSize, docFitsLimit, emptyDoc, isJournalBlock, parseDoc, plainText,
  type RichBlock, type RichDoc,
} from './richDoc';

const h = (id: string, level: 1 | 2, t: string): RichBlock => ({ id, type: 'heading', level, text: [{ t }] });
const p = (id: string, t: string): RichBlock => ({ id, type: 'paragraph', text: [{ t }] });

const DOC: RichDoc = {
  v: 1,
  blocks: [
    h('a', 1, 'El almacén de los muelles'),
    h('b', 2, 'Llegada'),
    p('c', 'Llegan de noche.'),
    h('d', 2, 'Quién hay dentro'),
    h('e', 1, 'Consecuencias'),
    h('f', 2, 'Si el chatarrero habla'),
  ],
};

describe('buildDocIndex — los H1 con sus H2 colgando', () => {
  it('cuelga cada H2 del H1 que lo contiene', () => {
    expect(buildDocIndex(DOC)).toEqual([
      { id: 'a', text: 'El almacén de los muelles', children: [
        { id: 'b', text: 'Llegada', children: [] },
        { id: 'd', text: 'Quién hay dentro', children: [] },
      ] },
      { id: 'e', text: 'Consecuencias', children: [
        { id: 'f', text: 'Si el chatarrero habla', children: [] },
      ] },
    ]);
  });

  it('un H2 escrito antes de cualquier H1 cuelga de la raíz', () => {
    const index = buildDocIndex({ v: 1, blocks: [h('x', 2, 'Suelto'), h('y', 1, 'Título')] });
    expect(index.map(e => e.id)).toEqual(['x', 'y']);
    expect(index[0]?.children).toEqual([]);
  });

  it('un documento sin títulos no tiene índice', () => {
    expect(buildDocIndex({ v: 1, blocks: [p('c', 'sólo texto')] })).toEqual([]);
    expect(buildDocIndex(emptyDoc())).toEqual([]);
  });

  it('el texto del índice es el texto plano, sin el formato', () => {
    const doc: RichDoc = { v: 1, blocks: [{ id: 'a', type: 'heading', level: 1, text: [{ t: 'El ' }, { t: 'almacén', b: true }] }] };
    expect(buildDocIndex(doc)[0]?.text).toBe('El almacén');
    expect(plainText([{ t: 'a' }, { t: 'b', i: true }])).toBe('ab');
  });
});

describe('parseDoc — lo que viene de la base nunca rompe la pantalla', () => {
  it('un jsonb vacío o con forma rara acaba en un documento vacío', () => {
    expect(parseDoc(null)).toEqual(emptyDoc());
    expect(parseDoc({})).toEqual(emptyDoc());
    expect(parseDoc('texto')).toEqual(emptyDoc());
    expect(parseDoc({ v: 1, blocks: 'no es una lista' })).toEqual(emptyDoc());
  });

  it('deja fuera los bloques sin id, sin tipo o de un tipo desconocido', () => {
    const doc = parseDoc({ v: 1, blocks: [
      { type: 'paragraph', text: 'sin id' },
      { id: 'a' },
      { id: 'b', type: 'video', src: 'x' },
      { id: 'c', type: 'paragraph', text: 'buena' },
    ] });
    expect(doc.blocks.map(b => b.id)).toEqual(['c']);
  });

  it('un texto guardado como cadena se lee como un solo tramo', () => {
    const doc = parseDoc({ v: 1, blocks: [{ id: 'a', type: 'heading', level: 2, text: 'Título' }] });
    expect(doc.blocks[0]).toEqual({ id: 'a', type: 'heading', level: 2, text: [{ t: 'Título' }] });
  });

  it('un título sin nivel, o con uno que el editor no ofrece, se lee como H1', () => {
    expect(parseDoc({ v: 1, blocks: [{ id: 'a', type: 'heading', text: 'x' }] }).blocks[0]).toMatchObject({ level: 1 });
    expect(parseDoc({ v: 1, blocks: [{ id: 'a', type: 'heading', level: 4, text: 'x' }] }).blocks[0]).toMatchObject({ level: 1 });
  });

  it('conserva negrita y cursiva, y descarta los tramos sin texto', () => {
    const doc = parseDoc({ v: 1, blocks: [{ id: 'a', type: 'paragraph', text: [{ t: 'uno', b: true }, { nope: 1 }, { t: 'dos', i: true }] }] });
    expect(doc.blocks[0]).toEqual({ id: 'a', type: 'paragraph', text: [{ t: 'uno', b: true }, { t: 'dos', i: true }] });
  });

  it('lee la lista, el separador, el enlace a escena y la tabla de una aventura', () => {
    const doc = parseDoc({ v: 1, blocks: [
      { id: 'l', type: 'list', ordered: true, items: ['uno', 'dos'] },
      { id: 'r', type: 'divider' },
      { id: 's', type: 'sceneRef', sceneId: 'scene-1', label: 'El sótano' },
      { id: 't', type: 'table', kind: 'encounter', columns: ['PNJ', 'N.º'], rows: [{ cells: ['Mutante', '3'] }] },
    ] });
    expect(doc.blocks.map(b => b.type)).toEqual(['list', 'divider', 'sceneRef', 'table']);
    expect(doc.blocks[0]).toEqual({ id: 'l', type: 'list', ordered: true, items: [[{ t: 'uno' }], [{ t: 'dos' }]] });
    expect(doc.blocks[3]).toEqual({
      id: 't', type: 'table', kind: 'encounter', columns: ['PNJ', 'N.º'],
      rows: [{ cells: [[{ t: 'Mutante' }], [{ t: '3' }]], npcId: null }],
    });
  });

  it('cada fila de tabla lleva su hueco de PNJ desde el día uno, vacío mientras no haya Bestiario', () => {
    const doc = parseDoc({ v: 1, blocks: [{ id: 't', type: 'table', rows: [{ cells: [] }, { cells: [], npcId: 'npc-7' }] }] });
    expect(doc.blocks[0]).toMatchObject({ kind: 'npc', rows: [{ npcId: null }, { npcId: 'npc-7' }] });
  });

  it('un enlace a escena sin escena no entra', () => {
    expect(parseDoc({ v: 1, blocks: [{ id: 's', type: 'sceneRef', label: 'x' }] }).blocks).toEqual([]);
  });
});

describe('el tope de tamaño y el subconjunto de journal', () => {
  it('mide el documento y lo compara con el tope', () => {
    expect(docByteSize(emptyDoc())).toBeLessThan(DOC_MAX_BYTES);
    expect(docFitsLimit(DOC)).toBe(true);
    const enorme: RichDoc = { v: 1, blocks: [p('a', 'x'.repeat(DOC_MAX_BYTES + 1))] };
    expect(docFitsLimit(enorme)).toBe(false);
  });

  it('las tablas y los enlaces a escena no valen en Notas ni en Bitácora', () => {
    expect(isJournalBlock(h('a', 1, 'x'))).toBe(true);
    expect(isJournalBlock({ id: 'r', type: 'divider' })).toBe(true);
    expect(isJournalBlock({ id: 's', type: 'sceneRef', sceneId: 'x', label: '' })).toBe(false);
    expect(isJournalBlock({ id: 't', type: 'table', kind: 'npc', columns: [], rows: [] })).toBe(false);
  });
});
