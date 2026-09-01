import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { IMAGE_CHAPEL, IMAGE_MARKET, LAYER_MOSS, SCENE_CHAPEL, SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { BG_COLORS } from '../domain/useCases/mapRules';
import { BackgroundPopover } from './BackgroundPopover';

function mount(over: Partial<React.ComponentProps<typeof BackgroundPopover>> = {}) {
  const cb = { onColor: vi.fn(), onImage: vi.fn(), onTransform: vi.fn(), onUpload: vi.fn().mockResolvedValue(undefined), onClose: vi.fn() };
  const r = renderWithProviders(<BackgroundPopover scene={SCENE_WAREHOUSE} images={[IMAGE_CHAPEL, IMAGE_MARKET]} {...cb} {...over} />);
  return { ...r, cb };
}

describe('<BackgroundPopover> — los iconos dicen qué hacen', () => {
  it('la aspa de cerrar lleva tooltip', () => {
    mount();
    expect([...document.querySelectorAll('.rv-tip')].map(x => x.textContent)).toContain('Cerrar');
  });
});

describe('<BackgroundPopover>', () => {
  it('base colour: swatch click and a valid hex change the scene colour; invalid hex is ignored', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('radio', { name: BG_COLORS[3] }));
    expect(cb.onColor).toHaveBeenCalledWith(BG_COLORS[3]);
    const hex = screen.getByRole('textbox', { name: 'Color hex' });
    await u.clear(hex); await u.type(hex, '#12ab');
    expect(cb.onColor).toHaveBeenCalledTimes(1);
    await u.type(hex, 'ef');
    expect(cb.onColor).toHaveBeenLastCalledWith('#12abef');
    expect(screen.getByText('se ve donde no llega la imagen')).toBeInTheDocument();
  });
  it('library: pick an image, «Ninguna», upload a file (registers + selects), error state; fit modes; custom shows scale/offset', async () => {
    const u = userEvent.setup();
    const { cb, rerender } = mount();
    await u.click(screen.getByRole('button', { name: 'Capilla' }));
    expect(cb.onImage).toHaveBeenCalledWith(IMAGE_CHAPEL.url);
    await u.click(screen.getByRole('button', { name: 'Ninguna' }));
    expect(cb.onImage).toHaveBeenLastCalledWith(null);
    const file = new File(['x'], 'plano.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('mp-bg-file'), { target: { files: [file] } });
    await waitFor(() => expect(cb.onUpload).toHaveBeenCalledWith(file));
    await u.click(screen.getByRole('button', { name: 'Encajar' }));
    expect(cb.onTransform).toHaveBeenCalledWith({ mode: 'contain', x: 0, y: 0, scale: 1 });
    expect(screen.queryByLabelText('Escala')).not.toBeInTheDocument();
    rerender(<BackgroundPopover scene={{ ...SCENE_CHAPEL, bgTransform: { mode: 'custom', x: 5, y: 6, scale: 1.5 } }} images={[IMAGE_CHAPEL]} {...cb} />);
    expect(screen.getByRole('button', { name: 'Capilla' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Escala'), { target: { value: '2' } });
    expect(cb.onTransform).toHaveBeenLastCalledWith({ mode: 'custom', x: 5, y: 6, scale: 2 });
    fireEvent.change(screen.getByLabelText('Desplazamiento X'), { target: { value: '40' } });
    expect(cb.onTransform).toHaveBeenLastCalledWith({ mode: 'custom', x: 40, y: 6, scale: 1.5 });
    const failing = vi.fn().mockRejectedValue(new Error('too big'));
    rerender(<BackgroundPopover scene={SCENE_WAREHOUSE} images={[]} {...cb} onUpload={failing} />);
    expect(screen.getByText('Sube el primer plano de la campaña.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('mp-bg-file'), { target: { files: [file] } });
    expect(await screen.findByText('No se pudo subir la imagen.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(cb.onClose).toHaveBeenCalled();
  });
});

/**
 * Rebanada 7: el mismo popover sirve para la foto de una CAPA DE TERRENO. Sin esto, «+ Capa de terreno»
 * dejaba una capa vacía y no había manera de darle imagen — se veía como si el botón no hiciera nada.
 */
describe('<BackgroundPopover> sobre una capa de terreno', () => {
  it('se titula con la capa y esconde el color de base, que es de la escena', () => {
    mount({ layer: LAYER_MOSS });
    expect(screen.getByRole('dialog', { name: 'Foto de la capa «Musgo»' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Color hex' })).not.toBeInTheDocument();
    expect(screen.queryByText('Color de base')).not.toBeInTheDocument();
  });

  it('marca la foto de la CAPA, no la de la escena', () => {
    // La escena tiene la de la capilla; la capa, la del musgo.
    mount({ scene: SCENE_CHAPEL, layer: { ...LAYER_MOSS, imageUrl: IMAGE_MARKET.url } });
    expect(screen.getByRole('button', { name: IMAGE_MARKET.name })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: IMAGE_CHAPEL.name })).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una foto y el encaje salen por los mismos avisos', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ layer: LAYER_MOSS });
    await u.click(screen.getByRole('button', { name: IMAGE_CHAPEL.name }));
    expect(cb.onImage).toHaveBeenCalledWith(IMAGE_CHAPEL.url);
    await u.click(screen.getByRole('button', { name: 'Encajar' }));
    expect(cb.onTransform).toHaveBeenCalledWith(expect.objectContaining({ mode: 'contain' }));
  });

  it('sin capa sigue siendo el fondo de la escena de siempre', () => {
    mount();
    expect(screen.getByRole('dialog', { name: 'Fondo del mapa' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Color hex' })).toBeInTheDocument();
  });
});
