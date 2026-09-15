import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { SCENE_WAREHOUSE, fakeCharactersRepo, fakeMapsRepo, fakeVisionPort } from '../helpers/fakes';
import { SceneTab } from '@/modules/maps/ui/SceneTab';

vi.mock('@/modules/maps/container', async importOriginal => ({
  ...(await importOriginal<typeof import('@/modules/maps/container')>()),
  compressionLevelsRepo: { load: vi.fn(), save: vi.fn() },
}));
vi.mock('@rolvium/ui', async importOriginal => ({
  ...(await importOriginal<typeof import('@rolvium/ui')>()),
  compressImage: vi.fn(),
}));

/**
 * 🐞 Regresión, dueño 2026-09-15: «*cuando le doy a upload de una textura el modal de subir queda detrás del
 * modal del catálogo*».
 *
 * Los dos son `Modal` de `@rolvium/ui`, que lleva un z-index FIJO (200). Entre dos hermanos con el mismo
 * z-index manda el orden del documento: gana el que se pinta después. En `SceneTab` la ventana de subir
 * texturas estaba ANTES que su catálogo, así que el catálogo la tapaba. Las piezas y los fondos ya estaban en
 * el orden bueno; las texturas eran la excepción.
 *
 * Se comprueba el orden en el DOM y no el z-index calculado porque jsdom no resuelve apilado: lo que hay que
 * proteger es justo lo que se rompió, que alguien vuelva a poner la ventana de subir por delante.
 */
beforeEach(async () => {
  const { compressImage } = await import('@rolvium/ui');
  const { compressionLevelsRepo } = await import('@/modules/maps/container');
  vi.mocked(compressionLevelsRepo.load).mockReset().mockResolvedValue(null);
  vi.mocked(compressImage).mockReset().mockResolvedValue({
    blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: 1, bytes: 1, compressed: true, width: 64, height: 64,
  });
});

describe('subir texturas se ve POR ENCIMA de su catálogo', () => {
  it('con las dos ventanas abiertas, la de subir se pinta después que el catálogo', async () => {
    const u = userEvent.setup();
    renderWithProviders(
      <SceneTab campaignId="c1" role="dm" userId="u-gm" system={plenilunio} members={[]} activeSceneId="sc-1"
        charactersRepo={fakeCharactersRepo([])} repo={fakeMapsRepo({ scenes: [SCENE_WAREHOUSE] })}
        vision={fakeVisionPort()} canManageTextures canManageProps canOrderToolbar={false} />,
    );
    await screen.findByText(/Almacén de Queens/);

    await u.click(screen.getByRole('button', { name: 'Builder' }));
    const panel = await screen.findByRole('group', { name: 'Builder' });
    await u.click(within(panel).getByRole('radio', { name: /Dibujar aquí/ }));
    const bloque = (await screen.findByText('Las dos texturas base')).closest('fieldset')!;
    await u.click(within(bloque).getAllByRole('button', { name: 'Elegir' })[0]!);

    const catalogo = await screen.findByTestId('mp-propcat');
    await u.click(await screen.findByRole('button', { name: /Subir texturas/ }));
    const subir = await screen.findByTestId('mp-propup');

    // Las dos siguen abiertas: subir no reemplaza al catálogo, se pone encima.
    await waitFor(() => expect(screen.getByTestId('mp-propcat')).toBeInTheDocument());

    const posicion = catalogo.compareDocumentPosition(subir);
    expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
