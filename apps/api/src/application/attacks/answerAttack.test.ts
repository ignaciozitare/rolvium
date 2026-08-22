import { describe, it, expect, vi } from 'vitest';
import { plenilunio, messages, lookup } from '@rolvium/system-plenilunio';
import type { RollRequest } from '@rolvium/core';
import type { IAttackRepository, OpenAttackInput, PendingAttack } from '../../domain/attack/IAttackRepository.js';
import type { RollCommitInput } from '../../domain/roll/IRollRepository.js';
import { answerAttack, answerPlayerAttack, openAttack, openPlayerAttack, withDefence } from './answerAttack.js';

const DM = '11111111-1111-4111-8111-111111111111';
const PLAYER = '22222222-2222-4222-8222-222222222222';
const CAMP = '77777777-7777-4777-8777-777777777777';
const CHAR = '55555555-5555-4555-8555-555555555555';

/** La petición tal y como la guarda el director: sin oposición, porque ésa la pone quien se defiende. */
const stored = (): RollRequest => ({
  systemId: 'plenilunio', kind: 'system', title: 'Ogro ataca a Karen',
  groups: [{ count: 4, sides: 6, tag: 'own' }],
  options: { stat: 'combat', difficulty: 0, weaponId: 'catalog.weapons.unarmed', weaponDamage: 8 },
  visibility: 'table',
});

const fakeAttacks = (over: Partial<IAttackRepository> = {}, row: Partial<PendingAttack> = {}) => {
  const closed: { id: string; rollId: string | null; status: string }[] = [];
  const opened: OpenAttackInput[] = [];
  const repo: IAttackRepository = {
    open: async i => { opened.push(i); return { id: 'atk-1' }; },
    openPlayer: async () => ({ id: 'atk-esp' }),
    answerPlayer: async (_a, _id, defence) => Math.max(0, Math.min(40, defence)),
    answer: async (_a, _id, defence) => defence,
    findById: async id => ({ id, campaignId: CAMP, targetCharacterId: CHAR, attackerCharacterId: null, createdBy: DM, dice: 4, request: stored(), status: 'pending', ...row }),
    close: async (id, rollId, status) => { closed.push({ id, rollId, status }); },
    ...over,
  };
  return { repo, closed, opened };
};

/** Karen: Combate 4, sana. Es la ficha de la que sale el TECHO de dados de defensa (p.93). */
const karenSheet = (over: Record<string, unknown> = {}) =>
  ({ ...plenilunio.newSheet(), combat: { value: 4, specialties: [] }, destiny: 3, ...over });

const deps = (attacks: IAttackRepository, committed: RollCommitInput[] = [], sheet: Record<string, unknown> | null = karenSheet()) => ({
  attacks,
  characters: {
    findForActor: async (id: string, actor: string) => (id === CHAR && actor === PLAYER && sheet
      ? { id, campaignId: CAMP, systemId: 'plenilunio', ownerId: PLAYER, data: sheet, isOwner: true, isDm: false, isMember: true }
      : null),
    saveSheet: async () => undefined,
    isCampaignMember: async () => false,
    isCampaignDm: async (cid: string, actor: string) => cid === CAMP && actor === DM,
  },
  rolls: { commit: async (i: RollCommitInput) => { committed.push(i); return { id: 'roll-1' }; } },
  systemById: (id: string) => (id === 'plenilunio' ? plenilunio : null),
  rng: () => 4,
});

describe('withDefence', () => {
  it('mete los dados de defensa como grupo de oposición y marca que es un conflicto', () => {
    const r = withDefence(stored(), 2);
    expect(r.groups).toEqual([{ count: 4, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'opposition' }]);
    expect(r.options?.['conflict']).toBe(true);
    expect(r.options?.['difficulty']).toBe(2);
  });
  it('«no me defiendo» deja la tirada sin oposición, pero sigue siendo un conflicto', () => {
    const r = withDefence(stored(), 0);
    expect(r.groups).toEqual([{ count: 4, sides: 6, tag: 'own' }]);
    expect(r.options?.['conflict']).toBe(true);
    expect(r.options?.['difficulty']).toBe(0);
  });
  // La petición la guardó el navegador del director: si trae oposición, no se respeta.
  it('tira la oposición que trajera la petición guardada', () => {
    const req = { ...stored(), groups: [{ count: 4, sides: 6, tag: 'own' }, { count: 9, sides: 6, tag: 'opposition' }] };
    expect(withDefence(req, 1).groups).toEqual([{ count: 4, sides: 6, tag: 'own' }, { count: 1, sides: 6, tag: 'opposition' }]);
  });
  it('no acepta dados de defensa negativos ni con decimales', () => {
    expect(withDefence(stored(), -3).groups).toHaveLength(1);
    expect(withDefence(stored(), 2.9).groups[1]).toEqual({ count: 2, sides: 6, tag: 'opposition' });
  });
});

describe('openAttack', () => {
  it('guarda el ataque y devuelve su id', async () => {
    const { repo, opened } = fakeAttacks();
    const input: OpenAttackInput = {
      actorId: DM, campaignId: CAMP, sceneId: null, attackerTokenId: null, targetTokenId: null,
      attackerName: 'Ogro', targetCharacterId: CHAR, dice: 4, request: stored(),
    };
    await expect(openAttack({ attacks: repo }, input)).resolves.toEqual({ ok: true, data: { id: 'atk-1' } });
    expect(opened[0]?.attackerName).toBe('Ogro');
  });
  it('quien no es el director no abre nada', async () => {
    const { repo } = fakeAttacks({ open: async () => { throw Object.assign(new Error('not_dm'), { code: 'FORBIDDEN' }); } });
    const r = await openAttack({ attacks: repo }, {
      actorId: PLAYER, campaignId: CAMP, sceneId: null, attackerTokenId: null, targetTokenId: null,
      attackerName: 'Ogro', targetCharacterId: CHAR, dice: 4, request: stored(),
    });
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('answerAttack', () => {
  it('la tirada sale al contestar, con la defensa enfrente, y el ataque se cierra apuntándola', async () => {
    const { repo, closed } = fakeAttacks();
    const committed: RollCommitInput[] = [];
    const r = await answerAttack(deps(repo, committed), { actorId: PLAYER, attackId: 'atk-1', defence: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.defence).toBe(2);
    expect(committed[0]?.request.groups).toEqual([{ count: 4, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'opposition' }]);
    expect(closed).toEqual([{ id: 'atk-1', rollId: 'roll-1', status: 'resolved' }]);
  });
  /** Quien ataca es la criatura del DIRECTOR: el Registro no puede decir que tiró el jugador atacado. */
  it('el autor de la tirada es el director que abrió el ataque, no quien contesta', async () => {
    const { repo } = fakeAttacks();
    const committed: RollCommitInput[] = [];
    await answerAttack(deps(repo, committed), { actorId: PLAYER, attackId: 'atk-1', defence: 1 });
    expect(committed[0]?.actorId).toBe(DM);
    expect(committed[0]?.campaignId).toBe(CAMP);
  });
  it('quien no es el dueño del personaje no contesta, y ni siquiera se llama al RPC', async () => {
    const { repo } = fakeAttacks();
    const answer = vi.spyOn(repo, 'answer');
    expect(await answerAttack(deps(repo), { actorId: DM, attackId: 'atk-1', defence: 0 })).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(answer).not.toHaveBeenCalled();
  });
  it('un ataque que ya no está pendiente se corta antes de tocar nada', async () => {
    const { repo, closed } = fakeAttacks({}, { status: 'resolved' });
    expect(await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 2 })).toEqual({ ok: false, code: 'NOT_PENDING' });
    expect(closed).toHaveLength(0);
  });

  /**
   * EL AGUJERO QUE CERRÓ EL REVIEW (2026-08-21): el techo de dados vivía sólo en el navegador, así que un
   * `{"defence": 40}` a pelo le daba 40 dados de defensa a un personaje con Combate 4. Se recorta en el
   * servidor con la MISMA cuenta que pinta la pantalla, y lo recortado es lo que se guarda y lo que se tira.
   */
  it('recorta los dados de defensa al techo de su característica, y guarda lo recortado', async () => {
    const { repo } = fakeAttacks();
    const committed: RollCommitInput[] = [];
    const answered: number[] = [];
    vi.spyOn(repo, 'answer').mockImplementation(async (_a, _id, d) => { answered.push(d); return d; });
    const r = await answerAttack(deps(repo, committed), { actorId: PLAYER, attackId: 'atk-1', defence: 40 });
    expect(r.ok && r.data.defence).toBe(4);
    expect(answered).toEqual([4]);
    expect(committed[0]?.request.groups).toContainEqual({ count: 4, sides: 6, tag: 'opposition' });
  });
  it('el techo baja con las heridas, porque es el mismo puñado que tiraría (p.99)', async () => {
    const { repo } = fakeAttacks();
    const committed: RollCommitInput[] = [];
    const r = await answerAttack(deps(repo, committed, karenSheet({ health: 'wounded' })), { actorId: PLAYER, attackId: 'atk-1', defence: 4 });
    expect(r.ok && r.data.defence).toBe(3);
  });
  it('pedir menos del techo se respeta tal cual', async () => {
    const { repo } = fakeAttacks();
    const r = await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 2 });
    expect(r.ok && r.data.defence).toBe(2);
  });
  /** Sin característica guardada la pantalla sólo ofrece «no me defiendo»: el servidor no acepta más. */
  it('sin característica en la petición el techo es 0', async () => {
    const noStat = { ...stored(), options: { difficulty: 0 } };
    const { repo } = fakeAttacks({}, { request: noStat });
    const r = await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 4 });
    expect(r.ok && r.data.defence).toBe(0);
  });
  it('un número negativo o con decimales no se cuela', async () => {
    const { repo } = fakeAttacks();
    expect((await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: -5 })) as { data?: { defence: number } }).toMatchObject({ data: { defence: 0 } });
    expect((await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 2.9 })) as { data?: { defence: number } }).toMatchObject({ data: { defence: 2 } });
  });
  it('un ataque ya contestado o cancelado no se vuelve a contestar', async () => {
    const { repo } = fakeAttacks({ answer: async () => { throw Object.assign(new Error('not_pending'), { code: 'NOT_PENDING' }); } });
    expect(await answerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 0 })).toEqual({ ok: false, code: 'NOT_PENDING' });
  });
  it('si la fila ya no está, no se tira ni se contesta nada', async () => {
    const { repo, closed } = fakeAttacks({ findById: async () => null });
    const answer = vi.spyOn(repo, 'answer');
    const committed: RollCommitInput[] = [];
    expect(await answerAttack(deps(repo, committed), { actorId: PLAYER, attackId: 'atk-1', defence: 2 })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(committed).toHaveLength(0);
    expect(closed).toHaveLength(0);
    expect(answer).not.toHaveBeenCalled();
  });
  /** Sin poder leer su ficha no se sabe cuánto puede poner: se rechaza, y el ataque SIGUE pendiente. */
  it('sin ficha legible se rechaza y el ataque se queda esperando', async () => {
    const { repo, closed } = fakeAttacks();
    expect(await answerAttack(deps(repo, [], null), { actorId: PLAYER, attackId: 'atk-1', defence: 2 })).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(closed).toHaveLength(0);
  });
  /**
   * Si la tirada falla, la fila se queda en `pending` a propósito: el jugador puede volver a contestar en
   * vez de quedarse con un ataque muerto delante que nadie puede resolver.
   */
  it('cuando la tirada falla, el ataque NO se cierra', async () => {
    const { repo, closed } = fakeAttacks();
    const d = { ...deps(repo), rolls: { commit: async () => { throw Object.assign(new Error('pool_empty'), { code: 'POOL_EMPTY' }); } } };
    expect(await answerAttack(d, { actorId: PLAYER, attackId: 'atk-1', defence: 2 })).toEqual({ ok: false, code: 'POOL_EMPTY' });
    expect(closed).toHaveLength(0);
  });
  it('un sistema que no está instalado se corta antes de contestar', async () => {
    const { repo } = fakeAttacks();
    const d = { ...deps(repo), systemById: () => null };
    expect(await answerAttack(d, { actorId: PLAYER, attackId: 'atk-1', defence: 2 })).toEqual({ ok: false, code: 'SYSTEM_NOT_INSTALLED' });
  });
  it('el desglose lo cuenta como conflicto y no como reto (p.93)', async () => {
    const { repo } = fakeAttacks();
    const committed: RollCommitInput[] = [];
    await answerAttack(deps(repo, committed), { actorId: PLAYER, attackId: 'atk-1', defence: 2 });
    const c = committed[0]!;
    const e = plenilunio.engine.explain?.({ request: c.request, dice: c.dice, result: c.result }, k => lookup(messages.es, k) ?? k);
    expect(e?.head.some(l => l.text.includes('Conflicto: 2 dados de defensa del otro lado'))).toBe(true);
    expect(e?.head.some(l => l.text.includes('Reto'))).toBe(false);
  });
});

/**
 * EL ESPEJO (spec § «El espejo»): un PJ ataca c/c a una criatura, la fila viaja sin personaje atacado, y la
 * defensa la pone el DIRECTOR. El autor de la tirada es el JUGADOR que abrió — su ataque, su tirada.
 */
describe('answerPlayerAttack — el espejo', () => {
  const espejo = { targetCharacterId: null, attackerCharacterId: CHAR, createdBy: PLAYER };

  it('el director contesta, la defensa se pone enfrente y la tirada sale con el JUGADOR de autor', async () => {
    const { repo, closed } = fakeAttacks({}, espejo);
    const committed: import('../../domain/roll/IRollRepository.js').RollCommitInput[] = [];
    const d = deps(repo, committed);
    // el autor de la tirada es el JUGADOR: para performRoll tiene que ser miembro de la mesa
    d.characters.isCampaignMember = async () => true;
    const r = await answerPlayerAttack(d, { actorId: DM, attackId: 'atk-1', defence: 3 });
    expect(r.ok).toBe(true);
    expect(committed[0]?.actorId).toBe(PLAYER);
    expect(committed[0]?.request.groups).toContainEqual({ count: 3, sides: 6, tag: 'opposition' });
    expect(closed).toEqual([{ id: 'atk-1', rollId: 'roll-1', status: 'resolved' }]);
  });

  it('una fila de la columna 5 no se contesta por aquí, ni una del espejo por el camino del jugador', async () => {
    const col5 = fakeAttacks();
    expect(await answerPlayerAttack(deps(col5.repo), { actorId: DM, attackId: 'atk-1', defence: 1 })).toEqual({ ok: false, code: 'FORBIDDEN' });
    const esp = fakeAttacks({}, espejo);
    expect(await answerAttack(deps(esp.repo), { actorId: PLAYER, attackId: 'atk-1', defence: 1 })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('quien no es el director rebota en la función SQL', async () => {
    const { repo } = fakeAttacks({ answerPlayer: async () => { throw Object.assign(new Error('not_pending'), { code: 'NOT_PENDING' }); } }, espejo);
    expect(await answerPlayerAttack(deps(repo), { actorId: PLAYER, attackId: 'atk-1', defence: 1 })).toEqual({ ok: false, code: 'NOT_PENDING' });
  });

  it('openPlayerAttack abre y devuelve el id; el rechazo SQL llega como FORBIDDEN', async () => {
    const { repo } = fakeAttacks();
    const input = { actorId: PLAYER, campaignId: CAMP, sceneId: null, attackerCharacterId: CHAR, attackerTokenId: null, targetTokenId: '44444444-4444-4444-8444-444444444444', attackerName: 'Karen', dice: 4, request: stored() };
    expect(await openPlayerAttack({ attacks: repo }, input)).toEqual({ ok: true, data: { id: 'atk-esp' } });
    const bad = fakeAttacks({ openPlayer: async () => { throw Object.assign(new Error('not_creature'), { code: 'FORBIDDEN' }); } });
    expect(await openPlayerAttack({ attacks: bad.repo }, input)).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});
