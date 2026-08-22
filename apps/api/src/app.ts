// ─────────────────────────────────────────────────────────────────────────────
// Rolvium API — Fastify app factory (composition root)
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ITokenVerifier, VerifiedIdentity } from './domain/auth/ITokenVerifier.js';
import type { IUserRepository } from './domain/user/IUserRepository.js';
import type { IUserAdmin } from './domain/user/IUserAdmin.js';
import type { IInviteRepository } from './domain/invite/IInviteRepository.js';
import type { ICharacterRepository } from './domain/character/ICharacterRepository.js';
import type { IRollRepository } from './domain/roll/IRollRepository.js';
import type { IAttackRepository } from './domain/attack/IAttackRepository.js';
import type { IRollRequestRepository } from './domain/rollRequest/IRollRequestRepository.js';
import type { IMapsRepository } from './domain/maps/IMapsRepository.js';
import type { GameSystem } from '@rolvium/core';
import { SupabaseTokenVerifier } from './infrastructure/supabase/SupabaseTokenVerifier.js';
import { SupabaseUserRepo } from './infrastructure/supabase/SupabaseUserRepo.js';
import { SupabaseUserAdmin } from './infrastructure/supabase/SupabaseUserAdmin.js';
import { SupabaseInviteRepo } from './infrastructure/supabase/SupabaseInviteRepo.js';
import { SupabaseCharacterRepo } from './infrastructure/supabase/SupabaseCharacterRepo.js';
import { SupabaseRollRepo } from './infrastructure/supabase/SupabaseRollRepo.js';
import { SupabaseAttackRepo } from './infrastructure/supabase/SupabaseAttackRepo.js';
import { SupabaseRollRequestRepo } from './infrastructure/supabase/SupabaseRollRequestRepo.js';
import { SupabaseMapsRepo } from './infrastructure/supabase/SupabaseMapsRepo.js';
import { systemById } from './infrastructure/systems.js';
import { authRoutes } from './infrastructure/http/authRoutes.js';
import { adminRoutes } from './infrastructure/http/adminRoutes.js';
import { invitesRoutes } from './infrastructure/http/invitesRoutes.js';
import { charactersRoutes } from './infrastructure/http/charactersRoutes.js';
import { rollsRoutes } from './infrastructure/http/rollsRoutes.js';
import { attacksRoutes } from './infrastructure/http/attacksRoutes.js';
import { rollRequestsRoutes } from './infrastructure/http/rollRequestsRoutes.js';
import { mapsRoutes } from './infrastructure/http/mapsRoutes.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    identity: VerifiedIdentity;
  }
}

/** Dependencies the app needs. Tests inject fakes; production wires Supabase. */
export interface AppDeps {
  tokenVerifier: ITokenVerifier;
  userRepo: IUserRepository;
  userAdmin: IUserAdmin;
  invites: IInviteRepository;
  characters: ICharacterRepository;
  rolls: IRollRepository;
  /** Ataques cuerpo a cuerpo a la espera de que el jugador conteste (`dice_attacks`). */
  attacks: IAttackRepository;
  /** Peticiones de tirada del director a la espera de que el jugador conteste (`dice_roll_requests`). */
  rollRequests: IRollRequestRepository;
  maps: IMapsRepository;
  /** Installed game systems (defaults to the bundled registry). */
  systemById?: (id: string) => GameSystem | null;
  /** Dice source for `POST /rolls` (defaults to CSPRNG); tests inject a rigged one. */
  rng?: (sides: number) => number;
  allowedOrigins?: string[];
  logger?: boolean;
}

export function supabaseDeps(): AppDeps {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGIN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
  const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    tokenVerifier: new SupabaseTokenVerifier(db),
    userRepo: new SupabaseUserRepo(db),
    userAdmin: new SupabaseUserAdmin(db),
    invites: new SupabaseInviteRepo(db),
    characters: new SupabaseCharacterRepo(db),
    rolls: new SupabaseRollRepo(db),
    attacks: new SupabaseAttackRepo(db),
    rollRequests: new SupabaseRollRequestRepo(db),
    maps: new SupabaseMapsRepo(db),
    allowedOrigins: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(',').map(s => s.trim()) : [],
    logger: true,
  };
}

const UNAUTHORIZED = { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } };

export async function createApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  const allowed = deps.allowedOrigins ?? [];

  await app.register(cors, {
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, cb) => {
      const ok =
        !origin ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https:\/\/rolvium(-[a-z0-9-]+)*\.vercel\.app$/.test(origin) ||
        allowed.includes(origin);
      cb(ok ? null : new Error(`CORS: origin not allowed — ${origin}`), ok);
    },
  });

  // ── authenticate: verifies the Supabase access token (signature + expiry) ─
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) { reply.status(401).send(UNAUTHORIZED); return; }
    const identity = await deps.tokenVerifier.verify(header.slice(7));
    if (!identity) { reply.status(401).send(UNAUTHORIZED); return; }
    request.identity = identity;
  });

  await app.register(authRoutes, { prefix: '/auth', userRepo: deps.userRepo });
  await app.register(adminRoutes, { prefix: '/admin', userRepo: deps.userRepo, userAdmin: deps.userAdmin });
  await app.register(invitesRoutes, { prefix: '/invites', invites: deps.invites });
  const sys = deps.systemById ?? systemById;
  await app.register(charactersRoutes, { prefix: '/characters', characters: deps.characters, systemById: sys });
  await app.register(rollsRoutes, { prefix: '/rolls', characters: deps.characters, rolls: deps.rolls, systemById: sys, ...(deps.rng ? { rng: deps.rng } : {}) });
  await app.register(attacksRoutes, { prefix: '/attacks', characters: deps.characters, rolls: deps.rolls, attacks: deps.attacks, systemById: sys, ...(deps.rng ? { rng: deps.rng } : {}) });
  await app.register(rollRequestsRoutes, { prefix: '/roll-requests', characters: deps.characters, rolls: deps.rolls, rollRequests: deps.rollRequests, systemById: sys, ...(deps.rng ? { rng: deps.rng } : {}) });
  await app.register(mapsRoutes, { prefix: '/scenes', maps: deps.maps });

  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  return app;
}

let _app: FastifyInstance | null = null;
/** Singleton for the serverless handler (reused across warm invocations). */
export async function buildApp(): Promise<FastifyInstance> {
  if (_app) return _app;
  _app = await createApp(supabaseDeps());
  return _app;
}
