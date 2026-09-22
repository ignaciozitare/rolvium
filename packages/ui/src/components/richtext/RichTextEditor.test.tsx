import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildDocIndex, heading, list, paragraph, quote, sceneRef, setCell, setRowNpc, table, type RichDoc } from '@rolvium/core';
import { RichTextEditor, type RichTextEditorLabels } from './RichTextEditor';
import { DocIndexPanel } from './DocIndexPanel';

const LABELS: RichTextEditorLabels = {
  toolbar: 'Formato', h1: 'Título', h2: 'Subtítulo', bold: 'Negrita', italic: 'Cursiva',
  bulleted: 'Lista', numbered: 'Lista numerada', quote: 'Cita', divider: 'Separador',
  quoteLabel: 'PARA LEER EN VOZ ALTA', npcTable: 'Tabla de PNJ', encounterTable: 'Tabla de encuentro',
  npcColumns: ['PNJ', 'Qué es'], encounterColumns: ['PNJ', 'N.º'], addRow: 'Añadir fila',
  linkScene: 'Enlazar escena', openScene: 'Abrir en la mesa', placeholder: 'Escribe aquí…',
  textField: 'Texto', removeBlock: 'Quitar',
  pickNpc: 'Elegir del Bestiario', npcMenu: 'Del Bestiario', openNpc: 'Ver su ficha',
  rollNpc: 'Tirar por él', unlinkNpc: 'Quitar el enlace', linkedNpc: 'Del Bestiario',
};

/** Lo que el Bestiario contesta cuando el editor pregunta por una fila enlazada. */
const OGRO = { name: 'Ogro del puente', photoUrl: 'https://x/ogro.webp', initials: 'OP' };
const look = (id: string) => (id === 'ogre' ? OGRO : null);

const doc = (...blocks: RichDoc['blocks']): RichDoc => ({ v: 1, blocks });

/** El editor es controlado: quien lo monta guarda el documento. Esto es ese «quien lo monta». */
function Montado({ inicial, ...rest }: { inicial: RichDoc } & Partial<React.ComponentProps<typeof RichTextEditor>>) {
  const [value, setValue] = useState(inicial);
  return <RichTextEditor doc={value} onChange={setValue} labels={LABELS} {...rest} />;
}

describe('RichTextEditor — lo que se ve', () => {
  it('pinta cada bloque con lo que es: títulos de verdad, cita con su rótulo, lista y separador', () => {
    render(<Montado inicial={doc(
      heading(1, [{ t: 'El almacén' }]),
      heading(2, [{ t: 'Llegada' }]),
      paragraph([{ t: 'Llegan de noche.' }]),
      quote([{ t: 'El olor a óxido…' }]),
      list(false, [[{ t: 'uno' }], [{ t: 'dos' }]]),
    )} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Llegada');
    expect(screen.getByText('Llegan de noche.')).toBeInTheDocument();
    expect(screen.getByText('PARA LEER EN VOZ ALTA')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  /**
   * ♿ UN TÍTULO SE LLAMA POR LO QUE DICE. El `aria-label` del trozo editable iba también en los `h1`/`h2`, y
   * PISABA su texto: quien navega por títulos con un lector de pantalla oía «Texto del documento» en todos
   * —exactamente lo que el índice existe para evitar—. Cazado en la revisión del 2026-09-20.
   */
  it('cada título se anuncia por su texto, no con el rótulo de la caja', () => {
    render(<Montado inicial={doc(heading(1, [{ t: 'El almacén' }]), heading(2, [{ t: 'Llegada' }]))} />);
    expect(screen.getByRole('heading', { level: 1, name: 'El almacén' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Llegada' })).toBeInTheDocument();
    // Lo que sí es una caja de texto conserva su rótulo: sin él no tendría nombre ninguno.
    render(<Montado inicial={doc(paragraph([{ t: 'x' }]))} />);
    expect(screen.getAllByRole('textbox', { name: 'Texto' }).length).toBeGreaterThan(0);
  });

  it('el formato de un tramo se ve: la negrita es negrita y la cursiva, cursiva', () => {
    const { container } = render(<Montado inicial={doc(paragraph([{ t: 'lo ' }, { t: 'importante', b: true }, { t: ' y lo otro', i: true }]))} />);
    expect(container.querySelector('strong')?.textContent).toBe('importante');
    expect(container.querySelector('em')?.textContent).toBe(' y lo otro');
  });

  it('un documento vacío se abre con un sitio donde escribir', () => {
    render(<Montado inicial={doc()} />);
    expect(screen.getByRole('textbox', { name: 'Texto' })).toBeInTheDocument();
  });

  it('sólo lectura: ni barra ni nada editable', () => {
    render(<Montado inicial={doc(paragraph([{ t: 'x' }]))} readOnly />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Texto' })).toHaveAttribute('contenteditable', 'false');
  });
});

describe('RichTextEditor — la barra', () => {
  it('convierte el bloque donde está el cursor en título, y volver a pulsar lo deshace', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(paragraph([{ t: 'El almacén' }]))} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.click(screen.getByRole('button', { name: 'Título' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
    await user.click(screen.getByRole('button', { name: 'Título' }));
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('el botón del estilo que tiene el bloque se ve pulsado', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(heading(2, [{ t: 'Llegada' }]))} />);
    // Un título editable NO es una caja de texto: se sigue anunciando como título, con su nivel.
    await user.click(screen.getByRole('heading', { level: 2 }));
    expect(screen.getByRole('button', { name: 'Subtítulo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Título' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('mete una lista, una cita y un separador detrás del bloque donde está el cursor', async () => {
    const user = userEvent.setup();
    const { container } = render(<Montado inicial={doc(paragraph([{ t: 'antes' }]))} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByRole('list')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Separador' }));
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('sin las cosas de una aventura, la barra NO las ofrece', () => {
    render(<Montado inicial={doc(paragraph())} />);
    expect(screen.queryByRole('button', { name: 'Tabla de encuentro' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enlazar escena' })).toBeNull();
  });

  it('con ellas, mete la tabla de encuentro con sus columnas y deja añadir filas', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(paragraph())} features={{ tables: true }} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.click(screen.getByRole('button', { name: 'Tabla de encuentro' }));
    expect(screen.getByText('PNJ · N.º')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Añadir fila/ }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('el enlace a escena pregunta a quien manda, y si cancela no mete nada', async () => {
    const user = userEvent.setup();
    const pick = vi.fn().mockResolvedValue(null);
    render(<Montado inicial={doc(paragraph())} features={{ sceneRef: true }} onPickScene={pick} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.click(screen.getByRole('button', { name: 'Enlazar escena' }));
    expect(pick).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /El sótano/ })).toBeNull();
  });

  it('el chip de una escena la abre en la mesa', async () => {
    const user = userEvent.setup();
    const abrir = vi.fn();
    render(<Montado inicial={doc(sceneRef('sc-9', 'El sótano'))} onOpenScene={abrir} />);
    await user.click(screen.getByRole('button', { name: 'El sótano' }));
    expect(abrir).toHaveBeenCalledWith('sc-9');
  });
});

describe('RichTextEditor — escribir', () => {
  it('cada tecla llega al documento de quien lo monta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor doc={doc(paragraph())} onChange={onChange} labels={LABELS} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.keyboard('hola');
    expect(onChange).toHaveBeenCalled();
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as RichDoc;
    expect(ultimo.blocks[0]).toMatchObject({ type: 'paragraph', text: [{ t: 'hola' }] });
  });

  it('el Intro abre un párrafo nuevo en vez de meter un salto dentro del bloque', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(paragraph([{ t: 'uno' }]))} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('textbox', { name: 'Texto' })).toHaveLength(2);
  });

  it('el Intro dentro de una lista añade un punto, no un párrafo', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(list(false, [[{ t: 'uno' }]]))} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  /**
   * 🐞 QUITAR UN PUNTO DE EN MEDIO SE LLEVABA EL DE ABAJO (cazado en la revisión del 2026-09-20).
   *
   * Los puntos de una lista se pintan por su sitio (0, 1, 2…), así que al quitar el de en medio React
   * REAPROVECHA el nodo que tenía el cursor para el punto de abajo. Como un trozo con el cursor no se
   * repintaba nunca, lo que se veía seguía siendo el punto viejo —el de abajo desaparecía de la pantalla
   * estando en el documento— y la siguiente tecla lo pisaba. Se perdía texto escrito, en silencio.
   */
  it('quitar un punto de en medio de una lista NO se lleva por delante el de abajo', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(list(false, [[{ t: 'uno' }], [], [{ t: 'dos' }]]))} />);
    const cajas = () => screen.getAllByRole('textbox', { name: 'Texto' });
    expect(cajas()).toHaveLength(3);

    await user.click(cajas()[1]!);       // el punto VACÍO de en medio
    await user.keyboard('{Backspace}');  // se lo lleva

    expect(cajas()).toHaveLength(2);
    // «dos» sigue en pantalla, en el sitio que ocupaba el que se fue.
    expect(cajas().map(c => c.textContent)).toEqual(['uno', 'dos']);

    // Y el cursor se queda a su principio: lo que se escriba ahora se AÑADE, no pisa.
    await user.keyboard('X');
    expect(cajas()[1]!.textContent).toBe('Xdos');
  });

  it('el Retroceso en un bloque vacío se lo lleva, pero nunca deja el documento sin sitio donde escribir', async () => {
    const user = userEvent.setup();
    render(<Montado inicial={doc(paragraph([{ t: 'uno' }]), paragraph())} />);
    const cajas = screen.getAllByRole('textbox', { name: 'Texto' });
    await user.click(cajas[1]!);
    await user.keyboard('{Backspace}');
    expect(screen.getAllByRole('textbox', { name: 'Texto' })).toHaveLength(1);
    await user.click(screen.getAllByRole('textbox', { name: 'Texto' })[0]!);
    await user.keyboard('{Backspace}');
    expect(screen.getAllByRole('textbox', { name: 'Texto' }).length).toBeGreaterThanOrEqual(1);
  });
});

describe('DocIndexPanel — el índice al lado', () => {
  const conTitulos = doc(
    heading(1, [{ t: 'El almacén' }]), heading(2, [{ t: 'Llegada' }]), paragraph([{ t: 'x' }]),
    heading(2, [{ t: 'Quién hay dentro' }]), heading(1, [{ t: 'Consecuencias' }]),
  );

  it('enseña los H1 con sus H2 colgando, en orden', () => {
    render(<DocIndexPanel entries={buildDocIndex(conTitulos)} onJump={() => {}} labels={{ title: 'ÍNDICE', empty: 'Sin títulos', close: 'Cerrar' }} />);
    const lista = screen.getAllByRole('list')[0]!;
    expect(within(lista).getAllByRole('button').map(b => b.textContent)).toEqual([
      'El almacén', 'Llegada', 'Quién hay dentro', 'Consecuencias',
    ]);
    expect(within(screen.getByRole('button', { name: 'El almacén' }).closest('li')!).getAllByRole('button')).toHaveLength(3);
  });

  it('un clic salta a ese título', async () => {
    const user = userEvent.setup();
    const saltar = vi.fn();
    const entries = buildDocIndex(conTitulos);
    render(<DocIndexPanel entries={entries} onJump={saltar} labels={{ title: 'ÍNDICE', empty: 'Sin títulos', close: 'Cerrar' }} />);
    await user.click(screen.getByRole('button', { name: 'Llegada' }));
    expect(saltar).toHaveBeenCalledWith(entries[0]!.children[0]!.id);
  });

  it('sin títulos, lo dice en vez de salir vacío', () => {
    render(<DocIndexPanel entries={[]} onJump={() => {}} labels={{ title: 'ÍNDICE', empty: 'Sin títulos', close: 'Cerrar' }} />);
    expect(screen.getByText('Sin títulos')).toBeInTheDocument();
  });

  it('se cierra sólo si quien lo monta da con qué', async () => {
    const user = userEvent.setup();
    const cerrar = vi.fn();
    const { rerender } = render(<DocIndexPanel entries={[]} onJump={() => {}} labels={{ title: 'ÍNDICE', empty: 'x', close: 'Cerrar' }} />);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    rerender(<DocIndexPanel entries={[]} onJump={() => {}} onClose={cerrar} labels={{ title: 'ÍNDICE', empty: 'x', close: 'Cerrar' }} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(cerrar).toHaveBeenCalled();
  });
});

describe('las tablas de una aventura', () => {
  it('cada celda se escribe por separado y la fila conserva su hueco de PNJ', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor doc={doc(table('encounter', ['PNJ', 'N.º'], 1))} onChange={onChange} labels={LABELS} features={{ tables: true }} />);
    // Cada celda se llama por su columna desde la revisión del 20-09: aquí se escribe en la de «N.º».
    await user.click(screen.getByRole('textbox', { name: 'N.º' }));
    await user.keyboard('3');
    const ultimo = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as RichDoc;
    expect(ultimo.blocks[0]).toMatchObject({ rows: [{ cells: [[], [{ t: '3' }]], npcId: null }] });
  });
});

describe('pegar, atajos y rótulos — lo que la revisión del 2026-09-20 dejó apuntado', () => {
  const paste = (el: Element, html: string, text: string) => {
    const data = { getData: (kind: string) => (kind === 'text/plain' ? text : html) };
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    el.dispatchEvent(event);
    return event;
  };

  it('pegar entra como TEXTO: ni marcado, ni el código de un <script> colado como prosa', () => {
    const onChange = vi.fn();
    render(<RichTextEditor doc={doc(paragraph())} onChange={onChange} labels={LABELS} />);
    const caja = screen.getByRole('textbox', { name: 'Texto' });
    const event = paste(caja, '<b>hola</b><script>alert(1)</script>', 'hola');
    // Se queda con el del portapapeles en texto plano y NO deja que el navegador meta su HTML.
    expect(event.defaultPrevented).toBe(true);
    expect(caja.querySelector('script')).toBeNull();
  });

  it('pegar varias líneas deja un párrafo por línea, no todo pegado', () => {
    const onChange = vi.fn();
    render(<RichTextEditor doc={doc(paragraph([{ t: 'antes' }]))} onChange={onChange} labels={LABELS} />);
    paste(screen.getByRole('textbox', { name: 'Texto' }), '', 'uno\ndos\r\ntres');
    const ultimo = onChange.mock.calls.at(-1)![0] as RichDoc;
    expect(ultimo.blocks).toHaveLength(3);
    expect(ultimo.blocks.slice(1)).toMatchObject([
      { type: 'paragraph', text: [{ t: 'dos' }] },
      { type: 'paragraph', text: [{ t: 'tres' }] },
    ]);
  });

  it('⌘B y ⌘I ponen negrita y cursiva, no sólo el botón de la barra', async () => {
    const user = userEvent.setup();
    const exec = vi.fn().mockReturnValue(true);
    const original = document.execCommand;
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    render(<Montado inicial={doc(paragraph([{ t: 'hola' }]))} />);
    await user.click(screen.getByRole('textbox', { name: 'Texto' }));
    await user.keyboard('{Meta>}b{/Meta}');
    await user.keyboard('{Control>}i{/Control}');
    expect(exec.mock.calls.map(c => c[0])).toEqual(['bold', 'italic']);
    (document as unknown as { execCommand: unknown }).execCommand = original;
  });

  it('cada celda de una tabla se llama por SU columna, no «Texto» cuatro veces', async () => {
    render(<RichTextEditor doc={doc(table('encounter', ['PNJ', 'N.º'], 1))} onChange={vi.fn()} labels={LABELS} features={{ tables: true }} />);
    expect(screen.getByRole('textbox', { name: 'PNJ' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'N.º' })).toBeInTheDocument();
  });
});

/**
 * LA FILA ELEGIDA DEL BESTIARIO (H5 × H12, 2026-09-22) — «*los encuentros y personajes … deberia poder
 * elegirlos del bestiario*», opción «b»: nombre y foto, ver su ficha y tirar por él. Colocar en la escena NO.
 */
describe('RichTextEditor — la fila del Bestiario', () => {
  const BEST = { tables: true, bestiary: true };

  it('sin la llave del Bestiario, la tabla sigue siendo la de siempre: ni libro ni eslabón', () => {
    render(<RichTextEditor doc={doc(table('npc', ['PNJ', 'Qué es'], 1))} onChange={vi.fn()} labels={LABELS} features={{ tables: true }} />);
    expect(screen.queryByRole('button', { name: 'Elegir del Bestiario' })).toBeNull();
  });

  it('una fila sin enlazar ofrece el libro SÓLO en la primera celda', () => {
    render(<RichTextEditor doc={doc(table('encounter', ['PNJ', 'N.º'], 2))} onChange={vi.fn()} labels={LABELS}
                           features={BEST} onPickNpc={vi.fn()} npcLook={look} />);
    expect(screen.getAllByRole('button', { name: 'Elegir del Bestiario' })).toHaveLength(2);
  });

  it('elegir del Bestiario deja el nombre escrito Y el enlace, en un solo cambio', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const d = doc(table('npc', ['PNJ', 'Qué es'], 1));
    render(<RichTextEditor doc={d} onChange={onChange} labels={LABELS} features={BEST} npcLook={look}
                           onPickNpc={() => Promise.resolve({ npcId: 'ogre', name: 'Ogro del puente' })} />);
    await user.click(screen.getByRole('button', { name: 'Elegir del Bestiario' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as RichDoc).blocks[0]).toMatchObject({
      rows: [{ cells: [[{ t: 'Ogro del puente' }], []], npcId: 'ogre' }],
    });
  });

  it('cancelar el picker no toca el documento', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor doc={doc(table('npc', ['PNJ', 'Qué es'], 1))} onChange={onChange} labels={LABELS}
                           features={BEST} npcLook={look} onPickNpc={() => Promise.resolve(null)} />);
    await user.click(screen.getByRole('button', { name: 'Elegir del Bestiario' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('una fila enlazada enseña su foto y el eslabón, y el botón abre su menú', async () => {
    const user = userEvent.setup();
    const base = doc(table('npc', ['PNJ', 'Qué es'], 1));
    const d = setRowNpc(base, base.blocks[0]!.id, 0, 'ogre');
    const { container } = render(<RichTextEditor doc={d} onChange={vi.fn()} labels={LABELS} features={BEST}
                                                 npcLook={look} onOpenNpc={vi.fn()} onRollNpc={vi.fn()} />);
    expect(container.querySelector('img.rv-rt-npcpic')).toHaveAttribute('src', OGRO.photoUrl);
    expect(screen.getByRole('img', { name: 'Del Bestiario' })).toBeInTheDocument();
    // Ya no es el picker: es el menú de la fila.
    expect(screen.queryByRole('button', { name: 'Elegir del Bestiario' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Del Bestiario · Ogro del puente/ }));
    expect(screen.getByRole('menuitem', { name: 'Ver su ficha' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tirar por él' })).toBeInTheDocument();
  });

  it('sin foto se pintan las iniciales, no un hueco', () => {
    const base = doc(table('npc', ['PNJ'], 1));
    const d = setRowNpc(base, base.blocks[0]!.id, 0, 'ogre');
    render(<RichTextEditor doc={d} onChange={vi.fn()} labels={LABELS} features={BEST}
                           npcLook={() => ({ ...OGRO, photoUrl: null })} />);
    expect(screen.getByText('OP')).toBeInTheDocument();
  });

  it('«Ver su ficha» y «Tirar por él» avisan a quien manda con el id de la entrada', async () => {
    const user = userEvent.setup();
    const onOpenNpc = vi.fn();
    const onRollNpc = vi.fn();
    const base = doc(table('encounter', ['PNJ', 'N.º'], 1));
    const d = setRowNpc(base, base.blocks[0]!.id, 0, 'ogre');
    const abrirMenu = () => user.click(screen.getByRole('button', { name: /Del Bestiario · Ogro del puente/ }));
    render(<RichTextEditor doc={d} onChange={vi.fn()} labels={LABELS} features={BEST} npcLook={look}
                           onOpenNpc={onOpenNpc} onRollNpc={onRollNpc} />);
    await abrirMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Ver su ficha' }));
    expect(onOpenNpc).toHaveBeenCalledWith('ogre');
    await abrirMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Tirar por él' }));
    expect(onRollNpc).toHaveBeenCalledWith('ogre');
  });

  it('quitar el enlace deja el nombre escrito donde estaba', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const base = doc(table('npc', ['PNJ', 'Qué es'], 1));
    const id = base.blocks[0]!.id;
    const d = setRowNpc(setCell(base, id, 0, 0, [{ t: 'Ogro del puente' }]), id, 0, 'ogre');
    render(<RichTextEditor doc={d} onChange={onChange} labels={LABELS} features={BEST} npcLook={look} />);
    await user.click(screen.getByRole('button', { name: /Del Bestiario · Ogro del puente/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Quitar el enlace' }));
    expect((onChange.mock.calls.at(-1)![0] as RichDoc).blocks[0]).toMatchObject({
      rows: [{ cells: [[{ t: 'Ogro del puente' }], []], npcId: null }],
    });
  });

  /**
   * La entrada se borró del Bestiario: el documento NO se toca —el nombre escrito es suyo— pero la fila deja
   * de prometer una ficha que ya no existe. Mismo principio que el `label` de `sceneRef` (spec § Rules & limits).
   */
  it('si la entrada ya no está en el Bestiario, la fila conserva el nombre y pierde el enlace', () => {
    const base = doc(table('npc', ['PNJ'], 1));
    const d = setRowNpc(base, base.blocks[0]!.id, 0, 'se-borro');
    render(<RichTextEditor doc={d} onChange={vi.fn()} labels={LABELS} features={BEST} npcLook={look}
                           onPickNpc={vi.fn()} onOpenNpc={vi.fn()} />);
    expect(screen.queryByRole('img', { name: 'Del Bestiario' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Elegir del Bestiario' })).toBeInTheDocument();
  });

  it('una tabla `plain` no se elige del Bestiario: no es de PNJ ni de encuentro', () => {
    render(<RichTextEditor doc={doc(table('plain', ['A', 'B'], 1))} onChange={vi.fn()} labels={LABELS}
                           features={BEST} onPickNpc={vi.fn()} npcLook={look} />);
    expect(screen.queryByRole('button', { name: 'Elegir del Bestiario' })).toBeNull();
  });
});
