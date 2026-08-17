import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { AppRoutes } from '@/AppRouter';
import { fakeAuthRepo, ADMIN_USER, PLAYER_USER } from '../helpers/fakes';

describe('smoke: routing + auth gate', () => {
  it('unauthenticated → login page', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/home'] } } });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('authenticated player → home, no admin entry', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/'] } } });
    expect(await screen.findByText('Bienvenido, Pip')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument();
  });

  it('authenticated admin → sees the admin entry', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(ADMIN_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/home'] } } });
    expect(await screen.findByText('Bienvenido, Root')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Administración/ })).toBeInTheDocument();
  });

  it('player hitting /admin is redirected home', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/admin'] } } });
    expect(await screen.findByText('Bienvenido, Pip')).toBeInTheDocument();
  });
});
