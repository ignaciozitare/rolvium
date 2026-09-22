import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RichText } from '@rolvium/core';
import { caretAtStart, placeCaret, sameText, spansFromNode, syncNode } from './spans';

export interface EditableTextProps {
  text: RichText;
  onChange: (text: RichText) => void;
  /** Intro: quien manda decide si eso es un párrafo nuevo o un punto más de la lista. */
  onEnter?: (() => void) | undefined;
  /** Retroceso con el cursor al principio: normalmente, quitar este bloque. */
  onBackspaceAtStart?: (() => void) | undefined;
  /**
   * Se ha pegado algo de más de una línea. La primera entra aquí; las demás las coloca quien manda, que es
   * quien sabe si esto es un párrafo, un punto de una lista o una celda.
   */
  onPasteLines?: ((lines: string[]) => void) | undefined;
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
  text, onChange, onEnter, onBackspaceAtStart, onPasteLines, onFocus, autoFocus, readOnly, placeholder, ariaLabel, className, as = 'div',
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

  /**
   * Mientras este trozo tiene el cursor NO se toca: lo que hay escrito es la verdad, y repintarlo a cada tecla
   * haría saltar el cursor al principio.
   *
   * 🐞 …salvo que el documento diga OTRA COSA que no ha salido de aquí. Eso pasa de verdad: los puntos de una
   * lista se pintan por su sitio (0, 1, 2…), así que al quitar uno de en medio React REAPROVECHA este mismo
   * nodo para el punto de abajo. Saltándose el repintado se veía el punto viejo —el de abajo desaparecía de la
   * pantalla— y la siguiente tecla lo PISABA en el documento. Cazado con «quitar un punto de en medio de una
   * lista no se lleva por delante el siguiente».
   *
   * Comparar por CONTENIDO y no por identidad es lo que evita que esto pelee con quien escribe: mientras se
   * teclea, el documento dice exactamente lo que dice el DOM (sale de él), así que aquí no se toca nada.
   */
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!focused.current) { syncNode(node, text); return; }
    if (sameText(spansFromNode(node), text)) return;
    syncNode(node, text);
    // El cursor se queda donde estaba el punto que se fue: al principio de lo que ahora ocupa su sitio.
    placeCaret(node, 'start');
  }, [text]);

  useEffect(() => {
    const node = ref.current;
    if (!autoFocus || !node) return;
    node.focus();
    placeCaret(node, 'end');
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
      //
      // Y el rótulo va SÓLO en la caja de texto. Un `aria-label` en un `h1`/`h2` PISA lo que pone el título: con
      // él, quien navega por títulos oía «Texto del documento» en todos —justo lo que el índice sirve para
      // evitar— en vez de «El almacén». Un título se llama por lo que dice.
      {...(as === 'div'
        ? { role: 'textbox' as const, 'aria-multiline': 'false' as const, 'aria-label': ariaLabel }
        : {})}
      data-placeholder={placeholder}
      onFocus={() => { focused.current = true; onFocus?.(); }}
      // Al perder el foco NO se vuelve a leer el DOM: cada tecla ya ha ido al documento en su `input`, y leerlo
      // aquí borraba el texto cuando el bloque cambiaba de etiqueta (de párrafo a título, con el botón de la
      // barra) — el nodo viejo se va, suelta su `blur` ya vacío, y ese vacío pisaba lo escrito.
      onBlur={() => { focused.current = false; }}
      onInput={e => onChange(spansFromNode(e.currentTarget))}
      /**
       * PEGAR ENTRA COMO TEXTO, SIEMPRE. Sin esto el navegador suelta el HTML del portapapeles dentro del
       * bloque y `spansFromNode` lo aplana: pegando de una página web o de Word, las líneas se pegaban unas a
       * otras sin separación y el CÓDIGO de un `<script>` o de un `<style>` acababa leyéndose como prosa.
       * Nada de eso se ejecutaba ni se guardaba como marcado —el documento es JSON—, pero el texto salía mal.
       */
      onPaste={e => {
        const plain = e.clipboardData?.getData('text/plain') ?? '';
        e.preventDefault();
        if (!plain) return;
        const lines = plain.replace(/\r\n?/g, '\n').split('\n');
        const exec = (globalThis as { document?: { execCommand?: (c: string, ui?: boolean, v?: string) => boolean } }).document?.execCommand;
        if (typeof exec === 'function') exec.call(globalThis.document, 'insertText', false, lines[0] ?? '');
        onChange(spansFromNode(e.currentTarget));
        const rest = lines.slice(1).filter(l => l.trim() !== '');
        if (rest.length > 0) onPasteLines?.(rest);
      }}
      onKeyDown={e => {
        // ⌘B / ⌘I, que es como se pone negrita en cualquier sitio. La barra hace lo mismo.
        if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
          e.preventDefault();
          const exec = (globalThis as { document?: { execCommand?: (c: string) => boolean } }).document?.execCommand;
          if (typeof exec === 'function') exec.call(globalThis.document, e.key === 'b' ? 'bold' : 'italic');
          onChange(spansFromNode(e.currentTarget));
          return;
        }
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
