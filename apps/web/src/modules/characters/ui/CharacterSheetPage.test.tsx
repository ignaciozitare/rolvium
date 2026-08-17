import { describe, it, expect } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAuthRepo, fakeCampaignsRepo, fakeCharactersRepo, fakeRollsPort, PLAYER_USER, ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, CHARACTER_OTHER } from '../../../../tests/helpers/fakes';
import { CharacterSheetPage } from './CharacterSheetPage';

const GM = { ...ADMIN_USER, id: 'dm-1', name: 'Laura', role: 'game_master' as const };

function mount(user: typeof PLAYER_USER, id: string, role: 'dm' | 'player' = 'player') {
  const repo = fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]);
  const campaigns = fakeCampaignsRepo({ mine: [{ ...CAMPAIGN_MINE, myRole: role }] });
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(user)}><Routes><Route path="/characters/:id" element={<CharacterSheetPage repo={repo} campaigns={campaigns} rolls={fakeRollsPort()} />} /></Routes></AuthProvider>,
    { providers: { routerProps: { initialEntries: [`/characters/${id}`] } } },
  );
  return repo;
}

describe('/characters/:id', () => {
  it('owner sees the themed full-screen sheet, edits and it autosaves', async () => {
    const repo = mount(PLAYER_USER, 'ch-karen');
    expect(await screen.findByText(/Ficha · Karen «K» · Las noches de Queens/)).toBeInTheDocument();
    expect(document.querySelector('.tb-root')).toHaveAttribute('data-system', 'plenilunio');
    expect((document.querySelector('.tb-root') as HTMLElement).style.getPropertyValue('--sys-ink')).not.toBe('');
    expect(screen.getByLabelText('Personaje')).not.toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText('Concepto'), '!');
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
    await waitFor(() => expect(repo.updates.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(await screen.findByText('sincronizada con la mesa')).toBeInTheDocument();
  });
  it('DM opens another player’s sheet read-only and toggles «Editar»', async () => {
    mount(GM, 'ch-elias', 'dm');
    const u = userEvent.setup();
    expect(await screen.findByLabelText('Personaje')).toBeDisabled();
    await u.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Personaje')).not.toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Solo lectura' }));
    expect(screen.getByLabelText('Personaje')).toBeDisabled();
  });
  it('unknown id shows the not-found notice', async () => {
    mount(PLAYER_USER, 'nope');
    expect(await screen.findByText('No encontramos ese personaje.')).toBeInTheDocument();
  });
});
