import type { RichSpan, RichText } from '@rolvium/core';

/**
 * EL PUENTE ENTRE EL DOCUMENTO Y EL DOM, en funciones puras y sin React, para poder probarlo sin montar una
 * pantalla. Son las dos únicas piezas del editor que tocan el DOM a mano:
 *
 * - `spansFromNode`: lee lo que hay escrito en un trozo editable y lo convierte en tramos `{ t, b, i }`.
 * - `syncNode`: escribe los tramos en el DOM **creando nodos**, nunca con HTML en crudo — `innerHTML` (y su
 *   primo `dangerouslySetInnerHTML`) están prohibidos en este proyecto, y aquí es donde más tentador sería.
 *
 * Y por eso el editor NO pinta el contenido editable con React: React y el navegador se pelearían por el mismo
 * DOM en cuanto se escribe, y el cursor salta. React pone el envoltorio; estas dos funciones, lo de dentro.
 */

const merge = (spans: RichSpan[], span: RichSpan): void => {
  if (!span.t) return;
  const last = spans[spans.length - 1];
  if (last && !!last.b === !!span.b && !!last.i === !!span.i) {
    last.t += span.t;
    return;
  }
  spans.push(span);
};

const walk = (node: Node, b: boolean, i: boolean, out: RichSpan[]): void => {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      const span: RichSpan = { t: child.nodeValue ?? '' };
      if (b) span.b = true;
      if (i) span.i = true;
      merge(out, span);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      // Un salto de línea dentro de un bloque no existe en el vocabulario: un bloque es una línea.
      continue;
    }
    const style = el.style;
    const bold = b || tag === 'B' || tag === 'STRONG' || style?.fontWeight === 'bold' || style?.fontWeight === '700';
    const italic = i || tag === 'I' || tag === 'EM' || style?.fontStyle === 'italic';
    walk(el, bold, italic, out);
  }
};

/** Lo escrito en un trozo editable, como tramos. Los tramos seguidos con el mismo formato se juntan. */
export function spansFromNode(node: Node): RichText {
  const out: RichSpan[] = [];
  walk(node, false, false, out);
  return out;
}

/**
 * Deja el DOM del trozo editable diciendo exactamente lo que dicen los tramos. Se llama SÓLO cuando ese trozo
 * no tiene el cursor: mientras se escribe, el DOM manda.
 */
export function syncNode(node: HTMLElement, text: RichText): void {
  node.textContent = '';
  for (const span of text) {
    if (!span.t) continue;
    let child: Node = node.ownerDocument.createTextNode(span.t);
    if (span.i) {
      const em = node.ownerDocument.createElement('em');
      em.appendChild(child);
      child = em;
    }
    if (span.b) {
      const strong = node.ownerDocument.createElement('strong');
      strong.appendChild(child);
      child = strong;
    }
    node.appendChild(child);
  }
}

/** ¿Está el cursor al principio del todo? Es lo que decide si un Retroceso junta con el bloque de arriba. */
export function caretAtStart(node: HTMLElement): boolean {
  const selection = node.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) return false;
  const before = range.cloneRange();
  before.selectNodeContents(node);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length === 0;
}
