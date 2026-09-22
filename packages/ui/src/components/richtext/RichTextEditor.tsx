import { useCallback, useMemo, useState } from 'react';
import type { RichBlock, RichDoc, RichText, TableBlock } from '@rolvium/core';
import {
  addTableRow, divider, docForEditing, insertAfter, insertItemAfter, list, paragraph, removeBlock, removeItem,
  sceneRef, setCell, setItem, setRowNpc, setText, setTextStyle, table, textBlockStyle, type TextBlockStyle,
} from '@rolvium/core';
import { EditableText } from './EditableText';
import './richtext.css';

export interface RichTextEditorLabels {
  /** Rótulo de la barra entera, para quien navega con teclado. */
  toolbar: string;
  h1: string;
  h2: string;
  bold: string;
  italic: string;
  bulleted: string;
  numbered: string;
  quote: string;
  divider: string;
  /** La caja de cita lleva este rótulo dentro, como en el diseño. */
  quoteLabel: string;
  /** Sólo con `features.tables`. */
  npcTable?: string | undefined;
  encounterTable?: string | undefined;
  /** Cabeceras de las dos tablas — son CONTENIDO del documento: se guardan tal cual se escriben. */
  npcColumns?: readonly string[] | undefined;
  encounterColumns?: readonly string[] | undefined;
  addRow?: string | undefined;
  /** Sólo con `features.sceneRef`. */
  linkScene?: string | undefined;
  openScene?: string | undefined;
  /** Sólo con `features.bestiary` — la fila de PNJ/encuentro elegida del Bestiario. */
  pickNpc?: string | undefined;
  npcMenu?: string | undefined;
  openNpc?: string | undefined;
  rollNpc?: string | undefined;
  unlinkNpc?: string | undefined;
  linkedNpc?: string | undefined;
  /** Lo que se lee en un bloque vacío. */
  placeholder: string;
  /** Rótulo de cada trozo que se escribe, para el lector de pantalla. */
  textField: string;
  removeBlock: string;
}

export interface RichTextEditorProps {
  doc: RichDoc;
  onChange: (doc: RichDoc) => void;
  labels: RichTextEditorLabels;
  readOnly?: boolean | undefined;
  /** Lo que sólo tiene una aventura: las tablas de PNJ/encuentro, el enlace a escena y el Bestiario. */
  features?: { tables?: boolean; sceneRef?: boolean; bestiary?: boolean } | undefined;
  /** Pide una escena a quien manda (un desplegable, un buscador…). Devolver `null` cancela. */
  onPickScene?: (() => Promise<{ sceneId: string; label: string } | null>) | undefined;
  /** Clic en el chip de una escena: abrirla en la mesa. */
  onOpenScene?: ((sceneId: string) => void) | undefined;
  /** Pide una criatura del Bestiario a quien manda. Devolver `null` cancela. */
  onPickNpc?: (() => Promise<{ npcId: string; name: string } | null>) | undefined;
  /** «Ver su ficha»: la misma del Bestiario. La abre quien manda; aquí sólo se pide. */
  onOpenNpc?: ((npcId: string) => void) | undefined;
  /** «Tirar por él»: el mismo desplegable del Bestiario. */
  onRollNpc?: ((npcId: string) => void) | undefined;
  /**
   * Cómo se pinta una fila enlazada: nombre, foto e iniciales de la entrada. **El editor no conoce el
   * Bestiario** — pregunta, y quien manda contesta con lo que tiene cargado.
   *
   * `null` = esa entrada ya no está (se borró del Bestiario). Entonces la fila se pinta SIN enlace y sin
   * foto, conservando lo escrito: es lo que manda el spec, el mismo principio que el `label` de `sceneRef`.
   */
  npcLook?: ((npcId: string) => NpcLook | null) | undefined;
  className?: string | undefined;
}

/** Lo que hace falta para pintar una fila enlazada. Las iniciales vienen hechas: son de quien tiene el nombre. */
export interface NpcLook { name: string; photoUrl: string | null; initials: string }

/** Qué fila tiene el menú abierto. Una sola a la vez, como cualquier menú. */
type OpenNpcRow = { blockId: string; row: number };

/**
 * EL EDITOR DE TEXTO ENRIQUECIDO DE ROLVIUM — **uno solo para las tres superficies** que se escriben: Notas,
 * Bitácora (`journal`, H9) y Aventuras (H12). Orden suya, 2026-09-19: «*haz las tres juntas*», y por eso vive
 * aquí y no tres veces dentro de los módulos (`CLAUDE.md` § Shared Packages).
 * Diseño: `rolvium.pen` § 4 · `Mesa/Plenilunio · Notas y Bitácora · con ÍNDICE` y
 * `Mesa/Plenilunio · Director · AVENTURAS · sólo el director`.
 *
 * - El documento es el árbol de bloques de `@rolvium/core` (`RichDoc`): **JSON, nunca HTML**. Aquí se PINTA
 *   bloque a bloque; no hay ni un `innerHTML` en todo el camino.
 * - **No trae botón de guardar** ni sabe guardar: avisa de cada cambio con `onChange` y quien lo monta decide
 *   cuándo escribe en la base («*el editor guarda solo*»).
 * - **Ni sabe de índice**: el panel es `DocIndexPanel`, y va AL LADO del texto, no dentro del documento.
 * - Viste con `--sys-*`: dentro de la mesa manda el tema del sistema de juego, no el claro/oscuro de la app.
 */
export function RichTextEditor({
  doc, onChange, labels, readOnly, features, onPickScene, onOpenScene, onPickNpc, onOpenNpc, onRollNpc, npcLook,
  className,
}: RichTextEditorProps) {
  /**
   * El documento con el que se TRABAJA. Un documento vacío se abre con un párrafo para tener dónde poner el
   * cursor, y hay que editar contra ESTE, no contra el de fuera: si no, lo que se escribiera en ese primer
   * párrafo no encontraría su bloque y se perdía tecla a tecla (cazado por el test de la Bitácora vacía).
   * Y va con `useMemo` porque ese párrafo tiene que ser SIEMPRE EL MISMO mientras el documento no cambie:
   * creándolo en cada pintada, el primer clic ya lo sustituía por otro y el foco se perdía antes de escribir.
   */
  const current = useMemo(() => docForEditing(doc), [doc]);
  const blocks = current.blocks;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  /** La fila enlazada que tiene el menú abierto («Ver su ficha · Tirar por él»). Sólo una a la vez. */
  const [npcRow, setNpcRow] = useState<OpenNpcRow | null>(null);
  const active = blocks.find(b => b.id === activeId) ?? null;
  const activeStyle = active ? textBlockStyle(active) : null;

  const apply = useCallback((next: RichDoc) => { onChange(next); }, [onChange]);

  // Cambiar de estilo NO puede echar al cursor del bloque: se vuelve a pedir el foco para el mismo bloque.
  const style = (s: TextBlockStyle) => { if (activeId) { apply(setTextStyle(current, activeId, s)); setFocusId(activeId); } };
  const inline = (command: 'bold' | 'italic') => {
    // `execCommand` sigue siendo la única forma de poner negrita en lo SELECCIONADO sin montar un motor de
    // edición entero. El `input` que provoca es el que mete el cambio en el documento.
    const exec = (globalThis as { document?: { execCommand?: (c: string) => boolean } }).document?.execCommand;
    if (typeof exec === 'function') exec.call(globalThis.document, command);
  };
  const insert = (block: RichBlock) => { apply(insertAfter(current, activeId, block)); setFocusId(block.id); };

  const addScene = async () => {
    if (!onPickScene) return;
    const picked = await onPickScene();
    if (picked) insert(sceneRef(picked.sceneId, picked.label));
  };

  /**
   * ELEGIR DEL BESTIARIO para una fila de PNJ/encuentro (2026-09-22).
   *
   * Dos cosas de una vez y en UN solo `onChange`: el enlace (`npcId`) y el NOMBRE en la primera celda. Van
   * juntas porque el nombre es contenido del documento —se puede reescribir a mano y sobrevive a que la
   * entrada se borre—, mientras que el enlace es lo que da ficha, foto y tirada. Dos `onChange` seguidos
   * contra `current` se pisarían: el segundo parte del documento viejo.
   */
  const pickNpc = async (blockId: string, row: number) => {
    if (!onPickNpc) return;
    const picked = await onPickNpc();
    if (!picked) return;
    apply(setCell(setRowNpc(current, blockId, row, picked.npcId), blockId, row, 0, [{ t: picked.name }]));
  };

  /** Lo que se sabe de la fila `row`: `null` si no está enlazada, o si su entrada ya no está en el Bestiario. */
  const lookOf = (block: TableBlock, row: number): NpcLook | null => {
    if (!features?.bestiary || !npcLook) return null;
    const id = block.rows[row]?.npcId;
    return id ? npcLook(id) : null;
  };

  const tools: { key: string; label: string; icon: string; on?: boolean; run: () => void }[] = [
    { key: 'h1', label: labels.h1, icon: 'format_h1', on: activeStyle === 'h1', run: () => style('h1') },
    { key: 'h2', label: labels.h2, icon: 'format_h2', on: activeStyle === 'h2', run: () => style('h2') },
    { key: 'bold', label: labels.bold, icon: 'format_bold', run: () => inline('bold') },
    { key: 'italic', label: labels.italic, icon: 'format_italic', run: () => inline('italic') },
    { key: 'bulleted', label: labels.bulleted, icon: 'format_list_bulleted', run: () => insert(list(false)) },
    { key: 'numbered', label: labels.numbered, icon: 'format_list_numbered', run: () => insert(list(true)) },
    { key: 'quote', label: labels.quote, icon: 'format_quote', on: activeStyle === 'quote', run: () => style('quote') },
    { key: 'divider', label: labels.divider, icon: 'horizontal_rule', run: () => insert(divider()) },
  ];
  if (features?.tables) {
    tools.push(
      { key: 'npc', label: labels.npcTable ?? '', icon: 'groups', run: () => insert(table('npc', labels.npcColumns ?? [])) },
      { key: 'encounter', label: labels.encounterTable ?? '', icon: 'swords', run: () => insert(table('encounter', labels.encounterColumns ?? [])) },
    );
  }
  if (features?.sceneRef && onPickScene) {
    tools.push({ key: 'scene', label: labels.linkScene ?? '', icon: 'link', run: () => { void addScene(); } });
  }

  const textProps = (block: RichBlock) => ({
    ariaLabel: labels.textField,
    placeholder: labels.placeholder,
    readOnly: readOnly ?? false,
    autoFocus: focusId === block.id,
    onFocus: () => setActiveId(block.id),
  });

  const renderBlock = (block: RichBlock) => {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote': {
        const editable = (
          <EditableText
            {...textProps(block)}
            as={block.type === 'heading' ? (block.level === 1 ? 'h1' : 'h2') : 'div'}
            className={block.type === 'heading' ? `rv-rt-h${block.level}` : `rv-rt-${block.type}`}
            text={block.text}
            onChange={text => apply(setText(current, block.id, text))}
            onEnter={() => insert(paragraph())}
            onBackspaceAtStart={() => { if (block.text.length === 0) apply(removeBlock(current, block.id)); }}
            // Pegar varias líneas deja un párrafo por línea, en vez de pegarlas todas seguidas.
            onPasteLines={lines => {
              let next = current;
              let after: string = block.id;
              for (const line of lines) {
                const b = paragraph([{ t: line }]);
                next = insertAfter(next, after, b);
                after = b.id;
              }
              apply(next);
            }}
          />
        );
        if (block.type !== 'quote') return editable;
        return (
          <blockquote className="rv-rt-quotebox">
            <span className="rv-rt-quotelabel">{labels.quoteLabel}</span>
            {editable}
          </blockquote>
        );
      }
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List className="rv-rt-list">
            {block.items.map((item, i) => (
              <li key={`${block.id}-${i}`}>
                <EditableText
                  {...textProps(block)}
                  text={item}
                  onChange={text => apply(setItem(current, block.id, i, text))}
                  onEnter={() => apply(insertItemAfter(current, block.id, i))}
                  onBackspaceAtStart={() => { if (item.length === 0) apply(removeItem(current, block.id, i)); }}
                />
              </li>
            ))}
          </List>
        );
      }
      case 'divider':
        return <hr className="rv-rt-divider" />;
      case 'sceneRef':
        return (
          <button
            type="button" className="rv-rt-scene"
            onClick={() => onOpenScene?.(block.sceneId)}
            title={labels.openScene ?? ''}
          >
            <span className="material-symbols-outlined" aria-hidden="true">map</span>
            {block.label}
          </button>
        );
      case 'table':
        return renderTable(block);
    }
  };

  /**
   * LA PRIMERA CELDA DE UNA FILA DE PNJ/ENCUENTRO, cuando hay Bestiario: foto (o iniciales), el nombre que se
   * escribe, el eslabón que avisa de que está enlazada, y el botón del libro — que elige si aún no lo está y
   * abre el menú de la fila si ya lo está. Lámina `Aventuras/Fila del BESTIARIO · elegir a alguien y lo que
   * ofrece`, aprobada el 2026-09-22.
   *
   * El menú vive AQUÍ, pequeño y flotante sobre su fila: «Ver su ficha» y «Tirar por él» los resuelve quien
   * manda (son del Bestiario, y este editor no lo conoce); quitar el enlace es del documento y se hace aquí.
   */
  const renderNpcCell = (block: TableBlock, r: number, editable: JSX.Element) => {
    const look = lookOf(block, r);
    const npcId = block.rows[r]?.npcId ?? null;
    const open = npcRow?.blockId === block.id && npcRow.row === r;
    const canPick = !readOnly && !!onPickNpc;
    return (
      <div className="rv-rt-npccell" onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setNpcRow(null); } }}>
        {look && (look.photoUrl
          ? <img src={look.photoUrl} alt="" className="rv-rt-npcpic" />
          : <span className="rv-rt-npcini" aria-hidden="true">{look.initials}</span>)}
        {editable}
        {look && (
          <span className="material-symbols-outlined rv-rt-npcchain" role="img" aria-label={labels.linkedNpc ?? ''}>link</span>
        )}
        {(look ? true : canPick) && (
          <button
            type="button" className="rv-rt-npcbtn"
            {...(look ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': open } : {})}
            aria-label={look ? `${labels.npcMenu ?? ''} · ${look.name}` : (labels.pickNpc ?? '')}
            title={look ? labels.npcMenu ?? '' : labels.pickNpc ?? ''}
            // El ratón no puede robarle el foco al texto que se estaba escribiendo.
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              if (look) setNpcRow(o => (o && o.blockId === block.id && o.row === r ? null : { blockId: block.id, row: r }));
              else void pickNpc(block.id, r);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
          </button>
        )}
        {open && look && npcId && (
          <>
            {/* Captador invisible: cierra al pulsar fuera sin tapar el documento. */}
            <div className="rv-rt-npccatch" onClick={() => setNpcRow(null)} aria-hidden="true" />
            <div className="rv-rt-npcmenu" role="menu" aria-label={`${labels.npcMenu ?? ''} · ${look.name}`}>
              {onOpenNpc && (
                <button type="button" role="menuitem" className="rv-rt-npcitem"
                        onClick={() => { setNpcRow(null); onOpenNpc(npcId); }}>
                  <span className="material-symbols-outlined" aria-hidden="true">contact_page</span>
                  {labels.openNpc ?? ''}
                </button>
              )}
              {onRollNpc && (
                <button type="button" role="menuitem" className="rv-rt-npcitem"
                        onClick={() => { setNpcRow(null); onRollNpc(npcId); }}>
                  <span className="material-symbols-outlined" aria-hidden="true">casino</span>
                  {labels.rollNpc ?? ''}
                </button>
              )}
              {!readOnly && (
                <button type="button" role="menuitem" className="rv-rt-npcitem"
                        onClick={() => { setNpcRow(null); apply(setRowNpc(current, block.id, r, null)); }}>
                  <span className="material-symbols-outlined" aria-hidden="true">link_off</span>
                  {labels.unlinkNpc ?? ''}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTable = (block: TableBlock) => {
    // Sólo las de PNJ y encuentro se eligen del Bestiario; una tabla `plain` es una tabla y ya está.
    const withBestiary = !!features?.bestiary && block.kind !== 'plain';
    return (
      <div className="rv-rt-table">
        <div className="rv-rt-thead">
          <span className="material-symbols-outlined" aria-hidden="true">{block.kind === 'encounter' ? 'swords' : 'groups'}</span>
          {block.columns.join(' · ')}
        </div>
        <table>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={`${block.id}-${r}`}>
                {row.cells.map((cell, c) => {
                  const editable = (
                    <EditableText
                      {...textProps(block)}
                      // Cada celda se llama por SU columna: en una tabla de cuatro, oír «Texto del documento»
                      // cuatro veces no dice en cuál estás.
                      ariaLabel={block.columns[c] ?? labels.textField}
                      placeholder={block.columns[c] ?? ''}
                      text={cell}
                      onChange={text => apply(setCell(current, block.id, r, c, text))}
                    />
                  );
                  return (
                    <td key={`${block.id}-${r}-${c}`}>
                      {withBestiary && c === 0 ? renderNpcCell(block, r, editable) : editable}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <button type="button" className="rv-rt-addrow" onClick={() => apply(addTableRow(current, block.id))}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            {labels.addRow ?? ''}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`rv-rt${className ? ` ${className}` : ''}`}>
      {!readOnly && (
        <div className="rv-rt-bar" role="toolbar" aria-label={labels.toolbar}>
          {tools.map(tool => (
            <button
              key={tool.key} type="button" title={tool.label} aria-label={tool.label}
              aria-pressed={tool.on ?? false}
              className={`rv-rt-tool${tool.on ? ' on' : ''}`}
              // El ratón no puede robarle el foco al texto: sin esto se pierde qué bloque se estaba tocando.
              onMouseDown={e => e.preventDefault()}
              onClick={tool.run}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{tool.icon}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rv-rt-page">
        {blocks.map(block => (
          <div key={block.id} id={`rt-${block.id}`} className="rv-rt-block">
            {renderBlock(block)}
          </div>
        ))}
      </div>
    </div>
  );
}
