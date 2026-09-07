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

/**
 * 🔒 «PERMISOS DE ROLVIUM» ESCRIBE EN `tools`, Y EN NINGÚN OTRO SITIO.
 *
 * Aviso suyo del 2026-09-04: «*cuidado con el tema roles, que tenemos un motor de roles y permisos en la
 * herramienta, ojo con cagarla aquí*». Ésta es la pantalla donde se concede, y por tanto donde un descuido
 * futuro haría el daño: si `toggleTool` acabara escribiendo dentro de `admin`, `hasAnyAdminPermission`
 * pasaría a ser cierta para todos los directores y les saldría «Administración» en el menú — llevando a una
 * pantalla vacía, porque no tienen ninguna de las tres secciones. `permissions.test.ts` guarda el motor;
 * esto guarda la puerta por la que entra.
 */
describe('AdminRoles — los permisos de herramienta van a su propio cajón', () => {
  it('conceder «Gestionar texturas» escribe en `tools` y deja `admin` intacto', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    await userEvent.click(await screen.findByTestId('role-game_master'));
    await userEvent.click(await screen.findByText('Gestionar texturas'));
    await waitFor(() => expect(deps.roleRepo.updatePermissions).toHaveBeenCalledWith('r-gm', {
      modules: [], admin: {}, tools: { manage_textures: true },
    }));
    // El cepo: ni una sola clave de herramienta dentro de `admin`.
    const [, escrito] = (deps.roleRepo.updatePermissions as unknown as { mock: { calls: [string, { admin: Record<string, boolean> }][] } }).mock.calls.at(-1)!;
    expect(escrito.admin).toEqual({});
    expect(Object.keys(escrito.admin)).not.toContain('manage_textures');
  });

  it('y al revés: conceder uno de administración no toca el cajón de herramientas', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    await userEvent.click(await screen.findByTestId('role-game_master'));
    await userEvent.click(await screen.findByText('Gestionar usuarios'));
    await waitFor(() => expect(deps.roleRepo.updatePermissions).toHaveBeenCalled());
    const [, escrito] = (deps.roleRepo.updatePermissions as unknown as { mock: { calls: [string, { admin: Record<string, boolean>; tools?: Record<string, boolean> }][] } }).mock.calls.at(-1)!;
    expect(escrito.admin).toEqual({ manage_users: true });
    expect(escrito.tools ?? {}).toEqual({});
  });

  it('el rol admin sigue bloqueado también para los permisos de herramienta', async () => {
    const deps = fakeAdminDeps();
    renderWithProviders(<AdminRoles roleRepo={deps.roleRepo} />);
    await userEvent.click(await screen.findByTestId('role-admin'));
    await userEvent.click(await screen.findByText('Gestionar texturas'));
    // No se le escribe nada: lo tiene por `is_admin()`, y el trigger de la base lo prohibiría igual.
    expect(deps.roleRepo.updatePermissions).not.toHaveBeenCalled();
  });
});
