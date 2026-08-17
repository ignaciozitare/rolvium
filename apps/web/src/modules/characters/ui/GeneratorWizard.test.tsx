import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { fakeCampaignsRepo, fakeCharactersRepo } from '../../../../tests/helpers/fakes';
import { GeneratorWizard } from './GeneratorWizard';

function mount(role: 'dm' | 'player') {
  const repo = fakeCharactersRepo([]);
  const campaigns = fakeCampaignsRepo();
  campaigns.listMembers = async () => [{ campaignId: 'c1', userId: 'u-pip', name: 'Pip', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' }];
  const onCreated = vi.fn(); const onCancel = vi.fn();
  renderWithProviders(<GeneratorWizard campaignId="c1" system={plenilunio} role={role} repo={repo} campaigns={campaigns} onCancel={onCancel} onCreated={onCreated} />);
  return { repo, onCreated, onCancel };
}
const stat = (id: string) => document.querySelector(`[data-stat="${id}"]`) as HTMLElement;

describe('<GeneratorWizard>', () => {
  it('walks the system steps with budget + validation and creates the character with finalizeDraft', async () => {
    const u = userEvent.setup();
    const { repo, onCreated } = mount('player');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan el nombre y el concepto');
    await u.type(screen.getByLabelText('Personaje'), 'Karen');
    await u.type(screen.getByLabelText('Concepto'), 'Líder');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // stats: 21 points, 7 already spent (1 each) → 14 left
    expect(screen.getByRole('status')).toHaveTextContent('Puntos');
    expect(screen.getByRole('status')).toHaveTextContent('14');
    for (const [id, n] of [['fortitude', 3], ['combat', 3], ['will', 2], ['cunning', 2], ['presence', 4]] as const) {
      for (let i = 0; i < n; i++) await u.click(within(stat(id)).getByRole('button', { name: /^\+ / }));
    }
    expect(screen.getByRole('status')).toHaveTextContent('0');
    // budget exhausted → + disabled
    expect(within(stat('culture')).getByRole('button', { name: /^\+ / })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // specialties: one per stat
    expect(screen.getByRole('alert')).toHaveTextContent('Elige una especialidad');
    for (const f of plenilunio.sheetSchema.sections.flatMap(s => s.fields).filter(f => f.type === 'stat')) {
      const sel = within(stat(f.id)).getByLabelText(/^Añadir Especialidad/);
      await u.selectOptions(sel, f.itemFields![0]!.options![0]!.value);
    }
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // destiny (3 default) → continue; gifts: 3 points → add one gift and raise to level 3
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: /Añadir · Dones/ }));
    await u.click(screen.getByRole('button', { name: '+ Nivel' })); await u.click(screen.getByRole('button', { name: '+ Nivel' }));
    expect(screen.getByRole('status')).toHaveTextContent('0');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // summary read-only + finish
    expect(screen.getByLabelText('Personaje')).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Crear personaje' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const input = repo.created[0]!;
    expect(input).toMatchObject({ campaignId: 'c1', name: 'Karen', concept: 'Líder', kind: 'pc' });
    expect(input.ownerId).toBeUndefined();
    expect(input.data.fortune).toBe(3); expect(input.data.resistance).toBe((4 + 3) * 3); expect(input.health).toBe('healthy');
  }, 40000);
  it('DM sees kind + assign-to, and «Atrás»/«Cancelar» work', async () => {
    const u = userEvent.setup();
    const { onCancel } = mount('dm');
    expect(screen.getByText('Solo director')).toBeInTheDocument();
    await u.selectOptions(await screen.findByLabelText('Asignar a'), 'u-pip');
    await u.click(screen.getByRole('button', { name: 'PNJ' }));
    expect(screen.queryByLabelText('Asignar a')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
