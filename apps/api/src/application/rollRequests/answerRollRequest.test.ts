import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { IRollRequestRepository, OpenRollRequestsInput, PendingRollRequest } from '../../domain/rollRequest/IRollRequestRepository.js';
import type { RollCommitInput } from '../../domain/roll/IRollRepository.js';
import { answerRollRequest, openRollRequests } from './answerRollRequest.js';

const DM = '11111111-1111-4111-8111-111111111111';
const PLAYER = '22222222-2222-4222-8222-222222222222';
const OTRO = '33333333-3333-4333-8333-333333333333';
const CAMP = '77777777-7777-4777-8777-777777777777';
const CHAR = '55555555-5555-4555-8555-555555555555';

const fila = (over: Partial<PendingRollRequest> = {}): PendingRollRequest => ({
  id: 'req-1', campaignId: CAMP, batchId: 'batch-1', targetCharacterId: CHAR, createdBy: DM,
  stat: 'fortitude', difficulty: 2, specialtyAllowed: true, status: 'pending', ...over,
});

const fakeRequests = (row: Partial<PendingRollRequest> = {}, over: Partial<IRollRequestRepository> = {}) => {
  const closed: { id: string; rollId: string | null; status: string }[] = [];
  const opened: OpenRollRequestsInput[] = [];
  const repo: IRollRequestRepository = {
    openBatch: async i => { opened.push(i); return { batchId: 'batch-1' }; },
    findById: async id => ({ ...fila(row), id }),
    close: async (id, rollId, status) => { closed.push({ id, rollId, status }); },
    ...over,
  };
  return { repo, closed, opened };
};

/** Karen: Fortaleza 4 con especialidad. El puñado sale de AQUÍ, no de nada que mande el navegador. */
const karenSheet = () => ({ ...plenilunio.newSheet(), fortitude: { value: 4, specialties: ['fortitude.vigour'] } });

const deps = (rollRequests: IRollRequestRepository, committed: RollCommitInput[] = [], owner = PLAYER) => ({
  rollRequests,
  characters: {
    findForActor: async (id: string, actor: string) => (id === CHAR
      ? { id, campaignId: CAMP, systemId: 'plenilunio', ownerId: owner, data: karenSheet(), isOwner: actor === owner, isDm: false, isMember: true }
      : null),
    saveSheet: async () => undefined,
    isCampaignMember: async () => true,
    isCampaignDm: async () => false,
  },
  rolls: { commit: async (i: RollCommitInput) => { committed.push(i); return { id: 'roll-1' }; } },
  systemById: (id: string) => (id === 'plenilunio' ? plenilunio : null),
  rng: () => 4,
});

describe('openRollRequests', () => {
  it('abre el lote tal cual y devuelve su id', async () => {
    const { repo, opened } = fakeRequests();
    const r = await openRollRequests({ rollRequests: repo }, {
      actorId: DM, campaignId: CAMP, targetCharacterIds: [CHAR], stat: 'fortitude', difficulty: 2, specialtyAllowed: true,
    });
    expect(r).toEqual({ ok: true, data: { batchId: 'batch-1' } });
    expect(opened[0]?.targetCharacterIds).toEqual([CHAR]);
  });
  it('quien no es el director se queda fuera (lo dice la función SQL)', async () => {
    const { repo } = fakeRequests({}, { openBatch: async () => { throw Object.assign(new Error('not_dm'), { code: 'FORBIDDEN' }); } });
    const r = await openRollRequests({ rollRequests: repo }, {
      actorId: PLAYER, campaignId: CAMP, targetCharacterIds: [CHAR], stat: 'fortitude', difficulty: 2, specialtyAllowed: false,
    });
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('answerRollRequest', () => {
  it('la tirada sale del SERVIDOR con la ficha del que contesta: característica, dificultad y especialidad del director', async () => {
    const { repo, closed } = fakeRequests();
    const committed: RollCommitInput[] = [];
    const r = await answerRollRequest(deps(repo, committed), { actorId: PLAYER, requestId: 'req-1' });
    expect(r.ok).toBe(true);
    const roll = committed[0]!;
    // el puñado lo armó poolFor: Fortaleza 4 contra dificultad 2. La especialidad NO añade dado:
    // hace que los triunfos cuenten doble al resolver (p.83), y viaja como opción.
    expect(roll.request.groups.find(g => g.tag === 'own')?.count).toBe(4);
    expect(roll.request.options?.['difficulty']).toBe(2);
    expect(roll.request.options?.['specialty']).toBe(true);
    // el AUTOR es el jugador — la tirada es suya; pedirla era lo del director
    expect(roll.actorId).toBe(PLAYER);
    expect(roll.title).toBe('sheet.stats.fortitude');
    // y la fila se cierra apuntando a la tirada
    expect(closed).toEqual([{ id: 'req-1', rollId: 'roll-1', status: 'resolved' }]);
  });

  it('sin la marca del director, la especialidad NO se aplica (p.83: lo decide él)', async () => {
    const { repo } = fakeRequests({ specialtyAllowed: false });
    const committed: RollCommitInput[] = [];
    await answerRollRequest(deps(repo, committed), { actorId: PLAYER, requestId: 'req-1' });
    expect(committed[0]!.request.options?.['specialty']).toBeFalsy();
  });

  it('sólo contesta el DUEÑO del personaje al que se le pidió', async () => {
    const { repo } = fakeRequests();
    const r = await answerRollRequest(deps(repo, [], OTRO), { actorId: PLAYER, requestId: 'req-1' });
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('una petición ya contestada no se puede volver a contestar', async () => {
    const { repo } = fakeRequests({ status: 'resolved' });
    const r = await answerRollRequest(deps(repo), { actorId: PLAYER, requestId: 'req-1' });
    expect(r).toEqual({ ok: false, code: 'NOT_PENDING' });
  });

  it('si la tirada falla, la fila se queda pendiente y se puede volver a contestar', async () => {
    const { repo, closed } = fakeRequests();
    const d = deps(repo);
    d.rolls.commit = async () => { throw Object.assign(new Error('pool_empty'), { code: 'POOL_EMPTY' }); };
    const r = await answerRollRequest(d, { actorId: PLAYER, requestId: 'req-1' });
    expect(r.ok).toBe(false);
    expect(closed).toEqual([]);
  });
});
