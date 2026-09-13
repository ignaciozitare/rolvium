import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from '../helpers/render';
import { Route, Routes } from 'react-router-dom';
import type { User } from '@rolvium/shared-types';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { TablePage } from '@/modules/table/ui/TablePage';
import type { TablePort } from '@/modules/table/domain/ports/TablePort';
import type { TableSnapshot } from '@/modules/table/domain/entities/Table';
import type { BestiaryPort } from '@/modules/bestiary/domain/ports/BestiaryPort';
import type { ToolbarOrderPort } from '@/modules/maps/domain/ports/ToolbarOrderPort';
import {
  ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, LAYER_CREATURES, LAYER_NOTES, LAYER_OBJECTS, PACK_DUNGEON, PACK_FOREST, PROP_COLUMN, PROP_OAK, SCENE_WAREHOUSE,
  fakeAttacks, fakeAuthRepo, fakeCharactersRepo, fakeMapsRepo, fakeRollLog, fakeRollRequests, fakeRollsPort, fakeVisionPort,
} from '../helpers/fakes';

/**
 * Pin de la rebanada 6 (specs/modules/maps/SPEC.md § «Rebanada 6»): la biblioteca de piezas es DE LA HERRAMIENTA, y
 * ordenarla —subir, renombrar, mover, borrar— es cosa de quien tenga el permiso `manage_props`, «por permisos, como
 * las texturas». Lo decide el caparazón (`TablePage`: `canManageProps={canUse('manage_props')}`) y baja por
 * parámetro. Si alguien lo cambiara por `isDm`, o por `can(...)`, los tests de `<SceneTab>` y `<PropsCatalog>` (que
 * reciben el permiso ya resuelto) no se enterarían. De ahí este pin, que monta la mesa entera con tres usuarios.
 */

/** La directora de la mesa sin ningún permiso de herramienta: dirige y planta piezas, pero la biblioteca no es suya. */
const DIRECTORA: User = { ...ADMIN_USER, id: 'dm-1', name: 'Laura', roleId: 'r-gm', role: 'game_master', permissions: { modules: [], admin: {}, tools: {} } };
/** La misma directora con el permiso concreto, SIN ser admin: es el permiso lo que manda, no el rol. */
const DIRECTORA_CON_PIEZAS: User = { ...DIRECTORA, permissions: { modules: [], admin: {}, tools: { manage_props: true } } };

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

/** El orden de la barra de mentira: nada guardado, sale el de serie. */
const fakeToolbarOrder = (): ToolbarOrderPort => ({ load: vi.fn(async () => null), save: vi.fn(async () => undefined) });

const fakeBestiaryRepo = (): BestiaryPort => ({ listForCampaign: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), remove: vi.fn(), uploadToken: vi.fn() });

function mount(user: User): void {
  const attacks = fakeAttacks();
  const requests = fakeRollRequests();
  // El catálogo abre en el PRIMER paquete por su orden (2026-09-13): el Bosque va primero para que el Roble esté a la vista.
  const maps = fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], props: [PROP_OAK, PROP_COLUMN], packs: [{ ...PACK_FOREST, sortOrder: 0 }, { ...PACK_DUNGEON, sortOrder: 1 }], layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES] });
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(user)}>
      <Routes><Route path="/table/:id" element={
        <TablePage repo={fakeTableRepo(user)} charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} rolls={fakeRollsPort()} rollLog={fakeRollLog()}
                   maps={maps} vision={fakeVisionPort()} bestiary={fakeBestiaryRepo()}
                   attacks={attacks} attackWatch={attacks} rollRequests={requests} rollRequestWatch={requests} toolbarOrder={fakeToolbarOrder()} />
      } /></Routes>
    </AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/table/c1'] } } },
  );
}

/** El camino de la pantalla: el botón Piezas abre el panel, ELEGIR abre el catálogo de la herramienta. */
async function abrirCatalogo(u: ReturnType<typeof userEvent.setup>): Promise<void> {
  const bar = await screen.findByRole('toolbar', { name: 'Herramientas del lienzo' });
  await u.click(await within(bar).findByRole('button', { name: 'Piezas' }));
  const panel = await screen.findByRole('group', { name: 'Piezas' });
  await u.click(within(panel).getByRole('button', { name: 'Elegir' }));
  await screen.findByRole('button', { name: 'Elegir Roble' });
}

describe('regresión · la biblioteca de piezas la ordena quien tiene `manage_props`, no el director', () => {
  it('la directora sin el permiso llega al catálogo y puede elegir, pero no se le ofrece subir', async () => {
    const u = userEvent.setup();
    mount(DIRECTORA);
    await abrirCatalogo(u);
    expect(screen.queryByRole('button', { name: /Subir piezas/ })).not.toBeInTheDocument();
  });

  it('con `manage_props` —sin ser admin— el catálogo ofrece subir: es el permiso lo que baja por `canManageProps`', async () => {
    const u = userEvent.setup();
    mount(DIRECTORA_CON_PIEZAS);
    await abrirCatalogo(u);
    expect(screen.getByRole('button', { name: /Subir piezas/ })).toBeInTheDocument();
  });

  it('el admin, que lo puede todo, también', async () => {
    const u = userEvent.setup();
    mount(ADMIN_USER);
    await abrirCatalogo(u);
    expect(screen.getByRole('button', { name: /Subir piezas/ })).toBeInTheDocument();
  });
});
