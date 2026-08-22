import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp, type AppDeps } from './app.js';
import type { UserProfile } from './domain/user/IUserRepository.js';
import type { FastifyInstance } from 'fastify';
import { plenilunio } from '@rolvium/system-plenilunio';
import { ownDiceForStat, type SheetData } from '@rolvium/core';
import type { RollCommitInput } from './domain/roll/IRollRepository.js';
import type { OpenAttackInput } from './domain/attack/IAttackRepository.js';
import { fakeMapsRepo } from './application/maps/fakeMapsRepo.js';

const ADMIN: UserProfile = { id: '11111111-1111-4111-8111-111111111111', name: 'Root', email: 'root@rolvium.test', avatarUrl: null, roleId: 'r-admin', role: 'admin', permissions: { modules: [], admin: {} }, active: true, createdAt: '' };
const PLAYER: UserProfile = { ...ADMIN, id: '22222222-2222-4222-8222-222222222222', name: 'Pip', email: 'pip@rolvium.test', role: 'player' };
const users = new Map<string, UserProfile>([[ADMIN.id, ADMIN], [PLAYER.id, PLAYER]]);
const created: unknown[] = [];
const MEMBER_ID = '77777777-7777-4777-8777-777777777777';
const CHAR_ID = '55555555-5555-4555-8555-555555555555';
const CAMP_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_CAMP = '88888888-8888-4888-8888-888888888888';
const saved: { id: string; actor: string; patch: unknown; origin: string }[] = [];
const committed: RollCommitInput[] = [];
const ATTACK_ID = '99999999-9999-4999-8999-999999999999';
const opened: OpenAttackInput[] = [];
const closedAttacks: { id: string; rollId: string | null; status: string }[] = [];
/** Lo que el director guarda al atacar cuerpo a cuerpo: sin oposición, que la pone quien se defiende. */
const attackRequest = () => ({
  systemId: 'plenilunio', kind: 'system' as const, title: 'Ogro ataca a Karen',
  groups: [{ count: 4, sides: 6, tag: 'own' }], options: { stat: 'combat', difficulty: 0 }, visibility: 'table' as const,
});
/** Karen-like sheet with Destiny 2 so a Destiny-die triumph raises it. */
const charData = (): SheetData => ({ ...plenilunio.newSheet(), name: 'Karen', destiny: 2, fortune: 1 });

const makeDeps = (): AppDeps => ({
    tokenVerifier: { verify: async (t) => t === 'admin' ? { userId: ADMIN.id, email: ADMIN.email } : t === 'player' ? { userId: PLAYER.id, email: PLAYER.email } : t === 'member' ? { userId: MEMBER_ID, email: 'member@rolvium.test' } : null },
    userRepo: {
      findById: async (id) => users.get(id) ?? null,
      findByEmail: async (email) => [...users.values()].find(u => u.email === email) ?? null,
    },
    userAdmin: {
      createUser: async (i) => { created.push(i); return { id: '33333333-3333-4333-8333-333333333333', email: i.email }; },
      setPassword: async () => undefined,
      deleteUser: async () => undefined,
    },
    invites: {
      preview: async (code) => code === 'LUNA-4F7K' ? { code, campaignName: 'Las ruinas de Manhattan', systemId: 'plenilunio', dmName: 'Ignacio', seatsFree: 4 } : null,
    },
    characters: {
      findForActor: async (id, actor) => id === CHAR_ID ? { id, campaignId: CAMP_ID, systemId: 'plenilunio', ownerId: PLAYER.id, data: charData(), isOwner: actor === PLAYER.id, isDm: actor === ADMIN.id, isMember: true } : null,
      saveSheet: async (id, actor, patch, origin) => { saved.push({ id, actor, patch, origin }); },
      isCampaignMember: async (cid, actor) => cid === CAMP_ID && actor === PLAYER.id,
      isCampaignDm: async (cid, actor) => cid === CAMP_ID && actor === ADMIN.id,
    },
    maps: fakeMapsRepo({ roles: { [ADMIN.id]: 'dm', [PLAYER.id]: 'player' }, tokens: [{ id: 'tk-pip', x: 2, y: 5, size: 1, controlledBy: PLAYER.id }] }),
    // Ataques a la espera (`.pen` columna 5): abrir es del director, contestar del dueño del personaje.
    attacks: {
      open: async (i) => { if (i.actorId !== ADMIN.id) throw Object.assign(new Error('not_dm'), { code: 'FORBIDDEN' }); opened.push(i); return { id: ATTACK_ID }; },
      answer: async (actor, id, defence) => {
        if (actor !== PLAYER.id || id !== ATTACK_ID) throw Object.assign(new Error('not_pending'), { code: 'FORBIDDEN' });
        return defence;
      },
      findById: async (id) => id === ATTACK_ID
        ? { id, campaignId: CAMP_ID, targetCharacterId: CHAR_ID, createdBy: ADMIN.id, dice: 4, request: attackRequest(), status: 'pending' as const }
        : null,
      close: async (id, rollId, status) => { closedAttacks.push({ id, rollId, status }); },
    },
    rolls: {
      commit: async (input) => {
        if ((input.shared['destiny'] ?? 0) > 1) throw Object.assign(new Error('pool_empty'), { code: 'POOL_EMPTY' });
        committed.push(input); return { id: `roll-${committed.length}` };
      },
    },
  });

let app: FastifyInstance;
beforeAll(async () => { app = await createApp(makeDeps()); });
afterAll(() => app.close());

describe('GET /health', () => {
  it('is public', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
  });
});

describe('GET /auth/me', () => {
  it('401 without token', async () => {
    expect((await app.inject({ method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
  });
  it('401 with an unverifiable token', async () => {
    expect((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
  });
  it('returns the profile for a verified token', async () => {
    const r = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: 'Bearer player' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.email).toBe('pip@rolvium.test');
  });
});

describe('POST /admin/users', () => {
  const body = { name: 'New', email: 'new@rolvium.test', password: 'supersecret1', roleId: '44444444-4444-4444-8444-444444444444' };
  it('403 for a player without manage_users', async () => {
    const r = await app.inject({ method: 'POST', url: '/admin/users', headers: { authorization: 'Bearer player' }, payload: body });
    expect(r.statusCode).toBe(403);
  });
  it('400 on invalid payload', async () => {
    const r = await app.inject({ method: 'POST', url: '/admin/users', headers: { authorization: 'Bearer admin' }, payload: { ...body, password: 'short' } });
    expect(r.statusCode).toBe(400);
  });
  it('409 when email exists', async () => {
    const r = await app.inject({ method: 'POST', url: '/admin/users', headers: { authorization: 'Bearer admin' }, payload: { ...body, email: PLAYER.email } });
    expect(r.statusCode).toBe(409);
  });
  it('201 for admin', async () => {
    const r = await app.inject({ method: 'POST', url: '/admin/users', headers: { authorization: 'Bearer admin' }, payload: body });
    expect(r.statusCode).toBe(201);
    expect(created).toHaveLength(1);
  });
  it('cannot delete yourself', async () => {
    const r = await app.inject({ method: 'DELETE', url: `/admin/users/${ADMIN.id}`, headers: { authorization: 'Bearer admin' } });
    expect(r.statusCode).toBe(400);
  });
});

describe('GET /invites/:code (public)', () => {
  it('previews a valid code without a token and normalises lower-case / missing dash', async () => {
    const r = await app.inject({ method: 'GET', url: '/invites/luna4f7k' });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toEqual({ code: 'LUNA-4F7K', campaignName: 'Las ruinas de Manhattan', systemId: 'plenilunio', dmName: 'Ignacio', seatsFree: 4 });
    expect(r.json().data.id).toBeUndefined();
  });
  it('404 INVALID_CODE for unknown or malformed codes — same body, no hint why', async () => {
    const a = await app.inject({ method: 'GET', url: '/invites/XXXX-XXXX' });
    const b = await app.inject({ method: 'GET', url: '/invites/12' });
    const c = await app.inject({ method: 'GET', url: '/invites/AAAA-BBBB-CCCC-DDDD' });
    for (const r of [a, b, c]) { expect(r.statusCode).toBe(404); expect(r.json().error.code).toBe('INVALID_CODE'); }
  });
});

describe('PUT /characters/:id/sheet', () => {
  const sheet = () => { const s = plenilunio.newSheet(); (s as Record<string, unknown>)['name'] = 'Karen'; return s; };
  it('401 without token, 404 unknown character', async () => {
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, payload: { data: sheet() } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: '/characters/66666666-6666-4666-8666-666666666666/sheet', headers: { authorization: 'Bearer player' }, payload: { data: sheet() } })).statusCode).toBe(404);
  });
  it('400 INVALID_SHEET with issues when data breaks the schema (unknown key, out of range)', async () => {
    const bad = { ...sheet(), destiny: 99, hack: 1 };
    const r = await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: bad } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('INVALID_SHEET');
    expect(r.json().error.issues).toEqual(expect.arrayContaining([{ field: 'destiny', code: 'max' }, { field: 'hack', code: 'unknown' }]));
    expect(saved).toHaveLength(0);
  });
  it('owner saves: derived computed by the engine, persisted as the actor with origin', async () => {
    const r = await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: sheet(), origin: 'damage' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.derived.endurance).toBeGreaterThan(0);
    expect(saved[0]).toMatchObject({ id: CHAR_ID, actor: PLAYER.id, origin: 'damage' });
    expect((saved[0]!.patch as { derived: { endurance: number } }).derived.endurance).toBe(r.json().data.derived.endurance);
  });
  it('XP: a player may only spend (decrease) through progression; the DM may award', async () => {
    const base = sheet();
    (base as Record<string, unknown>)['xp'] = 5; // prev xp in the fake character is 0
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: base } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer admin' }, payload: { data: base, origin: 'dm' } })).statusCode).toBe(200);
    expect(saved.at(-1)!.patch).toMatchObject({ xp: 5 });
    const same = { ...sheet(), xp: 0 }; // unchanged xp → allowed for the player…
    const r = await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: same, xp: 9999 } });
    expect(r.statusCode).toBe(200);
    expect((saved.at(-1)!.patch as { xp?: number }).xp).toBeUndefined(); // …but the top-level xp from a player is ignored
  });
  it("403 when a player tags origin 'dm'; DM may", async () => {
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: sheet(), origin: 'dm' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer admin' }, payload: { data: sheet(), origin: 'dm' } })).statusCode).toBe(200);
  });
});

describe('POST /rolls', () => {
  const req = { campaignId: CAMP_ID, systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', groups: [{ count: 4, sides: 6, tag: 'own' }], options: { stat: 'combat' }, visibility: 'table', characterId: CHAR_ID };
  it('401 without token; 400 on malformed / missing campaignId; 409 unknown system', async () => {
    expect((await app.inject({ method: 'POST', url: '/rolls', payload: req })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [] } })).statusCode).toBe(400);
    const { campaignId: _c, ...noCampaign } = req; void _c;
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: noCampaign })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, systemId: 'dnd5e' } })).statusCode).toBe(409);
  });
  it('rolls server-side dice in range, resolves with the system engine and commits the roll with the actor + campaign', async () => {
    committed.length = 0;
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: req });
    expect(r.statusCode).toBe(200);
    const d = r.json().data;
    expect(d.id).toBe('roll-1');
    // groups are rebuilt from the sheet by engine.poolFor (combat value of the fake sheet), not taken from the client
    expect(d.dice[0].length).toBeGreaterThan(0);
    for (const v of d.dice[0]) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6); }
    expect(typeof d.result.summary).toBe('string');
    expect(committed[0]).toMatchObject({ actorId: PLAYER.id, campaignId: CAMP_ID, characterId: CHAR_ID, systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', visibility: 'table', shared: {} });
    expect(committed[0]!.dice).toEqual(d.dice);
  });
  it('403 when the character belongs to another campaign or the actor is not a member (free roll)', async () => {
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, campaignId: OTHER_CAMP } })).statusCode).toBe(403);
    const free = { campaignId: OTHER_CAMP, systemId: null, kind: 'free', title: '2d10', groups: [{ count: 2, sides: 10 }], visibility: 'table' };
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: free })).statusCode).toBe(403);
    // the DM is not in campaigns_members but may roll
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer admin' }, payload: { ...free, campaignId: CAMP_ID } })).statusCode).toBe(200);
  });
  it('403 when a group rolls more shared-pool dice than the request declares (debit bypass)', async () => {
    committed.length = 0;
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [...req.groups, { count: 3, sides: 6, tag: 'destiny' }], sharedResources: { destiny: 1 } } });
    expect(r.statusCode).toBe(403);
    const none = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [...req.groups, { count: 1, sides: 6, tag: 'destiny' }] } });
    expect(none.statusCode).toBe(403);
    expect(committed).toHaveLength(0);
  });
  it('409 POOL_EMPTY when the hand cannot cover the shared dice (commit rejects) — nothing is saved', async () => {
    saved.length = 0;
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [...req.groups, { count: 2, sides: 6, tag: 'destiny' }], sharedResources: { destiny: 2 } } });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('POOL_EMPTY');
    expect(saved).toHaveLength(0);
  });
  it('applies result.effects.patch to the sheet server-side (origin roll) and returns the authoritative derived/health', async () => {
    saved.length = 0;
    // Rigged dice: every die is a 6 → the Destiny die is a triumph → destinyUp → patch { destiny: 3, fortune: 3 }.
    const rigged = await createApp({ ...makeDeps(), rng: () => 6 });
    const r = await rigged.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [{ count: 0, sides: 6, tag: 'own' }, { count: 1, sides: 6, tag: 'destiny' }], sharedResources: { destiny: 1 }, options: { stat: 'combat', destinyDice: 1 } } });
    expect(r.statusCode).toBe(200);
    const d = r.json().data;
    expect(d.result.effects.destinyUp).toBe(true);
    expect(d.effectsApplied).toBe(true);
    expect(d.sheet.derived.endurance).toBeGreaterThan(0);
    expect(saved.at(-1)).toMatchObject({ id: CHAR_ID, actor: PLAYER.id, origin: 'roll' });
    expect((saved.at(-1)!.patch as { data: SheetData }).data.destiny).toBe(3);
    // the roll is committed BEFORE the effects, and reports the failure without losing the roll
    saved.length = 0;
    const broken = await createApp({ ...makeDeps(), rng: () => 6, characters: { ...makeDeps().characters, saveSheet: async () => { throw new Error('db down'); } } });
    const b = await broken.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [{ count: 0, sides: 6, tag: 'own' }, { count: 1, sides: 6, tag: 'destiny' }], sharedResources: { destiny: 1 }, options: { stat: 'combat', destinyDice: 1 } } });
    expect(b.statusCode).toBe(200);
    expect(b.json().data.effectsApplied).toBe(false);
    await rigged.close(); await broken.close();
  });
  it('free roll persists with systemId null and sums with modifier (Fudge dice count −1/0/+1)', async () => {
    committed.length = 0;
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { campaignId: CAMP_ID, systemId: null, kind: 'free', title: '2d10', groups: [{ count: 2, sides: 10 }], visibility: 'dm', modifier: 3 } });
    expect(r.statusCode).toBe(200);
    const d = r.json().data;
    expect(d.result.total).toBe(d.dice[0][0] + d.dice[0][1] + 3);
    expect(committed[0]).toMatchObject({ systemId: null, kind: 'free', characterId: null, visibility: 'dm' });
    const f = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { campaignId: CAMP_ID, systemId: null, kind: 'free', title: '4dF', groups: [{ count: 4, sides: 3, tag: 'fudge' }], visibility: 'table' } });
    const fd = f.json().data;
    expect(fd.result.total).toBe((fd.dice[0] as number[]).reduce((a: number, v: number) => a + (v - 2), 0));
  });
});

describe('POST /rolls — character rolls need owner or DM', () => {
  it('403 for a member who does not own the character', async () => {
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer member' }, payload: { campaignId: CAMP_ID, systemId: 'plenilunio', kind: 'system', title: 'x', groups: [{ count: 2, sides: 6, tag: 'own' }], options: { stat: 'combat' }, visibility: 'table', characterId: CHAR_ID } });
    expect(r.statusCode).toBe(403);
  });
});

describe('POST /rolls — pool authority', () => {
  it('rebuilds the dice groups from the sheet via engine.poolFor (client groups are only a preview)', async () => {
    // fake character sheet has no stats → poolFor gives the stat's default value; the client claims 20 own dice.
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { campaignId: CAMP_ID, systemId: 'plenilunio', kind: 'system', title: 'Combate', groups: [{ count: 20, sides: 6, tag: 'own' }], options: { stat: 'combat' }, visibility: 'table', characterId: CHAR_ID } });
    expect(r.statusCode).toBe(200);
    const own = (r.json().data.request.groups as { count: number; tag?: string }[]).find(g => g.tag === 'own');
    expect(own!.count).toBeLessThan(20);
    expect(r.json().data.dice[0].length).toBe(own!.count);
  });
  /**
   * El techo de dados extra tiene que valer también AQUÍ, no sólo en el navegador: es la lección de la tanda
   * anterior, donde el de los dados de defensa vivía sólo en la pantalla y un `{"defence": 40}` mandado a
   * mano daba 40 dados. El manual da «uno o dos» por herramientas y no acumulables (p.87, RULES.md §2.8), y
   * `poolFor` —por donde el servidor rehace los grupos— lo recorta, así que un `extraDice: 26` a mano no cuela.
   */
  it('recorta los dados extra pedidos a mano: el techo del manual no vive en el navegador (p.87)', async () => {
    const payload = { campaignId: CAMP_ID, systemId: 'plenilunio', kind: 'system', title: 'Combate', groups: [{ count: 30, sides: 6, tag: 'own' }], options: { stat: 'combat', extraDice: 26 }, visibility: 'table', characterId: CHAR_ID };
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload });
    expect(r.statusCode).toBe(200);
    const data = r.json().data as { request: { groups: { count: number; tag?: string }[]; options: Record<string, unknown> }; dice: number[][] };
    const own = data.request.groups.find(g => g.tag === 'own')!;
    const base = plenilunio.engine.poolFor(charData(), { stat: 'combat', options: { difficulty: 0 } }).groups[0]!.count;
    expect(own.count).toBe(base + 2);
    expect(data.dice[0]!.length).toBe(own.count);
    // Y lo GUARDADO es lo que de verdad se tiró, no lo que se pidió: el Registro no puede decir «+26».
    expect(data.request.options['extraDice']).toBe(2);
  });
});


// ── maps (H7 slice 2): vision and fog are computed by the server, never by the browser ──
const SCENE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const post = (app: FastifyInstance, url: string, token?: string, payload?: unknown) =>
  app.inject({ method: 'POST', url, ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}), ...(payload ? { payload } : {}) });

describe('POST /scenes/:id/vision', () => {
  it('requires a token', async () => {
    expect((await post(app, `/scenes/${SCENE_ID}/vision`)).statusCode).toBe(401);
  });
  it('rejects a scene id that is not a uuid', async () => {
    expect((await post(app, '/scenes/nope/vision', 'player')).statusCode).toBe(400);
  });
  it('404 for an unknown scene, 403 for someone who is not at the table', async () => {
    expect((await post(app, '/scenes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/vision', 'player')).statusCode).toBe(404);
    expect((await post(app, `/scenes/${SCENE_ID}/vision`, 'member')).statusCode).toBe(403);
  });
  it('answers the player with their own polygon and remembers what they saw', async () => {
    const res = await post(app, `/scenes/${SCENE_ID}/vision`, 'player');
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; data: { vision: number[][][]; explored: number[][]; radiusPx: number | null } };
    expect(body.ok).toBe(true);
    expect(body.data.vision).toHaveLength(1);
    expect(body.data.explored.length).toBeGreaterThan(0);
    expect(body.data.radiusPx).toBeNull();
  });
  it('answers the DM with no polygon (they see everything) and the union of the table', async () => {
    const body = (await post(app, `/scenes/${SCENE_ID}/vision`, 'admin')).json() as { data: { vision: unknown[]; explored: number[][] } };
    expect(body.data.vision).toEqual([]);
    expect(body.data.explored.length).toBeGreaterThan(0);
  });

  /**
   * PAREDES SÓLIDAS DE PUNTA A PUNTA: `at.from` tiene que atravesar el esquema zod de la ruta. El cuerpo se
   * parsea con `safeParse` y fallback silencioso — si el esquema rechazara `from`, el `at` ENTERO se
   * descartaría y la física moriría en producción sin ningún error y con los tests del caso de uso en verde
   * (van directos a `computeSceneVision`). Este test es el canario (review, 3.ª ronda).
   */
  it('la física viaja entera por la ruta: `at.from` pasa el esquema y la corrección y la holgura llegan', async () => {
    const TOKEN_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const solid = await createApp({
      ...makeDeps(),
      maps: fakeMapsRepo({
        roles: { [ADMIN.id]: 'dm', [PLAYER.id]: 'player' },
        tokens: [{ id: TOKEN_UUID, x: 2, y: 5, size: 1, controlledBy: PLAYER.id }],
        scene: { solidWalls: true },
      }),
    });
    try {
      const res = await post(solid, `/scenes/${SCENE_ID}/vision`, 'player', { at: { tokenId: TOKEN_UUID, x: 7, y: 5, from: { x: 2, y: 5 } } });
      expect(res.statusCode).toBe(200);
      const data = res.json().data as { corrected: { tokenId: string; x: number } | null; clearance: number | null };
      // pidió cruzar el muro de x = 135: recortado a este lado (centro a 135 − 13.5 − 0.5 px), pegado
      expect(data.corrected).not.toBeNull();
      expect(data.corrected!.x).toBeCloseTo(121 / 27 - 0.5, 3);
      expect(data.clearance).toBeCloseTo(0, 6);
    } finally {
      await solid.close();
    }
  });
});

describe('POST /scenes/:id/fog', () => {
  it('rejects a body with neither `at` nor `all`', async () => {
    expect((await post(app, `/scenes/${SCENE_ID}/fog`, 'admin', { op: 'reveal' })).statusCode).toBe(400);
  });
  it('only the DM paints', async () => {
    expect((await post(app, `/scenes/${SCENE_ID}/fog`, 'player', { op: 'reveal', all: true })).statusCode).toBe(403);
  });
  it('«revelar todo» reveals the whole scene for the table', async () => {
    const body = (await post(app, `/scenes/${SCENE_ID}/fog`, 'admin', { op: 'reveal', all: true })).json() as { data: { explored: number[][] } };
    expect(body.data.explored).toHaveLength(100);
  });
  it('the brush hides only what it covers', async () => {
    await post(app, `/scenes/${SCENE_ID}/fog`, 'admin', { op: 'reveal', all: true });
    const body = (await post(app, `/scenes/${SCENE_ID}/fog`, 'admin', { op: 'hide', at: { x: 13.5, y: 13.5, radius: 20 } })).json() as { data: { explored: number[][] } };
    expect(body.data.explored.some(([x, y]) => x === 0 && y === 0)).toBe(false);
    expect(body.data.explored).toHaveLength(99);
  });
});

// ── ataques a la espera (`.pen` columna 5): el director abre, el jugador contesta y ahí sale la tirada ──
describe('POST /attacks', () => {
  const body = () => ({ campaignId: CAMP_ID, attackerName: 'Ogro', targetCharacterId: CHAR_ID, dice: 4, request: attackRequest() });
  it('requires a token', async () => {
    expect((await post(app, '/attacks')).statusCode).toBe(401);
  });
  it('rejects a body without a request', async () => {
    expect((await post(app, '/attacks', 'admin', { campaignId: CAMP_ID, attackerName: 'Ogro', targetCharacterId: CHAR_ID, dice: 4 })).statusCode).toBe(400);
  });
  it('only the DM opens an attack', async () => {
    expect((await post(app, '/attacks', 'player', body())).statusCode).toBe(403);
  });
  it('the DM opens it and gets its id back', async () => {
    const r = await post(app, '/attacks', 'admin', body());
    expect(r.statusCode).toBe(200);
    expect(r.json().data.id).toBe(ATTACK_ID);
    expect(opened.at(-1)?.attackerName).toBe('Ogro');
  });
});

describe('POST /attacks/:id/answer', () => {
  it('requires a token, and the id must be a uuid', async () => {
    expect((await post(app, `/attacks/${ATTACK_ID}/answer`)).statusCode).toBe(401);
    expect((await post(app, '/attacks/nope/answer', 'player', { defence: 1 })).statusCode).toBe(400);
  });
  it('rejects a defence that is not a whole number of dice', async () => {
    expect((await post(app, `/attacks/${ATTACK_ID}/answer`, 'player', { defence: -1 })).statusCode).toBe(400);
    expect((await post(app, `/attacks/${ATTACK_ID}/answer`, 'player', {})).statusCode).toBe(400);
  });
  it('only the owner of the attacked character answers', async () => {
    expect((await post(app, `/attacks/${ATTACK_ID}/answer`, 'admin', { defence: 1 })).statusCode).toBe(403);
  });
  /** El techo son los dados que le da su Combate AHORA: se pide al sistema, no se copia un número aquí. */
  const cap = () => ownDiceForStat(plenilunio, charData(), 'combat') ?? 0;

  it('answering rolls right there, with the defence dice facing the attacker', async () => {
    const before = committed.length;
    const r = await post(app, `/attacks/${ATTACK_ID}/answer`, 'player', { defence: cap() });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.defence).toBe(cap());
    const rolled = committed[before];
    expect(rolled?.actorId).toBe(ADMIN.id);
    expect(rolled?.request.groups).toContainEqual({ count: cap(), sides: 6, tag: 'opposition' });
    expect(closedAttacks.at(-1)?.status).toBe('resolved');
  });

  /**
   * El agujero que cerró el review: el techo vivía sólo en el navegador. Un `{"defence": 40}` a pelo daba
   * 40 dados de defensa. Ahora lo recorta el servidor con la misma cuenta que pinta la pantalla.
   */
  it('a defence bigger than the character\'s own dice is trimmed, not obeyed', async () => {
    const before = committed.length;
    const r = await post(app, `/attacks/${ATTACK_ID}/answer`, 'player', { defence: 40 });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.defence).toBe(cap());
    expect(committed[before]?.request.groups.find(g => g.tag === 'opposition')?.count).toBe(cap());
  });
  it('«no me defiendo» is an answer: it rolls with nothing facing the attacker', async () => {
    const before = committed.length;
    const r = await post(app, `/attacks/${ATTACK_ID}/answer`, 'player', { defence: 0 });
    expect(r.statusCode).toBe(200);
    expect(committed[before]?.request.groups.some(g => g.tag === 'opposition')).toBe(false);
  });
});
