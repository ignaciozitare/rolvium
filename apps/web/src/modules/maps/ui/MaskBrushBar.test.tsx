import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { MaskBrushBar } from './MaskBrushBar';

function mount(over: Partial<React.ComponentProps<typeof MaskBrushBar>> = {}) {
  const cb = { onSize: vi.fn(), onStrength: vi.fn(), onDirection: vi.fn(), onReset: vi.fn() };
  renderWithProviders(<MaskBrushBar layerName="Musgo" size={3} strength={0.6} direction="erase" {...cb} {...over} />);
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

  it('el tamaño se elige entre los de siempre', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Tamaño 3' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Tamaño 1' }));
    expect(cb.onSize).toHaveBeenCalledWith(1);
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
