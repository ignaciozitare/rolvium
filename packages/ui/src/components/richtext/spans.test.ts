import { describe, it, expect } from 'vitest';
import { caretAtStart, placeCaret, sameText, spansFromNode, syncNode } from './spans';

const div = (html: string): HTMLElement => {
  const el = document.createElement('div');
  // Es un test: aquí se MONTA a mano lo que el navegador dejaría al escribir, para comprobar cómo se lee.
  el.appendChild(document.createRange().createContextualFragment(html));
  return el;
};

describe('spansFromNode — leer lo escrito', () => {
  it('un texto suelto es un tramo', () => {
    expect(spansFromNode(div('Llegan de noche.'))).toEqual([{ t: 'Llegan de noche.' }]);
  });

  it('entiende negrita y cursiva, las pongan como las pongan', () => {
    expect(spansFromNode(div('a<b>b</b><strong>c</strong><i>d</i><em>e</em>'))).toEqual([
      { t: 'a' }, { t: 'bc', b: true }, { t: 'de', i: true },
    ]);
  });

  it('entiende las dos a la vez, y el estilo suelto que deja el navegador', () => {
    expect(spansFromNode(div('<b><i>x</i></b>'))).toEqual([{ t: 'x', b: true, i: true }]);
    expect(spansFromNode(div('<span style="font-weight:bold">y</span>'))).toEqual([{ t: 'y', b: true }]);
    expect(spansFromNode(div('<span style="font-style:italic">z</span>'))).toEqual([{ t: 'z', i: true }]);
  });

  it('junta los tramos seguidos con el mismo formato, y tira los vacíos', () => {
    expect(spansFromNode(div('<b>uno</b><b> y dos</b>'))).toEqual([{ t: 'uno y dos', b: true }]);
    expect(spansFromNode(div('<b></b>hola'))).toEqual([{ t: 'hola' }]);
  });

  it('un salto de línea dentro del bloque no existe: un bloque es una línea', () => {
    expect(spansFromNode(div('uno<br>dos'))).toEqual([{ t: 'unodos' }]);
  });

  it('un trozo vacío no son tramos', () => {
    expect(spansFromNode(div(''))).toEqual([]);
  });
});

describe('syncNode — escribir los tramos en el DOM', () => {
  it('crea NODOS, nunca marcado en crudo (regla de XSS del proyecto)', () => {
    const el = document.createElement('p');
    syncNode(el, [{ t: '<script>alert(1)</script>' }]);
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toBe('<script>alert(1)</script>');
  });

  it('pinta negrita y cursiva y va y vuelve sin perder nada', () => {
    const el = document.createElement('p');
    const text = [{ t: 'llano ' }, { t: 'fuerte', b: true }, { t: 'torcido', i: true }, { t: 'las dos', b: true, i: true }];
    syncNode(el, text);
    expect(el.querySelector('strong')?.textContent).toBe('fuerte');
    expect(el.querySelector('em')?.textContent).toBe('torcido');
    expect(spansFromNode(el)).toEqual(text);
  });

  it('vuelve a dejarlo vacío cuando el texto se borra entero', () => {
    const el = document.createElement('p');
    syncNode(el, [{ t: 'algo' }]);
    syncNode(el, []);
    expect(el.childNodes).toHaveLength(0);
  });
});

/**
 * Es lo que decide si un trozo CON EL CURSOR DENTRO hay que repintarlo: si el documento dice lo mismo que hay
 * escrito, no se toca (o el cursor saltaría a cada tecla); si dice otra cosa, es que el cambio viene de fuera
 * y manda el documento.
 */
describe('sameText — ¿el DOM y el documento dicen lo mismo?', () => {
  it('sí cuando dicen lo mismo, aunque sean tramos distintos', () => {
    expect(sameText([{ t: 'hola' }], [{ t: 'hola' }])).toBe(true);
    expect(sameText([], [])).toBe(true);
    // `undefined` y `false` son lo mismo: sin formato.
    expect(sameText([{ t: 'x' }], [{ t: 'x', b: false, i: false }])).toBe(true);
  });

  it('no cuando cambia el texto, el formato o cuántos tramos hay', () => {
    expect(sameText([{ t: 'hola' }], [{ t: 'adiós' }])).toBe(false);
    expect(sameText([{ t: 'x' }], [{ t: 'x', b: true }])).toBe(false);
    expect(sameText([{ t: 'x' }], [{ t: 'x' }, { t: 'y' }])).toBe(false);
    expect(sameText([{ t: 'x' }], [])).toBe(false);
  });
});

describe('placeCaret — dónde queda el cursor', () => {
  it('lo deja al principio o al final de lo escrito', () => {
    const el = document.createElement('p');
    document.body.appendChild(el);
    syncNode(el, [{ t: 'hola' }]);

    placeCaret(el, 'end');
    expect(caretAtStart(el)).toBe(false);

    placeCaret(el, 'start');
    expect(caretAtStart(el)).toBe(true);

    el.remove();
  });
});
