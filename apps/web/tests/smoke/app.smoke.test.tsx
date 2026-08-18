import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { AppRoutes } from '@/AppRouter';
import { vi } from 'vitest';
import { fakeAuthRepo, ADMIN_USER, PLAYER_USER } from '../helpers/fakes';

vi.mock('@/modules/campaigns/container', async () => { const f = await import('../helpers/fakes'); return { campaignsRepo: f.fakeCampaignsRepo({ mine: [f.CAMPAIGN_MINE] }) }; });

describe('smoke: routing + auth gate', () => {
  it('unauthenticated → login page', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/home'] } } });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('authenticated player → home, no admin entry', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/'] } } });
    expect(await screen.findByText('Hola, Pip')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument();
  });

  it('authenticated admin → sees the admin entry', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(ADMIN_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/home'] } } });
    expect(await screen.findByText('Hola, Root')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Administración/ })).toBeInTheDocument();
  });

  it('player hitting /admin is redirected home', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/admin'] } } });
    expect(await screen.findByText('Hola, Pip')).toBeInTheDocument();
  });
});

vi.mock('@/modules/characters/container', async () => { const f = await import('../helpers/fakes'); return { charactersRepo: f.fakeCharactersRepo([f.CHARACTER_KAREN]), rollsPort: f.fakeRollsPort() }; });

describe('smoke: characters routes', () => {
  it('/characters lists my characters behind the auth gate', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/characters'] } } });
    expect(await screen.findByRole('article', { name: 'Karen «K»' })).toBeInTheDocument();
  });
  it('/characters/:id opens the sheet dressed by the system', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/characters/ch-karen'] } } });
    expect(await screen.findByText(/Karen «K»/)).toBeInTheDocument();
  });
});

describe('smoke: systems route', () => {
  it('/systems renders the catalog behind the auth gate', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/systems'] } } });
    expect(await screen.findByRole('article', { name: 'Plenilunio' })).toBeInTheDocument();
    expect(await screen.findByText('Instalado')).toBeInTheDocument();
  });
});

vi.mock('@/modules/identity/container', async () => { const f = await import('../helpers/fakes'); return { identityDeps: f.fakeIdentityDeps() }; });

describe('smoke: identity routes', () => {
  it('/signup, /join/:code and /forgot are public', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/signup'] } } });
    expect(await screen.findByRole('form', { name: 'Crear cuenta' })).toBeInTheDocument();
  });
  it('/join/:code previews the invite without a session', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/join/LUNA-4F7K'] } } });
    expect(await screen.findByText('Las ruinas de Manhattan')).toBeInTheDocument();
  });
  it('/forgot renders the recovery form', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/forgot'] } } });
    expect(await screen.findByRole('form', { name: 'Recuperar contraseña' })).toBeInTheDocument();
  });
  it('/account needs a session and shows the profile; the user menu links to it', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(null)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/account'] } } });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
  it('/account for a signed-in user shows the account page and the menu entry', async () => {
    renderWithProviders(<AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><AppRoutes /></AuthProvider>, { providers: { routerProps: { initialEntries: ['/account'] } } });
    expect(await screen.findByRole('form', { name: 'Perfil' })).toBeInTheDocument();
    const { userEvent } = await import('../helpers/render');
    await userEvent.click(screen.getByRole('button', { name: 'Pip' }));
    expect(screen.getByRole('menuitem', { name: /Cuenta/ })).toBeInTheDocument();
  });
});
