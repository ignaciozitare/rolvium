import { describe, it, expect, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAuthRepo, fakeIdentityDeps, PLAYER_USER } from '../../../../tests/helpers/fakes';
import { SignupPage } from './SignupPage';

function mount(path: string, deps = fakeIdentityDeps(), user = null as typeof PLAYER_USER | null) {
  return renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(user)}>
      <Routes>
        <Route path="/signup" element={<SignupPage deps={deps} />} />
        <Route path="/join" element={<SignupPage deps={deps} />} />
        <Route path="/join/:code" element={<SignupPage deps={deps} />} />
        <Route path="/campaigns" element={<div>CAMPAIGNS</div>} />
        <Route path="/table/:id" element={<div>TABLE</div>} />
      </Routes>
    </AuthProvider>,
    { providers: { routerProps: { initialEntries: [path] } } },
  );
}

describe('SignupPage — open sign-up (/signup)', () => {
  it('validates before calling signUp', async () => {
    const deps = fakeIdentityDeps();
    mount('/signup', deps);
    await screen.findByRole('form', { name: 'Crear cuenta' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dinos cómo llamarte en la mesa');
    expect(deps.identity.signUp).not.toHaveBeenCalled();
    expect(screen.queryByText('LUNA-4F7K')).not.toBeInTheDocument();
  });
  it('signs up with the chosen language and goes to /campaigns', async () => {
    const deps = fakeIdentityDeps();
    mount('/signup', deps);
    await userEvent.type(await screen.findByLabelText('Tu nombre en la mesa'), 'Marta');
    await userEvent.type(screen.getByLabelText('Correo'), 'marta@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(deps.identity.signUp).toHaveBeenCalledWith({ email: 'marta@ejemplo.com', password: 'supersecret1', name: 'Marta', locale: 'es', redirectTo: expect.stringMatching(/\/campaigns$/) }));
    expect(await screen.findByText('CAMPAIGNS')).toBeInTheDocument();
  });
  it('shows the server error and the confirm-email state', async () => {
    const deps = fakeIdentityDeps({ identity: { signUp: vi.fn().mockResolvedValueOnce({ error: 'email_taken' }).mockResolvedValueOnce({ status: 'confirm_email' }) } });
    mount('/signup', deps);
    await userEvent.type(await screen.findByLabelText('Tu nombre en la mesa'), 'Marta');
    await userEvent.type(screen.getByLabelText('Correo'), 'marta@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese correo');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
  });
});

describe('SignupPage — with invite code (/join/:code)', () => {
  it('previews the code, signs up and joins → table', async () => {
    const deps = fakeIdentityDeps();
    mount('/join/luna4f7k', deps);
    expect(await screen.findByText('Las ruinas de Manhattan')).toBeInTheDocument();
    expect(deps.invites.preview).toHaveBeenCalledWith('LUNA-4F7K');
    expect(screen.getByText(/dirige Ignacio · 4 plazas libres/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tu nombre en la mesa'), 'Marta');
    await userEvent.type(screen.getByLabelText('Correo'), 'marta@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'supersecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta y entrar a la mesa' }));
    await waitFor(() => expect(deps.joinByCode).toHaveBeenCalledWith('LUNA-4F7K'));
    expect(deps.identity.signUp).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: expect.stringMatching(/\/join\/LUNA-4F7K$/) }));
    expect(await screen.findByText('TABLE')).toBeInTheDocument();
  });
  it('invalid code → generic error, form still usable as open sign-up', async () => {
    const deps = fakeIdentityDeps({ invites: { preview: vi.fn().mockResolvedValue(null) } });
    mount('/join/XXXX-XXXX', deps);
    expect(await screen.findByText('Ese código no vale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
  });
  it('/join without code lets the visitor type and check one', async () => {
    const deps = fakeIdentityDeps();
    mount('/join', deps);
    await userEvent.type(await screen.findByLabelText('Código'), 'luna4f7k');
    await userEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(await screen.findByText('Las ruinas de Manhattan')).toBeInTheDocument();
  });
  it('"sign in with the code" logs in and joins', async () => {
    const deps = fakeIdentityDeps();
    const { unmount } = mount('/join/LUNA-4F7K', deps);
    await screen.findByText('Las ruinas de Manhattan');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión con el código' }));
    await userEvent.type(screen.getByLabelText('Correo'), 'pip@rolvium.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret');
    // fakeAuthRepo(null) → login fails → error shown, no join
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión y unirme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
    expect(deps.joinByCode).not.toHaveBeenCalled();
    unmount();
  });
  it('signed-in visitor only sees "join"', async () => {
    const deps = fakeIdentityDeps();
    mount('/join/LUNA-4F7K', deps, PLAYER_USER);
    expect(await screen.findByText('Unirte a la campaña')).toBeInTheDocument();
    await screen.findByText('Las ruinas de Manhattan');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    await waitFor(() => expect(deps.joinByCode).toHaveBeenCalledWith('LUNA-4F7K'));
    expect(await screen.findByText('TABLE')).toBeInTheDocument();
  });
  it('full campaign → explicit error', async () => {
    const deps = fakeIdentityDeps({ joinByCode: vi.fn().mockResolvedValue({ error: 'campaign_full' }) });
    mount('/join/LUNA-4F7K', deps, PLAYER_USER);
    await screen.findByText('Las ruinas de Manhattan');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La campaña ya está completa');
  });
});
