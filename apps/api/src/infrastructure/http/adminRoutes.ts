import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { IUserRepository } from '../../domain/user/IUserRepository.js';
import type { IUserAdmin } from '../../domain/user/IUserAdmin.js';
import { assertPermission, ForbiddenError } from '../../application/authorize.js';

interface AdminPluginOptions extends FastifyPluginOptions {
  userRepo: IUserRepository;
  userAdmin: IUserAdmin;
}

const CreateUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  roleId: z.string().uuid(),
});

const SetPasswordSchema = z.object({ password: z.string().min(8).max(128) });
const IdParams = z.object({ id: z.string().uuid() });

/**
 * Privileged user operations (need the service role). Every route:
 *   1. authenticate (verified Supabase token)
 *   2. load caller profile, assertPermission('manage_users')
 *   3. validate input with zod at the boundary
 */
export async function adminRoutes(app: FastifyInstance, opts: AdminPluginOptions): Promise<void> {
  const { userRepo, userAdmin } = opts;

  const requireManageUsers = async (userId: string): Promise<void> => {
    const caller = await userRepo.findById(userId);
    if (!caller) throw new ForbiddenError('manage_users');
    assertPermission(caller, 'manage_users');
  };

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
    app.log.error(err);
    return reply.status(status).send({ ok: false, error: { code, message: status === 500 ? 'Internal error' : err.message } });
  });

  app.post('/users', { preHandler: [app.authenticate] }, async (request, reply) => {
    await requireManageUsers(request.identity.userId);
    const parsed = CreateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join('; ') } });

    const existing = await userRepo.findByEmail(parsed.data.email);
    if (existing) return reply.status(409).send({ ok: false, error: { code: 'EMAIL_TAKEN', message: 'A user with that email already exists' } });

    const created = await userAdmin.createUser({ ...parsed.data, email: parsed.data.email.toLowerCase() });
    const profile = await userRepo.findById(created.id);
    return reply.status(201).send({ ok: true, data: profile ?? created });
  });

  app.post('/users/:id/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    await requireManageUsers(request.identity.userId);
    const params = IdParams.safeParse(request.params);
    const body = SetPasswordSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid id or password' } });
    await userAdmin.setPassword(params.data.id, body.data.password);
    return reply.send({ ok: true, data: { id: params.data.id } });
  });

  app.delete('/users/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    await requireManageUsers(request.identity.userId);
    const params = IdParams.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } });
    if (params.data.id === request.identity.userId) return reply.status(400).send({ ok: false, error: { code: 'SELF_DELETE', message: 'You cannot delete yourself' } });
    await userAdmin.deleteUser(params.data.id);
    return reply.status(204).send();
  });
}
