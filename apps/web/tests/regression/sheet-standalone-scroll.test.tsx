import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regresión, dueño 2026-08-19: «cuando abres la ficha de personaje en una nueva pestaña no tienes scroll».
 *
 * `CharacterSheetPage` reusa `.tb-root` por el tema del sistema, pero esa clase lleva
 * `height:100dvh; overflow:hidden` para que la ESCENA no scrollee — el mapa se comía el alto. La página
 * suelta heredaba la regla y se quedaba sin forma de bajar. El modificador `.tb-root-page` la deshace.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../../src', p), 'utf8');

describe('regresión · la ficha en pestaña aparte scrollea', () => {
  it('CharacterSheetPage lleva el modificador que deshace el overflow:hidden de la mesa', () => {
    expect(read('modules/characters/ui/CharacterSheetPage.tsx')).toMatch(/className="tb-root tb-root-page"/);
  });
  it('y el modificador devuelve el scroll y suelta el alto fijo', () => {
    const css = read('modules/table/ui/table.css');
    const rule = css.match(/\.tb-root-page\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('overflow:visible');
    expect(rule).toContain('height:auto');
    expect(rule).toMatch(/min-height:100dvh/);
  });
});
