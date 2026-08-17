import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import type { UserProfile } from './domain/user/IUserRepository.js';
import type { FastifyInstance } from 'fastify';

const ADMIN: UserProfile = { id: '11111111-1111-4111-8111-111111111111', name: 'Root', email: 'root@rolvium.test', avatarUrl: null, roleId: 'r-admin', role: 'admin', permissions: { modules: [], admin: {} }, active: true, createdAt: '' };
const PLAYER: UserProfile = { ...ADMIN, id: '22222222-2222-4222-8222-222222222222', name: 'Pip', email: 'pip@rolvium.test', role: 'player' };
const users = new Map<string, UserProfile>([[ADMIN.id, ADMIN], [PLAYER.id, PLAYER]]);
const created: unknown[] = [];

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
