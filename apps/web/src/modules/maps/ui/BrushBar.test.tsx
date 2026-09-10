import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { BrushBar, type BrushSettings } from './BrushBar';

const BRUSH: BrushSettings = { tip: 'soft', size: 1.2, strength: 0.6, hardness: 0.4, roughness: 0.5 };

function mount(over: Partial<React.ComponentProps<typeof BrushBar>> = {}) {
  const cb = { onTarget: vi.fn(), onDirection: vi.fn(), onChange: vi.fn(), onCommit: vi.fn(), onReset: vi.fn() };
  renderWithProviders(<BrushBar target="layer" direction="erase" value={BRUSH} {...cb} {...over} />);
  return cb;
}

describe('<BrushBar>', () => {
  /**
   * UN SOLO MANDO PARA LOS TRES SITIOS, que es lo que él pidió («*para los dos, tengo que poder elegir el
   * trazo*») y lo que el suelo de una sala no tenía de ninguna manera.
   */
  it('deja elegir sobre qué se pinta: capa, niebla o suelo de sala', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Capa' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Suelo de sala' }));
    expect(cb.onTarget).toHaveBeenCalledWith('room');
    await u.click(screen.getByRole('radio', { name: 'Niebla' }));
    expect(cb.onTarget).toHaveBeenCalledWith('fog');
  });

  /** Dos sentidos, y las mismas dos palabras valen para los tres destinos. */
  it('ofrece pintar y quitar, y marca cuál está puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Quitar' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Pintar' }));
    expect(cb.onDirection).toHaveBeenCalledWith('restore');
  });

  it('ofrece los tres trazos y marca el puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Difuminado' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Borde roto' }));
    expect(cb.onChange).toHaveBeenCalledWith({ tip: 'rough' });
  });

  it('la transparencia se enseña en porcentaje y se cambia con el deslizador', () => {
    const cb = mount();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Transparencia' }), { target: { value: '25' } });
    expect(cb.onChange).toHaveBeenCalledWith({ strength: 0.25 });
  });

  /**
   * El dueño lo pidió así de claro: «tamaño de pincel lo quiero gradual, no me sirve eso» — «eso» eran los
   * cuatro discos. Este test fija que no vuelvan: si alguien los repone, aquí ya no hay deslizador.
   */
  it('el tamaño es un deslizador continuo, no cuatro discos', () => {
    const cb = mount();
    expect(screen.getByText('1.2 casillas')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Tamaño \d$/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Tamaño' }), { target: { value: '35' } });
    expect(cb.onChange).toHaveBeenCalledWith({ size: 3.5 });
  });

  /** En el uno exacto no se dice «1.0 casillas»: ni el decimal ni el plural pintan nada ahí. */
  it('en el uno exacto dice «1 casilla», en singular y sin decimal', () => {
    mount({ value: { ...BRUSH, size: 1 } });
    expect(screen.getByText('1 casilla')).toBeInTheDocument();
    expect(screen.queryByText('1.0 casillas')).not.toBeInTheDocument();
  });

  /** El borde es su propio mando y se lee en palabras: «40 %» de borde no significa nada para nadie. */
  it('el borde es su propio mando, separado de la transparencia, y se lee en palabras', () => {
    const cb = mount();
    expect(screen.getByText('medio')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Borde' }), { target: { value: '90' } });
    expect(cb.onChange).toHaveBeenCalledWith({ hardness: 0.9 });
  });

  /**
   * `rough` NO es «borde a cero»: la dureza difumina hacia fuera y siempre en círculo, roto cambia el
   * contorno. Por eso «cuánto de roto» sólo sale con el borde roto, y no antes.
   */
  it('«cuánto de roto» sólo aparece con el borde roto', () => {
    mount();
    expect(screen.queryByRole('slider', { name: 'Cuánto de roto' })).not.toBeInTheDocument();
    const cb = mount({ value: { ...BRUSH, tip: 'rough' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Cuánto de roto' }), { target: { value: '80' } });
    expect(cb.onChange).toHaveBeenCalledWith({ roughness: 0.8 });
    expect(screen.getByText('cada brochazo, distinto')).toBeInTheDocument();
  });

  /** Mover es continuo, guardar es una vez. Sin esto cada paso del deslizador escribiría en la base. */
  it('soltar el deslizador es lo que guarda; moverlo no', () => {
    const cb = mount();
    const slider = screen.getByRole('slider', { name: 'Transparencia' });
    fireEvent.change(slider, { target: { value: '25' } });
    expect(cb.onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(cb.onCommit).toHaveBeenCalled();
  });

  it('avisa mientras guarda, y deja restaurar lo pintado', async () => {
    const u = userEvent.setup();
    const cb = mount({ saving: true });
    expect(screen.getByText('guardando…')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Restaurar toda' }));
    expect(cb.onReset).toHaveBeenCalled();
  });

  /**
   * En la niebla no hay una máscara que restaurar: hay dos botones de siempre, revelar y ocultar todo. Se
   * quedan en el mismo sitio de la barra, que es lo que evita perder función al unificar los tres pinceles.
   */
  it('en la niebla, el mismo hueco lleva revelar y ocultar todo', async () => {
    const u = userEvent.setup();
    const onRevealAll = vi.fn(), onHideAll = vi.fn();
    mount({ target: 'fog', onReset: undefined, onRevealAll, onHideAll });
    expect(screen.queryByRole('button', { name: 'Restaurar toda' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Revelar todo' }));
    expect(onRevealAll).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Ocultar todo' }));
    expect(onHideAll).toHaveBeenCalled();
  });

  /** Las tres advertencias del diseño: el recorte de la sala, que el pincel es de la escena, y la niebla. */
  it('dice que el brochazo se recorta en la sala, que el pincel es de la escena y cómo se ve en la niebla', () => {
    mount();
    expect(screen.getByText(/se recorta solo en su borde/)).toBeInTheDocument();
    expect(screen.getByText(/se guarda en ESTA escena/)).toBeInTheDocument();
    expect(screen.getByText(/a trozos de casilla/)).toBeInTheDocument();
  });
});
