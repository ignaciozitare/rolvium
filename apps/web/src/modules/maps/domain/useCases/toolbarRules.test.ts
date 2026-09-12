import { describe, it, expect } from 'vitest';
import { DEFAULT_TOOLBAR_ORDER, moveToolbarItem, parseToolbarOrder, resolvedBlockOrder, resolvedToolbarOrder, TOOLBAR_SEP } from './toolbarRules';

/**
 * 🧲 El orden de la barra lo pone el admin PARA TODOS (spec § «La barra se ordena arrastrando…», 2026-09-12). Estas
 * reglas son las que impiden que lo guardado rompa nada: un botón desconocido se ignora, uno nuevo cae en su sitio de
 * serie y los bloques —que son lo que ve cada rol— no se mezclan.
 */
describe('toolbarRules — el orden de la barra', () => {
  it('sin nada guardado sale el orden de serie: el que fijó él el 31-ago', () => {
    expect(resolvedBlockOrder('dm')).toEqual(['light', 'wall', 'background', 'mask', TOOLBAR_SEP, 'reveal', 'hide', TOOLBAR_SEP, 'encounter', 'placePc']);
    expect(resolvedToolbarOrder(null)).toEqual({ play: [...DEFAULT_TOOLBAR_ORDER.play], draw: ['draw'], dm: [...DEFAULT_TOOLBAR_ORDER.dm] });
    // y no devuelve la lista de serie por identidad: quien la reciba puede tocarla sin pisar la constante
    expect(resolvedBlockOrder('play')).not.toBe(DEFAULT_TOOLBAR_ORDER.play);
  });

  it('lo guardado manda, y un botón desconocido o repetido se ignora', () => {
    expect(resolvedBlockOrder('play', ['pin', 'dice', 'measure', 'select'])).toEqual(['pin', 'dice', 'measure', 'select']);
    expect(resolvedBlockOrder('play', ['pin', 'pieces', 'dice', 'pin', 'measure', 'select'])).toEqual(['pin', 'dice', 'measure', 'select']);
    // un id del bloque del director no se cuela en el de juego: los bloques no se mezclan
    expect(resolvedBlockOrder('play', ['wall', 'pin', 'dice', 'measure', 'select'])).toEqual(['pin', 'dice', 'measure', 'select']);
  });

  it('un botón que falte (uno NUEVO, como Piezas) cae en su sitio de serie sin deshacer el orden guardado', () => {
    // guardado sin «measure»: vuelve detrás de «select», que es su vecino de serie
    expect(resolvedBlockOrder('play', ['pin', 'select', 'dice'])).toEqual(['pin', 'select', 'measure', 'dice']);
    // guardado sin «dice» (que en serie va el primero): va al principio
    expect(resolvedBlockOrder('play', ['pin', 'measure', 'select'])).toEqual(['dice', 'pin', 'measure', 'select']);
    // guardado vacío: todo de serie
    expect(resolvedBlockOrder('play', [])).toEqual([...DEFAULT_TOOLBAR_ORDER.play]);
  });

  it('las rayas del bloque del director se quedan donde estaban mientras los botones se mueven a su alrededor', () => {
    const movido = ['wall', 'background', 'mask', TOOLBAR_SEP, 'reveal', 'light', 'hide', TOOLBAR_SEP, 'encounter', 'placePc'];
    expect(resolvedBlockOrder('dm', movido)).toEqual(movido);
    // guardado SIN rayas (basura o versión vieja): vuelven a su sitio de serie, y sobran las de más
    expect(resolvedBlockOrder('dm', ['placePc', 'light', 'wall', 'background', 'mask', 'reveal', 'hide', 'encounter']))
      .toEqual(['placePc', 'light', 'wall', 'background', 'mask', TOOLBAR_SEP, 'reveal', 'hide', TOOLBAR_SEP, 'encounter']);
    expect(resolvedBlockOrder('dm', [TOOLBAR_SEP, TOOLBAR_SEP, TOOLBAR_SEP, ...DEFAULT_TOOLBAR_ORDER.dm.filter(x => x !== TOOLBAR_SEP)]).filter(x => x === TOOLBAR_SEP)).toHaveLength(2);
  });

  it('moveToolbarItem: coloca el botón antes del destino, o al final; devuelve la MISMA lista si no hay nada que cambiar', () => {
    const base = DEFAULT_TOOLBAR_ORDER.play;
    expect(moveToolbarItem(base, 'pin', 'dice')).toEqual(['pin', 'dice', 'select', 'measure']);
    expect(moveToolbarItem(base, 'dice', null)).toEqual(['select', 'measure', 'pin', 'dice']);
    expect(moveToolbarItem(base, 'select', 'measure')).toBe(base);   // ya estaba ahí
    expect(moveToolbarItem(base, 'pin', null)).toBe(base);           // ya era el último
    expect(moveToolbarItem(base, 'pin', 'pin')).toBe(base);
    expect(moveToolbarItem(base, 'nope', 'dice')).toBe(base);        // un botón que no está
    expect(moveToolbarItem(base, 'pin', 'nope')).toBe(base);         // un destino que no está
    // las rayas ni se mueven ni sirven de destino
    const dm = DEFAULT_TOOLBAR_ORDER.dm;
    expect(moveToolbarItem(dm, TOOLBAR_SEP, 'light')).toBe(dm);
    expect(moveToolbarItem(dm, 'light', TOOLBAR_SEP)).toBe(dm);
    expect(moveToolbarItem(dm, 'light', 'hide')).toEqual(['wall', 'background', 'mask', TOOLBAR_SEP, 'reveal', 'light', 'hide', TOOLBAR_SEP, 'encounter', 'placePc']);
  });

  it('parseToolbarOrder: sólo entiende un objeto con listas de textos por bloque; lo demás es «nada guardado»', () => {
    expect(parseToolbarOrder(null)).toBeNull();
    expect(parseToolbarOrder(7)).toBeNull();
    expect(parseToolbarOrder(['dice'])).toBeNull();
    expect(parseToolbarOrder({ play: ['pin', 3, 'dice'], dm: 'no', otro: ['x'] })).toEqual({ play: ['pin', 'dice'] });
    expect(parseToolbarOrder({})).toEqual({});
  });
});
