import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../../../tests/helpers/render';
import { fakeAdminDeps, ADMIN_USER } from '../../../../tests/helpers/fakes';
import { AdminUsers } from './AdminUsers';

describe('AdminUsers', () => {
  it('renders users with role selector and status', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminUsers {...deps} currentUserId={ADMIN_USER.id} />);
    expect(await screen.findByText('Pip')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
  });

  it('changes a role through the port', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminUsers {...deps} currentUserId={ADMIN_USER.id} />);
    const sel = await screen.findByLabelText('Rol Pip');
    await userEvent.selectOptions(sel, 'r-gm');
    await waitFor(() => expect(deps.userRepo.updateRole).toHaveBeenCalledWith('u-pip', 'r-gm'));
  });

  it('blocks a user (not yourself)', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminUsers {...deps} currentUserId={ADMIN_USER.id} />);
    await screen.findByText('Pip');
    expect(screen.getAllByRole('button', { name: 'Bloquear' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    await waitFor(() => expect(deps.userRepo.updateActive).toHaveBeenCalledWith('u-pip', false));
  });

  it('creates a user through the API port with validation', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminUsers {...deps} currentUserId={ADMIN_USER.id} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir usuario' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Nuevo');
    await userEvent.type(screen.getByLabelText('Email'), 'nuevo@rolvium.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'supersecret1');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await waitFor(() => expect(deps.userAdmin.createUser).toHaveBeenCalledWith({ name: 'Nuevo', email: 'nuevo@rolvium.test', password: 'supersecret1', roleId: 'r-player' }));
    expect(await screen.findByText('Nuevo')).toBeInTheDocument();
  });
});
