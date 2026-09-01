import { describe, it, expect } from 'vitest';
import { Tooltip } from '@rolvium/ui';
import { renderWithProviders, screen, userEvent, fireEvent } from '../helpers/render';

/**
 * Pin de dos quejas del dueño del 2026-09-01, mirando la app en local.
 *
 * 1. «esta barra no tiene tooltips» — la barra de herramientas y el panel de capas SCROLLEAN
 *    (`overflow:auto` en `.mp-toolbar` y en `.mp-layers`). Un globo colocado en absoluto dentro del
 *    envoltorio lo recorta el antepasado que scrollea, así que ahí no se veía ni uno aunque estuviera en
 *    el DOM. Se arregla poniéndolo `position: fixed` con las coordenadas calculadas contra la ventana.
 * 2. «si hago click queda activado» — el CSS lo enseñaba con `:focus-within`, y un clic también deja el
 *    foco puesto, así que el rótulo se quedaba colgado después de pulsar el botón.
 *
 * Nada de esto lo pilla el typecheck ni un test que sólo mire que el globo EXISTE: los dos fallos vivían
 * en un DOM perfectamente correcto. De ahí este pin.
 */
describe('regresión · el tooltip se ve donde tiene que verse y se va cuando tiene que irse', () => {
  const mount = () => renderWithProviders(
    <Tooltip label="Muro" placement="right">
      <button type="button" aria-label="Muro">·</button>
    </Tooltip>,
  );
  const tip = (): HTMLElement => document.querySelector('.rv-tip') as HTMLElement;

  it('está escondido hasta que pasas por encima', async () => {
    mount();
    expect(tip()).toHaveAttribute('hidden');
    await userEvent.hover(screen.getByRole('button', { name: 'Muro' }));
    expect(tip()).not.toHaveAttribute('hidden');
  });

  it('al salir se va', async () => {
    mount();
    const btn = screen.getByRole('button', { name: 'Muro' });
    await userEvent.hover(btn);
    expect(tip()).not.toHaveAttribute('hidden');
    await userEvent.unhover(btn);
    expect(tip()).toHaveAttribute('hidden');
  });

  it('un CLIC no lo deja colgado', async () => {
    mount();
    const btn = screen.getByRole('button', { name: 'Muro' });
    await userEvent.hover(btn);
    fireEvent.pointerDown(btn);
    expect(tip()).toHaveAttribute('hidden');
  });

  it('se coloca contra la VENTANA, que es lo que lo saca del recorte de una barra que scrollea', async () => {
    mount();
    await userEvent.hover(screen.getByRole('button', { name: 'Muro' }));
    // Coordenadas puestas a mano = `position: fixed`. Con el `left:calc(100% + 8px)` de antes no habría
    // ningún estilo en línea, y el globo dependería del envoltorio — que es justo lo que lo recortaba.
    expect(tip().style.top).not.toBe('');
    expect(tip().style.left).not.toBe('');
  });
});
