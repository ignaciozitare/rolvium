import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { fakeIdentityDeps } from '../../../../tests/helpers/fakes';
import { ForgotPage } from './ForgotPage';

describe('ForgotPage', () => {
  it('sends the reset link to /reset and shows the neutral confirmation', async () => {
    const deps = fakeIdentityDeps();
    renderWithProviders(<ForgotPage deps={deps} />);
    await userEvent.type(screen.getByLabelText('Correo'), 'marta@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    await waitFor(() => expect(deps.identity.requestPasswordReset).toHaveBeenCalledWith('marta@ejemplo.com', expect.stringMatching(/\/reset$/)));
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta con ese correo');
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login');
  });
});
