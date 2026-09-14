import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LAYERS_ALL, PROP_COLUMN, PROP_OAK, PROP_PINE, SCENE_PROP_OAK } from '../../../../tests/helpers/fakes';
import { DEFAULT_SOW, PropsPanel } from './PropsPanel';

/**
 * EL PANEL DE PIEZA (`rolvium.pen` · `lWBaU`, aprobado el 2026-09-11): las cinco secciones de la lámina y el pie.
 * Sin la barra alargada «Sello activo» (`NAAEV`), que él tumbó: «*está todo dentro del panel, no la pongas*».
 */
function mount(over: Partial<React.ComponentProps<typeof PropsPanel>> = {}) {
  const cb = {
    onToggleFavorite: vi.fn(), onPick: vi.fn(), onDrop: vi.fn(), onScale: vi.fn(), onScaleEnd: vi.fn(), onRotation: vi.fn(),
    onRandomRotation: vi.fn(), onQuick: vi.fn(), onQuickPick: vi.fn(), onLayer: vi.fn(), onMode: vi.fn(), onSow: vi.fn(), onFamilyPick: vi.fn(), onClose: vi.fn(),
  };
  const props: React.ComponentProps<typeof PropsPanel> = {
    stamp: PROP_OAK, isFavorite: false, scale: 1.5, rotation: 15, quick: 'recent', quickProps: [PROP_OAK, PROP_COLUMN],
    layers: LAYERS_ALL, layerId: null, mode: 'one', sow: DEFAULT_SOW, ...cb, ...over,
  };
  const r = renderWithProviders(<PropsPanel {...props} />);
  return { ...r, cb, panel: () => screen.getByRole('group', { name: 'Objetos' }) };
}

describe('<PropsPanel> la pieza del sello (S/1)', () => {
  it('es un panel flotante de los comunes, con el sello, su nombre, ELEGIR en sangre y SOLTAR', () => {
    const { panel } = mount();
    expect(panel()).toHaveClass('rv-fpanel', 'mp-propspanel');
    expect(within(panel()).getByText('Roble')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir' })).toHaveClass('tb-btn-blood');
    expect(screen.getByRole('button', { name: 'Soltar' })).not.toBeDisabled();
    expect(screen.getByTestId('mp-props-sample').querySelector('img')).toHaveAttribute('src', PROP_OAK.imageUrl);
  });

  it('sin sello lo dice, y SOLTAR se apaga', () => {
    mount({ stamp: null });
    expect(screen.getByText(/Sin objeto elegido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soltar' })).toBeDisabled();
    expect(screen.queryByRole('slider', { name: 'Escala' })).not.toBeInTheDocument();
  });

  it('ELEGIR abre el catálogo, SOLTAR suelta, la estrella marca favorita', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Elegir' }));
    expect(cb.onPick).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Soltar' }));
    expect(cb.onDrop).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Favorito' }));
    expect(cb.onToggleFavorite).toHaveBeenCalled();
    document.body.innerHTML = '';
    mount({ isFavorite: true });
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  });

  /** § 6.4: mover va en vivo; soltar es lo que se guarda en la pieza («se recuerda»). */
  it('la ESCALA se lee en ×, avisa en vivo y guarda al soltar; la nota dice que se recuerda', () => {
    const { cb } = mount();
    const barra = screen.getByRole('slider', { name: 'Escala' });
    expect(barra).toHaveValue('150');
    expect(screen.getByText('1,5 ×')).toBeInTheDocument();
    fireEvent.change(barra, { target: { value: '200' } });
    expect(cb.onScale).toHaveBeenCalledWith(2);
    fireEvent.pointerUp(barra);
    expect(cb.onScaleEnd).toHaveBeenCalled();
    expect(screen.getByText(/se recuerda: el próximo roble sale ya a este tamaño/)).toBeInTheDocument();
  });

  it('el GIRO va debajo, con su dado', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    const giro = screen.getByRole('slider', { name: 'Giro' });
    expect(giro).toHaveValue('15');
    fireEvent.change(giro, { target: { value: '90' } });
    expect(cb.onRotation).toHaveBeenCalledWith(90);
    await u.click(screen.getByRole('button', { name: 'Un giro al azar' }));
    expect(cb.onRandomRotation).toHaveBeenCalled();
  });
});

describe('<PropsPanel> sin abrir el catálogo (S/2), la capa (S/3) y cuántas (S/4, S/5)', () => {
  it('RECIENTES / FAVORITOS en botones, la rejilla con la del sello marcada, y pinchar una la hace el sello', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    expect(screen.getByRole('radio', { name: /Recientes/ })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: /Favoritos/ }));
    expect(cb.onQuick).toHaveBeenCalledWith('favorites');
    const celdas = within(screen.getByTestId('mp-props-grid')).getAllByRole('listitem');
    expect(celdas).toHaveLength(2);
    expect(celdas[0]).toHaveAttribute('aria-pressed', 'true');   // el roble es el sello
    await u.click(screen.getByRole('listitem', { name: 'Elegir Columna' }));
    expect(cb.onQuickPick).toHaveBeenCalledWith(PROP_COLUMN);
  });

  it('sin nada que enseñar lo dice, según el estante', () => {
    mount({ quickProps: [] });
    expect(screen.getByText('Todavía no has plantado ninguno.')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount({ quickProps: [], quick: 'favorites' });
    expect(screen.getByText(/Marca uno con la estrella/)).toBeInTheDocument();
  });

  it('a qué capa va: un desplegable con las capas, Objetos de serie, y elegir Objetos vuelve a «natural»', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    const sel = screen.getByRole('combobox', { name: 'A qué capa va' });
    expect(sel).toHaveValue('ly-obj');
    await u.selectOptions(sel, 'ly-dm');
    expect(cb.onLayer).toHaveBeenCalledWith('ly-dm');
    await u.selectOptions(sel, 'ly-obj');
    expect(cb.onLayer).toHaveBeenLastCalledWith(null);
  });

  it('UNA / MUCHAS: con UNA no salen los mandos de sembrar; con MUCHAS salen área, densidad y los dos al azar', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    expect(screen.queryByTestId('mp-props-sow')).not.toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: /Muchos/ }));
    expect(cb.onMode).toHaveBeenCalledWith('many');
    document.body.innerHTML = '';
    const { cb: cb2 } = mount({ mode: 'many' });
    const sow = screen.getByTestId('mp-props-sow');
    expect(within(sow).getByRole('slider', { name: 'Área' })).toHaveValue('6');   // 3 casillas, en medias
    expect(within(sow).getByText('3 casillas')).toBeInTheDocument();
    fireEvent.change(within(sow).getByRole('slider', { name: 'Densidad' }), { target: { value: '2' } });
    expect(cb2.onSow).toHaveBeenCalledWith({ density: 'high' });
    const giro = within(sow).getByRole('switch', { name: /Giro al azar/ });
    expect(giro).toHaveAttribute('aria-checked', 'true');
    expect(giro).toHaveClass('rv-option', 'on');
    await u.click(giro);
    expect(cb2.onSow).toHaveBeenCalledWith({ randomRotation: false });
    await u.click(within(sow).getByRole('switch', { name: /Tamaño al azar/ }));
    expect(cb2.onSow).toHaveBeenCalledWith({ randomScale: true });
  });

  it('el pie dice lo único que hay que saber, y la X cierra', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    expect(screen.getByText(/uno: cada clic planta otro · muchos: arrastras y siembra · Esc suelta el objeto/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cerrar Objetos' }));
    expect(cb.onClose).toHaveBeenCalled();
  });
});

/** § 6.8 (2026-09-13), puntos 7 y 8: la pieza COGIDA manda en el primer bloque, y la foto grande es un botón. */
describe('<PropsPanel> la pieza cogida y la foto como botón', () => {
  it('la foto grande abre el catálogo, igual que ELEGIR', async () => {
    const u = userEvent.setup();
    const { cb } = mount();
    await u.click(screen.getByRole('button', { name: 'Abrir el catálogo de objetos' }));
    expect(cb.onPick).toHaveBeenCalledTimes(1);
  });

  it('con una cogida, el bloque dice LA PIEZA COGIDA, enseña su foto con marco y su nombre, y ESCALA/GIRO son los suyos', () => {
    const onPickedScale = vi.fn(), onPickedScaleEnd = vi.fn(), onPickedRotation = vi.fn(), onPickedRotationEnd = vi.fn(), onPickedToggleFavorite = vi.fn();
    const { panel, cb } = mount({ picked: { prop: SCENE_PROP_OAK, scale: 2, rotation: 45, isFavorite: false }, onPickedScale, onPickedScaleEnd, onPickedRotation, onPickedRotationEnd, onPickedToggleFavorite });
    expect(within(panel()).getByText('El objeto cogido')).toBeInTheDocument();
    expect(within(panel()).queryByText('El objeto elegido')).not.toBeInTheDocument();
    expect(screen.getByTestId('mp-props-sample')).toHaveClass('picked');
    expect(within(panel()).getByTestId('mp-props-picked')).toHaveTextContent('Roble');
    const escala = within(panel()).getByRole('slider', { name: 'Escala' });
    expect(escala).toHaveValue('200');
    expect(within(panel()).getByText('2 ×')).toBeInTheDocument();
    fireEvent.change(escala, { target: { value: '250' } });
    expect(onPickedScale).toHaveBeenCalledWith(2.5);
    expect(cb.onScale).not.toHaveBeenCalled();   // el sello no se toca
    fireEvent.pointerUp(escala);
    expect(onPickedScaleEnd).toHaveBeenCalled();
    expect(within(panel()).getByText(/escala y giro cambian ESTE objeto/)).toBeInTheDocument();
    const giro = within(panel()).getByRole('slider', { name: 'Giro' });
    expect(giro).toHaveValue('45');
    fireEvent.change(giro, { target: { value: '90' } });
    expect(onPickedRotation).toHaveBeenCalledWith(90);
    fireEvent.pointerUp(giro);
    expect(onPickedRotationEnd).toHaveBeenCalled();
    // El pie cambia: dice cómo se suelta.
    expect(within(panel()).getByText(/Esc o clic en el vacío suelta el objeto/)).toBeInTheDocument();
  });

  it('el dado gira la cogida al azar y guarda; la estrella marca su pieza de biblioteca, y no sale si ya no está en la biblioteca', async () => {
    const u = userEvent.setup();
    const onPickedRotation = vi.fn(), onPickedRotationEnd = vi.fn(), onPickedToggleFavorite = vi.fn();
    const { rerender, panel } = mount({ picked: { prop: SCENE_PROP_OAK, scale: 1, rotation: 0, isFavorite: true }, onPickedRotation, onPickedRotationEnd, onPickedToggleFavorite });
    await u.click(within(panel()).getByRole('button', { name: 'Un giro al azar' }));
    expect(onPickedRotation).toHaveBeenCalled();
    expect(onPickedRotationEnd).toHaveBeenCalled();
    await u.click(within(panel()).getByRole('button', { name: 'Quitar de favoritos' }));
    expect(onPickedToggleFavorite).toHaveBeenCalled();
    rerender(<PropsPanel {...({ stamp: PROP_OAK, isFavorite: false, scale: 1.5, rotation: 15, quick: 'recent', quickProps: [], layers: LAYERS_ALL, layerId: null, mode: 'one', sow: DEFAULT_SOW, onToggleFavorite: vi.fn(), onPick: vi.fn(), onDrop: vi.fn(), onScale: vi.fn(), onScaleEnd: vi.fn(), onRotation: vi.fn(), onRandomRotation: vi.fn(), onQuick: vi.fn(), onQuickPick: vi.fn(), onLayer: vi.fn(), onMode: vi.fn(), onSow: vi.fn(), onClose: vi.fn(), picked: { prop: { ...SCENE_PROP_OAK, propId: null }, scale: 1, rotation: 0, isFavorite: null } } as React.ComponentProps<typeof PropsPanel>)} />);
    expect(within(panel()).queryByRole('button', { name: /favorit/i })).not.toBeInTheDocument();
  });
});

/** § 6.8, punto 9: DE SU FAMILIA — debajo de la pieza cogida, las de su mismo paquete. */
describe('<PropsPanel> DE SU FAMILIA (S/1b)', () => {
  it('sin pieza cogida, o sin compañía en su paquete, el bloque no sale', () => {
    const { panel } = mount();   // sin `picked`
    expect(within(panel()).queryByTestId('mp-props-family')).not.toBeInTheDocument();
    document.body.innerHTML = '';
    const { panel: panel2 } = mount({ picked: { prop: SCENE_PROP_OAK, scale: 1, rotation: 0, isFavorite: false }, family: [] });
    expect(within(panel2()).queryByTestId('mp-props-family')).not.toBeInTheDocument();
  });

  it('con una cogida y su paquete, enseña el rótulo con el nombre, la rejilla de a tres, la suya marcada, y pinchar otra la hace el sello sin tocar la plantada', async () => {
    const u = userEvent.setup();
    const { panel, cb } = mount({
      picked: { prop: SCENE_PROP_OAK, scale: 1.5, rotation: 0, isFavorite: false },
      family: [PROP_OAK, PROP_PINE], familyPackName: 'Bosque de Karen',
    });
    expect(within(panel()).getByText('De su familia · Bosque de Karen')).toBeInTheDocument();
    const grid = within(panel()).getByTestId('mp-props-family-grid');
    const celdas = within(grid).getAllByRole('listitem');
    expect(celdas).toHaveLength(2);
    expect(within(grid).getByRole('listitem', { name: 'Elegir Roble' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grid).getByRole('listitem', { name: 'Elegir Roble' })).toHaveClass('on');
    expect(within(grid).getByRole('listitem', { name: 'Elegir Pino' })).toHaveAttribute('aria-pressed', 'false');
    await u.click(within(grid).getByRole('listitem', { name: 'Elegir Pino' }));
    expect(cb.onFamilyPick).toHaveBeenCalledWith(PROP_PINE);
    expect(within(panel()).getByTestId('mp-props-picked')).toHaveTextContent('Roble');   // la plantada cogida no cambia
  });
});
