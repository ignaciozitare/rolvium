import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { PendingAttack } from '../domain/entities/Attack';
import type { AttacksPort } from '../domain/ports/AttacksPort';
import type { AttackWatchPort } from '../domain/ports/AttackWatchPort';
import { AttackWatcher } from './AttackWatcher';

const attack = (over: Partial<PendingAttack> = {}): PendingAttack => ({
  id: 'atk-1', campaignId: 'c1', attackerName: 'Ogro', targetCharacterId: 'ch1',
  dice: 4, stat: 'combat', createdAt: '2026-08-21T00:00:00Z', ...over,
});

const ME = 'u1';
const karen = (ownerId: string | null = ME): Character => ({
  id: 'ch1', campaignId: 'c1', campaignName: 'Manhattan', systemId: 'plenilunio', ownerId, ownerName: 'Pip',
  kind: 'pc', name: 'Karen', concept: null, avatarUrl: null, tokenUrl: null, color: null,
  data: { ...plenilunio.newSheet(), combat: { value: 4, specialties: [] }, destiny: 3 },
  derived: {}, health: 'healthy', xp: 0, archivedAt: null, createdAt: '', updatedAt: '',
});

const setup = (over: { pending?: PendingAttack[]; character?: Character | null; answer?: unknown } = {}) => {
  const listPending = vi.fn().mockResolvedValue(over.pending ?? [attack()]);
  const off = vi.fn();
  let fire: () => void = () => undefined;
  const watch: AttackWatchPort = { listPending, subscribe: (_c, onChange) => { fire = onChange; return off; } };
  const answer = vi.fn().mockResolvedValue(over.answer === undefined ? { id: 'r-1', result: { summary: 'ok', total: 1 } } : over.answer);
  const attacks = { open: vi.fn(), answer } as unknown as AttacksPort;
  const getById = vi.fn().mockResolvedValue(over.character === undefined ? karen() : over.character);
  const charactersRepo = { getById } as unknown as CharactersPort;
  const view = renderWithProviders(
    <AttackWatcher campaignId="c1" userId={ME} system={plenilunio} charactersRepo={charactersRepo} attacks={attacks} watch={watch} />,
  );
  return { listPending, answer, getById, off, view, fire: () => fire() };
};

beforeEach(() => vi.clearAllMocks());

describe('AttackWatcher — el aviso que le salta al jugador', () => {
  it('saca el aviso del ataque que le espera, con los dados que le da su Combate', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Te ataca Ogro' })).toBeInTheDocument();
    expect(screen.getByText('tienes Combate: 4 dados')).toBeInTheDocument();
  });

  it('sin ningún ataque pendiente no pinta nada', async () => {
    const { listPending } = setup({ pending: [] });
    await waitFor(() => expect(listPending).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  /** Le tiene que SALTAR sin recargar: es toda la razón de que la tabla esté en la publicación de realtime. */
  it('un ataque que llega en vivo aparece sin recargar', async () => {
    const { listPending, fire } = setup({ pending: [] });
    await waitFor(() => expect(listPending).toHaveBeenCalledTimes(1));
    listPending.mockResolvedValue([attack()]);
    fire();
    expect(await screen.findByRole('heading', { name: 'Te ataca Ogro' })).toBeInTheDocument();
  });

  it('al contestar manda los dados y el aviso se va', async () => {
    const { answer } = setup();
    await screen.findByRole('heading', { name: 'Te ataca Ogro' });
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Defenderme · 2 dados' }));
    expect(answer).toHaveBeenCalledWith('atk-1', 2);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('si no se pudo contestar, el aviso se queda: nadie tira por él', async () => {
    setup({ answer: null });
    await screen.findByRole('heading', { name: 'Te ataca Ogro' });
    await userEvent.click(screen.getByRole('button', { name: 'No me defiendo' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  /** Amontonar dos avisos taparía el segundo: se contesta en el orden en que le atacaron. */
  it('con dos ataques enseña el primero, y el segundo al contestar aquél', async () => {
    const { answer } = setup({ pending: [attack(), attack({ id: 'atk-2', attackerName: 'Lunar', dice: 6 })] });
    expect(await screen.findByRole('heading', { name: 'Te ataca Ogro' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Te ataca Lunar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'No me defiendo' }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith('atk-1', 0));
    expect(await screen.findByRole('heading', { name: 'Te ataca Lunar' })).toBeInTheDocument();
    // Y las fichas vuelven a 0: no heredan lo que se eligió para el anterior.
    expect(screen.getByRole('button', { name: 'Defenderme · 0 dados' })).toBeDisabled();
  });

  it('si no se puede leer su ficha, lo dice y sólo le deja no defenderse', async () => {
    setup({ character: null });
    expect(await screen.findByText(/No se ha podido leer tu ficha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Defenderme/ })).not.toBeInTheDocument();
  });

  /**
   * La RLS deja al director leer los ataques de toda su mesa. Filtrar por rol dejaba dos agujeros: un
   * director que además lleve un PJ no se enteraba, y un ataque contra un PNJ suyo se quedaba esperando
   * para siempre sin que nadie lo viera. Manda de QUIÉN ES el personaje.
   */
  it('un ataque contra el personaje de otro se descarta y pasa al siguiente', async () => {
    const mine = attack({ id: 'atk-2', attackerName: 'Lunar' });
    const getById = vi.fn()
      .mockResolvedValueOnce(karen('otro-usuario'))
      .mockResolvedValue(karen());
    const watch: AttackWatchPort = { listPending: vi.fn().mockResolvedValue([attack(), mine]), subscribe: () => () => undefined };
    renderWithProviders(
      <AttackWatcher campaignId="c1" userId={ME} system={plenilunio}
                     charactersRepo={{ getById } as unknown as CharactersPort}
                     attacks={{ open: vi.fn(), answer: vi.fn() } as unknown as AttacksPort} watch={watch} />,
    );
    expect(await screen.findByRole('heading', { name: 'Te ataca Lunar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Te ataca Ogro' })).not.toBeInTheDocument();
  });

  it('si NINGUNO es mío no se pinta nada', async () => {
    const getById = vi.fn().mockResolvedValue(karen('otro-usuario'));
    const watch: AttackWatchPort = { listPending: vi.fn().mockResolvedValue([attack()]), subscribe: () => () => undefined };
    renderWithProviders(
      <AttackWatcher campaignId="c1" userId={ME} system={plenilunio}
                     charactersRepo={{ getById } as unknown as CharactersPort}
                     attacks={{ open: vi.fn(), answer: vi.fn() } as unknown as AttacksPort} watch={watch} />,
    );
    await waitFor(() => expect(getById).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('se da de baja del canal al desmontarse', async () => {
    const { off, view } = setup();
    await screen.findByRole('heading', { name: 'Te ataca Ogro' });
    view.unmount();
    expect(off).toHaveBeenCalled();
  });
});
