import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
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
