import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '../../../../tests/helpers/render';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAuthRepo, fakeIdentityDeps, PLAYER_USER, SESSION_OTHER } from '../../../../tests/helpers/fakes';
import { AccountPage } from './AccountPage';

const GM_USER = { ...PLAYER_USER, role: 'game_master', alias: 'Pipito' };

function mount(deps = fakeIdentityDeps(), user = GM_USER) {
  const repo = fakeAuthRepo(user);
  const utils = renderWithProviders(<AuthProvider repo={repo}><AccountPage deps={deps} /></AuthProvider>);
  return { ...utils, repo };
}

describe('AccountPage', () => {
  it('renders nav + the four sections and scrolls on nav click', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Cuenta' })).toBeInTheDocument();
    for (const n of ['Perfil', 'Contraseña y acceso', 'Dispositivos', 'Idioma y tema']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notificaciones/ })).toBeDisabled();
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll;
    await userEvent.click(screen.getByRole('button', { name: 'Dispositivos' }));
    expect(scroll).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dispositivos' })).toHaveAttribute('aria-current', 'true');
  });

  describe('ProfileSection', () => {
    it('shows the profile, saves name + alias, refreshes the user', async () => {
      const deps = fakeIdentityDeps();
      const { repo } = mount(deps);
      const form = await screen.findByRole('form', { name: 'Perfil' });
      expect(within(form).getByLabelText('Correo')).toHaveValue('pip@rolvium.test');
      expect(within(form).getByLabelText('Correo')).toBeDisabled();
      expect(within(form).getByText('GAME MASTER')).toBeInTheDocument();
      expect(within(form).getByText('puedes crear campañas y dirigirlas')).toBeInTheDocument();
      await userEvent.clear(within(form).getByLabelText('Nombre'));
      await userEvent.type(within(form).getByLabelText('Nombre'), 'Pip Nuevo');
      await userEvent.clear(within(form).getByLabelText('Nombre en las mesas'));
      await userEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(deps.identity.updateProfile).toHaveBeenCalledWith('u-pip', { name: 'Pip Nuevo', alias: null }));
      expect(await within(form).findByRole('status')).toHaveTextContent('Cambios guardados');
      expect(repo.getCurrentUser).toHaveBeenCalledTimes(2);
    });
    it('opens the image picker and uploads → uploadAvatar + refresh', async () => {
      const deps = fakeIdentityDeps();
      mount(deps);
      const form = await screen.findByRole('form', { name: 'Perfil' });
      await userEvent.click(within(form).getByRole('button', { name: 'Subir imagen' }));
      expect(within(form).getByText('Arrastra una imagen o haz clic')).toBeInTheDocument();
    });
    it('shows the error when saving fails', async () => {
      const deps = fakeIdentityDeps({ identity: { updateProfile: vi.fn().mockRejectedValue(new Error('x')) } });
      mount(deps);
      const form = await screen.findByRole('form', { name: 'Perfil' });
      await userEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
      expect(await within(form).findByRole('status')).toHaveTextContent('No se pudieron guardar');
    });
  });

  describe('PasswordSection', () => {
    it('rejects mismatch, then changes the password and clears the fields', async () => {
      const deps = fakeIdentityDeps();
      mount(deps);
      const form = await screen.findByRole('form', { name: 'Contraseña y acceso' });
      await userEvent.type(within(form).getByLabelText('Nueva contraseña', { selector: 'input' }), 'supersecret1');
      await userEvent.type(within(form).getByLabelText('Repetir contraseña'), 'nope');
      await userEvent.click(within(form).getByRole('button', { name: 'Cambiar contraseña' }));
      expect(await within(form).findByRole('alert')).toHaveTextContent('no coinciden');
      await userEvent.clear(within(form).getByLabelText('Repetir contraseña'));
      await userEvent.type(within(form).getByLabelText('Repetir contraseña'), 'supersecret1');
      await userEvent.click(within(form).getByRole('button', { name: 'Cambiar contraseña' }));
      await waitFor(() => expect(deps.identity.updatePassword).toHaveBeenCalledWith('supersecret1'));
      expect(await within(form).findByRole('status')).toHaveTextContent('Contraseña cambiada');
      expect(within(form).getByLabelText('Nueva contraseña', { selector: 'input' })).toHaveValue('');
    });
  });

  describe('DevicesSection', () => {
    it('lists sessions (current first, chip) and revokes another after confirm', async () => {
      const deps = fakeIdentityDeps();
      mount(deps);
      const list = await screen.findByRole('list', { name: 'Sesiones y dispositivos' });
      const items = await within(list).findAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(within(items[0]!).getByText('Mac · Safari')).toBeInTheDocument();
      expect(within(items[0]!).getByText('ACTUAL')).toBeInTheDocument();
      expect(within(items[1]!).getByText('iPad · Safari')).toBeInTheDocument();
      expect(within(items[1]!).getByText(/hace 3 min/)).toBeInTheDocument();
      await userEvent.click(within(items[1]!).getByRole('button', { name: 'Cerrar sesión' }));
      expect(await screen.findByText(/¿Cerrar la sesión de iPad · Safari\?/)).toBeInTheDocument();
      // the confirm button lives in the DialogProvider overlay (last matching button)
      const confirmBtns = screen.getAllByRole('button', { name: 'Cerrar sesión' });
      await userEvent.click(confirmBtns[confirmBtns.length - 1]!);
      await waitFor(() => expect(deps.identity.revokeSession).toHaveBeenCalledWith(SESSION_OTHER.id));
      expect(deps.identity.listSessions).toHaveBeenCalledTimes(2);
    });
    it('shows the error state when the RPC fails', async () => {
      const deps = fakeIdentityDeps({ identity: { listSessions: vi.fn().mockRejectedValue(new Error('x')) } });
      mount(deps);
      expect(await screen.findByText('No se pudieron cargar las sesiones')).toBeInTheDocument();
    });
  });

  describe('PreferencesSection', () => {
    it('saves locale and theme to the profile and applies them', async () => {
      const deps = fakeIdentityDeps();
      mount(deps);
      const lang = await screen.findByRole('radiogroup', { name: 'Idioma' });
      await userEvent.click(within(lang).getByRole('radio', { name: 'English' }));
      await waitFor(() => expect(deps.identity.updateProfile).toHaveBeenCalledWith('u-pip', { locale: 'en' }));
      const theme = screen.getByRole('radiogroup', { name: 'Tema de la plataforma' });
      await userEvent.click(within(theme).getByRole('radio', { name: /Claro/ }));
      await waitFor(() => expect(deps.identity.updateProfile).toHaveBeenCalledWith('u-pip', { themePref: 'light' }));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(within(theme).getByRole('radio', { name: /Claro/ })).toHaveAttribute('aria-checked', 'true');
    });
  });
});
