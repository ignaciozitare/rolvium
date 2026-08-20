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
  it('renders the system sheet, TIRAR sends poolFor request (with Destiny dice in hand + campaignId) and logs the summary; effects fall back to the client when the API did not apply them', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort({ summary: 'roll.degree.success.2', total: 2, effects: { patch: { destiny: 3, fortune: 3 } } });
    const { repo, onRolled } = await mount(true, rolls, { destinyDice: 2 });
    const stat = document.querySelector('[data-stat="combat"]') as HTMLElement;
    // El botón ya no tira: abre el desplegable (`.pen` «Mesa/Tiradas», columna 1) y se tira al confirmar.
    await u.click(within(stat).getByRole('button', { name: 'Tirar 6' })); // 4 + 2 destiny
    expect(rolls.requests).toHaveLength(0);
    const pop = await screen.findByRole('dialog', { name: 'Tirar · Combate' });
    expect(within(pop).getByText('tu Combate 4')).toBeInTheDocument();
    await u.click(within(pop).getByRole('button', { name: 'Tirar 6' }));
    await waitFor(() => expect(rolls.requests).toHaveLength(1));
    expect(rolls.requests[0]).toMatchObject({ systemId: 'plenilunio', characterId: 'ch-karen', campaignId: 'c1', sharedResources: { destiny: 2 } });
    expect(onRolled).toHaveBeenCalled();
    // El resumen de la tirada NO se repite dentro de la ficha: está en la barra de tiradas de la mesa,
    // que es donde lo lee todo el mundo (dueño, 2026-08-19). Aquí sólo queda el aviso de fallo.
    expect(screen.queryByText(/Combate · Lo consigue\./)).not.toBeInTheDocument();
    expect(document.querySelector('.ch-log')).toBeNull();
    // effects.patch applied with origin roll (client fallback: the fake API did not report effectsApplied)
    await waitFor(() => expect(repo.updates.some(x => x.origin === 'roll' && x.patch.data?.destiny === 3)).toBe(true));
  });
  it('when the API applied the effects, the sheet mirrors them (derived/health from the server) without saving again', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort({ summary: 'roll.degree.success.2', total: 2, effects: { destinyUp: true, patch: { destiny: 3, fortune: 3 } } }, { effectsApplied: true, sheet: { derived: { endurance: 99 }, health: 'healthy' } });
    const { repo, hook } = await mount(true, rolls);
    const stat = document.querySelector('[data-stat="combat"]') as HTMLElement;
    await u.click(within(stat).getByRole('button', { name: /Tirar/ }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Tirar/ }));
    await waitFor(() => expect(hook.result.current.data.destiny).toBe(3));
    expect(hook.result.current.character?.derived.endurance).toBe(99);
    expect(hook.result.current.dirty).toBe(false);
    expect(repo.updates.filter(x => x.origin === 'roll')).toHaveLength(0);
  });
  it('weapon attack + gift activation build action requests; failed roll shows an error line', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort(null);
    await mount(true, rolls);
    // Disparar abre el desplegable, con su alcance; activar un don sigue yendo directo (el `.pen` no lo diseña).
    await u.click(screen.getByRole('button', { name: /Disparar · Revólver magnum .44/ }));
    const pop = await screen.findByRole('dialog', { name: 'Disparar · Revólver magnum .44' });
    expect(within(pop).getByRole('button', { name: 'Medio · 3' })).toHaveAttribute('aria-pressed', 'true');
    // El magnum llega a alcance medio: largo y muy largo se ven, pero no se pueden elegir (p.96).
    expect(within(pop).getByRole('button', { name: 'Largo · 5' })).toBeDisabled();
    await u.click(within(pop).getByRole('button', { name: /Disparar · 4 dados/ }));
    await waitFor(() => expect(rolls.requests).toHaveLength(1));
    expect(rolls.requests[0]!.title).toBe('catalog.weapons.magnum44');
    expect(rolls.requests[0]!.options).toMatchObject({ range: 'medium', difficulty: 3 });
    // La tirada falló: el desplegable se queda abierto y lo dice, en vez de cerrarse en falso.
    expect((await screen.findAllByText('No se ha podido tirar. Inténtalo de nuevo.')).length).toBeGreaterThan(0);
    await u.keyboard('{Escape}');
    await u.click(screen.getByRole('button', { name: /Activar don · Furia de titán/ }));
    await waitFor(() => expect(rolls.requests).toHaveLength(2));
    expect(rolls.requests[1]!.options).toMatchObject({ giftId: 'titanFury' });
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
  /**
   * La ficha decía «Subir imagen: pronto» desde que se escribió. Ya no: el `<Sheet>` traía el enganche
   * `onImagePick` y `charactersRepo.uploadImage` sabía subir — sólo faltaba juntarlos (dueño, 2026-08-20).
   * Se fija el botón, y que NO aparezca en modo lectura: un avatar ajeno no se cambia.
   */
  it('el avatar se puede subir cuando se puede editar, y no cuando es de sólo lectura', async () => {
    await mount(true);
    const field = screen.getByLabelText('Avatar').parentElement as HTMLElement;
    expect(within(field).getByRole('button', { name: 'Subir imagen' })).toBeInTheDocument();
    expect(screen.queryByText(/pronto/i)).not.toBeInTheDocument();
    document.body.innerHTML = '';
    await mount(false);
    const ro = screen.getByLabelText('Avatar').parentElement as HTMLElement;
    expect(within(ro).queryByRole('button')).not.toBeInTheDocument();
  });
});
