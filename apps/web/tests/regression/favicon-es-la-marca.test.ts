import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Petición del dueño, 2026-09-03: «*pon el logo que tenemos en el .pen como favicon*». No había NINGÚN
 * `rel="icon"` en `index.html`, así que la pestaña salía con el icono por omisión del navegador.
 *
 * La marca es la del `.pen` (`Logo/Mark`: la luna creciente con la vela), y vive en un solo fichero —
 * `public/brand/mark.svg`— que ya usaban la barra de arriba, el login y la mesa. El icono apunta a ESE, y no
 * a una copia, para que el logo no pueda quedarse medio cambiado.
 */
const read = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('regresión · el favicon es la marca del .pen', () => {
  it('index.html declara el icono, y apunta a la marca compartida', () => {
    const html = read('index.html');
    expect(html).toMatch(/<link rel="icon"[^>]*href="\/brand\/mark\.svg"/);
    expect(html).toMatch(/<link rel="apple-touch-icon"[^>]*href="\/brand\/mark\.svg"/);
  });

  it('la marca existe, es un SVG y lleva la luna y la vela en el degradado de ámbar', () => {
    const svg = read('public/brand/mark.svg');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 40 40"');
    // El degradado de la marca del `.pen`: ámbar claro → ámbar.
    expect(svg).toContain('#f0c27a');
    expect(svg).toContain('#e0a458');
  });

  it('el icono NO es una copia: es el mismo fichero que usa el resto de la app', () => {
    for (const f of ['src/RolviumApp.tsx', 'src/shared/ui/AuthShell.tsx']) {
      expect(read(f)).toContain('/brand/mark.svg');
    }
  });
});
