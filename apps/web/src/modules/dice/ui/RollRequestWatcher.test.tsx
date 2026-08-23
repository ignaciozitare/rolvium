import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { PendingRollRequest } from '../domain/entities/RollRequestAsk';
import type { RollRequestsPort } from '../domain/ports/RollRequestsPort';
import type { RollRequestWatchPort } from '../domain/ports/RollRequestWatchPort';
import { RollRequestWatcher } from './RollRequestWatcher';

const request = (over: Partial<PendingRollRequest> = {}): PendingRollRequest => ({
  id: 'req-1', campaignId: 'c1', batchId: 'b-1', targetCharacterId: 'ch1',
  stat: 'fortitude', difficulty: 2, specialtyAllowed: true, createdAt: '2026-08-22T00:00:00Z', ...over,
});

const ME = 'u1';
const karen = (ownerId: string | null = ME): Character => ({
  id: 'ch1', campaignId: 'c1', campaignName: 'Manhattan', systemId: 'plenilunio', ownerId, ownerName: 'Pip',
  kind: 'pc', name: 'Karen', concept: null, avatarUrl: null, tokenUrl: null, color: null,
  data: { ...plenilunio.newSheet(), fortitude: { value: 4, specialties: ['fortitude.vigour'] }, destiny: 3 },
  derived: {}, health: 'healthy', xp: 0, archivedAt: null, createdAt: '', updatedAt: '',
});

const setup = (over: { pending?: PendingRollRequest[]; character?: Character | null; answer?: unknown } = {}) => {
  const listPending = vi.fn().mockResolvedValue(over.pending ?? [request()]);
  const off = vi.fn();
  let fire: () => void = () => undefined;
  const watch: RollRequestWatchPort = { listPending, subscribe: (_c, onChange) => { fire = onChange; return off; } };
  const answer = vi.fn().mockResolvedValue(over.answer === undefined ? { id: 'r-1', result: { summary: 'ok', total: 1 } } : over.answer);
  const rollRequests = { open: vi.fn(), answer } as unknown as RollRequestsPort;
  const getById = vi.fn().mockResolvedValue(over.character === undefined ? karen() : over.character);
  const charactersRepo = { getById } as unknown as CharactersPort;
  renderWithProviders(
    <RollRequestWatcher campaignId="c1" userId={ME} system={plenilunio} charactersRepo={charactersRepo} rollRequests={rollRequests} watch={watch} />,
  );
  return { listPending, answer, getById, off, fire: () => fire() };
};

beforeEach(() => vi.clearAllMocks());

describe('RollRequestWatcher — «Tirada pedida», el aviso del jugador (.pen avisos del panel)', () => {
  it('saca el aviso con la característica, la dificultad y la nota de la especialidad', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'El director te pide una tirada' })).toBeInTheDocument();
    expect(screen.getByText(/Fortaleza a dificultad Media \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Te vale tu especialidad/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar · 4 dados' })).toBeInTheDocument();
  });

  it('sin la marca del director no promete especialidad', async () => {
    setup({ pending: [request({ specialtyAllowed: false })] });
    await screen.findByRole('heading', { name: 'El director te pide una tirada' });
    expect(screen.queryByText(/Te vale tu especialidad/)).not.toBeInTheDocument();
  });

  it('contestar tira por la API y el aviso se va', async () => {
    const u = userEvent.setup();
    const { answer } = setup();
    await u.click(await screen.findByRole('button', { name: 'Tirar · 4 dados' }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith('req-1'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('si la tirada no sale, lo dice y deja volver a intentarlo (la petición sigue esperando)', async () => {
    const u = userEvent.setup();
    setup({ answer: null });
    await u.click(await screen.findByRole('button', { name: 'Tirar · 4 dados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo tirar');
    expect(screen.getByRole('button', { name: 'Tirar · 4 dados' })).toBeEnabled();
  });

  it('una petición de un personaje de OTRO se descarta sin enseñarla', async () => {
    const { getById } = setup({ character: karen('u-otro') });
    await waitFor(() => expect(getById).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('al llegar un cambio en vivo se vuelve a pedir la lista', async () => {
    const { listPending, fire } = setup({ pending: [] });
    await waitFor(() => expect(listPending).toHaveBeenCalledTimes(1));
    fire();
    await waitFor(() => expect(listPending).toHaveBeenCalledTimes(2));
  });
});
