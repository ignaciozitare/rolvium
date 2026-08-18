import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { TablePage } from '@/modules/table/ui/TablePage';
import type { TablePort } from '@/modules/table/domain/ports/TablePort';
import type { TableSnapshot } from '@/modules/table/domain/entities/Table';
import { fakeAuthRepo, fakeCharactersRepo, fakeMapsRepo, fakeVisionPort, fakeRollsPort, fakeRollLog, PLAYER_USER, ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, ROLL_FREE, SCENE_WAREHOUSE, TOKEN_KAREN } from '../helpers/fakes';
import { canTake, tabsFor } from '@/modules/table/domain/useCases/tableRules';

const GM = { ...ADMIN_USER, id: 'dm-1', name: 'Laura', role: 'game_master' };

function fakeTableRepo(role: 'dm' | 'player', value = 7): TablePort & { snap: TableSnapshot } {
  const snap: TableSnapshot = {
    campaign: { ...CAMPAIGN_MINE, myRole: role },
    members: [
      { campaignId: 'c1', userId: 'dm-1', name: 'Laura', avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' },
      { campaignId: 'c1', userId: 'u-pip', name: 'Pip', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' },
      { campaignId: 'c1', userId: 'u-nix', name: 'Dani', avatarUrl: null, role: 'player', characterId: null, joinedAt: '' },
    ],
    resources: { destiny: { value, max: 10, perTakeMax: 5, hands: {} } },
    presence: [{ userId: 'dm-1', devices: 1 }, { userId: 'u-pip', devices: 2 }],
    activeSceneId: null,
  };
  const st = () => snap.resources.destiny!;
  return {
    snap,
    load: async () => snap,
    subscribe: () => () => {},
    takeResource: async (_c, _r, n) => {
      const hand = st().hands['u-pip'] ?? 0;
      if (st().value < n) return { error: 'pool_empty' };
      if (hand + n > st().perTakeMax) return { error: 'per_take_max' };
      st().value -= n; st().hands['u-pip'] = hand + n; return { state: { ...st() } };
    },
    returnResource: async () => { const h = st().hands['u-pip'] ?? 0; st().value += h; st().hands['u-pip'] = 0; return { state: { ...st() } }; },
    resetResource: async () => { st().value = 10; st().hands = {}; return { state: { ...st() } }; },
  };
}

function mount(user: typeof PLAYER_USER, repo: TablePort, chars = fakeCharactersRepo([CHARACTER_KAREN]), rolls = fakeRollsPort(), rollLog = fakeRollLog(), maps = fakeMapsRepo(), vision = fakeVisionPort()) {
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(user)}><Routes><Route path="/table/:id" element={<TablePage repo={repo} charactersRepo={chars} rolls={rolls} rollLog={rollLog} maps={maps} vision={vision} />} /></Routes></AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/table/c1'] } } },
  );
  return { rolls, rollLog, maps, vision };
}

describe('table: rules', () => {
  it('tabs depend on the role', () => {
    expect(tabsFor('player')).toEqual(['sheet', 'scene', 'improve', 'create']);
    expect(tabsFor('dm')).toContain('group');
  });
  it('only players take dice, up to the per-take max, while the pool has dice', () => {
    const def = { id: 'destiny', label: 'x', max: 10, initial: 10, perTakeMax: 5, whoCanTake: 'player' as const, whoCanReset: 'dm' as const };
    expect(canTake(def, { value: 3, max: 10, perTakeMax: 5, hands: {} }, 'player', 'u')).toBe(true);
    expect(canTake(def, { value: 3, max: 10, perTakeMax: 5, hands: {} }, 'dm', 'u')).toBe(false);
    expect(canTake(def, { value: 0, max: 10, perTakeMax: 5, hands: {} }, 'player', 'u')).toBe(false);
    expect(canTake(def, { value: 3, max: 10, perTakeMax: 5, hands: { u: 5 } }, 'player', 'u')).toBe(false);
  });
});

describe('table: page', () => {
  it('player sees the themed table, connected people and takes/returns Destiny dice', async () => {
    const repo = fakeTableRepo('player');
    mount(PLAYER_USER, repo);
    const u = userEvent.setup();
    expect(await screen.findByText('PLENILUNIO')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ficha', pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'El grupo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reiniciar' })).not.toBeInTheDocument();
    // Dani is absent (not in presence)
    expect(screen.getByText('AUSENTE')).toBeInTheDocument();
    // take one die
    const dice = screen.getAllByRole('button', { name: 'Coger un dado' });
    await u.click(dice[0]!);
    await waitFor(() => expect(screen.getByText('6/10')).toBeInTheDocument());
    expect(screen.getByText('+1')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Devolver' }));
    await waitFor(() => expect(screen.getByText('7/10')).toBeInTheDocument());
  });

  it('DM sees group/bestiary tabs, cannot take dice, can reset', async () => {
    const repo = fakeTableRepo('dm', 2);
    mount(GM, repo);
    const u = userEvent.setup();
    expect(await screen.findByRole('button', { name: 'El grupo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestiario' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Coger un dado' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Reiniciar' }));
    await waitFor(() => expect(screen.getByText('10/10')).toBeInTheDocument());
  });

  it('non-member sees the notice', async () => {
    const repo = fakeTableRepo('player'); repo.load = async () => null;
    mount(PLAYER_USER, repo);
    expect(await screen.findByText('No formas parte de esta campaña.')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('Ficha tab renders my sheet; DM «El grupo» → «Ver ficha» opens that sheet; Mejorar and Crear personaje tabs render', async () => {
    const u = userEvent.setup();
    mount(GM, fakeTableRepo('dm'));
    await u.click(await screen.findByRole('button', { name: 'El grupo' }));
    const karen = await screen.findByRole('article', { name: 'Karen «K»' });
    await u.click(within(karen).getByRole('button', { name: 'Ver ficha' }));
    expect(await screen.findByLabelText('Personaje')).toHaveValue('Karen «K»');
    expect(screen.getByRole('button', { name: 'Ficha', pressed: true })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Mejorar' }));
    expect(await screen.findByText('Mejorar con experiencia')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Crear personaje' }));
    expect(await screen.findByText('Solo director')).toBeInTheDocument();
    document.body.innerHTML = '';
    mount(PLAYER_USER, fakeTableRepo('player'));
    expect(await screen.findByLabelText('Personaje')).toHaveValue('Karen «K»');
  });

  it('«Escena» tab mounts the maps hexagon with the snapshot\'s active scene (player follows the DM\'s choice; no scene → the notice)', async () => {
    const u = userEvent.setup();
    const empty = fakeTableRepo('player');
    mount(PLAYER_USER, empty);
    await u.click(await screen.findByRole('button', { name: 'Escena' }));
    expect(await screen.findByText('El director aún no ha activado ninguna escena.')).toBeInTheDocument();
    document.body.innerHTML = '';
    const live = fakeTableRepo('player');
    live.snap.activeSceneId = SCENE_WAREHOUSE.id;
    const { maps } = mount(PLAYER_USER, live, fakeCharactersRepo([CHARACTER_KAREN]), fakeRollsPort(), fakeRollLog(), fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: [TOKEN_KAREN] }));
    await u.click(await screen.findByRole('button', { name: 'Escena' }));
    // the scene header is gone in slice 3: the name rides the canvas label
    expect(await screen.findByText(new RegExp(SCENE_WAREHOUSE.name))).toBeInTheDocument();
    const canvas = screen.getByRole('application', { name: 'Lienzo de la escena' });
    expect(await within(canvas).findByRole('img', { name: 'Token Karen «K»' })).toBeInTheDocument();
    await waitFor(() => expect(maps.subscribers).toBe(1));
  });

  it('side panel: el Registro lista las tiradas en vivo; el lanzador se abre desde la barra de la escena y tira en esta campaña', async () => {
    const u = userEvent.setup();
    const table = fakeTableRepo('player');
    table.snap.activeSceneId = SCENE_WAREHOUSE.id;   // el lanzador vive en la barra de la escena, así que hace falta escena
    const { rolls, rollLog } = mount(PLAYER_USER, table, fakeCharactersRepo([CHARACTER_KAREN]), fakeRollsPort({ summary: 'roll.free', total: 9 }), fakeRollLog([]), fakeMapsRepo({ scenes: [SCENE_WAREHOUSE] }));
    expect(await screen.findByText('Pulsa TIRAR en una característica, o usa el lanzador libre.')).toBeInTheDocument();
    rollLog.push(ROLL_FREE);
    expect(await screen.findByText('2D10 · Nix')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Lanzador de dados' })).not.toBeInTheDocument();
    // ya no hay botón en el panel: los dados son la primera herramienta de la escena
    await u.click(screen.getByRole('button', { name: 'Escena' }));
    const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
    await u.click(within(bar).getByRole('button', { name: 'Lanzador de dados' }));
    const roller = await screen.findByRole('dialog', { name: 'Lanzador de dados' });
    expect(within(bar).getByRole('button', { name: 'Lanzador de dados', pressed: true })).toBeInTheDocument();
    await u.click(within(roller).getByRole('button', { name: 'Tirar 2 D10' }));
    await waitFor(() => expect(rolls.requests).toHaveLength(1));
    expect(rolls.requests[0]).toMatchObject({ campaignId: 'c1', kind: 'free', groups: [{ count: 2, sides: 10 }] });
    await u.click(within(roller).getByRole('button', { name: 'Cerrar el lanzador' }));
    expect(screen.queryByRole('dialog', { name: 'Lanzador de dados' })).not.toBeInTheDocument();
  });
});

/**
 * Where the table chrome lives after slice 3 moved it to give the map its height back
 * (specs/modules/maps/SPEC.md § «Rebanada 3»). The owner asked for each of these by hand, and they are
 * exactly the kind of thing a refactor undoes without noticing.
 */
describe('table chrome — dónde vive cada cosa tras la rebanada 3', () => {
  it('las pestañas viven en la barra de la plataforma, junto a los conectados, y no en una fila propia', async () => {
    mount(PLAYER_USER, fakeTableRepo('player'));
    await screen.findByRole('banner');
    const nav = screen.getByRole('navigation', { name: 'Pestañas de la mesa' });
    expect(nav.closest('.tb-rvbar')).not.toBeNull();
    expect(within(nav).getByRole('button', { name: 'Escena' })).toBeInTheDocument();
  });

  it('la Reserva de Destino se sienta en la cabecera blanca, junto al nombre del sistema', async () => {
    mount(PLAYER_USER, fakeTableRepo('player'));
    const head = await screen.findByRole('banner');
    expect(within(head).getByText('Reserva de Destino')).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Ocultar la reserva' })).toBeInTheDocument();
  });

  it('los conectados van en la barra de la plataforma, arriba del todo, y ya no en la cabecera de la mesa', async () => {
    mount(PLAYER_USER, fakeTableRepo('player'));
    await screen.findByRole('banner');
    const people = screen.getByRole('list', { name: 'Conectados' });
    expect(people.closest('.tb-rvbar')).not.toBeNull();
    expect(people.closest('.tb-head')).toBeNull();
  });

  it('la escena ya no lleva barra de opciones bajo el mapa: «Solo director» va encima del lienzo', async () => {
    const u = userEvent.setup();
    const live = fakeTableRepo('dm');
    live.snap.activeSceneId = SCENE_WAREHOUSE.id;
    mount(ADMIN_USER, live, fakeCharactersRepo([CHARACTER_KAREN]), fakeRollsPort(), fakeRollLog(), fakeMapsRepo({ scenes: [SCENE_WAREHOUSE] }));
    await u.click(await screen.findByRole('button', { name: 'Escena' }));
    const canvas = await screen.findByRole('application', { name: 'Lienzo de la escena' });
    const stage = canvas.closest('.mp-stage');
    expect(stage?.querySelector('.mp-dmtag')).not.toBeNull();
    expect(document.querySelector('.mp-dmbar')).toBeNull();
  });
});
