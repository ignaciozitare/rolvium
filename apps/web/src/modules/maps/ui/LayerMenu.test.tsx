import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, cleanup } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LAYERS_ALL, LAYER_NOTES, LAYER_OBJECTS } from '../../../../tests/helpers/fakes';
import { LayerMenu } from './LayerMenu';

/**
 * «Botón derecho sobre cualquier cosa → mándala a otra capa», petición literal del dueño
 * (`rolvium.pen` · «Menú mandar a capa»).
 *
 * Y desde el 2026-09-02, además, BORRARLA desde aquí: «*si la selecciono a la luz y toco la tecla suprimir o
 * botón derecho eliminar la luz se tiene que borrar*». Ese camino borra de verdad y estaba sin ningún test
 * que lo sujetara — lo cazó la puerta de QA antes de subir a producción.
 */
function mount(over: Partial<React.ComponentProps<typeof LayerMenu>> = {}) {
  const cb = { onPick: vi.fn(), onClose: vi.fn() };
  const base: React.ComponentProps<typeof LayerMenu> = {
    at: { x: 40, y: 60 },
    element: { kind: 'drawing', id: 'dw-1', name: 'Trampa', layerId: LAYER_OBJECTS.id },
    layers: LAYERS_ALL,
    ...cb,
    ...over,
  };
  renderWithProviders(<LayerMenu {...base} />);
  return { cb, menu: () => screen.getByRole('menu', { name: 'Mandar a la capa' }) };
}

describe('<LayerMenu> mandar a otra capa', () => {
  it('sale donde se pinchó, con el nombre de lo que se pinchó', () => {
    const { menu } = mount();
    expect(menu()).toHaveStyle({ left: '40px', top: '60px' });
    expect(within(menu()).getByText('Trampa')).toBeInTheDocument();
  });

  /** Sin nombre propio se dice QUÉ es: un menú que no dice sobre qué actúa no sirve de nada. */
  it('sin nombre propio, enseña de qué se trata', () => {
    mount({ element: { kind: 'light', id: 'li-1', name: '', layerId: null } });
    expect(screen.getByText('Luz')).toBeInTheDocument();
  });

  /**
   * Sale la lista ENTERA, «Notas del director» incluida: mandar algo ahí es justamente cómo se esconde de la
   * mesa sin borrarlo.
   */
  it('ofrece todas las capas, notas del director incluida', () => {
    const { menu } = mount();
    expect(within(menu()).getByRole('menuitem', { name: /Notas del director/ })).toBeInTheDocument();
    expect(within(menu()).getAllByRole('menuitem')).toHaveLength(LAYERS_ALL.length);
  });

  it('marca la capa donde está ahora', () => {
    const { menu } = mount();
    expect(within(menu()).getByRole('menuitem', { name: /Objetos/ })).toHaveClass('on');
  });

  /** Si nunca se movió, la marcada es su capa NATURAL — no «ninguna». */
  it('sin capa propia, la marcada es la natural de su tipo', () => {
    mount({ element: { kind: 'drawing', id: 'dw-2', name: 'Flecha', layerId: null } });
    expect(screen.getByRole('menuitem', { name: /Objetos/ })).toHaveClass('on');
  });

  it('elegir una capa la manda ahí y cierra el menú', async () => {
    const { cb } = mount();
    await userEvent.setup().click(screen.getByRole('menuitem', { name: /Notas del director/ }));
    expect(cb.onPick).toHaveBeenCalledWith(LAYER_NOTES.id);
    expect(cb.onClose).toHaveBeenCalled();
  });
});

/**
 * 🗑 BORRAR DESDE EL MENÚ. Es un camino DESTRUCTIVO, y por eso se sujeta entero: que aparezca sólo cuando se
 * puede borrar, que llame a quien tiene que llamar, y que cierre el menú detrás.
 */
describe('<LayerMenu> borrar desde el menú', () => {
  it('sin `onRemove` no ofrece borrar: no todo lo que pasa por aquí se borra desde aquí', () => {
    const { menu } = mount();
    expect(within(menu()).queryByRole('menuitem', { name: /Borrar/ })).not.toBeInTheDocument();
  });

  it('con `onRemove`, la opción aparece y dice QUÉ borra', () => {
    mount({ element: { kind: 'light', id: 'li-1', name: 'Antorcha', layerId: null }, onRemove: vi.fn() });
    expect(screen.getByRole('menuitem', { name: 'Borrar la luz' })).toBeInTheDocument();
  });

  it('el trazo dice que borra el trazo, no la luz', () => {
    mount({ onRemove: vi.fn() });
    expect(screen.getByRole('menuitem', { name: 'Borrar el trazo' })).toBeInTheDocument();
  });

  it('pulsar borrar borra y cierra el menú', async () => {
    const onRemove = vi.fn();
    const { cb } = mount({ onRemove });
    await userEvent.setup().click(screen.getByRole('menuitem', { name: 'Borrar el trazo' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalled();
    // Y no se lleva por delante el otro camino: borrar no es mandar a una capa.
    expect(cb.onPick).not.toHaveBeenCalled();
  });

  /** Va en rojo sangre y separado del resto: borrar no puede parecerse a mandar algo a una capa. */
  it('se presenta como lo que es: destructivo y aparte', () => {
    mount({ onRemove: vi.fn() });
    expect(screen.getByRole('menuitem', { name: 'Borrar el trazo' })).toHaveClass('danger');
    expect(screen.getByRole('menu', { name: 'Mandar a la capa' }).querySelector('.mp-menu-sep')).not.toBeNull();
  });
});

/**
 * UNA PIEZA PLANTADA (rebanada 6, § 6.6). Suyo, 2026-09-11: «*cada uno al hacerle click derecho tienes que poder
 * mandarlo adelante y atrás como en cualquier programa … top layer, down layer etc*». El mismo menú, con el orden
 * de apilado, el estorbo con sus dos casillas, duplicar y borrar — y la lista de capas de siempre encima.
 */
describe('<LayerMenu> una pieza plantada', () => {
  const pieza = { kind: 'prop' as const, id: 'sp-1', name: 'Roble', layerId: null };

  it('sin las opciones de pieza no ofrece ni apilar ni estorbar: son de las piezas y de nada más', () => {
    mount({ element: pieza });
    expect(screen.queryByText('Orden de apilado')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();
    // y una pieza sin nombre propio dice que es una pieza
    expect(screen.getByText('Roble')).toBeInTheDocument();
  });

  it('las cuatro del orden de apilado, en el orden de la petición, y cada una cierra el menú', async () => {
    const u = userEvent.setup();
    const onStack = vi.fn();
    const { cb } = mount({ element: pieza, onStack });
    const items = ['Traer adelante', 'Enviar atrás', 'Traer al frente', 'Enviar al fondo'];
    // Por el nombre accesible y en orden: el icono es texto y va marcado como decorativo.
    const all = screen.getAllByRole('menuitem');
    expect(items.map(n => all.indexOf(screen.getByRole('menuitem', { name: n })))).toEqual([...items.keys()].map(i => all.length - 4 + i));
    await u.click(screen.getByRole('menuitem', { name: 'Traer al frente' }));
    expect(onStack).toHaveBeenCalledWith('front');
    expect(cb.onClose).toHaveBeenCalled();
  });

  it('el estorbo son dos casillas independientes que se marcan sin cerrar el menú', async () => {
    const u = userEvent.setup();
    const onToggle = vi.fn();
    const { cb } = mount({ element: pieza, blocks: { sight: true, move: false, onToggle } });
    expect(screen.getByRole('menuitemcheckbox', { name: /Corta la vista/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: /Corta el paso/ })).toHaveAttribute('aria-checked', 'false');
    await u.click(screen.getByRole('menuitemcheckbox', { name: /Corta el paso/ }));
    expect(onToggle).toHaveBeenCalledWith('move');
    expect(cb.onClose).not.toHaveBeenCalled();
  });

  it('duplicar y borrar la pieza, cada uno por su camino', async () => {
    const u = userEvent.setup();
    const onDuplicate = vi.fn(), onRemove = vi.fn();
    mount({ element: pieza, onDuplicate, onRemove });
    await u.click(screen.getByRole('menuitem', { name: 'Duplicar' }));
    expect(onDuplicate).toHaveBeenCalled();
    await u.click(screen.getByRole('menuitem', { name: 'Borrar la pieza' }));
    expect(onRemove).toHaveBeenCalled();
  });

  /** Visto en el navegador la noche del 13-09: con todo lo de una pieza, el menú se salía por abajo del mapa. */
  it('si no cabe por abajo o por la derecha, se pega al borde en vez de recortarse', () => {
    const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.getAttribute('role') === 'menu' ? 300 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.getAttribute('role') === 'menu' ? 190 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 400; } });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 500; } });
    try {
      const { menu } = mount({ element: pieza, at: { x: 450, y: 250 }, onStack: vi.fn() });
      // 250 + 300 no cabe en 400 → 400 − 300 − 4; 450 + 190 no cabe en 500 → 500 − 190 − 4.
      expect(menu()).toHaveStyle({ top: '96px', left: '306px' });
    } finally {
      for (const [k, d] of [['offsetHeight', h], ['offsetWidth', w], ['clientHeight', ch], ['clientWidth', cw]] as const) {
        if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
      }
    }
  });

  it('la pieza tiene su capa natural, Objetos, cuando no se movió de sitio', () => {
    mount({ element: pieza });
    expect(within(screen.getByRole('menuitem', { name: /Objetos/ })).getByText('check')).toBeInTheDocument();
  });
});

/** § 6.8 (2026-09-13), puntos 5 y 6: «Seleccionar» arriba del todo, y con varias cogidas manda sobre todas. */
describe('<LayerMenu> seleccionar y varias piezas', () => {
  it('con `onSelect`, «Seleccionar» va ARRIBA DEL TODO, coge la pieza y cierra; marcado cuando ya se está en Seleccionar', async () => {
    const u = userEvent.setup();
    const pick = vi.fn();
    const { cb, menu } = mount({ element: { kind: 'prop', id: 'sp-1', name: 'Roble', layerId: null }, onSelect: { on: false, pick } });
    const items = within(menu()).getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Seleccionar');
    expect(items[0]).not.toHaveClass('on');
    await u.click(items[0]!);
    expect(pick).toHaveBeenCalled();
    expect(cb.onClose).toHaveBeenCalled();
  });

  it('en Seleccionar ya, la opción sale marcada; sin `onSelect` no está', () => {
    const { menu } = mount({ element: { kind: 'prop', id: 'sp-1', name: 'Roble', layerId: null }, onSelect: { on: true, pick: vi.fn() } });
    expect(within(menu()).getAllByRole('menuitem')[0]).toHaveClass('on');
    cleanup();
    const { menu: sin } = mount({ element: { kind: 'prop', id: 'sp-1', name: 'Roble', layerId: null } });
    expect(within(sin()).queryByRole('menuitem', { name: /Seleccionar/ })).not.toBeInTheDocument();
  });

  it('con varias cogidas, la cabecera dice cuántas y que manda sobre todas', () => {
    const { menu } = mount({ element: { kind: 'prop', id: 'sp-1', name: 'Roble', layerId: null }, count: 3 });
    expect(within(menu()).getByText('3 piezas cogidas: manda sobre todas')).toBeInTheDocument();
    expect(within(menu()).queryByText('Roble')).not.toBeInTheDocument();
  });
});
