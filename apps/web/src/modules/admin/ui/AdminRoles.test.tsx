import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../../../tests/helpers/render';
import { fakeAdminDeps } from '../../../../tests/helpers/fakes';
import { AdminRoles } from './AdminRoles';

describe('AdminRoles', () => {
  it('lists roles and marks system ones', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    expect(await screen.findByTestId('role-admin')).toBeInTheDocument();
    expect(screen.getByTestId('role-player')).toHaveTextContent('sistema');
  });

  it('creates a role with a slugified name', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    await screen.findByTestId('role-admin');
    await userEvent.type(screen.getByLabelText('Nombre del nuevo rol'), 'Máster Invitado{Enter}');
    await waitFor(() => expect(deps.roleRepo.create).toHaveBeenCalledWith({ name: 'master_invitado', description: 'Máster Invitado' }));
    expect(await screen.findByTestId('role-master_invitado')).toBeInTheDocument();
  });

  it('toggling a permission persists the merged JSON; admin role is locked', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    await userEvent.click(await screen.findByTestId('role-game_master'));
    // DualPanelPicker renders available items as buttons/rows; click the "Gestionar usuarios" item
    await userEvent.click(await screen.findByText('Gestionar usuarios'));
    await waitFor(() => expect(deps.roleRepo.updatePermissions).toHaveBeenCalledWith('r-gm', { modules: [], admin: { manage_users: true } }));

    await userEvent.click(screen.getByTestId('role-admin'));
    expect(await screen.findByText(/no se puede modificar/)).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción del rol')).toBeDisabled();
  });
});
