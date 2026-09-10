import { describe, it, expect, vi } from 'vitest';
import { cleanup, renderWithProviders, screen, fireEvent, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { BrushPanel, type BrushSettings } from './BrushPanel';
import type { MapColor } from '../domain/entities/Scene';

const BRUSH: BrushSettings = { tip: 'disc', size: 1.2, strength: 0.6, hardness: 0.4, roughness: 0.5 };
const MIOS: MapColor[] = [
  { id: 'mc-1', campaignId: 'c1', color: '#7a5c3e', createdAt: 't1' },
  { id: 'mc-2', campaignId: 'c1', color: '#3f5d4a', createdAt: 't2' },
];

/** Cada `mount` deja UN panel en pantalla: varios estados en el mismo test se miran de uno en uno. */
function mount(over: Partial<React.ComponentProps<typeof BrushPanel>> = {}) {
  cleanup();
  const cb = {
    onOn: vi.fn(), onPaint: vi.fn(), onPickTexture: vi.fn(), onClearTexture: vi.fn(),
    onColor: vi.fn(), onSaveColor: vi.fn(), onDirection: vi.fn(), onChange: vi.fn(), onCommit: vi.fn(),
    onClose: vi.fn(),
  };
  renderWithProviders(
    <BrushPanel on="floor" paint="texture" textureUrl={null} textureName={null} textureCells={4} gridSize={30}
      color="#b08d57" savedColors={MIOS} direction="erase" value={BRUSH} {...cb} {...over} />,
  );
  return cb;
}

/**
 * 🖌 EL PANEL DEL PINCEL (rebanada 10 · `rolvium.pen` `YwHzR` + `M9zw2t`, aprobados por él el 2026-09-10).
 *
 * Sustituye a la barra flotante de la rebanada 9, que él paró en pantalla: «*esto está mal, ajusta el diseño
 * como un modal que se mueva como todos los otros*».
 */
describe('<BrushPanel>', () => {
  /**
   * 🔒 LAS CINCO, Y EN EL ORDEN DEL DISEÑO. Las dos primeras levantan mapa; las tres siguientes pintan
   * encima de algo que ya está. La quinta —el suelo de UNA sala— sigue viva por su «*por ahora déjalo*».
   */
  it('deja elegir sobre qué se pinta: suelo, muro, capa, niebla y suelo de sala', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Suelo' })).toHaveAttribute('aria-checked', 'true');
    for (const [rotulo, valor] of [['Muro', 'wall'], ['Capa', 'layer'], ['Niebla', 'fog'], ['Suelo de sala', 'room']] as const) {
      await u.click(screen.getByRole('radio', { name: rotulo }));
      expect(cb.onOn).toHaveBeenCalledWith(valor);
    }
  });

  /** Construyendo se elige CON QUÉ; pintando encima, el SENTIDO. No son la misma pregunta. */
  it('construyendo ofrece textura, color y borrador; pintando encima, pintar y quitar', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Textura' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Borrar' }));
    expect(cb.onPaint).toHaveBeenCalledWith('erase');
    expect(screen.queryByRole('radio', { name: 'Quitar' })).not.toBeInTheDocument();

    mount({ on: 'layer' });
    expect(screen.getByRole('radio', { name: 'Quitar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: 'Textura' })).not.toBeInTheDocument();
  });

  /**
   * ⚠️ § 10.4 — LOS MANDOS QUE NO VALEN NO SE ENSEÑAN APAGADOS: NO SALEN. Un suelo se anda o no se anda, así
   * que construyendo no hay transparencia ni difuminado. Pintando encima siguen los tres de siempre.
   */
  it('construyendo no hay transparencia ni difuminado; pintando encima, sí', () => {
    mount();
    expect(screen.queryByRole('slider', { name: 'Transparencia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Borde' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Difuminado' })).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Tamaño' })).toBeInTheDocument();

    mount({ on: 'layer' });
    expect(screen.getByRole('slider', { name: 'Transparencia' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Difuminado' })).toBeInTheDocument();
  });

  /** El borrador se lleva el brochazo entero: ni el tamaño ni la forma cambian nada, así que no salen. */
  it('borrando no hay mandos de brochazo, y se dice por qué', () => {
    mount({ paint: 'erase' });
    expect(screen.queryByRole('slider', { name: 'Tamaño' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Disco' })).not.toBeInTheDocument();
    expect(screen.getByText(/se lleva ENTERO el brochazo/)).toBeInTheDocument();
  });

  /** «Cuánto de roto» sólo existe con el borde roto, y va aparte de la dureza a propósito. */
  it('«cuánto de roto» sólo aparece con el borde roto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.queryByRole('slider', { name: 'Cuánto de roto' })).not.toBeInTheDocument();
    // El rótulo es el MISMO que en la barra de la rebanada 9 («Borde roto»): es el mismo trazo, y darle un
    // segundo nombre en el panel nuevo sería tener dos palabras para una cosa.
    await u.click(screen.getByRole('radio', { name: 'Borde roto' }));
    expect(cb.onChange).toHaveBeenCalledWith({ tip: 'rough' });
    mount({ value: { ...BRUSH, tip: 'rough' } });
    expect(screen.getByRole('slider', { name: 'Cuánto de roto' })).toBeInTheDocument();
  });

  /** Mover es continuo y guardar es una vez, al soltar: sin esto cada paso sería una escritura en la base. */
  it('soltar el deslizador es lo que guarda; moverlo no', () => {
    const cb = mount();
    const slider = screen.getByRole('slider', { name: 'Tamaño' });
    fireEvent.change(slider, { target: { value: '35' } });
    expect(cb.onChange).toHaveBeenCalledWith({ size: 3.5 });
    expect(cb.onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(cb.onCommit).toHaveBeenCalled();
  });

  /** La textura sale del MISMO catálogo que la pared y el suelo: «Elegir», no «Subir». */
  it('la textura se elige del catálogo, y sólo se puede quitar cuando hay una', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Ninguna todavía: se pinta con el color')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Elegir' }));
    expect(cb.onPickTexture).toHaveBeenCalled();

    const cb2 = mount({ textureUrl: 'https://x/losa.png', textureName: 'Losa de piedra' });
    expect(screen.getByText('Losa de piedra')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(cb2.onClearTexture).toHaveBeenCalled();
  });

  /**
   * 🔒 SU CORRECCIÓN DEL 2026-09-10: «*aquí el color se tiene que guardar, no veo un cuadradito donde quede
   * puesto*». La paleta enseñaba las opciones y nada decía cuál era la tuya.
   */
  it('el color puesto se ve EN GRANDE, con su nombre y su hex', () => {
    mount({ paint: 'color' });
    expect(screen.getByTestId('mp-bp-color-big')).toHaveStyle({ background: '#b08d57' });
    expect(screen.getByText('Arena')).toBeInTheDocument();
    expect(screen.getByText('#b08d57')).toBeInTheDocument();
  });

  it('la paleta de la casa son doce, y elegir una la cambia', async () => {
    const u = userEvent.setup();
    const cb = mount({ paint: 'color' });
    const paleta = screen.getByRole('radiogroup', { name: 'El color · el que está puesto' });
    expect(within(paleta).getAllByRole('radio')).toHaveLength(12);
    await u.click(within(paleta).getByRole('radio', { name: 'Musgo' }));
    expect(cb.onColor).toHaveBeenCalledWith('#5f8f6a');
  });

  /** Los que él se inventa se guardan POR CAMPAÑA, y salen en su propia fila. */
  it('«tus colores» enseña los de la campaña y deja elegirlos', async () => {
    const u = userEvent.setup();
    const cb = mount({ paint: 'color' });
    const mios = screen.getByRole('radiogroup', { name: 'Tus colores · de esta campaña' });
    expect(within(mios).getAllByRole('radio')).toHaveLength(2);
    await u.click(within(mios).getByRole('radio', { name: 'Color #7a5c3e' }));
    expect(cb.onColor).toHaveBeenCalledWith('#7a5c3e');
  });

  /**
   * Guardar sólo tiene sentido con un color INVENTADO: uno de la casa ya está en la paleta y guardarlo lo
   * pondría dos veces en pantalla; uno ya guardado, lo mismo.
   */
  it('el «+» guarda un color inventado, y no se ofrece con uno que ya está', async () => {
    const u = userEvent.setup();
    const cb = mount({ paint: 'color', color: '#123456' });
    await u.click(screen.getByRole('button', { name: 'Guardar este color en la campaña' }));
    expect(cb.onSaveColor).toHaveBeenCalledWith('#123456');

    mount({ paint: 'color', color: '#b08d57' });          // uno de la casa
    expect(screen.getByRole('button', { name: 'Guardar este color en la campaña' })).toBeDisabled();
    mount({ paint: 'color', color: '#7a5c3e' });          // ya guardado
    expect(screen.getByRole('button', { name: 'Guardar este color en la campaña' })).toBeDisabled();
  });

  /**
   * El campo de hex avisa al escribir un color VÁLIDO y no antes: la base no comprueba el formato —igual que
   * en el fondo del mapa— así que el filtro tiene que estar aquí.
   */
  it('el hex a mano sólo cambia el color cuando está completo', () => {
    const cb = mount({ paint: 'color' });
    const campo = screen.getByRole('textbox', { name: 'Color en hexadecimal' });
    fireEvent.change(campo, { target: { value: '#12' } });
    expect(cb.onColor).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '#123456' } });
    expect(cb.onColor).toHaveBeenCalledWith('#123456');
  });

  /** Mientras se cargan no es lo mismo «no hay ninguno» que «todavía no han llegado». */
  it('dice que los colores están cargando cuando aún no han llegado', () => {
    mount({ paint: 'color', savedColors: null });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  /** En la niebla, el mismo hueco lleva los DOS botones de siempre: quitárselos sería perder función. */
  it('en la niebla salen revelar y ocultar todo; en una capa, restaurar', async () => {
    const u = userEvent.setup();
    const onRevealAll = vi.fn(), onHideAll = vi.fn();
    mount({ on: 'fog', onRevealAll, onHideAll });
    await u.click(screen.getByRole('button', { name: 'Revelar todo' }));
    await u.click(screen.getByRole('button', { name: 'Ocultar todo' }));
    expect(onRevealAll).toHaveBeenCalled();
    expect(onHideAll).toHaveBeenCalled();

    const onReset = vi.fn();
    mount({ on: 'layer', onReset });
    await u.click(screen.getByRole('button', { name: 'Restaurar toda' }));
    expect(onReset).toHaveBeenCalled();
  });

  /** Es un panel de los que se mueven, no una franja: tiene su asa y su X, como Builder y la luz. */
  it('se cierra por la X y avisa mientras guarda', async () => {
    const u = userEvent.setup();
    const cb = mount({ saving: true });
    expect(screen.getByText('guardando…')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cerrar el pincel' }));
    expect(cb.onClose).toHaveBeenCalled();
  });

  /** El pie dice lo único que hay que saber antes de arrastrar, y cambia con lo que se esté haciendo. */
  it('el pie avisa de que lo pintado levanta mapa', () => {
    mount();
    expect(screen.getByText(/levanta mapa/)).toBeInTheDocument();
    mount({ on: 'room' });
    expect(screen.getByText(/se recorta solo en su borde/)).toBeInTheDocument();
  });
});
