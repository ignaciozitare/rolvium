import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { CampaignsPage } from '@/modules/campaigns/ui/CampaignsPage';
import { fakeAuthRepo, PLAYER_USER, ADMIN_USER, fakeCampaignsRepo, CAMPAIGN_MINE, CAMPAIGN_OPEN } from '../helpers/fakes';
import { normalizeInviteCode, isValidInviteCode, validateCreateStep } from '@/modules/campaigns/domain/useCases/campaignRules';

const GM = { ...ADMIN_USER, id: 'u-gm', name: 'Laura', role: 'game_master' };

function mount(user = PLAYER_USER, repo = fakeCampaignsRepo({ mine: [CAMPAIGN_MINE], open: [CAMPAIGN_OPEN] })) {
  renderWithProviders(<AuthProvider repo={fakeAuthRepo(user)}><CampaignsPage repo={repo} /></AuthProvider>);
  return repo;
}

describe('campaigns: rules', () => {
  it('normalises invite codes typed loosely', () => {
    expect(normalizeInviteCode('luna4f7k')).toBe('LUNA-4F7K');
    expect(normalizeInviteCode(' luna-4f7k ')).toBe('LUNA-4F7K');
    expect(isValidInviteCode('LUNA-4F7')).toBe(false);
    expect(isValidInviteCode('luna4f7k')).toBe(true);
  });
  it('validates wizard steps', () => {
    expect(validateCreateStep('name', { name: ' ', systemId: 'plenilunio', seats: 5 })).toBe('campaigns.errors.nameRequired');
    expect(validateCreateStep('system', { name: 'x', systemId: null, seats: 5 })).toBe('campaigns.errors.systemRequired');
    expect(validateCreateStep('seats', { name: 'x', systemId: 'plenilunio', seats: 13 })).toBe('campaigns.errors.seatsRange');
    expect(validateCreateStep('seats', { name: 'x', systemId: 'plenilunio', seats: 5 })).toBeNull();
  });
});

describe('campaigns: home', () => {
  it('lists my campaigns and open ones; player cannot create', async () => {
    mount();
    expect(await screen.findByText('Las noches de Queens')).toBeInTheDocument();
    expect(screen.getByText('Sangre en el asfalto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar a la mesa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir unirme' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear campaña' })).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no campaigns', async () => {
    mount(PLAYER_USER, fakeCampaignsRepo());
    expect(await screen.findByText('Todavía no estás en ninguna campaña')).toBeInTheDocument();
  });

  it('join by code: invalid format shows error, valid code calls the port', async () => {
    const repo = mount(PLAYER_USER, fakeCampaignsRepo({ mine: [], joinResult: { error: 'campaign_full' } }));
    const u = userEvent.setup();
    const input = await screen.findByLabelText('Código');
    await u.type(input, 'ab');
    await u.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/código no vale/i);
    await u.clear(input); await u.type(input, 'luna4f7k');
    expect(input).toHaveValue('LUNA-4F7K');
    await u.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/completa/i);
    expect(repo).toBeTruthy();
  });

  it('game master creates a campaign through the wizard and gets an invite code', async () => {
    const repo = mount(GM, fakeCampaignsRepo());
    const u = userEvent.setup();
    await u.click((await screen.findAllByRole('button', { name: 'Crear campaña' }))[0]!);
    // step 1: name
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre/i);
    await u.type(screen.getByLabelText('Nombre'), 'Las ruinas de Manhattan');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // step 2: system (plenilunio preselected, cyberpunk locked)
    expect(screen.getByRole('radio', { name: /Plenilunio/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Cyberpunk/ })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // step 3: visibility + seats
    await u.click(screen.getByRole('radio', { name: 'Abierta' }));
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // step 4: options → create
    await u.click(screen.getByRole('checkbox'));
    const btns = screen.getAllByRole('button', { name: 'Crear campaña' });
    await u.click(btns[btns.length - 1]!);
    // step 5: invite
    await waitFor(() => expect(screen.getByText('LUNA-4F7K')).toBeInTheDocument());
    expect(repo.created[0]).toMatchObject({ name: 'Las ruinas de Manhattan', systemId: 'plenilunio', visibility: 'open', progressionEnabled: true });
    expect(screen.getByRole('button', { name: 'Abrir la mesa' })).toBeInTheDocument();
  });
});
