import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LAYER_MOSS, SCENE_CHAPEL, SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { BackgroundPopover } from './BackgroundPopover';

function mount(over: Partial<React.ComponentProps<typeof BackgroundPopover>> = {}) {
  const cb = {
    onColor: vi.fn(), onSaveColor: vi.fn(), onOpenCatalog: vi.fn(), onRemoveImage: vi.fn(),
    onTransform: vi.fn(), onClose: vi.fn(),
  };
  const r = renderWithProviders(
    <BackgroundPopover scene={SCENE_WAREHOUSE} currentName={null} savedColors={[]} {...cb} {...over} />,
  );
  return { ...r, cb };
}

describe('<BackgroundPopover> — los iconos dicen qué hacen', () => {
  it('la aspa de cerrar lleva tooltip', () => {
    mount();
    expect([...document.querySelectorAll('.rv-tip')].map(x => x.textContent)).toContain('Cerrar');
  });
});

/**
 * EL COLOR ES EL BLOQUE DEL PINCEL (suyo, 2026-09-14: «*el color picker tiene que ajustarse como hicimos en
 * otros menús*»). Antes había aquí un selector con su hex apagado MÁS una fila de hex hecha a mano al lado.
 */
describe('<BackgroundPopover> · el color de base', () => {
  it('usa las muestras del Pincel y avisa al elegir; y el hex suelto de antes ya no está', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    const muestras = screen.getAllByRole('radio');
    expect(muestras.length).toBeGreaterThan(1);
    await u.click(muestras[1]!);
    expect(cb.onColor).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9a-fA-F]{6}$/));
    // La fila de hex hecha a mano se fue con el bloque viejo.
    expect(screen.queryByRole('textbox', { name: 'Color hex' })).not.toBeInTheDocument();
  });

  it('un color que no es de la casa se puede GUARDAR, y eso es lo que no hacía el de antes', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ scene: { ...SCENE_WAREHOUSE, bgColor: '#123456' } });
    await u.click(screen.getByRole('button', { name: 'Guardar este color en la campaña' }));
    expect(cb.onSaveColor).toHaveBeenCalledWith('#123456');
  });
});

/**
 * LA FOTO NO SE ELIGE AQUÍ: la muestra y CAMBIAR abren el catálogo a pantalla completa, igual que las texturas
 * del Constructor. Antes había una rejilla plana sin categorías y una subida de un fichero cada vez.
 */
describe('<BackgroundPopover> · la imagen', () => {
  it('enseña el nombre de lo puesto; la muestra y CAMBIAR abren el catálogo; QUITAR la quita', async () => {
    const u = userEvent.setup();
    const { cb } = mount({ scene: SCENE_CHAPEL, currentName: 'Capilla' });
    expect(screen.getByText('Capilla')).toBeInTheDocument();
    await u.click(screen.getByTestId('mp-bg-swatch'));
    await u.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(cb.onOpenCatalog).toHaveBeenCalledTimes(2);
    await u.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(cb.onRemoveImage).toHaveBeenCalled();
  });

  it('sin foto dice «Ninguna», no ofrece QUITAR, y la subida de un fichero cada vez ya no existe', () => {
    mount({ scene: { ...SCENE_WAREHOUSE, bgImageUrl: null }, currentName: null });
    expect(screen.getByText('Ninguna')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mp-bg-file')).not.toBeInTheDocument();
  });
});

describe('<BackgroundPopover> · el ajuste', () => {
  it('cambia el encaje, y con Reposicionar salen la escala y el desplazamiento', async () => {
    const u = userEvent.setup();
    const { cb, rerender } = mount();
    await u.click(screen.getByRole('button', { name: 'Encajar' }));
    expect(cb.onTransform).toHaveBeenCalledWith({ mode: 'contain', x: 0, y: 0, scale: 1 });
    expect(screen.queryByLabelText('Escala')).not.toBeInTheDocument();
    rerender(
      <BackgroundPopover scene={{ ...SCENE_CHAPEL, bgTransform: { mode: 'custom', x: 5, y: 6, scale: 1.5 } }}
        currentName="Capilla" savedColors={[]} {...cb} />,
    );
    fireEvent.change(screen.getByLabelText('Escala'), { target: { value: '2' } });
    expect(cb.onTransform).toHaveBeenLastCalledWith({ mode: 'custom', x: 5, y: 6, scale: 2 });
    fireEvent.change(screen.getByLabelText('Desplazamiento X'), { target: { value: '40' } });
    expect(cb.onTransform).toHaveBeenLastCalledWith({ mode: 'custom', x: 40, y: 6, scale: 1.5 });
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
    expect(screen.queryByText('Color de base')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('sobre una capa, la fila habla de la foto de LA CAPA, no de la de la escena', async () => {
    const u = userEvent.setup();
    // La escena tiene la de la capilla; la capa, ninguna.
    const { cb } = mount({ scene: SCENE_CHAPEL, layer: { ...LAYER_MOSS, imageUrl: null }, currentName: null });
    expect(screen.getByText('Ninguna')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(cb.onOpenCatalog).toHaveBeenCalled();
  });

  it('sin capa sigue siendo el fondo de la escena de siempre', () => {
    mount();
    expect(screen.getByRole('dialog', { name: 'Fondo del mapa' })).toBeInTheDocument();
    expect(screen.getByText('Color de base')).toBeInTheDocument();
  });
});
