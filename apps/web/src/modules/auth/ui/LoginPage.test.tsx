import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../../../tests/helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { LoginPage } from './LoginPage';
import type { IAuthRepository } from '../domain/ports/IAuthRepository';

function fakeRepo(over: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ user: null, error: 'invalid_credentials' }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    ...over,
  };
}

describe('LoginPage', () => {
  it('renders the form with i18n labels', async () => {
    renderWithProviders(<AuthProvider repo={fakeRepo()}><LoginPage /></AuthProvider>);
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('calls the repository and shows the invalid-credentials error', async () => {
    const repo = fakeRepo();
    renderWithProviders(<AuthProvider repo={repo}><LoginPage /></AuthProvider>);
    await userEvent.type(await screen.findByLabelText('Correo'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(repo.signInWithPassword).toHaveBeenCalledWith('a@b.co', 'secret123'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });

  it('shows the disabled-account message', async () => {
    const repo = fakeRepo({ signInWithPassword: vi.fn().mockResolvedValue({ user: null, error: 'account_disabled' }) });
    renderWithProviders(<AuthProvider repo={repo}><LoginPage /></AuthProvider>);
    await userEvent.type(await screen.findByLabelText('Correo'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/desactivada/);
  });
});
