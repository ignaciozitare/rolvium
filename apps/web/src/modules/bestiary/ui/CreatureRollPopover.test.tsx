import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { CreatureRollPopover } from './CreatureRollPopover';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

const ogre = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: '', tokenUrl: null, sourceRef: 'ogre',
  campaignId: 'c1', editable: true,
  data: {
    // Sin Cultura a propósito: el manual deja características sin publicar y eso NO es 0.
    stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3,
    abilities: [], specialties: { combat: ['ogre.club'] }, page: 152,
  },
  ...over,
});

const setup = (entry = ogre(), over: Record<string, unknown> = {}) => {
  const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
  const onClose = vi.fn();
  renderWithProviders(
    <CreatureRollPopover entry={entry} system={plenilunio} specialtyLabel={(id: string) => id}
                         onRoll={onRoll} onClose={onClose} {...over} />,
  );
  return { onRoll, onClose };
};

const lastRequest = (onRoll: ReturnType<typeof vi.fn>) => onRoll.mock.calls.at(-1)?.[0];

beforeEach(() => vi.clearAllMocks());

describe('CreatureRollPopover — tirar por la criatura, no abrir el lanzador libre', () => {
  it('sólo ofrece las características que el manual publica de esa criatura', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Fortaleza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Combate' })).toBeInTheDocument();
    // Cultura no está en el bloque: ausente no es 0, y no se tira por lo que no está escrito.
    expect(screen.queryByRole('button', { name: 'Cultura' })).not.toBeInTheDocument();
  });

  it('enseña cuántos dados salen ANTES de tirar, y de dónde vienen', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/su Combate 4/)).toBeInTheDocument();
  });

  it('los dados extra suben la cuenta que se enseña', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un dado más' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('5'));
  });

  it('ofrece la especialidad de ESA criatura y sólo cuando la tiene', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    expect(screen.getByLabelText(/ogre.club/)).toBeInTheDocument();
    // Fortaleza no tiene especialidad en este bloque: no se ofrece la casilla.
    await userEvent.click(screen.getByRole('button', { name: 'Fortaleza' }));
    expect(screen.queryByLabelText(/ogre.club/)).not.toBeInTheDocument();
  });

  it('manda la tirada con la característica, la especialidad, la dificultad y la visibilidad', async () => {
    const { onRoll, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/ogre.club/));
    await userEvent.click(screen.getByRole('button', { name: /Difícil · 3/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Secreta' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));

    await waitFor(() => expect(onRoll).toHaveBeenCalledOnce());
    const req = lastRequest(onRoll);
    expect(req.options.specialty).toBe(true);
    expect(req.groups.find((g: { tag?: string }) => g.tag === 'opposition').count).toBe(3);
    expect(req.visibility).toBe('secret');
    expect(req.title).toBe('Ogro con antorcha · Combate');
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  /** Cambiar de característica tiene que soltar la especialidad: el garrote no sirve para esquivar. */
  it('al cambiar de característica desmarca la especialidad anterior', async () => {
    const { onRoll } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/ogre.club/));
    await userEvent.click(screen.getByRole('button', { name: 'Fortaleza' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));

    await waitFor(() => expect(onRoll).toHaveBeenCalledOnce());
    expect(lastRequest(onRoll).options.specialty).toBe(false);
  });

  it('si el servidor no puede tirar, lo dice y NO se cierra', async () => {
    const onRoll = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithProviders(
      <CreatureRollPopover entry={ogre()} system={plenilunio} specialtyLabel={(id: string) => id}
                           onRoll={onRoll} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se ha podido tirar/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('una criatura sin ninguna característica publicada lo dice en vez de ofrecer una tirada vacía', () => {
    setup(ogre({ data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {} } }));
    expect(screen.getByText(/no publica ninguna característica/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tirar/ })).not.toBeInTheDocument();
  });
});
