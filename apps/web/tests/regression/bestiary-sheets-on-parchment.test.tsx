import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '../helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { EntrySheetModal } from '@/modules/bestiary/ui/EntrySheetModal';
import { NpcSheetModal } from '@/modules/bestiary/ui/NpcSheetModal';
import { PhotoModal } from '@/modules/bestiary/ui/PhotoModal';
import type { BestiaryEntry } from '@/modules/bestiary/domain/entities/BestiaryEntry';

/**
 * Pin del rechazo del dueño del 2026-08-21.
 *
 * Las fichas del bestiario se diseñaron en `rolvium.pen` como pergamino (`PL/Hoja`) y se construyeron
 * dentro del `Modal` de `@rolvium/ui`, cuyo panel es `var(--sf)` sobre un scrim negro al 60 %. Como
 * `--sys-card` es traslúcido, el papel salía sucio sobre el negro y el texto ilegible: «el fondo está
 * negro y no usaste la textura».
 *
 * Volver a meterlas en `Modal` no rompería ni el typecheck ni ningún test de comportamiento — sólo se
 * vería mirando la pantalla, que es exactamente como se coló la primera vez. De ahí este pin.
 */

const creature = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: '', tokenUrl: null, sourceRef: null,
  campaignId: 'c1', editable: true,
  data: { stats: { fortitude: 8 }, endurance: 10, destiny: 0, protection: 3, abilities: [], specialties: {}, page: 152 },
  ...over,
});

const npc = (): BestiaryEntry => creature({
  id: 'be-npc', origin: 'npc', name: 'Padre Vidal',
  data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {}, sheet: {} },
});

/** La hoja es el `role="dialog"`; el pergamino es su clase y el fondo con textura, su padre. */
const parchment = () => {
  const sheet = screen.getByRole('dialog');
  return { sheet, scrim: sheet.parentElement as HTMLElement };
};

describe('regresión: las fichas del bestiario van en pergamino, no en el Modal de plataforma', () => {
  const common = {
    system: plenilunio, campaignId: 'c1', onSave: vi.fn().mockResolvedValue(undefined),
    onUploadImage: vi.fn().mockResolvedValue('https://x/t.webp'), onDelete: vi.fn(), onClose: vi.fn(),
  };

  it('la ficha del encuentro se pinta dentro de `SheetOverlay`', () => {
    renderWithProviders(
      <EntrySheetModal {...common} entry={creature()} specialtyLabel={(id: string) => id} onDuplicate={vi.fn()} />,
    );
    const { sheet, scrim } = parchment();
    expect(sheet).toHaveClass('bs-ov-sheet');
    expect(scrim).toHaveClass('bs-ov');
  });

  it('la ficha del PNJ aliado también, y sigue siendo el <Sheet> del sistema', () => {
    renderWithProviders(<NpcSheetModal {...common} entry={npc()} />);
    const { sheet, scrim } = parchment();
    expect(sheet).toHaveClass('bs-ov-sheet');
    expect(scrim).toHaveClass('bs-ov');
    // Lo que el dueño creyó que no se había reutilizado: es la ficha de personaje, no un bloque aparte.
    expect(sheet.querySelector('.rv-sheet')).not.toBeNull();
  });

  it('la foto del monstruo también', () => {
    renderWithProviders(<PhotoModal entry={creature()} onClose={vi.fn()} />);
    expect(parchment().sheet).toHaveClass('bs-ov-sheet');
  });

  /**
   * Rechazo n.º 2 del dueño: «si le pones tirar a un monstruo te abre el lanzador avanzado de dados, no lo
   * que establecimos». El atajo era `onRoll={() => setRollerOpen(true)}` en `TablePage`. Que `BestiaryTab`
   * EXIJA un `RollsPort` es lo que impide que vuelva: un callback suelto compilaba igual.
   */
  it('«Tirar» arma la tirada de la criatura y la manda al servidor, no abre el lanzador libre', async () => {
    const { BestiaryTab } = await import('@/modules/bestiary/ui/BestiaryTab');
    const roll = vi.fn().mockResolvedValue({ id: 'r-1' });
    const entry = creature();
    const repo = {
      listForCampaign: vi.fn().mockResolvedValue([entry]), create: vi.fn(), update: vi.fn(),
      remove: vi.fn(), uploadToken: vi.fn(),
    };
    renderWithProviders(
      <BestiaryTab campaignId="c1" system={plenilunio} repo={repo} rolls={{ roll }} />,
    );

    const heading = (await screen.findAllByRole('heading', { name: 'Ogro con antorcha' }))[0] as HTMLElement;
    const card = heading.closest('article') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Tirar' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar \d/ }));

    await waitFor(() => expect(roll).toHaveBeenCalledOnce());
    const req = roll.mock.calls[0]?.[0] as { kind: string; title: string; campaignId: string; groups: { tag?: string; count: number }[] };
    // Lo que el lanzador libre NO tenía: sistema, características de la criatura y su nombre en el acta.
    expect(req.kind).toBe('system');
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(8);
    expect(req.title).toContain('Ogro con antorcha');
    expect(req.campaignId).toBe('c1');
  });

  /**
   * «El modal de tirada no es un modal, me abre una vista nueva… lo tiene que abrir sobre la card»
   * (dueño, 2026-08-21). El desplegable reusaba el pergamino a pantalla completa de `SheetOverlay` y
   * tapaba el catálogo entero. Ahora vive DENTRO de su ficha.
   */
  it('el desplegable de tirada sale dentro de su ficha, no a pantalla completa', async () => {
    const { BestiaryTab } = await import('@/modules/bestiary/ui/BestiaryTab');
    const entry = creature();
    const repo = {
      listForCampaign: vi.fn().mockResolvedValue([entry]), create: vi.fn(), update: vi.fn(),
      remove: vi.fn(), uploadToken: vi.fn(),
    };
    renderWithProviders(
      <BestiaryTab campaignId="c1" system={plenilunio} repo={repo} rolls={{ roll: vi.fn() }} />,
    );
    const heading = (await screen.findAllByRole('heading', { name: 'Ogro con antorcha' }))[0] as HTMLElement;
    const card = heading.closest('article') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Tirar' }));

    const pop = screen.getByRole('dialog', { name: /Tirar por Ogro con antorcha/ });
    expect(card).toContainElement(pop);          // dentro de SU ficha
    expect(pop).not.toHaveClass('bs-ov-sheet');  // y no es la hoja a pantalla completa
    // El catálogo se sigue viendo por detrás: el desplegable no es una pantalla.
    expect(within(card).getByRole('heading', { name: 'Ogro con antorcha' })).toBeInTheDocument();
  });

  /**
   * El filete superior lleva el origen y la página del manual — «Titulo Derecha» de `PL/Hoja`. Es el dato
   * que distingue una copia propia de la criatura publicada, y el .pen lo pone ahí a propósito.
   */
  it('el filete dice de dónde sale la criatura', () => {
    renderWithProviders(
      <EntrySheetModal {...common} entry={creature()} specialtyLabel={(id: string) => id} onDuplicate={vi.fn()} />,
    );
    expect(screen.getByText('Propio · manual p.152')).toBeInTheDocument();
  });
});
