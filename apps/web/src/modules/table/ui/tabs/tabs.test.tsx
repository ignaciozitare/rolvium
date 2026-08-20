import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { fakeCharactersRepo, fakeRollsPort, CHARACTER_KAREN, CHARACTER_OTHER, CHARACTER_UNASSIGNED, PLAYER_USER } from '../../../../../tests/helpers/fakes';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import { SheetTab, CreateTab } from './SheetTab';
import { GroupTab } from './GroupTab';

const MEMBERS: CampaignMember[] = [
  { campaignId: 'c1', userId: 'dm-1', name: 'Laura', avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' },
  { campaignId: 'c1', userId: 'u-pip', name: 'Pip', avatarUrl: 'https://x/pip.png', role: 'player', characterId: 'ch-karen', joinedAt: '' },
  { campaignId: 'c1', userId: 'u-nix', name: 'Dani', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' },
];

describe('table tabs — sheet / create / group', () => {
  it('SheetTab shows my sheet with roll options from the table, «Abrir ficha aparte»; empty state → create', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN]);
    const rolls = fakeRollsPort();
    const onOpenCreate = vi.fn();
    renderWithProviders(<SheetTab campaignId="c1" system={plenilunio} role="player" userId={PLAYER_USER.id} repo={repo} rolls={rolls} rollOptions={{ destinyDice: 1 }} onOpenCreate={onOpenCreate} />);
    expect(await screen.findByLabelText('Personaje')).toHaveValue('Karen «K»');
    expect(screen.getByRole('link', { name: 'Abrir ficha aparte' })).toHaveAttribute('href', '/characters/ch-karen');
    const u1 = userEvent.setup();
    await u1.click(within(document.querySelector('[data-stat="combat"]') as HTMLElement).getByRole('button', { name: 'Tirar 5' }));
    // El botón abre el desplegable de tirar y se tira al confirmar (`.pen` «Mesa/Tiradas», columna 1);
    // los dados de reserva que ya llevas en la mano siguen viajando con la petición.
    await u1.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tirar 5' }));
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
  it('CreateTab hosts the generator', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN]);
    renderWithProviders(<CreateTab campaignId="c1" system={plenilunio} role="player" repo={repo} onCancel={() => {}} onCreated={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  });

  /**
   * «Mejorar» dejó de ser pestaña y bajó a la barra de la ficha, al lado de «Abrir ficha aparte»
   * (dueño, 2026-08-19: «quedamos hace varias sesiones que lo bajarías»). El panel sale sobre la
   * ficha, se cierra con el mismo botón, y con la progresión cerrada en la campaña sale bloqueado.
   */
  it('«Mejorar» es un botón de la ficha: abre y cierra el panel, y respeta progressionEnabled', async () => {
    const repo = fakeCharactersRepo([CHARACTER_KAREN]);
    const u = userEvent.setup();
    renderWithProviders(<SheetTab campaignId="c1" system={plenilunio} role="player" userId={PLAYER_USER.id} repo={repo} progressionEnabled={false} onOpenCreate={() => {}} />);
    expect(await screen.findByLabelText('Personaje')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Mejorar' });
    expect(screen.queryByText(/las mejoras cerradas/)).not.toBeInTheDocument();
    await u.click(btn);
    expect(await screen.findByText(/las mejoras cerradas/)).toBeInTheDocument();
    await u.click(btn);
    expect(screen.queryByText(/las mejoras cerradas/)).not.toBeInTheDocument();
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

/**
 * La ficha abierta desde «El grupo» (dueño, 2026-08-21: «necesitamos un goback que te tiene que devolver
 * a el grupo»). El director entraba en la ficha de un jugador y se quedaba dentro: ni cartel de quién era
 * ni puerta de salida, y la pestaña «Ficha» seguía enseñando a esa persona.
 */
describe('SheetTab — entrar desde «El grupo» y poder volver', () => {
  it('con `onBack` ofrece la vuelta y dice de quién es la ficha', async () => {
    const onBack = vi.fn();
    renderWithProviders(
      <SheetTab campaignId="c1" system={plenilunio} role="dm" userId="dm-1"
                repo={fakeCharactersRepo([CHARACTER_KAREN])} characterId="ch-karen"
                onOpenCreate={vi.fn()} onBack={onBack} />,
    );
    const back = await screen.findByRole('button', { name: /Volver al grupo/ });
    expect(screen.getByText(/Estás viendo la ficha de/)).toBeInTheDocument();
    await userEvent.setup().click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('sin `onBack` (mi propia ficha) no pinta ni la vuelta ni el cartel', async () => {
    renderWithProviders(
      <SheetTab campaignId="c1" system={plenilunio} role="player" userId={PLAYER_USER.id}
                repo={fakeCharactersRepo([CHARACTER_KAREN])} onOpenCreate={vi.fn()} />,
    );
    await screen.findByLabelText('Personaje');
    expect(screen.queryByRole('button', { name: /Volver al grupo/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Estás viendo la ficha de/)).not.toBeInTheDocument();
  });
});
