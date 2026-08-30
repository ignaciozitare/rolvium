import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LIGHT_BULB, LIGHT_TORCH } from '../../../../tests/helpers/fakes';
import { LightEditor } from './LightEditor';

function mount(light = LIGHT_TORCH) {
  const cb = { onChange: vi.fn(), onRemove: vi.fn() };
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
  it('deja poner el alcance en metros y la sombra aunque todavía no iluminen', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Alcance y sombra · se guardan ya')).toBeInTheDocument();
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
  it('dice en pantalla que hoy la luz es pintura', () => {
    mount();
    expect(screen.getByText(/no revela niebla ni cambia lo que ve nadie/)).toBeInTheDocument();
  });

  it('se puede borrar', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('button', { name: 'Borrar la luz' }));
    expect(cb.onRemove).toHaveBeenCalled();
  });
});
