import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from '../helpers/render';
import { Route, Routes } from 'react-router-dom';
import type { User } from '@rolvium/shared-types';
import { AuthProvider } from '@/shared/hooks/useAuth';
import type { TablePort } from '@/modules/table/domain/ports/TablePort';
import type { TableSnapshot } from '@/modules/table/domain/entities/Table';
import type { BestiaryPort } from '@/modules/bestiary/domain/ports/BestiaryPort';
import type { ToolbarOrderPort } from '@/modules/maps/domain/ports/ToolbarOrderPort';
import {
  ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, LAYER_CREATURES, LAYER_NOTES, LAYER_OBJECTS, SCENE_PROP_PHOTO, SCENE_WAREHOUSE,
  fakeAttacks, fakeAuthRepo, fakeCharactersRepo, fakeChatPort, fakeMapsRepo, fakeRollLog, fakeRollRequests, fakeRollsPort, fakeVisionPort,
} from '../helpers/fakes';

/**
 * Pin de la revisión del 2026-09-28 — LA GALERÍA LLEGA SOLA A TODA LA MESA, sin que nadie la inyecte.
 *
 * 🔑 POR QUÉ ESTE PIN NO SOBRA teniendo ya `la-galeria-esta-enchufada-al-mapa`: aquél monta la mesa entera,
 * sí, pero le pasa `photos={…}` a mano. Quien tiene que poner la galería es el CAPARAZÓN, porque el router
 * monta `<TablePage />` a secas — y con el puerto inyectado desde fuera ese `?? photosPort` no se ejerce
 * nunca. Medido el 2026-09-28: quitando la línea de la escena, aquel pin seguía en verde.
 *
 * Aquí la mesa se monta COMO EN PRODUCCIÓN, sin `photos`, y el único firmante posible es el del contenedor
 * del módulo, doblado abajo. Si alguien vuelve a dejar un consumidor con `{...(photos ? { photos } : {})}`,
 * esa parte de la mesa se queda sin firmante y esto se pone rojo.
 *
 * Los dos sitios que se comprueban son los dos que él pidió:
 *   · LA ESCENA — la foto puesta en el mapa (H13 · rebanada 4).
 *   · EL CARRIL — la foto mandada por un susurro (H13 · rebanada 5). Sin firmante salía «Foto borrada»,
 *     que es la cara de «esa foto ya no existe»: el fallo se leía como un dato, no como una avería.
 */

/** El firmante del CONTENEDOR: el que la mesa tiene que encontrar sola. */
const contenedor = vi.hoisted(() => ({
  urlsFor: vi.fn(async (_c: string, ids: readonly string[]) =>
    Object.fromEntries(ids.map(id => [id, `https://x/delcontenedor/${id}.webp`]))),
}));
vi.mock('@/modules/photos', async importOriginal => {
  const real = await importOriginal<typeof import('@/modules/photos')>();
  return { ...real, photosPort: { ...real.photosPort, urlsFor: contenedor.urlsFor } };
});

const DIRECTORA: User = {
  ...ADMIN_USER, id: 'dm-1', name: 'Laura', roleId: 'r-gm', role: 'game_master',
  permissions: { modules: [], admin: {}, tools: {} },
};

function fakeTableRepo(): TablePort {
  const snap: TableSnapshot = {
    campaign: { ...CAMPAIGN_MINE, myRole: 'dm', dmId: DIRECTORA.id, dmName: DIRECTORA.name },
    members: [{ campaignId: 'c1', userId: DIRECTORA.id, name: DIRECTORA.name, avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' }],
    resources: { destiny: { value: 7, max: 10, perTakeMax: 5, hands: {} } },
    presence: [{ userId: DIRECTORA.id, devices: 1 }],
    activeSceneId: SCENE_WAREHOUSE.id,
  };
  return { load: async () => snap, subscribe: () => () => {}, takeResource: vi.fn(), returnResource: vi.fn(), resetResource: vi.fn() };
}
const fakeToolbarOrder = (): ToolbarOrderPort => ({ load: vi.fn(async () => null), save: vi.fn(async () => undefined) });
const fakeBestiaryRepo = (): BestiaryPort => ({ listForCampaign: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), remove: vi.fn(), uploadToken: vi.fn() });

/** Un susurro con una FOTO dentro: su fila sólo dice QUÉ foto es, nunca su enlace. */
const chatConFoto = () => fakeChatPort({
  directory: [{ key: 'p-1', conversationId: 'conv-1', isGroup: false, title: 'Karen', role: 'player', memberCount: null, memberIds: ['p-1'], lastKind: null, lastBody: null, unreadCount: 0 }],
  messages: { 'conv-1': [{
    id: 'm-foto', conversationId: 'conv-1', authorId: 'dm-1', authorName: 'Laura', authorAvatarUrl: null, kind: 'photo',
    body: 'Esto es lo que ves.', characterId: null, characterName: null, systemId: null,
    rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, photoId: 'ph-1',
    createdAt: '2026-09-28T21:04:00Z',
  }] },
});

/** 🔑 SIN `photos`: exactamente como lo monta el router (`<TablePage />`). */
async function montarComoEnProduccion() {
  const { TablePage } = await import('@/modules/table/ui/TablePage');
  const attacks = fakeAttacks();
  const requests = fakeRollRequests();
  const maps = fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], sceneProps: [SCENE_PROP_PHOTO], layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES] });
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(DIRECTORA)}>
      <Routes><Route path="/table/:id" element={
        <TablePage repo={fakeTableRepo()} charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} rolls={fakeRollsPort()} rollLog={fakeRollLog()}
                   maps={maps} vision={fakeVisionPort()} bestiary={fakeBestiaryRepo()}
                   attacks={attacks} attackWatch={attacks} rollRequests={requests} rollRequestWatch={requests}
                   toolbarOrder={fakeToolbarOrder()} chat={chatConFoto()} />
      } /></Routes>
    </AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/table/c1'] } } },
  );
}

describe('regresión · la galería llega sola a toda la mesa (sin inyectarla)', () => {
  it('🔑 LA ESCENA: la foto puesta se pinta con el enlace que firma el contenedor', async () => {
    await montarComoEnProduccion();
    const puesta = await screen.findByRole('img', { name: 'Foto puesta' });
    expect(puesta.querySelector('image')).toHaveAttribute('href', 'https://x/delcontenedor/ph-1.webp');
  });

  it('🔑 EL CARRIL: una foto mandada por un susurro SE VE, y no sale como «Foto borrada»', async () => {
    const u = userEvent.setup();
    await montarComoEnProduccion();
    await u.click(await screen.findByRole('tab', { name: /Susurros/ }));
    const panel = screen.getByRole('tabpanel');
    await u.click(await within(panel).findByText('Karen'));
    expect(await within(panel).findByRole('img', { name: 'Esto es lo que ves.' }))
      .toHaveAttribute('src', 'https://x/delcontenedor/ph-1.webp');
    expect(within(panel).queryByText('Foto borrada')).toBeNull();
  });
});
