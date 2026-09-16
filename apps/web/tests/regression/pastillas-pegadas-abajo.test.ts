import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🐞 2026-09-16, suyo, con captura: «*las pastillas deben quedar abajo, ahora cuando se abre una levanta las
 * del costado*». Al desplegar una pastilla, las barritas de al lado subían hasta la altura de la desplegada
 * en vez de quedarse pegadas al borde de abajo.
 *
 * La causa es contraintuitiva y por eso se pincha aquí: el rincón lleva `flex-wrap: wrap-reverse` (para que,
 * en una ventana estrecha, las pastillas que no caben se apilen HACIA ARRIBA y no se salgan por la izquierda
 * sin poder cerrarlas). `wrap-reverse` **da la vuelta al eje transversal**, así que `align-items: flex-end`
 * —que es lo que uno escribiría para «pegado abajo»— alinea con el borde de ARRIBA. Lo correcto aquí es
 * `flex-start`.
 *
 * Es una línea de CSS que parece un error tipográfico. Sin este test, el siguiente que la lea la «arregla».
 */
describe('las pastillas se quedan pegadas abajo', () => {
  const css = readFileSync(join(__dirname, '../../src/modules/chat/ui/chat.css'), 'utf8');
  const dock = css.slice(css.indexOf('.ch-dock{'), css.indexOf('}', css.indexOf('.ch-dock{')) + 1);

  it('el rincón se apila hacia arriba, que es de donde viene la inversión', () => {
    expect(dock).toContain('flex-wrap:wrap-reverse');
  });

  it('y por eso alinea en flex-start: con wrap-reverse, «start» es el borde de ABAJO', () => {
    expect(dock).toContain('align-items:flex-start');
    expect(dock).not.toContain('align-items:flex-end');
  });

  it('sigue anclado abajo a la derecha, a la izquierda de la columna', () => {
    expect(dock).toContain('position:fixed');
    expect(dock).toContain('bottom:16px');
    expect(dock).toContain('right:calc(var(--tb-side-w) + 24px)');
  });
});
