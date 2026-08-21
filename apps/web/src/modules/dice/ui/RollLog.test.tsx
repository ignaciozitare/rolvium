import { describe, it, expect } from 'vitest';
import { plenilunio, poolFor, resolve, newSheet } from '@rolvium/system-plenilunio';
import type { Roll } from '../domain/entities/Roll';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import { fakeRollLog, ROLL_COMBAT, ROLL_FREE, ROLL_SETBACK } from '../../../../tests/helpers/fakes';
import { RollLog } from './RollLog';

/**
 * Una tirada de verdad, hecha con el motor del sistema (`poolFor` → `resolve`) y no a mano: el
 * desglose se lee de lo que `resolve` guardó, así que probarlo contra un `detail` inventado no
 * demostraría nada.
 */
function karenRoll(): Roll {
  const sheet = { ...newSheet(), name: 'Karen Sinclair', combat: { value: 4, specialties: ['combat.shortWeapons'] }, health: 'wounded', armour: 'bulletproofVest', destiny: 3 };
  const request = poolFor(sheet, { stat: 'combat', options: { difficulty: 2, specialty: false, armourPenalty: 2, extraDice: 0 } });
  const dice = [[6, 1, 4], [4, 4]];
  return { ...ROLL_COMBAT, id: 'roll-karen', request, dice, result: resolve(request, dice, sheet) };
}

describe('<RollLog>', () => {
  it('la cabecera dice quién tiró EN LA FICCIÓN: el personaje, no la cuenta', async () => {
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={fakeRollLog([ROLL_COMBAT])} />);
    const entry = await screen.findByRole('listitem');
    expect(within(entry).getByText('Karen Sinclair')).toHaveClass('dc-entry-who');
    expect(within(entry).queryByText('Karen «K»')).toBeNull();
    expect(within(entry).getByText('Combate')).toBeInTheDocument();
    // El avatar lleva las iniciales del PERSONAJE, no la cara de la cuenta; quién tiró de verdad va en el `title`.
    expect(within(entry).getByText('KS')).toBeInTheDocument();
    expect(within(entry).getByTitle('Karen Sinclair · tirada de Karen «K»')).toBeInTheDocument();
  });
  it('sin personaje (tirada libre) la entrada se queda como estaba y no lleva desglose', async () => {
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={fakeRollLog([ROLL_FREE])} />);
    const entry = await screen.findByRole('listitem');
    expect(entry.querySelector('.dc-entry-who')).toBeNull();
    expect(within(entry).queryByRole('tooltip')).toBeNull();
    expect(entry).not.toHaveAttribute('tabindex');
  });
  it('el desglose cuenta de dónde salieron los dados, lo que se aplicó y cómo cerró', async () => {
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={fakeRollLog([karenRoll()])} />);
    const entry = await screen.findByRole('listitem');
    // se llega con el teclado, y el lector lo encuentra por `aria-describedby`
    expect(entry).toHaveAttribute('tabindex', '0');
    const tip = within(entry).getByRole('tooltip');
    expect(entry).toHaveAttribute('aria-describedby', tip.id);
    expect(within(tip).getByText('Cómo salió esta tirada')).toBeInTheDocument();
    expect(within(tip).getByText('Manual · p.82, p.83, p.84 y p.98')).toBeInTheDocument();
    // la primera línea NO repite su página: ya encabeza la referencia de arriba
    expect(within(tip).getByText('4 Combate − 1 por herido = 3 dados')).toBeInTheDocument();
    expect(within(tip).getByText('Reto a dificultad 2 (p.84)')).toBeInTheDocument();
    expect(within(tip).getByText('Lo que se aplicó')).toHaveClass('dc-tip-label');
    expect(within(tip).getByText('Especialidad «Armas cortas» — no aplicada por el director (p.83)')).toBeInTheDocument();
    expect(within(tip).getByText('Chaleco antibalas — salió un fracaso, así que 1 triunfo pasa a éxito normal (p.98)')).toBeInTheDocument();
    expect(within(tip).getByText('2 éxitos contra 2 de dificultad = resultado ambiguo')).toHaveClass('dc-tip-verdict');
  });
  it('sin lo que la ficha sabía (tiradas viejas) el desglose calla esas líneas en vez de inventarlas', async () => {
    renderWithProviders(<RollLog campaignId="c1" system={plenilunio} log={fakeRollLog([ROLL_COMBAT])} />);
    const tip = within(await screen.findByRole('listitem')).getByRole('tooltip');
    expect(within(tip).getByText('4 dados')).toBeInTheDocument();
    expect(within(tip).queryByText('Lo que se aplicó')).toBeNull();
    expect(within(tip).getByText('7 éxitos contra 1 de dificultad = grado de éxito 6')).toBeInTheDocument();
  });
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
