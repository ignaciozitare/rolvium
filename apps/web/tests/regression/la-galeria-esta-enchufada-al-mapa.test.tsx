import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../helpers/render';
import { Route, Routes } from 'react-router-dom';
import type { User } from '@rolvium/shared-types';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { TablePage } from '@/modules/table/ui/TablePage';
import type { TablePort } from '@/modules/table/domain/ports/TablePort';
import type { TableSnapshot } from '@/modules/table/domain/entities/Table';
import type { BestiaryPort } from '@/modules/bestiary/domain/ports/BestiaryPort';
import type { PhotosPort } from '@/modules/photos';
import type { ToolbarOrderPort } from '@/modules/maps/domain/ports/ToolbarOrderPort';
import {
  ADMIN_USER, CAMPAIGN_MINE, CHARACTER_KAREN, LAYER_CREATURES, LAYER_NOTES, LAYER_OBJECTS, SCENE_PROP_PHOTO, SCENE_WAREHOUSE,
  fakeAttacks, fakeAuthRepo, fakeCharactersRepo, fakeChatPort, fakeMapsRepo, fakeRollLog, fakeRollRequests, fakeRollsPort, fakeVisionPort,
} from '../helpers/fakes';

/**
 * Pin de la rebanada 4 de H13 (specs/modules/photos/SPEC.md): LA GALERÍA TIENE QUE ESTAR ENCHUFADA AL MAPA.
 *
 * Su queja del 2026-09-28, y tenía razón: «*no me sirve de nada poder subir la foto y no poder arrastrarla a la
 * escena como te pedi*». La rebanada 3 dejó la galería entera y verde, y la foto no llegaba a la escena — no
 * porque nada estuviera roto, sino porque **nadie había juntado las dos piezas**.
 *
 * Quien las junta es una línea del caparazón, `TablePage`: `photos={photos ?? photosPort}`. Sin ella el lienzo
 * no tiene con qué firmar el enlace de una foto puesta, así que NO SE PINTA NINGUNA — y todo lo demás sigue
 * verde, porque los tests de `<SceneTab>` y `<MapCanvas>` reciben el firmante ya resuelto por parámetro.
 *
 * ⚠️ ALCANCE REAL DE ESTE PIN, corregido el 2026-09-28 tras medirlo: aquí la mesa se monta **inyectando** el
 * puerto (`photos={photos}`), así que lo que se clava es que `TablePage` se lo PASA a la escena — no el
 * `?? photosPort` del camino de producción, que este fichero no ejerce. Quien clava ese otro tramo, montando
 * la mesa **a secas como el router**, es `la-galeria-llega-sola-a-toda-la-mesa.test.tsx`. Los dos hacen falta,
 * y la cabecera de antes afirmaba cubrir los dos: no era cierto.
 */

const DIRECTORA: User = {
  ...ADMIN_USER, id: 'dm-1', name: 'Laura', roleId: 'r-gm', role: 'game_master',
  permissions: { modules: [], admin: {}, tools: {} },
};

function fakeTableRepo(user: User): TablePort {
  const snap: TableSnapshot = {
    campaign: { ...CAMPAIGN_MINE, myRole: 'dm', dmId: user.id, dmName: user.name },
    members: [{ campaignId: 'c1', userId: user.id, name: user.name, avatarUrl: null, role: 'dm', characterId: null, joinedAt: '' }],
    resources: { destiny: { value: 7, max: 10, perTakeMax: 5, hands: {} } },
    presence: [{ userId: user.id, devices: 1 }],
    activeSceneId: SCENE_WAREHOUSE.id,
  };
  return { load: async () => snap, subscribe: () => () => {}, takeResource: vi.fn(), returnResource: vi.fn(), resetResource: vi.fn() };
}

const fakeToolbarOrder = (): ToolbarOrderPort => ({ load: vi.fn(async () => null), save: vi.fn(async () => undefined) });
const fakeBestiaryRepo = (): BestiaryPort => ({ listForCampaign: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), remove: vi.fn(), uploadToken: vi.fn() });

/** La galería de mentira: lo único que la escena le pide es FIRMAR el enlace de lo que hay puesto. */
function fakePhotosPort(): PhotosPort {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    usage: vi.fn(),
    urlsFor: vi.fn(async (_campaignId: string, ids: readonly string[]) =>
      Object.fromEntries(ids.map(id => [id, `https://x/firmado/${id}.webp`]))),
  } as unknown as PhotosPort;
}

function mount(photos: PhotosPort) {
  const attacks = fakeAttacks();
  const requests = fakeRollRequests();
  // La escena ya tiene una FOTO PUESTA: su fila no lleva enlace (`image_url = ''`), así que sólo se pinta si
  // alguien le firma el enlace — y ese alguien tiene que llegar desde el caparazón.
  const maps = fakeMapsRepo({
    scenes: [SCENE_WAREHOUSE], sceneProps: [SCENE_PROP_PHOTO],
    layers: [LAYER_OBJECTS, LAYER_CREATURES, LAYER_NOTES],
  });
  renderWithProviders(
    <AuthProvider repo={fakeAuthRepo(DIRECTORA)}>
      <Routes><Route path="/table/:id" element={
        <TablePage repo={fakeTableRepo(DIRECTORA)} charactersRepo={fakeCharactersRepo([CHARACTER_KAREN])} rolls={fakeRollsPort()} rollLog={fakeRollLog()}
                   maps={maps} vision={fakeVisionPort()} bestiary={fakeBestiaryRepo()} photos={photos}
                   attacks={attacks} attackWatch={attacks} rollRequests={requests} rollRequestWatch={requests}
                   toolbarOrder={fakeToolbarOrder()} chat={fakeChatPort()} />
      } /></Routes>
    </AuthProvider>,
    { providers: { routerProps: { initialEntries: ['/table/c1'] } } },
  );
  return { maps };
}

describe('regresión · la galería está enchufada al mapa: una foto puesta SE VE en la mesa', () => {
  it('🔑 la mesa le da a la escena con qué firmar, y la foto puesta se pinta con su enlace', async () => {
    const photos = fakePhotosPort();
    mount(photos);

    // El camino entero: `TablePage` → `<SceneTab photos=…>` → `usePlacedPhotos` → `<MapCanvas photoUrls=…>`.
    const puesta = await screen.findByRole('img', { name: 'Foto puesta' });
    expect(puesta.querySelector('image')).toHaveAttribute('href', 'https://x/firmado/ph-1.webp');
    expect(puesta).toHaveAttribute('data-photo-id', 'ph-1');
  });

  it('le pide la firma a la galería de SU campaña, y sólo de lo que hay puesto', async () => {
    const photos = fakePhotosPort();
    mount(photos);
    await screen.findByRole('img', { name: 'Foto puesta' });
    expect(photos.urlsFor).toHaveBeenCalledWith('c1', ['ph-1']);
  });
});
