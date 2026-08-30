import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LAYERS_ALL, LAYER_FLOOR, LAYER_MOSS, LAYER_NOTES, LAYER_OBJECTS, LAYER_PUDDLES } from '../../../../tests/helpers/fakes';
import { LayersPanel } from './LayersPanel';

function mount(over: Partial<React.ComponentProps<typeof LayersPanel>> = {}) {
  const cb = { onActivate: vi.fn(), onToggleVisible: vi.fn(), onToggleLocked: vi.fn(), onReorder: vi.fn(), onAddTerrain: vi.fn(), onRemove: vi.fn(), onCollapse: vi.fn() };
  renderWithProviders(<LayersPanel layers={LAYERS_ALL} activeId="ly-moss" {...cb} {...over} />);
  return cb;
}

const rowNames = (): string[] => screen.getAllByRole('listitem').map(li => li.getAttribute('data-layer-kind') ?? '');

describe('<LayersPanel>', () => {
  it('se lee de arriba abajo al revés que el pintado: notas, criaturas, objetos y luego el terreno', () => {
    mount();
    expect(rowNames()).toEqual(['dm_notes', 'creatures', 'objects', 'terrain', 'terrain', 'terrain']);
    // El terreno, dentro de su franja, va del de más arriba al de más abajo.
    const terrain = screen.getAllByRole('listitem').filter(li => li.dataset.layerKind === 'terrain');
    expect(terrain.map(li => li.dataset.layerId)).toEqual(['ly-pud', 'ly-moss', 'ly-floor']);
  });

  it('rotula las tres fijas por su tipo y el terreno por su nombre', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Trabajar en la capa Notas del director' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trabajar en la capa Criaturas y personajes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' })).toBeInTheDocument();
  });

  /**
   * «Notas del director» no es una capa apagada: es un TIPO, porque un interruptor se pulsa por error. La
   * etiqueta lo dice en la propia fila para que nadie tenga que acordarse.
   */
  it('marca las notas del director como privadas, y sólo a ellas', () => {
    mount();
    const tags = screen.getAllByText('Privada · no viaja');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.closest('li')).toHaveAttribute('data-layer-kind', 'dm_notes');
  });

  it('la capa activa se marca, y pinchar otra la cambia', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('button', { name: 'Trabajar en la capa Musgo' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Trabajar en la capa Suelo' }));
    expect(cb.onActivate).toHaveBeenCalledWith(LAYER_FLOOR);
  });

  /** El ojo es el de Photoshop: apagar quita la capa para TODOS, el director incluido. Lo dice el rótulo. */
  it('el ojo avisa de que deja de pintarse para todos', async () => {
    const u = userEvent.setup();
    const cb = mount();
    const eye = screen.getByRole('button', { name: 'Ocultar la capa Musgo (deja de pintarse para todos)' });
    expect(eye).toHaveAttribute('aria-pressed', 'true');
    await u.click(eye);
    expect(cb.onToggleVisible).toHaveBeenCalledWith(LAYER_MOSS);
    // Y una ya apagada ofrece encenderla.
    expect(screen.getByRole('button', { name: 'Mostrar la capa Charcos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('el candado se marca y se suelta', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('button', { name: 'Desbloquear la capa Suelo' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Bloquear la capa Musgo' }));
    expect(cb.onToggleLocked).toHaveBeenCalledWith(LAYER_MOSS);
  });

  it('marca qué capas llevan máscara del pincel', () => {
    mount();
    const marks = screen.getAllByRole('img', { name: 'Lleva máscara del pincel de transparencia' });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.closest('li')).toHaveAttribute('data-layer-id', 'ly-moss');
  });

  describe('subir, bajar y borrar', () => {
    it('sólo salen con una capa de TERRENO activa: las otras tres son fijas', () => {
      mount({ activeId: LAYER_NOTES.id });
      expect(screen.queryByRole('button', { name: 'Subir la capa' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Borrar la capa' })).not.toBeInTheDocument();
    });

    it('mueven la capa activa en la dirección pedida', async () => {
      const u = userEvent.setup();
      const cb = mount();
      await u.click(screen.getByRole('button', { name: 'Subir la capa' }));
      expect(cb.onReorder).toHaveBeenCalledWith(LAYER_MOSS, 'up');
      await u.click(screen.getByRole('button', { name: 'Bajar la capa' }));
      expect(cb.onReorder).toHaveBeenLastCalledWith(LAYER_MOSS, 'down');
    });

    it('se apagan en los extremos, para no prometer un movimiento que no pasa', () => {
      mount({ activeId: LAYER_FLOOR.id });
      expect(screen.getByRole('button', { name: 'Bajar la capa' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Subir la capa' })).toBeEnabled();
    });

    it('borrar avisa de lo que se lleva por delante', async () => {
      const u = userEvent.setup();
      const cb = mount({ activeId: LAYER_PUDDLES.id });
      expect(screen.getByRole('button', { name: 'Subir la capa' })).toBeDisabled();
      await u.click(screen.getByRole('button', { name: 'Borrar la capa' }));
      expect(cb.onRemove).toHaveBeenCalledWith(LAYER_PUDDLES);
    });
  });

  it('añade capas de terreno', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('button', { name: '+ Capa de terreno' }));
    expect(cb.onAddTerrain).toHaveBeenCalled();
  });

  /** «Sin límite» fue elección del dueño: la app AVISA cuando pesa, no impide nada. */
  it('avisa cuando hay mucho terreno, sin bloquear el botón de añadir', () => {
    mount();
    expect(screen.getByText('3 capas de terreno · la escena empieza a pesar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Capa de terreno' })).toBeEnabled();
  });

  it('con poco terreno no molesta con el aviso', () => {
    mount({ layers: [LAYER_OBJECTS, LAYER_FLOOR], activeId: null });
    expect(screen.queryByText(/empieza a pesar/)).not.toBeInTheDocument();
  });

  it('plegado deja sólo la cabecera', async () => {
    const u = userEvent.setup();
    const cb = mount({ collapsed: true });
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Desplegar capas' }));
    expect(cb.onCollapse).toHaveBeenCalled();
  });

  it('una escena sin capas lo dice en vez de quedarse en blanco', () => {
    mount({ layers: [], activeId: null });
    expect(screen.getByText('Esta escena aún no tiene capas.')).toBeInTheDocument();
  });
});
