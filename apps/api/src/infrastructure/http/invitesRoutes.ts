import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { IInviteRepository } from '../../domain/invite/IInviteRepository.js';

interface InvitesPluginOptions extends FastifyPluginOptions {
  invites: IInviteRepository;
}

/** `LUNA-4F7K` — 4+4 uppercase alphanumerics; lower-case and missing dash are normalised. */
const CodeParams = z.object({ code: z.string().trim().min(8).max(9) });
export const normalizeCode = (raw: string): string | null => {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : null;
};

const NOT_FOUND = { ok: false, error: { code: 'INVALID_CODE', message: 'That code is not valid' } };

/**
 * Public (no token): visitors preview an invitation before signing up. The
 * response never says *why* a code fails, and never carries the campaign id.
 */
export async function invitesRoutes(app: FastifyInstance, opts: InvitesPluginOptions): Promise<void> {
  const { invites } = opts;

  app.get('/:code', async (request, reply) => {
    const parsed = CodeParams.safeParse(request.params);
    const code = parsed.success ? normalizeCode(parsed.data.code) : null;
    if (!code) return reply.status(404).send(NOT_FOUND);
    const preview = await invites.preview(code);
    if (!preview) return reply.status(404).send(NOT_FOUND);
    return reply.send({ ok: true, data: preview });
  });
}
