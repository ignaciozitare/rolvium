import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor, within } from '../helpers/render';
import { Route, Routes } from 'react-router-dom';
import type { User } from '@rolvium/shared-types';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { TablePage } from '@/modules/table/ui/TablePage';
import type { TablePort } from '@/modules/table/domain/ports/TablePort';
import type { TableSnapshot } from '@/modules/table/domain/entities/Table';
import type { BestiaryPort } from '@/modules/bestiary/domain/ports/BestiaryPort';
import type { ToolbarOrderPort } from '@/modules/maps/domain/ports/ToolbarOrderPort';
import type { ToolbarOrder } from '@/modules/maps/domain/useCases/toolbarRules';
import { ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, SCENE_WAREHOUSE, fakeAttacks, fakeAuthRepo, fakeCharactersRepo, fakeMapsRepo, fakeRollLog, fakeRollRequests, fakeRollsPort, fakeVisionPort } from '../helpers/fakes';

/**
 * 🧲 Pin de la corrección del dueño del 2026-09-12 (specs/modules/maps/SPEC.md § «La barra se ordena arrastrando,
 * y el orden lo pone el admin para todos»): «*el orden lo pone el admin y es para todos*».
 *
 * Quien ordena la barra es quien tiene el permiso `admin.manage_settings` — NO el director de la mesa. Lo decide
 * el caparazón (`TablePage`: `canOrderToolbar={can('manage_settings')}`) y baja por parámetro, igual que
 * `canManageTextures`. Si alguien lo cambiara por `isDm`, o por `canUse(...)`, ni el typecheck ni los tests de
 * `<Toolbar>` y `<SceneTab>` (que reciben el permiso ya resuelto) se enterarían. De ahí este pin, que monta la
 * mesa entera con tres usuarios distintos.
 */

/** La directora de la mesa, sin ningún permiso de administración: dirige, pero la barra no es suya. */
const DIRECTORA: User = { ...ADMIN_USER, id: 'dm-1', name: 'Laura', roleId: 'r-gm', role: 'game_master', permissions: { modules: [], admin: {} } };
/** La misma directora con el permiso concreto, SIN ser admin: es el permiso lo que manda, no el rol. */
const DIRECTORA_CON_AJUSTES: User = { ...DIRECTORA, permissions: { modules: [], admin: { manage_settings: true } } };

function fakeTableRepo(user: User): TablePort {
  const snap: TableSnapshot = {
    campaign: { ...CAMPAIGN_MINE, myRole: 'dm', dmId: user.id, dmName: user.name },
    members: [{ campaignId: 'c1', userId: user.id, name: user.name, avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' }],
    resources: { destiny: { value: 7, max: 10, perTakeMax: 5, hands: {} } },
    presence: [{ userId: user.id, devices: 1 }],
    activeSceneId: SCENE_WAREHOUSE.id,
  };
  return {
    load: async () => snap, subscribe: () => () => {},
    takeResource: vi.fn(), returnResource: vi.fn(), resetResource: vi.fn(),
  };
}

const fakeBestiaryRepo = (): BestiaryPort => ({ listForCampaign: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), remove: vi.fn(), uploadToken: vi.fn() });

/** El orden de la barra de mentira, como el de `SceneTab.test.tsx`: lo que el admin guardó para todos. */
function fakeToolbarOrder(saved: ToolbarOrder | null = null): ToolbarOrderPort & { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> } {
  return { load: vi.fn(async () => saved), save: vi.fn(async () => undefined) };
}

function mount(user: User, port: ToolbarOrderPort): void {
  const attacks = fakeAttacks();
  const requests = fakeRollRequests();
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(user)}>
      <Routes><Route path="/table/:id" element={
        <TablePage repo={fakeTableRepo(user)} charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} rolls={fakeRollsPort()} rollLog={fakeRollLog()}
                   maps={fakeMapsRepo({ scenes: [SCENE_WAREHOUSE] })} vision={fakeVisionPort()} bestiary={fakeBestiaryRepo()}
                   attacks={attacks} attackWatch={attacks} rollRequests={requests} rollRequestWatch={requests} toolbarOrder={port} />
      } /></Routes>
    </AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/table/c1'] } } },
  );
}

const barra = () => screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
const nombres = (bar: HTMLElement) => within(bar).getAllByRole('button').map(b => b.getAttribute('aria-label'));
const slot = (bar: HTMLElement, name: string): HTMLElement => within(bar).getByRole('button', { name }).closest('.mp-slot') as HTMLElement;
const arrastra = (bar: HTMLElement, from: string, to: string): void => {
  const data = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: () => from };
  fireEvent.dragStart(slot(bar, from), { dataTransfer: data });
  fireEvent.dragOver(slot(bar, to), { dataTransfer: data });
  fireEvent.drop(slot(bar, to), { dataTransfer: data });
};

describe('regresión · la barra la ordena quien administra los ajustes, no el director', () => {
  it('la directora sin el permiso ve el orden guardado para todos, pero no arrastra nada', async () => {
    const port = fakeToolbarOrder({ dm: ['placePc', 'light', 'wall', 'background', 'mask', 'sep', 'reveal', 'hide', 'sep', 'encounter'] });
    mount(DIRECTORA, port);
    const bar = await barra();
    // El orden lo lee la mesa por el puerto que le dio el caparazón, y se pinta aunque ella no pueda tocarlo.
    await waitFor(() => expect(nombres(bar).slice(-8)[0]).toBe('Colocar PJ'));
    expect(port.load).toHaveBeenCalled();
    expect(slot(bar, 'Pincel')).toHaveAttribute('draggable', 'false');
    arrastra(bar, 'Luz de ambiente', 'Ocultar');
    expect(port.save).not.toHaveBeenCalled();
    expect(nombres(bar).slice(-8)).toEqual(['Colocar PJ', 'Luz de ambiente', 'Builder', 'Fondo del mapa', 'Pincel', 'Revelar', 'Ocultar', 'Encuentro']);
  });

  it('con `admin.manage_settings` —sin ser admin— arrastra, y se guarda el orden entero para todos', async () => {
    const port = fakeToolbarOrder();
    mount(DIRECTORA_CON_AJUSTES, port);
    const bar = await barra();
    await within(bar).findByRole('button', { name: 'Pincel' });
    expect(slot(bar, 'Pincel')).toHaveAttribute('draggable', 'true');
    arrastra(bar, 'Luz de ambiente', 'Ocultar');
    await waitFor(() => expect(port.save).toHaveBeenCalledWith({
      play: ['dice', 'select', 'measure', 'pin'], draw: ['draw'],
      dm: ['wall', 'background', 'mask', 'sep', 'reveal', 'light', 'hide', 'sep', 'encounter', 'placePc'],
    }));
    expect(nombres(bar).slice(-8)).toEqual(['Builder', 'Fondo del mapa', 'Pincel', 'Revelar', 'Luz de ambiente', 'Ocultar', 'Encuentro', 'Colocar PJ']);
  });

  it('el admin, que lo puede todo, también', async () => {
    mount(ADMIN_USER, fakeToolbarOrder());
    const bar = await barra();
    await within(bar).findByRole('button', { name: 'Pincel' });
    expect(slot(bar, 'Pincel')).toHaveAttribute('draggable', 'true');
  });
});
