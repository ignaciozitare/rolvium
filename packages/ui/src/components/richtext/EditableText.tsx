import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RichText } from '@rolvium/core';
import { caretAtStart, spansFromNode, syncNode } from './spans';

export interface EditableTextProps {
  text: RichText;
  onChange: (text: RichText) => void;
  /** Intro: quien manda decide si eso es un párrafo nuevo o un punto más de la lista. */
  onEnter?: (() => void) | undefined;
  /** Retroceso con el cursor al principio: normalmente, quitar este bloque. */
  onBackspaceAtStart?: (() => void) | undefined;
  onFocus?: (() => void) | undefined;
  /** Se pide el foco desde fuera (se acaba de crear el bloque): se enfoca y se pone el cursor al final. */
  autoFocus?: boolean | undefined;
  readOnly?: boolean | undefined;
  placeholder?: string | undefined;
  ariaLabel: string;
  className?: string | undefined;
  /** La etiqueta que se pinta: un título es un `h1`/`h2` de verdad, no un `div` con letra grande. */
  as?: 'div' | 'h1' | 'h2' | undefined;
}

/**
 * UN TROZO DE TEXTO QUE SE ESCRIBE. Es la pieza de la que están hechos todos los bloques del editor: el título,
 * el párrafo, la cita, cada punto de una lista y cada celda de una tabla.
 *
 * 🔑 **Lo de dentro no lo pinta React**, lo pintan `syncNode`/`spansFromNode` (ver `spans.ts`): si React
 * repintara el contenido a cada tecla, el navegador y React se pelearían por el mismo DOM y el cursor saltaría
 * al principio. React pone el envoltorio y se aparta; el DOM manda mientras se escribe, y el documento se
 * entera en cada `input`.
 */
export function EditableText({
  text, onChange, onEnter, onBackspaceAtStart, onFocus, autoFocus, readOnly, placeholder, ariaLabel, className, as = 'div',
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const focused = useRef(false);
  const latest = useRef(text);
  latest.current = text;

  /**
   * Se pinta AL ENGANCHAR el nodo, no sólo cuando cambia el texto. El botón H1 de la barra cambia la etiqueta
   * (`div` → `h1`) sin cambiar el texto: el nodo es nuevo pero el efecto de abajo no se enteraría, y el título
   * salía VACÍO. Cazado con el test «convierte el bloque donde está el cursor en título».
   */
  const attach = useCallback((node: HTMLElement | null) => {
    ref.current = node;
    // El foco es del nodo VIEJO, que ya no está: un nodo recién enganchado no lo tiene (el `autoFocus` va después).
    focused.current = !!node && node.ownerDocument.activeElement === node;
    if (node && !focused.current) syncNode(node, latest.current);
  }, []);

  // Mientras este trozo tiene el cursor NO se toca: lo que hay escrito es la verdad.
  useLayoutEffect(() => {
    const node = ref.current;
    if (node && !focused.current) syncNode(node, text);
  }, [text]);

  useEffect(() => {
    const node = ref.current;
    if (!autoFocus || !node) return;
    node.focus();
    const selection = node.ownerDocument.defaultView?.getSelection();
    if (!selection) return;
    const range = node.ownerDocument.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [autoFocus]);

  const Tag = as as 'div';
  return (
    <Tag
      ref={attach as React.Ref<HTMLDivElement>}
      className={`rv-rt-text${className ? ` ${className}` : ''}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      // Un TÍTULO editable se sigue anunciando como título con su nivel: ponerle `role="textbox"` se lo quitaba
      // a quien navega con lector de pantalla. Lo demás sí es una caja de texto y hay que decirlo.
      {...(as === 'div' ? { role: 'textbox' as const, 'aria-multiline': 'false' as const } : {})}
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      onFocus={() => { focused.current = true; onFocus?.(); }}
      // Al perder el foco NO se vuelve a leer el DOM: cada tecla ya ha ido al documento en su `input`, y leerlo
      // aquí borraba el texto cuando el bloque cambiaba de etiqueta (de párrafo a título, con el botón de la
      // barra) — el nodo viejo se va, suelta su `blur` ya vacío, y ese vacío pisaba lo escrito.
      onBlur={() => { focused.current = false; }}
      onInput={e => onChange(spansFromNode(e.currentTarget))}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && onEnter) {
          e.preventDefault();
          onChange(spansFromNode(e.currentTarget));
          onEnter();
          return;
        }
        if (e.key === 'Backspace' && onBackspaceAtStart && caretAtStart(e.currentTarget)) {
          e.preventDefault();
          onBackspaceAtStart();
        }
      }}
    />
  );
}
