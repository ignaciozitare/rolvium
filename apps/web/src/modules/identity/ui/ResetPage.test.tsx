import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAuthRepo, fakeIdentityDeps, PLAYER_USER } from '../../../../tests/helpers/fakes';
import { ResetPage } from './ResetPage';

const mount = (deps = fakeIdentityDeps(), user = PLAYER_USER as typeof PLAYER_USER | null) => renderWithProviders(
  <AuthProvider repo={fakeAuthRepo(user)}>
    <Routes><Route path="/reset" element={<ResetPage deps={deps} />} /><Route path="/campaigns" element={<div>CAMPAIGNS</div>} /></Routes>
  </AuthProvider>, { providers: { routerProps: { initialEntries: ['/reset'] } } });

describe('ResetPage', () => {
  it('without a recovery session it points to /forgot', async () => {
    mount(fakeIdentityDeps(), null);
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido');
    expect(screen.getByRole('link', { name: 'Pedir otro' })).toHaveAttribute('href', '/forgot');
  });
  it('validates the pair, then updates the password and enters', async () => {
    const deps = fakeIdentityDeps();
    mount(deps);
    await userEvent.type(await screen.findByLabelText('Nueva contraseña', { selector: 'input' }), 'supersecret1');
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'different1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(deps.identity.updatePassword).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Repetir contraseña'));
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));
    await waitFor(() => expect(deps.identity.updatePassword).toHaveBeenCalledWith('supersecret1'));
    expect(await screen.findByText('CAMPAIGNS')).toBeInTheDocument();
  });
  it('shows the server error', async () => {
    const deps = fakeIdentityDeps({ identity: { updatePassword: vi.fn().mockResolvedValue({ error: 'weak_password' }) } });
    mount(deps);
    await userEvent.type(await screen.findByLabelText('Nueva contraseña', { selector: 'input' }), 'supersecret1');
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiado débil');
  });
});
