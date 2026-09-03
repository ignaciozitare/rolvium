import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
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
