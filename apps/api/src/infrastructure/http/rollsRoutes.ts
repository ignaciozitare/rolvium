import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem, RollRequest } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IRollRepository } from '../../domain/roll/IRollRepository.js';
import { performRoll } from '../../application/rolls/performRoll.js';

interface Opts extends FastifyPluginOptions { characters: ICharacterRepository; rolls: IRollRepository; systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number }

const Group = z.object({ count: z.number().int().min(0).max(100), sides: z.number().int().min(2).max(1000), tag: z.string().max(32).optional() });
const Body = z.object({
  campaignId: z.string().uuid(),
  systemId: z.string().max(64).nullable(),
  kind: z.enum(['system', 'free']),
  title: z.string().max(200),
  groups: z.array(Group).min(1).max(10),
  options: z.record(z.unknown()).optional(),
  sharedResources: z.record(z.number().int().min(0).max(50)).optional(),
  visibility: z.enum(['table', 'dm', 'secret']).default('table'),
  characterId: z.string().uuid().nullable().optional(),
  modifier: z.number().int().min(-100).max(100).optional(),
});

const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, POOL_EMPTY: 409, SYSTEM_NOT_INSTALLED: 409 };

/**
 * `POST /rolls` — body = `RollRequest & { campaignId }`. The server generates the dice (CSPRNG), the system resolves
 * them, the roll is committed to `dice_rolls` (shared dice debited atomically) and sheet effects are applied here.
 */
export async function rollsRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = Body.safeParse(request.body);
    if (!b.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid roll request' } });
    const { campaignId, ...req } = b.data;
    if (req.kind === 'system' && !req.systemId) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'systemId required' } });
    const r = await performRoll(opts, { actorId: request.identity.userId, campaignId, request: req as RollRequest });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
