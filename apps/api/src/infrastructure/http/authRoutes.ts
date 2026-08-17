import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { IUserRepository } from '../../domain/user/IUserRepository.js';

interface AuthPluginOptions extends FastifyPluginOptions {
  userRepo: IUserRepository;
}

/**
 * Login itself happens in the browser against Supabase Auth (the anon key is
 * public by design; RLS protects the data). The API only needs to answer
 * "who am I" for a verified token.
 */
export async function authRoutes(app: FastifyInstance, opts: AuthPluginOptions): Promise<void> {
  const { userRepo } = opts;

  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const profile = await userRepo.findById(request.identity.userId);
    if (!profile) return reply.status(404).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    return reply.send({ ok: true, data: profile });
  });
}
