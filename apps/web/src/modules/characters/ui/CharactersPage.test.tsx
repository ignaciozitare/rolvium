import { describe, it, expect } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { fakeAuthRepo, fakeCampaignsRepo, fakeCharactersRepo, PLAYER_USER, CAMPAIGN_MINE, CHARACTER_KAREN, CHARACTER_UNASSIGNED } from '../../../../tests/helpers/fakes';
import { CharactersPage } from './CharactersPage';

function mount(chars = [CHARACTER_KAREN, CHARACTER_UNASSIGNED]) {
  const repo = fakeCharactersRepo(chars);
  const campaigns = fakeCampaignsRepo({ mine: [CAMPAIGN_MINE] });
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(PLAYER_USER)}><Routes>
      <Route path="/characters" element={<CharactersPage repo={repo} campaigns={campaigns} />} />
      <Route path="/table/:id" element={<div>TABLE</div>} />
      <Route path="/characters/:id" element={<div>SHEET</div>} />
      <Route path="/campaigns" element={<div>CAMPAIGNS</div>} />
    </Routes></AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/characters'] } } },
  );
  return repo;
}

describe('/characters', () => {
  it('lists my characters grouped by campaign with system chip, state and highlights; actions navigate', async () => {
    mount();
    const u = userEvent.setup();
    const card = await screen.findByRole('article', { name: 'Karen «K»' });
    expect(within(card).getByText('Plenilunio')).toBeInTheDocument();
    expect(within(card).getByText('Líder de banda')).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByText(/Sano · 24 px/)).toBeInTheDocument());
    expect(within(card).getByText('Presencia 5 · Fortaleza 4 · Combate 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Las noches de Queens' })).toBeInTheDocument();
    await u.click(within(card).getByRole('button', { name: 'Ver ficha' }));
    expect(screen.getByText('SHEET')).toBeInTheDocument();
  });
  it('unassigned PCs of my campaigns can be claimed', async () => {
    const repo = mount();
    const u = userEvent.setup();
    const nix = await screen.findByRole('article', { name: 'Nix' });
    expect(within(nix).getByText('Sin asignar')).toBeInTheDocument();
    await u.click(within(nix).getByRole('button', { name: 'Reclamar' }));
    await waitFor(() => expect(repo.claimed).toEqual(['ch-nix']));
    await waitFor(() => expect(screen.queryByText('Sin dueño en tus campañas')).not.toBeInTheDocument());
  });
  it('empty state sends to campaigns; «Abrir en la mesa» opens the table', async () => {
    mount([]);
    const u = userEvent.setup();
    expect(await screen.findByText('Aún no tienes personajes')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ir a mis campañas' }));
    expect(screen.getByText('CAMPAIGNS')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount([CHARACTER_KAREN]);
    await u.click(await screen.findByRole('button', { name: 'Abrir en la mesa' }));
    expect(screen.getByText('TABLE')).toBeInTheDocument();
  });
});
