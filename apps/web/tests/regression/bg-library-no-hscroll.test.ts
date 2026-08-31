import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regresión, dueño 2026-08-31: «cuidado con el modal de fondos… has puesto un scroll horizontal, eso no es
 * respetar el diseño». En `rolvium.pen` la biblioteca de imágenes son tres columnas dentro de un ancho fijo,
 * sin ninguna barra abajo.
 *
 * La causa NO era el ancho: cada casilla es una celda de rejilla, y una celda no se encoge por debajo del
 * contenido mínimo de sus hijos. Un nombre largo SIN ESPACIOS —el identificador de un fichero recién
 * subido— estiraba su columna, la rejilla se pasaba de los 340 px del modal y aparecía la barra. El
 * `text-overflow:ellipsis` de `.mp-lib-name` no llegaba a entrar nunca, porque el texto nunca se veía
 * obligado a recortarse.
 *
 * Se fija en el CSS y no renderizando porque jsdom no calcula layout: no hay forma de preguntarle si hay
 * scroll. Lo que este test protege es que nadie quite las dos reglas que lo arreglan.
 */
const css = (): string => readFileSync(resolve(__dirname, '../../src/modules/maps/ui/maps.css'), 'utf8');
const rule = (name: string): string => css().match(new RegExp(`\\${name}\\{([^}]*)\\}`))?.[1] ?? '';

describe('regresión · la biblioteca de fondos no scrollea a lo ancho', () => {
  it('la casilla puede encogerse por debajo de su contenido, que es lo que activa el recorte', () => {
    expect(rule('.mp-lib-item')).toContain('min-width:0');
  });

  it('y el modal deja el scroll vertical pero prohíbe el horizontal', () => {
    const bgpop = rule('.mp-bgpop');
    expect(bgpop).toContain('overflow-x:hidden');
    expect(bgpop).toContain('overflow-y:auto');
    // `overflow:auto` a secas es justo lo que dejaba salir la barra de abajo.
    expect(bgpop).not.toMatch(/overflow:auto/);
  });

  it('el nombre sigue recortándose con puntos suspensivos: sin eso, encoger sólo lo cortaría en seco', () => {
    const name = rule('.mp-lib-name');
    expect(name).toContain('text-overflow:ellipsis');
    expect(name).toContain('white-space:nowrap');
    expect(name).toContain('overflow:hidden');
  });

  it('y la rejilla sigue siendo de tres columnas, como el diseño', () => {
    expect(rule('.mp-lib')).toContain('grid-template-columns:repeat(3,1fr)');
  });
});
