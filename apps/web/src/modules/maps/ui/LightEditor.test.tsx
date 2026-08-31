import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LIGHT_BULB, LIGHT_TORCH } from '../../../../tests/helpers/fakes';
import { LightEditor } from './LightEditor';

// jsdom no trae PointerEvent: un MouseEvent con pointerId basta para los gestos, como en MapCanvas.test.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

function mount(light = LIGHT_TORCH) {
  const cb = { onChange: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
  renderWithProviders(<LightEditor light={light} {...cb} />);
  return cb;
}

describe('<LightEditor>', () => {
  it('marca la forma y el tipo de la luz que se está tocando', () => {
    mount();
    expect(screen.getByRole('radio', { name: 'Radio' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cono' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Antorcha' })).toHaveAttribute('aria-checked', 'true');
  });

  it('cambiar forma y tipo sale por el mismo sitio', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('radio', { name: 'Cuadrado' }));
    expect(cb.onChange).toHaveBeenCalledWith({ shape: 'square' });
    await u.click(screen.getByRole('radio', { name: 'Hoguera' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ kind: 'fire' });
  });

  /** La apertura sólo tiene sentido en un cono; en radio y cuadrado no se enseña para no prometer nada. */
  it('la apertura del cono sólo aparece con la forma cono, y se ajusta', () => {
    mount();
    expect(screen.queryByRole('slider', { name: 'Apertura del cono en grados' })).not.toBeInTheDocument();
    document.body.innerHTML = '';
    const cb = mount({ ...LIGHT_TORCH, shape: 'cone' });
    const slider = screen.getByRole('slider', { name: 'Apertura del cono en grados' });
    expect(slider).toHaveValue('60');
    expect(screen.getByText('60°')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '120' } });
    expect(cb.onChange).toHaveBeenCalledWith({ coneAngle: 120 });
  });

  it('el color sale de la paleta y se marca el puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Color 1' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Color 5' }));
    expect(cb.onChange).toHaveBeenCalledWith({ color: '#a97fe0' });
  });

  /**
   * Lo que el dueño pidió al aprobar el diseño: que parpadeen de verdad. Que se anima no se ve en un
   * interruptor, así que se dice con todas las letras junto a él.
   */
  it('avisa de que el parpadeo SE ANIMA, y sólo cuando está puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Se anima')).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: 'Parpadea' }));
    expect(cb.onChange).toHaveBeenCalledWith({ flicker: false });
    document.body.innerHTML = '';
    mount(LIGHT_BULB);
    expect(screen.queryByText('Se anima')).not.toBeInTheDocument();
  });

  /**
   * Alcance y sombra no se usan todavía. Salen igual —y rotulados «se guardan ya»— porque añadirlos el día
   * que las luces iluminen obligaría a repasar a mano todas las luces ya colocadas de todas las escenas.
   */
  it('deja poner el alcance en metros y encender la sombra, que es lo que la recorta contra los muros', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Alcance y sombra')).toBeInTheDocument();
    expect(screen.getByText('6 m')).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: 'Proyecta sombra' }));
    expect(cb.onChange).toHaveBeenCalledWith({ castsShadow: true });
  });

  it('el alcance se redondea a medio metro y no se sale de madre', async () => {
    const u = userEvent.setup();
    const cb = mount();
    const box = screen.getByRole('spinbutton', { name: 'Alcance en metros' });
    await u.clear(box);
    await u.type(box, '9999');
    expect(cb.onChange).toHaveBeenLastCalledWith({ rangeM: 60 });
  });

  /** Que hoy la luz no ilumine tiene que estar EN PANTALLA, no sólo en el código. */
  it('dice en pantalla cómo se sale del panel y qué hace la luz', () => {
    mount();
    expect(screen.getByText(/la X lo cierra sin borrar la luz/)).toBeInTheDocument();
  });

  it('se puede borrar', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('button', { name: 'Borrar la luz' }));
    expect(cb.onRemove).toHaveBeenCalled();
  });
});


/**
 * Regresión, dueño 2026-08-31: «no puedo mover el modal de luces ni cerrarlo». Con la herramienta de luces un
 * clic fuera COLOCA otra luz, y cambiar de herramienta tampoco lo quitaba: el panel se quedaba tapando el
 * mapa hasta borrar la luz. Ahora tiene X, Escape y se arrastra por la cabecera.
 */
describe('<LightEditor> · salir y apartarlo', () => {
  it('la X cierra sin borrar la luz — son dos botones distintos y no se confunden', async () => {
    const cb = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el editor' }));
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onRemove).not.toHaveBeenCalled();
  });

  it('Escape también cierra: es la salida que se busca a ciegas', () => {
    const cb = mount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onRemove).not.toHaveBeenCalled();
  });

  it('se arrastra por la cabecera y el panel se corre con el ratón', () => {
    mount();
    const panel = screen.getByRole('group', { name: /Luz/ });
    const head = panel.querySelector('.mp-light-head') as HTMLElement;
    expect(panel).toHaveStyle({ transform: 'translate(0px, 0px)' });
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(panel).toHaveStyle({ transform: 'translate(60px, 30px)' });
    // Al soltar se queda donde lo dejaste: mover no es un gesto que se deshaga solo.
    fireEvent.pointerUp(head, { pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 400, clientY: 400, pointerId: 1 });
    expect(panel).toHaveStyle({ transform: 'translate(60px, 30px)' });
  });

  it('pulsar borrar o cerrar NO empieza un arrastre: los botones mandan sobre el asa', () => {
    mount();
    const panel = screen.getByRole('group', { name: /Luz/ });
    const head = panel.querySelector('.mp-light-head') as HTMLElement;
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Borrar la luz' }), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 300, clientY: 300, pointerId: 1 });
    expect(panel).toHaveStyle({ transform: 'translate(0px, 0px)' });
  });
});
