import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { WALL_1 } from '../../../../tests/helpers/fakes';
import { SegmentBar } from './SegmentBar';

/**
 * La barra «Segmento» es Builder. Corrección suya del 2026-09-02: «es el mismo Builder que pone hoy los
 * muros, puertas y ventanas, que se le suma todo esto» — así que muro · puerta · ventana no se mueven de
 * sitio, y las formas se AÑADEN al lado (§ «Rebanada 8»).
 */
function mount(over: Partial<React.ComponentProps<typeof SegmentBar>> = {}) {
  const cb = { onKind: vi.fn(), onShape: vi.fn() };
  renderWithProviders(<SegmentBar wall={null} kind="wall" shape="segment" {...cb} {...over} />);
  return cb;
}

describe('<SegmentBar>', () => {
  it('muro, puerta y ventana siguen donde estaban', () => {
    mount();
    for (const name of ['Muro', 'Puerta', 'Ventana']) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Muro' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ofrece las cinco formas y marca la puesta', () => {
    mount();
    const formas = screen.getByRole('radiogroup', { name: 'Con qué forma' });
    for (const name of ['Segmento', 'Rectángulo', 'Círculo', 'Polígono', 'A pulso']) {
      expect(within(formas).getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(within(formas).getByRole('radio', { name: 'Segmento' })).toHaveAttribute('aria-checked', 'true');
  });

  /**
   * 🧩 LA FILA DEL GRUPO (§ «EL GRUPO»). Con menos de dos muros cogidos no se enseña: un muro solo no es un
   * grupo y la fila estorbaría en el 99 % de los clics.
   */
  it('sin nada cogido, o con un muro solo, la fila del grupo no aparece', () => {
    mount();
    expect(screen.queryByText(/muros sueltos|Grupo ·/)).toBeNull();
    mount({ groupCount: 1 });
    expect(screen.queryByText(/muros sueltos|Grupo ·/)).toBeNull();
  });

  it('con varios muros sueltos cogidos ofrece AGRUPAR', async () => {
    const u = userEvent.setup();
    const cb = { onKind: vi.fn(), onShape: vi.fn(), onGroup: vi.fn(), onUngroup: vi.fn() };
    renderWithProviders(<SegmentBar wall={null} kind="wall" shape="segment" groupCount={3} grouped={false} {...cb} />);
    expect(screen.getByText('3 muros sueltos')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Agrupar' }));
    expect(cb.onGroup).toHaveBeenCalledTimes(1);
    expect(cb.onUngroup).not.toHaveBeenCalled();
  });

  it('con un grupo cogido dice cuántos muros son y ofrece SOLTAR', async () => {
    const u = userEvent.setup();
    const cb = { onKind: vi.fn(), onShape: vi.fn(), onGroup: vi.fn(), onUngroup: vi.fn() };
    renderWithProviders(<SegmentBar wall={null} kind="wall" shape="segment" groupCount={11} grouped {...cb} />);
    expect(screen.getByText('Grupo · 11 muros')).toBeInTheDocument();
    expect(screen.getByText('doble clic entra a un muro')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Soltar' }));
    expect(cb.onUngroup).toHaveBeenCalledTimes(1);
    expect(cb.onGroup).not.toHaveBeenCalled();
  });

  it('elegir una forma la avisa hacia arriba', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(within(screen.getByRole('radiogroup', { name: 'Con qué forma' })).getByRole('radio', { name: 'Polígono' }));
    expect(cb.onShape).toHaveBeenCalledWith('poly');
  });

  /** Con un segmento seleccionado se está editando ESE, no eligiendo el siguiente: las formas sobran. */
  it('con un segmento seleccionado no se eligen formas', () => {
    mount({ wall: WALL_1, onVisible: vi.fn(), onRemove: vi.fn() });
    expect(screen.queryByRole('radiogroup', { name: 'Con qué forma' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /visible/i })).toBeInTheDocument();
  });

  it('la pista de abajo cambia con la forma, que cada una se dibuja de una manera', () => {
    const { unmount } = renderWithProviders(<SegmentBar wall={null} kind="wall" shape="poly" onKind={vi.fn()} onShape={vi.fn()} />);
    expect(screen.getByText(/pincha otra vez sobre el primero/)).toBeInTheDocument();
    unmount();
    renderWithProviders(<SegmentBar wall={null} kind="wall" shape="rect" onKind={vi.fn()} onShape={vi.fn()} />);
    expect(screen.getByText(/arrastra para levantar la sala/)).toBeInTheDocument();
  });

  /** Sin formas (nadie se las pasa) la barra es exactamente la de siempre: no se rompe lo que ya existía. */
  it('sin formas se comporta como la barra de siempre', () => {
    renderWithProviders(<SegmentBar wall={null} kind="wall" onKind={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: 'Con qué forma' })).not.toBeInTheDocument();
    expect(screen.getByText(/dibuja una puerta o una ventana/)).toBeInTheDocument();
  });
});
