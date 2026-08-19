import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Sheet } from '@rolvium/ui';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';

/**
 * Regresión, prueba manual del dueño 2026-08-19 sobre la tabla de Armas: el alcance se comía media
 * tabla porque la celda escribía el nombre, los metros y la dificultad en línea («Medio · hasta 50 m ·
 * dif. 3»). Ahora la celda dice SÓLO el nombre y el dato secundario vive en un tooltip
 * (`FieldDef.options[].hint`), sobre un `<abbr>` enfocable.
 *
 * Lo que se fija aquí, que es justo lo que puede volver a romperse solo:
 *   · que la celda NO lleve los metros — si vuelven, la tabla se descuadra otra vez;
 *   · que la pista siga estando y sea alcanzable SIN RATÓN (`tabIndex=0`): sin eso el dato existe
 *     únicamente al pasar por encima, que es como no existir para quien navega con teclado;
 *   · que una opción SIN `hint` (cuerpo a cuerpo: no tiene metros ni reto, p.95–96) salga como texto
 *     pelado, sin subrayado punteado ni tooltip vacío.
 */
const ts = sysT(plenilunio, 'es');
const labels = { roll: 'Tirar', add: 'Añadir', remove: 'Quitar', manual: 'Manual', of: 'de' };

/** Magnum (alcance medio, CON pista) y nudilleras (cuerpo a cuerpo, SIN pista). */
const mount = () => render(
  <Sheet schema={plenilunio.sheetSchema} data={{ weapons: [{ id: 'magnum44', ammo: 6 }, { id: 'knuckles', ammo: null }] }}
    derived={{}} catalogs={plenilunio.catalogs} t={ts} labels={labels} icons={{}} showActions={false} />,
);

describe('regresión · el alcance de un arma se lee en una palabra, y los metros van en tooltip', () => {
  it('la celda dice sólo «Medio»: los metros viven en la capa del tooltip, no en el flujo', () => {
    mount();
    const tabla = screen.getByRole('table', { name: ts('sheet.weapons.list') });
    const celda = screen.getByText('Medio').closest('td')!;

    // Lo que se LEE en la celda es una palabra. (El texto de la pista existe en el DOM: el tooltip
    // del kit lo pinta en su propia capa, oculta por CSS y marcada `aria-hidden` — por eso esto no
    // se comprueba con «no está en el DOM», sino con «no está en el flujo de la celda».)
    expect(screen.getByText('Medio').textContent).toBe('Medio');
    expect(celda.querySelector('.rv-tip-wrap')?.firstElementChild?.textContent).toBe('Medio');

    const conMetros = within(tabla).getAllByText(/50 m/).filter(el => el.classList.contains('rv-tip'));
    expect(conMetros).toHaveLength(1);
    expect(conMetros[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('la pista está en el tooltip y se alcanza con el teclado', () => {
    mount();
    const abbr = screen.getByText('Medio');

    expect(abbr.tagName).toBe('ABBR');
    expect(abbr).toHaveAttribute('tabindex', '0');
    expect(abbr).toHaveAttribute('title', 'Hasta 50 m · dificultad 3');
    // El tooltip del kit cuelga del envoltorio, con el texto en `data-tooltip`.
    expect(abbr.closest('.rv-tip-wrap')).toHaveAttribute('data-tooltip', 'Hasta 50 m · dificultad 3');
  });

  it('una opción sin `hint` sale como texto pelado: cuerpo a cuerpo no tiene metros ni reto', () => {
    mount();
    const melee = screen.getByText('Cuerpo a cuerpo');

    expect(melee.tagName).not.toBe('ABBR');
    expect(melee.closest('.rv-tip-wrap')).toBeNull();
  });
});
