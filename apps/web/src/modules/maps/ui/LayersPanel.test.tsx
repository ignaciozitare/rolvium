import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LAYERS_ALL, LAYER_FLOOR, LAYER_MOSS, LAYER_NOTES, LAYER_OBJECTS, LAYER_PUDDLES } from '../../../../tests/helpers/fakes';
import { LayersPanel } from './LayersPanel';

function mount(over: Partial<React.ComponentProps<typeof LayersPanel>> = {}) {
  const cb = { onActivate: vi.fn(), onToggleVisible: vi.fn(), onToggleLocked: vi.fn(), onReorder: vi.fn(), onReorderTo: vi.fn(), onAddTerrain: vi.fn(), onRemove: vi.fn(), onCollapse: vi.fn() };
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


/**
 * Dueño, 2026-08-31: «necesito poder arrastrar el orden de las capas». Sólo el TERRENO se ordena a mano: las
 * otras tres son fijas —una y sólo una por escena— y su sitio en la pila lo pone el motor. Los botones de
 * subir y bajar SIGUEN estando: son la vía precisa y la única que funciona sin ratón.
 */
describe('<LayersPanel> · arrastrar el orden', () => {
  const row = (id: string): HTMLElement => screen.getAllByRole('listitem').find(li => li.dataset.layerId === id)!;
  const drag = (fromId: string, toId: string): void => {
    const data = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => fromId };
    fireEvent.dragStart(row(fromId), { dataTransfer: data });
    fireEvent.dragOver(row(toId), { dataTransfer: data });
    fireEvent.drop(row(toId), { dataTransfer: data });
  };

  it('sólo el terreno se arrastra; las tres fijas no', () => {
    mount();
    for (const id of [LAYER_FLOOR.id, LAYER_MOSS.id, LAYER_PUDDLES.id]) expect(row(id)).toHaveAttribute('draggable', 'true');
    for (const id of [LAYER_OBJECTS.id, LAYER_NOTES.id]) expect(row(id)).toHaveAttribute('draggable', 'false');
  });

  it('soltar una capa sobre otra pide el cambio de orden', () => {
    const cb = mount();
    drag(LAYER_PUDDLES.id, LAYER_FLOOR.id);
    expect(cb.onReorderTo).toHaveBeenCalledWith(LAYER_PUDDLES.id, LAYER_FLOOR.id);
  });

  it('mientras arrastras se marca dónde va a caer, y al soltar la marca se va', () => {
    mount();
    const data = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_PUDDLES.id };
    fireEvent.dragStart(row(LAYER_PUDDLES.id), { dataTransfer: data });
    fireEvent.dragOver(row(LAYER_FLOOR.id), { dataTransfer: data });
    expect(row(LAYER_FLOOR.id)).toHaveClass('over');
    expect(row(LAYER_PUDDLES.id)).toHaveClass('dragging');
    fireEvent.drop(row(LAYER_FLOOR.id), { dataTransfer: data });
    expect(row(LAYER_FLOOR.id)).not.toHaveClass('over');
    expect(row(LAYER_PUDDLES.id)).not.toHaveClass('dragging');
  });

  it('soltarla sobre sí misma o sobre una capa fija no pide nada', () => {
    const cb = mount();
    drag(LAYER_MOSS.id, LAYER_MOSS.id);
    drag(LAYER_MOSS.id, LAYER_OBJECTS.id);
    expect(cb.onReorderTo).not.toHaveBeenCalled();
  });

  /**
   * PIN: LA APP NO SE CALLA. Petición literal del dueño — arrastrabas una capa sobre una fila fija, el
   * navegador la rebotaba (nunca dispara `drop` ahí) y no había forma de saber si era una avería o una regla.
   * El aviso vive sólo mientras dura el gesto: fuera de él sería ruido permanente en un panel estrecho.
   */
  it('mientras arrastras DICE por qué las filas fijas no la aceptan, y al soltar se calla', () => {
    mount();
    const data = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_PUDDLES.id };
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.dragStart(row(LAYER_PUDDLES.id), { dataTransfer: data });
    expect(screen.getByRole('status')).toHaveTextContent('Sólo se reordenan las capas de terreno');
    fireEvent.dragEnd(row(LAYER_PUDDLES.id), { dataTransfer: data });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /** Los dos motivos son distintos y el aviso no los mezcla: aquí no hay sitio, no es que la fila no valga. */
  it('con una sola capa de terreno dice que no hay dónde soltarla', () => {
    mount({ layers: [LAYER_NOTES, LAYER_OBJECTS, LAYER_FLOOR] });
    const data = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_FLOOR.id };
    fireEvent.dragStart(row(LAYER_FLOOR.id), { dataTransfer: data });
    expect(screen.getByRole('status')).toHaveTextContent('Hace falta más de una capa de terreno');
  });

  /**
   * El fallo INVERSO al que arregla el aviso: si otro director borra por realtime la capa que estás
   * arrastrando, su `dragend` llega a un nodo ya desprendido, React no lo enruta y el aviso se quedaría
   * clavado para siempre. Que la fila siga existiendo es parte de estar arrastrando.
   */
  it('si la capa arrastrada desaparece a media faena, el aviso se va solo', () => {
    const cb = { onActivate: vi.fn(), onToggleVisible: vi.fn(), onToggleLocked: vi.fn(), onReorder: vi.fn(), onReorderTo: vi.fn(), onAddTerrain: vi.fn(), onRemove: vi.fn(), onCollapse: vi.fn() };
    const { rerender } = renderWithProviders(<LayersPanel layers={LAYERS_ALL} activeId="ly-moss" {...cb} />);
    fireEvent.dragStart(row(LAYER_PUDDLES.id), { dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_PUDDLES.id } });
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<LayersPanel layers={LAYERS_ALL.filter(l => l.id !== LAYER_PUDDLES.id)} activeId="ly-moss" {...cb} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /** Dos cajas doradas iguales apiladas en un panel estrecho no ayudan: mientras arrastras manda el gesto. */
  it('el aviso de «la escena pesa» se calla mientras arrastras', () => {
    mount();
    expect(screen.getByText(/la escena empieza a pesar/)).toBeInTheDocument();
    fireEvent.dragStart(row(LAYER_PUDDLES.id), { dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_PUDDLES.id } });
    expect(screen.queryByText(/la escena empieza a pesar/)).not.toBeInTheDocument();
    fireEvent.dragEnd(row(LAYER_PUDDLES.id), { dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => LAYER_PUDDLES.id } });
    expect(screen.getByText(/la escena empieza a pesar/)).toBeInTheDocument();
  });

  it('y los botones de subir y bajar siguen ahí: arrastrar no es la única forma', () => {
    const cb = mount({ activeId: LAYER_MOSS.id });
    expect(screen.getByRole('button', { name: 'Subir la capa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar la capa' }));
    expect(cb.onReorder).toHaveBeenCalled();
  });
});
