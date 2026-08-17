import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { fakeCharactersRepo, fakeRollsPort } from '../../../../tests/helpers/fakes';
import { useCharacterSheet } from './useCharacterSheet';
import { CharacterSheetView } from './CharacterSheetView';

async function mount(canEdit = true, rolls = fakeRollsPort(), rollOptions?: Record<string, unknown>) {
  const repo = fakeCharactersRepo();
  const hook = renderHook(() => useCharacterSheet('ch-karen', repo, 10));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  const onRolled = vi.fn();
  const view = renderWithProviders(<Host />);
  function Host() { return <CharacterSheetView state={hook.result.current} canEdit={canEdit} rolls={rolls} onRolled={onRolled} {...(rollOptions ? { rollOptions } : {})} />; }
  return { repo, hook, onRolled, rerender: () => view.rerender(<Host />) };
}

describe('<CharacterSheetView>', () => {
  it('renders the system sheet, TIRAR sends poolFor request (with Destiny dice in hand) and logs the summary', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort({ summary: 'roll.degree.success.2', total: 2, effects: { patch: { destiny: 3, fortune: 3 } } });
    const { repo, onRolled } = await mount(true, rolls, { destinyDice: 2 });
    const stat = document.querySelector('[data-stat="combat"]') as HTMLElement;
    await u.click(within(stat).getByRole('button', { name: 'Tirar 6' })); // 4 + 2 destiny
    await waitFor(() => expect(rolls.requests).toHaveLength(1));
    expect(rolls.requests[0]).toMatchObject({ systemId: 'plenilunio', characterId: 'ch-karen', sharedResources: { destiny: 2 } });
    expect(onRolled).toHaveBeenCalled();
    expect(await screen.findByText(/Combate · Lo consigue\./)).toBeInTheDocument();
    // effects.patch applied with origin roll
    await waitFor(() => expect(repo.updates.some(x => x.origin === 'roll' && x.patch.data?.destiny === 3)).toBe(true));
  });
  it('weapon attack + gift activation build action requests; failed roll shows an error line', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort(null);
    await mount(true, rolls);
    await u.click(screen.getByRole('button', { name: /Disparar · Revólver magnum .44/ }));
    await u.click(screen.getByRole('button', { name: /Activar don · Furia de titán/ }));
    await waitFor(() => expect(rolls.requests).toHaveLength(2));
    expect(rolls.requests[0]!.title).toBe('catalog.weapons.magnum44');
    expect(rolls.requests[1]!.options).toMatchObject({ giftId: 'titanFury' });
    expect((await screen.findAllByText('No se ha podido tirar. Inténtalo de nuevo.')).length).toBeGreaterThan(0);
  });
  it('Recibir daño applies engine.applyDamage immediately with origin damage; hidden when read-only', async () => {
    const u = userEvent.setup();
    const { repo } = await mount(true);
    await u.clear(screen.getByLabelText('Daño')); await u.type(screen.getByLabelText('Daño'), '9');
    await u.click(screen.getByRole('button', { name: 'Recibir daño' }));
    await waitFor(() => expect(repo.updates.some(x => x.origin === 'damage')).toBe(true));
    const d = repo.updates.find(x => x.origin === 'damage')!.patch;
    expect(d.data?.resistance).toBe(21 - (9 - 1)); // protection 1 (leather jacket)
    expect(d.health).toBe('bruised'); // 8 ≥ endurance 7 → one level
    document.body.innerHTML = '';
    await mount(false);
    expect(screen.queryByRole('button', { name: 'Recibir daño' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Personaje')).toBeDisabled();
  });
});
