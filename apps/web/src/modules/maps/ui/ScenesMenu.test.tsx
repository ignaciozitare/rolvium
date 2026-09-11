import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { SCENE_CHAPEL, SCENE_TUNNELS, SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { ScenesMenu } from './ScenesMenu';

function mount(over: Partial<React.ComponentProps<typeof ScenesMenu>> = {}) {
  const cb = { onSelect: vi.fn(), onCreate: vi.fn().mockResolvedValue(undefined), onRename: vi.fn().mockResolvedValue(undefined), onActivate: vi.fn().mockResolvedValue(undefined), onToggleVisible: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined), onToggleCollapsed: vi.fn() };
  renderWithProviders(<ScenesMenu scenes={[SCENE_WAREHOUSE, SCENE_CHAPEL, SCENE_TUNNELS]} selectedId="sc-1" activeSceneId="sc-2" collapsed={false} {...cb} {...over} />);
  return cb;
}

describe('<ScenesMenu> — los iconos dicen qué hacen', () => {
  it('plegar el rail lleva tooltip, y sale a la derecha porque el rail vive pegado al borde izquierdo', () => {
    mount();
    const tip = [...document.querySelectorAll('.rv-tip')].find(x => x.textContent === 'Plegar escenas');
    expect(tip).toBeDefined();
    expect(tip?.getAttribute('data-placement')).toBe('right');
  });
});

describe('<ScenesMenu>', () => {
  it('chips with miniature; the active one is marked; clicking another chip selects it; «+ Escena» prompts a name and creates', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ver escena Capilla sin techo' })).toContainElement(screen.getByLabelText('Activa'));
    await u.click(screen.getByRole('button', { name: 'Ver escena Túneles de servicio' }));
    expect(cb.onSelect).toHaveBeenCalledWith('sc-3');
    await u.click(screen.getByRole('button', { name: '+ Escena' }));
    await u.type(await screen.findByRole('textbox'), 'Mercado');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(cb.onCreate).toHaveBeenCalledWith('Mercado'));
  });
  it('clicking the selected chip opens the menu: activate · visible toggle · rename · delete (confirmed)', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    const menu = screen.getByRole('menu', { name: 'Opciones de la escena' });
    await u.click(screen.getByRole('menuitem', { name: 'Activar para los jugadores' }));
    expect(cb.onActivate).toHaveBeenCalledWith('sc-1');
    expect(menu).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Visible para jugadores' })).toHaveAttribute('aria-checked', 'false');
    await u.click(screen.getByRole('menuitemcheckbox', { name: 'Visible para jugadores' }));
    expect(cb.onToggleVisible).toHaveBeenCalledWith('sc-1', true);
    await u.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    const input = await screen.findByRole('textbox');
    expect(input).toHaveValue('Almacén de Queens');
    await u.clear(input); await u.type(input, 'Almacén');
    await u.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(cb.onRename).toHaveBeenCalledWith('sc-1', 'Almacén'));
    await u.click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    await u.click(screen.getByRole('menuitem', { name: 'Eliminar escena' }));
    expect(await screen.findByText('¿Eliminar «Almacén de Queens» con sus tokens, muros y trazos?')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(cb.onRemove).toHaveBeenCalledWith('sc-1'));
  });
  it('the active scene cannot be re-activated from its menu', async () => {
    const u = userEvent.setup();
    mount({ selectedId: 'sc-2' });
    await u.click(screen.getByRole('button', { name: 'Ver escena Capilla sin techo' }));
    expect(screen.getByRole('menuitem', { name: 'Activar para los jugadores' })).toBeDisabled();
  });
});

describe('<ScenesMenu> plegado', () => {
  it('plegado deja sólo las miniaturas, con el nombre en tooltip, y sigue pudiendo cambiar de escena', async () => {
    const cb = mount({ collapsed: true });
    // la fila ya no pinta el nombre; sólo lo lleva el tooltip y el nombre accesible del botón
    expect(document.querySelector('.mp-rail-name')).toBeNull();
    expect([...document.querySelectorAll('.rv-tip')].map(t => t.textContent)).toContain('Túneles de servicio');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver escena Túneles de servicio' }));
    expect(cb.onSelect).toHaveBeenCalledWith('sc-3');
  });

  it('plegado NO abre el menú de opciones al pulsar la escena ya seleccionada: la vuelve a seleccionar y nada más', async () => {
    const cb = mount({ collapsed: true });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver escena Almacén de Queens' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(cb.onSelect).toHaveBeenCalledWith('sc-1');
  });

  it('el botón de plegar dice si está abierto y avisa al pulsarlo', async () => {
    const cb = mount();
    const fold = screen.getByRole('button', { name: 'Plegar escenas' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    await userEvent.setup().click(fold);
    expect(cb.onToggleCollapsed).toHaveBeenCalled();
  });
});

/**
 * ── LOS TRES PUNTOS DE CADA ESCENA, Y EL MENÚ POR ENCIMA ──
 * Suyo, 2026-09-09: «*quiero que los 3 puntitos para modificar las escenas se vean y que el modal quede por
 * encima, que no se tape*». Y el 11, sin ellos todavía: «*te pedí ya varias sesiones atrás que tenga el icono y
 * que el desplegable quede por arriba no que se corte*».
 */
describe('<ScenesMenu> los tres puntos', () => {
  const rect = (top: number, height: number, left = 150): DOMRect =>
    ({ top, bottom: top + height, left, right: left + 18, width: 18, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  it('cada escena lleva los suyos, y abren el menú de ESA escena sin cambiar la que se mira', async () => {
    const u = userEvent.setup();
    const cb = mount();
    for (const n of ['Almacén de Queens', 'Capilla sin techo', 'Túneles de servicio'])
      expect(screen.getByRole('button', { name: `Opciones de «${n}»` })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Túneles de servicio»' }));
    expect(screen.getByRole('menu', { name: 'Opciones de la escena' })).toBeInTheDocument();
    expect(cb.onSelect).not.toHaveBeenCalled();
    await u.click(screen.getByRole('menuitem', { name: 'Activar para los jugadores' }));
    expect(cb.onActivate).toHaveBeenCalledWith('sc-3');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  /** 🔒 El pin del recorte: fijo a la ventana y pegado a sus tres puntos, así la lista no lo puede cortar. */
  it('el menú flota fijo a la ventana, justo debajo de sus tres puntos', async () => {
    const u = userEvent.setup();
    mount();
    const kebab = screen.getByRole('button', { name: 'Opciones de «Capilla sin techo»' });
    vi.spyOn(kebab, 'getBoundingClientRect').mockReturnValue(rect(100, 18));
    await u.click(kebab);
    const menu = screen.getByRole('menu', { name: 'Opciones de la escena' });
    expect(menu).toHaveClass('mp-pop', 'mp-scene-menu');
    expect(menu.style.top).toBe('122px');
    expect(menu.style.left).toBe('150px');
    vi.restoreAllMocks();
  });

  it('si no cabe debajo, se abre hacia arriba', async () => {
    const u = userEvent.setup();
    const alto = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('mp-rail-kebab')) return rect(260, 18);
      if (this.getAttribute('role') === 'menu') return rect(0, 130);
      return rect(0, 0);
    });
    mount();
    await u.click(screen.getByRole('button', { name: 'Opciones de «Túneles de servicio»' }));
    expect(screen.getByRole('menu', { name: 'Opciones de la escena' }).style.top).toBe('126px'); // 260 − 4 − 130
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', { value: alto, configurable: true });
  });

  it('se cierra con Escape, pinchando fuera, y con los mismos tres puntos', async () => {
    const u = userEvent.setup();
    mount();
    const kebab = screen.getByRole('button', { name: 'Opciones de «Capilla sin techo»' });
    await u.click(kebab);
    expect(kebab).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await u.click(kebab);
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await u.click(kebab);
    await u.click(kebab);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  /** La elegida va en rojo sangre (en la vista del director no hay negros) y sus tres puntos, en claro. Plegado no hay ninguno. */
  it('la elegida lleva los tres puntos en claro; plegado no sale ninguno', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Opciones de «Almacén de Queens»' })).toHaveClass('on');
    expect(screen.getByRole('button', { name: 'Opciones de «Capilla sin techo»' })).not.toHaveClass('on');
    cleanup();
    mount({ collapsed: true });
    expect(screen.queryByRole('button', { name: /^Opciones de «/ })).not.toBeInTheDocument();
  });

  /** Va fijo a la ventana: al desplazar, al cambiar la ventana o al plegar el rail se quedaría lejos de su escena, sin ancla. */
  it('se cierra al desplazar, al cambiar la ventana y al plegar el rail, y al desplegar no vuelve solo', async () => {
    const u = userEvent.setup();
    const props = { scenes: [SCENE_WAREHOUSE, SCENE_CHAPEL, SCENE_TUNNELS], selectedId: 'sc-1', activeSceneId: 'sc-2', collapsed: false, onSelect: vi.fn(), onCreate: vi.fn().mockResolvedValue(undefined), onRename: vi.fn().mockResolvedValue(undefined), onActivate: vi.fn().mockResolvedValue(undefined), onToggleVisible: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined), onToggleCollapsed: vi.fn() };
    const { rerender } = renderWithProviders(<ScenesMenu {...props} />);
    const kebab = (): HTMLElement => screen.getByRole('button', { name: 'Opciones de «Capilla sin techo»' });
    await u.click(kebab());
    fireEvent.scroll(document.querySelector('.mp-rail-list')!);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await u.click(kebab());
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await u.click(kebab());
    expect(screen.getByRole('menu', { name: 'Opciones de la escena' })).toBeInTheDocument();
    rerender(<ScenesMenu {...props} collapsed />);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    rerender(<ScenesMenu {...props} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(kebab()).toHaveAttribute('aria-expanded', 'false');
  });
});
