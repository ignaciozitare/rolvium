import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { fakeCharactersRepo } from '../../../../tests/helpers/fakes';
import { useCharacterSheet } from './useCharacterSheet';
import { ProgressionPanel } from './ProgressionPanel';

async function mount(enabled: boolean) {
  const repo = fakeCharactersRepo();
  const hook = renderHook(() => useCharacterSheet('ch-karen', repo, 10));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  const Host = () => <ProgressionPanel state={hook.result.current} enabled={enabled} />;
  const r = renderWithProviders(<Host />);
  return { repo, rerender: () => r.rerender(<Host />) };
}

describe('<ProgressionPanel>', () => {
  it('enabled: shows xp, costs per stat, applies +1 with origin progression; blocks unaffordable', async () => {
    const u = userEvent.setup();
    const { repo, rerender } = await mount(true);
    expect(screen.getByText('Mejoras abiertas por el director.')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    const rows = screen.getByRole('region', { name: 'Características' });
    expect(within(rows).getAllByRole('button', { name: '+1 · 20 px' }).length).toBe(6);
    expect(within(rows).getByRole('button', { name: '+1 · 40 px' })).toBeDisabled(); // presence 5→6 costs 40 > 24
    await u.click(within(rows).getAllByRole('button', { name: '+1 · 20 px' })[0]!);
    await waitFor(() => expect(repo.updates.some(x => x.origin === 'progression')).toBe(true));
    const p = repo.updates.find(x => x.origin === 'progression')!.patch;
    expect(p.xp).toBe(4); expect((p.data?.fortitude as { value: number }).value).toBe(5);
    rerender();
    // gifts: level up costs 10 > 4 left → disabled; new specialty flow
    expect(screen.getByRole('button', { name: '+1 · 10 px' })).toBeDisabled();
    await u.selectOptions(within(screen.getByRole('region', { name: 'Nueva especialidad' })).getByLabelText('Características'), 'combat');
    await u.selectOptions(within(screen.getByRole('region', { name: 'Nueva especialidad' })).getByLabelText('Nueva especialidad'), 'combat.knives');
    expect(screen.getByRole('button', { name: 'Añadir · 10 px' })).toBeDisabled();
  });
  it('blocked: shows the reason and disables every action', async () => {
    await mount(false);
    expect(screen.getByRole('status')).toHaveTextContent('El director tiene las mejoras cerradas');
    expect(screen.getAllByRole('button').every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
