// ─────────────────────────────────────────────────────────────────────────────
// Rolvium API — Fastify app factory (composition root)
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ITokenVerifier, VerifiedIdentity } from './domain/auth/ITokenVerifier.js';
import type { IUserRepository } from './domain/user/IUserRepository.js';
import type { IUserAdmin } from './domain/user/IUserAdmin.js';
import { SupabaseTokenVerifier } from './infrastructure/supabase/SupabaseTokenVerifier.js';
import { SupabaseUserRepo } from './infrastructure/supabase/SupabaseUserRepo.js';
import { SupabaseUserAdmin } from './infrastructure/supabase/SupabaseUserAdmin.js';
import { authRoutes } from './infrastructure/http/authRoutes.js';
import { adminRoutes } from './infrastructure/http/adminRoutes.js';

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
