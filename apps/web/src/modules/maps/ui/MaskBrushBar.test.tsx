import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { MaskBrushBar } from './MaskBrushBar';

function mount(over: Partial<React.ComponentProps<typeof MaskBrushBar>> = {}) {
  const cb = { onSize: vi.fn(), onStrength: vi.fn(), onHardness: vi.fn(), onDirection: vi.fn(), onReset: vi.fn() };
  renderWithProviders(<MaskBrushBar layerName="Musgo" size={1.2} strength={0.6} hardness={0.4} direction="erase" {...cb} {...over} />);
  return cb;
}

describe('<MaskBrushBar>', () => {
  it('dice en qué capa se está pintando: el pincel no vale para todas a la vez', () => {
    mount();
    expect(screen.getByText('Musgo')).toBeInTheDocument();
  });

  /** Dos sentidos, como Revelar/Ocultar en la niebla: es lo que hace verdad «se puede volver atrás». */
  it('ofrece borrar y devolver, y marca cuál está puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Borrar' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Devolver' }));
    expect(cb.onDirection).toHaveBeenCalledWith('restore');
  });

  it('la fuerza se enseña en porcentaje y se cambia con el deslizador', () => {
    const cb = mount();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Fuerza' }), { target: { value: '25' } });
    expect(cb.onStrength).toHaveBeenCalledWith(0.25);
  });

  /**
   * El dueño lo pidió así de claro: «tamaño de pincel lo quiero gradual, no me sirve eso» — «eso» eran los
   * cuatro discos. Este test fija que no vuelvan: si alguien los repone, aquí ya no hay deslizador.
   */
  it('el tamaño es un deslizador continuo, no cuatro discos', () => {
    const cb = mount();
    expect(screen.getByText('1.2 casillas')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Tamaño \d$/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Tamaño del pincel' }), { target: { value: '35' } });
    expect(cb.onSize).toHaveBeenCalledWith(3.5);
  });

  /** La dureza es el BORDE, y va aparte de la fuerza: son dos deslizadores distintos, no uno. */
  it('la dureza del borde es su propio mando, separado de la fuerza', () => {
    const cb = mount({ hardness: 0.4 });
    fireEvent.change(screen.getByRole('slider', { name: 'Dureza del borde' }), { target: { value: '90' } });
    expect(cb.onHardness).toHaveBeenCalledWith(0.9);
    expect(cb.onStrength).not.toHaveBeenCalled();
  });

  it('recuerda que la foto original no se toca', () => {
    mount();
    expect(screen.getByText(/la foto original nunca se toca/)).toBeInTheDocument();
  });

  it('avisa mientras guarda, y deja restaurar la capa entera', async () => {
    const u = userEvent.setup();
    const cb = mount({ saving: true });
    expect(screen.getByText('guardando…')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Restaurar toda' }));
    expect(cb.onReset).toHaveBeenCalled();
  });
});
