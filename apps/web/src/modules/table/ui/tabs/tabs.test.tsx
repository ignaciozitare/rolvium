import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { fakeCharactersRepo, fakeRollsPort, CHARACTER_KAREN, CHARACTER_OTHER, CHARACTER_UNASSIGNED, PLAYER_USER } from '../../../../../tests/helpers/fakes';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import { SheetTab, CreateTab } from './SheetTab';
import { ImproveTab } from './ImproveTab';
import { GroupTab } from './GroupTab';

const MEMBERS: CampaignMember[] = [
  { campaignId: 'c1', userId: 'dm-1', name: 'Laura', avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' },
  { campaignId: 'c1', userId: 'u-pip', name: 'Pip', avatarUrl: 'https://x/pip.png', role: 'player', characterId: 'ch-karen', joinedAt: '' },
  { campaignId: 'c1', userId: 'u-nix', name: 'Dani', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' },
];

describe('table tabs — sheet / create / improve / group', () => {
  it('SheetTab shows my sheet with roll options from the table, «Abrir ficha aparte»; empty state → create', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN]);
    const rolls = fakeRollsPort();
    const onOpenCreate = vi.fn();
    renderWithProviders(<SheetTab campaignId="c1" system={plenilunio} role="player" userId={PLAYER_USER.id} repo={repo} rolls={rolls} rollOptions={{ destinyDice: 1 }} onOpenCreate={onOpenCreate} />);
    expect(await screen.findByLabelText('Personaje')).toHaveValue('Karen «K»');
    expect(screen.getByRole('link', { name: 'Abrir ficha aparte' })).toHaveAttribute('href', '/characters/ch-karen');
    await userEvent.setup().click(within(document.querySelector('[data-stat="combat"]') as HTMLElement).getByRole('button', { name: 'Tirar 5' }));
    await waitFor(() => expect(rolls.requests[0]?.sharedResources).toEqual({ destiny: 1 }));
    document.body.innerHTML = '';
    renderWithProviders(<SheetTab campaignId="c1" system={plenilunio} role="player" userId="someone-else" repo={repo} onOpenCreate={onOpenCreate} />);
    expect(await screen.findByText('No tienes personaje en esta campaña')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Crear personaje' }));
    expect(onOpenCreate).toHaveBeenCalled();
  });
  it('DM viewing a player sheet via characterId: read-only with «Editar» toggle', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER]);
    renderWithProviders(<SheetTab campaignId="c1" system={plenilunio} role="dm" userId="dm-1" repo={repo} characterId="ch-elias" onOpenCreate={() => {}} />);
    expect(await screen.findByLabelText('Personaje')).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Personaje')).not.toBeDisabled();
  });
  it('CreateTab hosts the generator; ImproveTab gates on progressionEnabled', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN]);
    renderWithProviders(<CreateTab campaignId="c1" system={plenilunio} role="player" repo={repo} onCancel={() => {}} onCreated={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    document.body.innerHTML = '';
    renderWithProviders(<ImproveTab campaignId="c1" userId={PLAYER_USER.id} repo={repo} progressionEnabled={false} />);
    expect(await screen.findByText(/las mejoras cerradas/)).toBeInTheDocument();
    document.body.innerHTML = '';
    renderWithProviders(<ImproveTab campaignId="c1" userId="nobody" repo={repo} progressionEnabled />);
    expect(await screen.findByText('Necesitas un personaje en esta campaña para mejorarlo.')).toBeInTheDocument();
  });
  it('GroupTab lists PCs with avatar precedence, resistance, health and xp; «Ver ficha» callback', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN, CHARACTER_OTHER, CHARACTER_UNASSIGNED, { ...CHARACTER_OTHER, id: 'npc', kind: 'npc', name: 'Ogro' }]);
    const onView = vi.fn();
    renderWithProviders(<GroupTab campaignId="c1" system={plenilunio} members={MEMBERS} repo={repo} onView={onView} />);
    const karen = await screen.findByRole('article', { name: 'Karen «K»' });
    expect(within(karen).getByRole('img')).toHaveAttribute('src', 'https://x/pip.png'); // owner avatar fallback
    expect(within(karen).getByRole('meter')).toHaveAttribute('aria-valuenow', '21');
    expect(within(karen).getByText('Sano')).toBeInTheDocument();
    expect(within(karen).getByText('24')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Elías Vance' })).getByText('Herido')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Nix' })).toHaveTextContent('sin dueño');
    expect(screen.queryByRole('article', { name: 'Ogro' })).not.toBeInTheDocument();
    await userEvent.setup().click(within(karen).getByRole('button', { name: 'Ver ficha' }));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'ch-karen' }));
  });
});
