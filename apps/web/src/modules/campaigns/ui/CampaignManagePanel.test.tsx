import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { fakeCampaignsRepo, CAMPAIGN_DM, MEMBER_DM, MEMBER_PIP, MEMBER_DANI, REQUEST_MARTA } from '../../../../tests/helpers/fakes';
import { CampaignManagePanel } from './CampaignManagePanel';

function mount(over: Parameters<typeof fakeCampaignsRepo>[0] = {}) {
  const repo = fakeCampaignsRepo({ mine: [CAMPAIGN_DM], members: [MEMBER_DM, MEMBER_PIP, MEMBER_DANI], requests: [REQUEST_MARTA], ...over });
  const onClose = vi.fn(); const onChanged = vi.fn();
  renderWithProviders(<CampaignManagePanel campaign={{ ...CAMPAIGN_DM, visibility: 'open' }} repo={repo} onClose={onClose} onChanged={onChanged} />);
  return { repo, onClose, onChanged };
}
/** The confirm button of the DialogProvider overlay is the last one with that name. */
const confirmLast = async (u: ReturnType<typeof userEvent.setup>, name: string) => { const b = screen.getAllByRole('button', { name }); await u.click(b[b.length - 1]!); };

describe('CampaignManagePanel (DM)', () => {
  it('shows the invite code + join link, copies it and regenerates after confirm', async () => {
    const { repo, onChanged } = mount();
    const u = userEvent.setup();
    expect(await screen.findByTestId('invite-code')).toHaveTextContent('LUNA-4F7K');
    expect(screen.getByText(/\/join\/LUNA-4F7K$/)).toBeInTheDocument();
    // userEvent installs its own clipboard stub; read it back after the click.
    await u.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(await navigator.clipboard.readText()).toMatch(/\/join\/LUNA-4F7K$/);
    expect(await screen.findByText('Enlace copiado')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Regenerar' }));
    expect(await screen.findByText(/Regenerar el código/)).toBeInTheDocument();
    await confirmLast(u, 'Regenerar');
    await waitFor(() => expect(screen.getByTestId('invite-code')).toHaveTextContent('NEW1-CODE'));
    expect(repo.regenerated).toBe(1);
    expect(onChanged).toHaveBeenCalled();
  });

  it('lists pending requests; accept resolves and moves the player into the members list', async () => {
    const { repo } = mount();
    const u = userEvent.setup();
    const row = await screen.findByRole('listitem', { name: 'Marta' });
    expect(within(row).getByText('Juego los martes')).toBeInTheDocument();
    await u.click(within(row).getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(repo.resolved).toEqual([{ id: 'rq-1', accept: true }]));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jugadores · 3 de 5' })).toBeInTheDocument());
    expect(screen.getByText('Nadie ha pedido unirse todavía.')).toBeInTheDocument();
  });

  it('reject resolves with accept=false', async () => {
    const { repo } = mount();
    const u = userEvent.setup();
    const row = await screen.findByRole('listitem', { name: 'Marta' });
    await u.click(within(row).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(repo.resolved).toEqual([{ id: 'rq-1', accept: false }]));
  });

  it('members: DM row has no expel; expelling a player asks for confirmation then removes', async () => {
    const { repo } = mount();
    const u = userEvent.setup();
    const dm = await screen.findByRole('listitem', { name: 'Laura' });
    expect(within(dm).getByText('Director')).toBeInTheDocument();
    expect(within(dm).queryByRole('button', { name: 'Expulsar' })).not.toBeInTheDocument();
    const pip = screen.getByRole('listitem', { name: 'Pip' });
    expect(within(pip).getByText('con personaje')).toBeInTheDocument();
    await u.click(within(pip).getByRole('button', { name: 'Expulsar' }));
    expect(await screen.findByText(/Expulsar a Pip/)).toBeInTheDocument();
    await confirmLast(u, 'Cancelar');
    expect(repo.removed).toEqual([]);
    await u.click(within(pip).getByRole('button', { name: 'Expulsar' }));
    await confirmLast(u, 'Expulsar');
    await waitFor(() => expect(repo.removed).toEqual(['u-pip']));
    expect(screen.queryByRole('listitem', { name: 'Pip' })).not.toBeInTheDocument();
  });

  it('next session and progression persist through update()', async () => {
    const { repo } = mount();
    const u = userEvent.setup();
    const input = await screen.findByLabelText('Próxima sesión');
    await u.type(input, '2026-09-04T21:00');
    await waitFor(() => expect(repo.updates.at(-1)?.patch.nextSessionAt).toBe(new Date('2026-09-04T21:00').toISOString()));
    await u.click(screen.getByRole('button', { name: 'Sin fecha' }));
    await waitFor(() => expect(repo.updates.at(-1)?.patch).toEqual({ nextSessionAt: null }));
    await u.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(repo.updates.at(-1)?.patch).toEqual({ progressionEnabled: true }));
    expect(screen.getByText(/Abierta · los jugadores/)).toBeInTheDocument();
  });

  it('archive asks for confirmation, archives and closes', async () => {
    const { repo, onClose } = mount();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Archivar' }));
    expect(await screen.findByText(/Archivar «El sótano de la catedral»/)).toBeInTheDocument();
    await confirmLast(u, 'Archivar');
    await waitFor(() => expect(repo.archived).toEqual(['c2']));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when loading fails', async () => {
    const repo = { ...fakeCampaignsRepo(), listRequests: async () => { throw new Error('boom'); } };
    renderWithProviders(<CampaignManagePanel campaign={CAMPAIGN_DM} repo={repo} onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
  });
});
