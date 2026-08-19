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
  it('honours the system per-field guard: a stat stops at the preset maximum (regression 2026-08-18)', async () => {
    const u = userEvent.setup();
    mount('player');
    await u.type(screen.getByLabelText('Personaje'), 'Karen');
    await u.type(screen.getByLabelText('Concepto'), 'Líder');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    // Standard spread: 21 points, max 5 per stat. Points alone would allow a 7 here.
    const plus = within(stat('fortitude')).getByRole('button', { name: /^\+ / });
    for (let i = 0; i < 4; i++) await u.click(plus);
    expect(within(stat('fortitude')).getByText('5')).toBeInTheDocument();
    expect(plus).toBeDisabled();                       // capped by the preset, not by the budget…
    expect(screen.getByRole('status')).toHaveTextContent('10'); // …10 points still unspent
    // Dropping the spread re-clamps instead of stranding the draft above the new maximum.
    await u.selectOptions(screen.getByLabelText('Reparto de puntos'), 'mythic');
    for (let i = 0; i < 3; i++) await u.click(within(stat('fortitude')).getByRole('button', { name: /^\+ / }));
    expect(within(stat('fortitude')).getByText('8')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Reparto de puntos'), 'standard');
    expect(within(stat('fortitude')).getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Te sobran puntos');
  }, 40000);
  it('el canje de dones ya no puede empujar el borrador a números rojos (dueño 2026-08-19)', async () => {
    const u = userEvent.setup();
    mount('player');
    await u.type(screen.getByLabelText('Personaje'), 'Karen');
    await u.type(screen.getByLabelText('Concepto'), 'Líder');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.selectOptions(screen.getByLabelText('Reparto de puntos'), 'mythic');
    // Spend all 30 creation points without any stat above 6, so no re-clamp can rescue us.
    for (const [id, n] of [['fortitude', 5], ['combat', 5], ['will', 5], ['cunning', 5], ['subtlety', 2], ['presence', 1]] as const) {
      for (let i = 0; i < n; i++) await u.click(within(stat(id)).getByRole('button', { name: /^\+ / }));
    }
    expect(screen.getByRole('status')).toHaveTextContent('0');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));   // specialties…
    for (const f of plenilunio.sheetSchema.sections.flatMap(s => s.fields).filter(f => f.type === 'stat')) {
      await u.selectOptions(within(stat(f.id)).getByLabelText(/^Añadir Especialidad/), f.itemFields![0]!.options![0]!.value);
    }
    await u.click(screen.getByRole('button', { name: 'Continuar' }));   // …destiny…
    await u.click(screen.getByRole('button', { name: 'Continuar' }));   // …gifts
    // Sin un punto de creación libre, canjear no es una opción. Antes el guardia de este paso miraba
    // el presupuesto DE DONES —que un canje sólo SUBE— así que decía que sí siempre y dejaba los
    // puntos de creación en rojo; el dueño llegó así a un paso del que no se salía.
    const trade = screen.getByLabelText('Puntos canjeados por dones');
    expect(within(trade).getByRole('button', { name: /^\+ / })).toBeDisabled();
    // y Características sigue cuadrado, sin aviso ninguno
    await u.click(screen.getByRole('button', { name: /Características/ }));
    expect(screen.getByRole('status')).toHaveTextContent('0');
    expect(screen.queryByRole('alert')).toBeNull();
  }, 40000);
  it('un reparto que no cabe se ve desactivado en el desplegable, no rebota en silencio (review 2026-08-19)', async () => {
    const u = userEvent.setup();
    mount('player');
    await u.type(screen.getByLabelText('Personaje'), 'Karen');
    await u.type(screen.getByLabelText('Concepto'), 'Líder');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    const preset = screen.getByLabelText('Reparto de puntos');
    // Mítico (30, máx. 10) gastado hasta el último punto…
    await u.selectOptions(preset, 'mythic');
    for (const [id, n] of [['fortitude', 5], ['combat', 5], ['will', 5], ['cunning', 5], ['subtlety', 3]] as const) {
      for (let i = 0; i < n; i++) await u.click(within(stat(id)).getByRole('button', { name: /^\+ / }));
    }
    expect(screen.getByRole('status')).toHaveTextContent('0');
    // …no cabe en Estándar: el re-clamp a máx. 5 deja 26 gastados de 21. El guardia lo veta, y
    // antes el <select> volvía a «Mítico» sin decir nada — el mismo rebote mudo de los dones.
    expect(within(preset).getByRole('option', { name: /^Estándar/ })).toBeDisabled();
    expect(within(preset).getByRole('option', { name: /^Más humano/ })).toBeDisabled();
    expect(within(preset).getByRole('option', { name: /^Mítico/ })).toBeEnabled();      // el actual, nunca
    // y sigue siendo un callejón con salida: bajando características vuelve a caber
    // (tras el re-clamp a máx. 5, Estándar necesita bajar de 26 a 21 gastados)
    for (let i = 0; i < 5; i++) await u.click(within(stat('fortitude')).getByRole('button', { name: /^− |^- / }));
    await u.click(within(stat('subtlety')).getByRole('button', { name: /^− |^- / }));
    expect(within(preset).getByRole('option', { name: /^Estándar/ })).toBeEnabled();
    await u.selectOptions(preset, 'standard');
    expect(preset).toHaveValue('standard');
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
