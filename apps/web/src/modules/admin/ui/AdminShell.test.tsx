import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAdminDeps, fakeAuthRepo, ADMIN_USER, PLAYER_USER } from '../../../../tests/helpers/fakes';
import type { AdminDeps } from '../container';
import { AdminShell } from './AdminShell';
import { Route, Routes } from 'react-router-dom';

const app = (user: typeof ADMIN_USER, deps: AdminDeps = fakeAdminDeps()) => (
  <AuthProvider repo={fakeAuthRepo(user)}>
    <Routes>
      <Route path="/admin" element={<AdminShell deps={deps} />} />
      <Route path="/home" element={<div>HOME</div>} />
    </Routes>
  </AuthProvider>
);

describe('AdminShell', () => {
  it('admin sees every section', async () => {
    renderWithProviders(app(ADMIN_USER), { providers: { routerProps: { initialEntries: ['/admin'] } } });
    expect(await screen.findByRole('button', { name: /Usuarios/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roles y permisos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajustes/ })).toBeInTheDocument();
  });

  it('a user with only manage_roles sees only that section (?mod= honoured)', async () => {
    const u = { ...PLAYER_USER, permissions: { modules: [], admin: { manage_roles: true } } };
    renderWithProviders(app(u), { providers: { routerProps: { initialEntries: ['/admin?mod=users'] } } });
    expect(await screen.findByRole('button', { name: /Roles y permisos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuarios/ })).not.toBeInTheDocument();
    expect(await screen.findByTestId('role-admin')).toBeInTheDocument(); // fell back to roles
  });

  /** The settings screen reads its levels through the port the shell hands it — not through one of its own. */
  it('settings gets the compression port from deps', async () => {
    const deps = fakeAdminDeps({
      compressionLevels: {
        load: vi.fn().mockResolvedValue({ texture: 'max', prop: 'light', background: 'balanced' }),
        save: vi.fn().mockResolvedValue(undefined),
      },
    });
    renderWithProviders(app(ADMIN_USER, deps), { providers: { routerProps: { initialEntries: ['/admin?mod=settings'] } } });

    const texturas = await screen.findByRole('radiogroup', { name: 'Texturas' });
    await waitFor(() => expect(within(texturas).getByRole('radio', { name: 'Máximo ahorro' })).toHaveAttribute('aria-checked', 'true'));
    expect(deps.compressionLevels.load).toHaveBeenCalled();
  });

  it('a plain player is redirected home', async () => {
    renderWithProviders(app(PLAYER_USER), { providers: { routerProps: { initialEntries: ['/admin'] } } });
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});
