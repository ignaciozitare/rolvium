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
    onOn: vi.fn(), onAction: vi.fn(), onInk: vi.fn(), onPickTexture: vi.fn(), onClearTexture: vi.fn(),
    onColor: vi.fn(), onSaveColor: vi.fn(), onChange: vi.fn(), onCommit: vi.fn(), onClose: vi.fn(),
  };
  renderWithProviders(
    <BrushPanel on="room" action="paint" ink="color" textureUrl={null} textureName={null} textureCells={4} gridSize={30}
      color="#b08d57" savedColors={MIOS} value={BRUSH} {...cb} {...over} />,
  );
  return cb;
}

/**
 * 🖌 EL PANEL DEL PINCEL QUE PINTA ENCIMA (rebanada 10 · `rolvium.pen` `TlJot`, aprobado por él el 2026-09-10).
 *
 * 🔴 Reescrito ese mismo día después de verlo funcionando: la versión anterior EXCAVABA («*eso es cavar con
 * construir, que no es lo que te pedí*») y todo aquello se mudó al Builder. Lo que sujetan estos tests es que
 * este pincel hace lo único que tiene que hacer: **pintar encima, sin tocar el mapa**.
 */
describe('<BrushPanel>', () => {
  /** Los cuatro del diseño y EN SU ORDEN: habitación, muro, foto, niebla. */
  it('deja elegir sobre qué se pinta: habitación, muro, foto y niebla', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Habitación' })).toHaveAttribute('aria-checked', 'true');
    for (const [rotulo, valor] of [['Muro', 'rock'], ['Foto', 'layer'], ['Niebla', 'fog']] as const) {
      await u.click(screen.getByRole('radio', { name: rotulo }));
      expect(cb.onOn).toHaveBeenCalledWith(valor);
    }
  });

  /**
   * 🔑 LO ELEGIDO ES EL LÍMITE, y se dice en el panel: «*si elijo pintar una habitación el scope de ese pincel
   * es la habitación; si se me va la mano al muro, el muro no se tiene que pintar*» (2026-09-10).
   */
  it('avisa de que lo elegido es el límite del pincel', () => {
    mount();
    expect(screen.getByText(/si se te va la mano, lo de al lado no se mancha/i)).toBeInTheDocument();
  });

  /** Las tres cosas que se pueden hacer, con la de destapar a lo ancho como en la lámina. */
  it('ofrece pintar, borrar pintura y destapar lo de debajo', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Pintar' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Borrar pintura' }));
    expect(cb.onAction).toHaveBeenCalledWith('erase');
    await u.click(screen.getByRole('radio', { name: 'Destapar lo de debajo' }));
    expect(cb.onAction).toHaveBeenCalledWith('uncover');
  });

  /**
   * 🔒 LO QUE NO SE PUEDE HACER NO SALE, no sale apagado. Destapar la roca no significa nada —debajo no hay
   * mapa— y en la niebla ya lo hace borrar.
   */
  it('no ofrece destapar donde no hay nada debajo', () => {
    mount({ on: 'rock' });
    expect(screen.queryByRole('radio', { name: 'Destapar lo de debajo' })).not.toBeInTheDocument();
    mount({ on: 'fog' });
    expect(screen.queryByRole('radio', { name: 'Destapar lo de debajo' })).not.toBeInTheDocument();
    mount({ on: 'layer' });
    expect(screen.getByRole('radio', { name: 'Destapar lo de debajo' })).toBeInTheDocument();
  });

  /** Sólo pintando hay algo con qué pintar: borrando y destapando se quita, no se pone. */
  it('sólo ofrece «con qué pinto» mientras se pinta', () => {
    mount();
    expect(screen.getByRole('radio', { name: 'Color' })).toBeInTheDocument();
    mount({ action: 'erase' });
    expect(screen.queryByRole('radio', { name: 'Color' })).not.toBeInTheDocument();
    mount({ action: 'uncover' });
    expect(screen.queryByRole('radio', { name: 'Color' })).not.toBeInTheDocument();
  });

  /** La NIEBLA es sí o no: no se pinta con una textura ni con un color. */
  it('en la niebla no se elige ni textura ni color', () => {
    mount({ on: 'fog' });
    expect(screen.queryByRole('radio', { name: 'Textura' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mp-bp-color-big')).not.toBeInTheDocument();
  });

  /**
   * ⚠️ § 10A.7 — AQUÍ VALEN LOS CUATRO MANDOS, que es el vuelco exacto de la versión anterior: excavando la
   * mitad no significaban nada («*un suelo se anda o no se anda*»), pintando sí — una mancha de humedad tiene
   * transparencia y borde.
   */
  it('ofrece los cuatro mandos del brochazo, porque esto sí es pintura', () => {
    mount({ value: { ...BRUSH, tip: 'rough' } });
    expect(screen.getByRole('slider', { name: 'Tamaño' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Transparencia' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Borde' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Cuánto de roto' })).toBeInTheDocument();
  });

  /** «Cuánto de roto» sólo existe con el borde roto: con las otras puntas no cambia nada. */
  it('«cuánto de roto» sólo sale con el borde roto', () => {
    mount();
    expect(screen.queryByRole('slider', { name: 'Cuánto de roto' })).not.toBeInTheDocument();
  });

  /** Las tres puntas de la rebanada 9, todas útiles ahora: disco, difuminado y borde roto. */
  it('ofrece las tres puntas y cambiar de una avisa arriba', async () => {
    const u = userEvent.setup();
    const cb = mount();
    for (const n of ['Disco', 'Difuminado', 'Borde roto']) expect(screen.getByRole('radio', { name: n })).toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: 'Borde roto' }));
    expect(cb.onChange).toHaveBeenCalledWith({ tip: 'rough' });
  });

  /** Mover es continuo y guardar es una vez: la escena se escribe al SOLTAR, no en cada paso. */
  it('el deslizador avisa al moverse y guarda al soltarse', () => {
    const cb = mount();
    const s = screen.getByRole('slider', { name: 'Tamaño' });
    fireEvent.change(s, { target: { value: '30' } });
    expect(cb.onChange).toHaveBeenCalledWith({ size: 3 });
    expect(cb.onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(s);
    expect(cb.onCommit).toHaveBeenCalled();
  });

  /** La textura sale del MISMO catálogo que la pared y el suelo, y sólo se quita si hay una puesta. */
  it('la textura se elige del catálogo, y sólo se puede quitar cuando hay una', async () => {
    const u = userEvent.setup();
    const cb = mount({ ink: 'texture' });
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Elegir' }));
    expect(cb.onPickTexture).toHaveBeenCalled();

    const cb2 = mount({ ink: 'texture', textureUrl: 'https://x/losa.png', textureName: 'Losa' });
    expect(screen.getByText('Losa')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(cb2.onClearTexture).toHaveBeenCalled();
  });

  /** Su corrección del 2026-09-10: «*no veo un cuadradito donde quede puesto*». El color puesto, en grande. */
  it('el color puesto se ve EN GRANDE, con su nombre y su hex', () => {
    mount();
    expect(screen.getByTestId('mp-bp-color-big')).toHaveStyle({ background: '#b08d57' });
    expect(screen.getByText('Arena')).toBeInTheDocument();
    expect(screen.getByText('#b08d57')).toBeInTheDocument();
  });

  /** «Tus colores» son los de ESTA campaña, y el «+» sólo se ofrece con uno que no esté ya. */
  it('«tus colores» enseña los de la campaña y el «+» no repite lo que ya está', async () => {
    const u = userEvent.setup();
    const cb = mount({ color: '#123456' });
    const mios = screen.getByRole('radiogroup', { name: /Tus colores/ });
    expect(within(mios).getByRole('radio', { name: 'Color #7a5c3e' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Guardar este color/ }));
    expect(cb.onSaveColor).toHaveBeenCalledWith('#123456');

    mount({ color: MIOS[0]!.color });
    expect(screen.getByRole('button', { name: /Guardar este color/ })).toBeDisabled();
    mount({ color: '#b08d57' });
    expect(screen.getByRole('button', { name: /Guardar este color/ })).toBeDisabled();
  });

  /** El hex a mano no cambia el color a medio teclear: sólo cuando ya es un color de verdad. */
  it('el hex a mano sólo cambia el color cuando está completo', () => {
    const cb = mount();
    const campo = screen.getByRole('textbox', { name: 'Color en hexadecimal' });
    fireEvent.change(campo, { target: { value: '#12' } });
    expect(cb.onColor).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '#123456' } });
    expect(cb.onColor).toHaveBeenCalledWith('#123456');
  });

  /** Mientras la lista no ha llegado se dice, en vez de enseñar una paleta vacía que parece rota. */
  it('dice que los colores están cargando cuando aún no han llegado', () => {
    mount({ savedColors: null });
    expect(within(screen.getByRole('radiogroup', { name: /Tus colores/ })).getByText(/cargando/i)).toBeInTheDocument();
  });

  /**
   * 🔑 EL PIE DICE LA LÍNEA QUE SEPARA ESTE PINCEL DEL BUILDER. Es lo que se entendió al revés la primera vez,
   * así que está escrito en pantalla y sujeto por un test.
   */
  it('el pie avisa de que pintar NO cambia el mapa', () => {
    mount();
    expect(screen.getByText(/Pintar NO cambia el mapa/i)).toBeInTheDocument();
  });

  /** Guardando se dice, para que no parezca que el brochazo se ha perdido. */
  it('avisa mientras el PNG sube', () => {
    mount({ saving: true });
    expect(screen.getByText(/guardando/i)).toBeInTheDocument();
  });

  /** En la niebla siguen los dos botones de siempre; en lo demás, quitar del todo lo pintado. */
  it('ofrece revelar y ocultar todo en la niebla, y quitar del todo en lo demás', async () => {
    const u = userEvent.setup();
    const revealAll = vi.fn(), hideAll = vi.fn(), reset = vi.fn();
    mount({ on: 'fog', onRevealAll: revealAll, onHideAll: hideAll });
    await u.click(screen.getByRole('button', { name: 'Revelar todo' }));
    expect(revealAll).toHaveBeenCalled();

    mount({ onReset: reset });
    await u.click(screen.getByRole('button', { name: /Restaurar toda/ }));
    expect(reset).toHaveBeenCalled();
  });
});
