import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import type { UserProfile } from './domain/user/IUserRepository.js';
import type { FastifyInstance } from 'fastify';
import { plenilunio } from '@rolvium/system-plenilunio';

const ADMIN: UserProfile = { id: '11111111-1111-4111-8111-111111111111', name: 'Root', email: 'root@rolvium.test', avatarUrl: null, roleId: 'r-admin', role: 'admin', permissions: { modules: [], admin: {} }, active: true, createdAt: '' };
const PLAYER: UserProfile = { ...ADMIN, id: '22222222-2222-4222-8222-222222222222', name: 'Pip', email: 'pip@rolvium.test', role: 'player' };
const users = new Map<string, UserProfile>([[ADMIN.id, ADMIN], [PLAYER.id, PLAYER]]);
const created: unknown[] = [];
const CHAR_ID = '55555555-5555-4555-8555-555555555555';
const saved: { id: string; actor: string; patch: unknown; origin: string }[] = [];

let app: FastifyInstance;
beforeAll(async () => {
  app = await createApp({
    tokenVerifier: { verify: async (t) => t === 'admin' ? { userId: ADMIN.id, email: ADMIN.email } : t === 'player' ? { userId: PLAYER.id, email: PLAYER.email } : null },
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
      findForActor: async (id, actor) => id === CHAR_ID ? { id, campaignId: 'c1', systemId: 'plenilunio', ownerId: PLAYER.id, data: {}, isOwner: actor === PLAYER.id, isDm: actor === ADMIN.id, isMember: true } : null,
      saveSheet: async (id, actor, patch, origin) => { saved.push({ id, actor, patch, origin }); },
      isCampaignMember: async () => true,
    },
  });
});
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
    const same = { ...sheet(), xp: 0 }; // unchanged xp → allowed for the player
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: same } })).statusCode).toBe(200);
  });
  it("403 when a player tags origin 'dm'; DM may", async () => {
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer player' }, payload: { data: sheet(), origin: 'dm' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: `/characters/${CHAR_ID}/sheet`, headers: { authorization: 'Bearer admin' }, payload: { data: sheet(), origin: 'dm' } })).statusCode).toBe(200);
  });
});

describe('POST /rolls', () => {
  const req = { systemId: 'plenilunio', kind: 'system', title: 'Combate', groups: [{ count: 4, sides: 6, tag: 'own' }], options: { stat: 'combat' }, visibility: 'table', characterId: CHAR_ID };
  it('401 without token; 400 on malformed; 409 unknown system', async () => {
    expect((await app.inject({ method: 'POST', url: '/rolls', payload: req })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, groups: [] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { ...req, systemId: 'dnd5e' } })).statusCode).toBe(409);
  });
  it('rolls server-side dice in range and resolves with the system engine', async () => {
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: req });
    expect(r.statusCode).toBe(200);
    const d = r.json().data;
    expect(d.dice[0]).toHaveLength(4);
    for (const v of d.dice[0]) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6); }
    expect(typeof d.result.summary).toBe('string');
    expect(d.result.detail).toBeDefined();
  });
  it('free roll sums with modifier', async () => {
    const r = await app.inject({ method: 'POST', url: '/rolls', headers: { authorization: 'Bearer player' }, payload: { systemId: null, kind: 'free', title: '2d10', groups: [{ count: 2, sides: 10 }], visibility: 'table', modifier: 3 } });
    expect(r.statusCode).toBe(200);
    const d = r.json().data;
    expect(d.result.total).toBe(d.dice[0][0] + d.dice[0][1] + 3);
  });
});
