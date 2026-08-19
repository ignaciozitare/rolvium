import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import { fakeRollLog, ROLL_COMBAT, ROLL_FREE, ROLL_SETBACK } from '../../../../tests/helpers/fakes';
import { RollLog } from './RollLog';

describe('<RollLog>', () => {
  it('renders the recent rolls (title, score, dice with tones / shared gold, degree, notices, visibility chip)', async () => {
    const log = fakeRollLog();
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={log} />);
    const list = await screen.findByRole('list', { name: 'Registro de tiradas' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // se leen como un chat: la más reciente abajo del todo
    const combat = items.at(-1)!;
    expect(within(combat).getByText('Combate')).toBeInTheDocument();
    expect(within(combat).getByText('7—1')).toBeInTheDocument();
    const dice = combat.querySelectorAll('.dc-die');
    expect(dice).toHaveLength(8);
    expect(dice[1]).toHaveClass('triumph');
    expect(dice[4]).toHaveClass('shared');
    expect(dice[7]).toHaveClass('fumble');
    expect(within(combat).getByText('vs')).toBeInTheDocument();
    expect(within(combat).getByText('Lo consigue de forma absoluta y queda en posición ventajosa.')).toBeInTheDocument();
    expect(within(combat).getByText('+1 Destino · Fortuna al máximo')).toHaveClass('gold');
    const setback = items.at(-2)!;
    expect(within(setback).getByText('Revés')).toHaveClass('blood');
    expect(within(setback).getByText('Director')).toHaveClass('dc-vis');
    const free = items.at(-3)!;
    expect(free).toHaveClass('free');
    expect(within(free).getByText('2D10 · Nix')).toBeInTheDocument();
    expect(within(free).getByText('13')).toBeInTheDocument();
  });
  it('las tiradas nuevas entran ABAJO (dedup) y el registro las sigue; estados vacío / error', async () => {
    const log = fakeRollLog([ROLL_FREE]);
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={log} />);
    await screen.findByText('2D10 · Nix');
    expect(log.subscribers).toBe(1);
    log.push(ROLL_SETBACK);
    log.push(ROLL_SETBACK);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.getAllByRole('listitem').at(-1)).toHaveAttribute('data-roll-id', 'roll-setback');
    document.body.innerHTML = '';
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={fakeRollLog([])} />);
    expect(await screen.findByText('Pulsa TIRAR en una característica, o usa el lanzador libre.')).toBeInTheDocument();
    document.body.innerHTML = '';
    const broken = fakeRollLog([ROLL_COMBAT]); broken.listRecent = async () => { throw new Error('rls'); };
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={broken} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cargar el registro.');
  });
});
