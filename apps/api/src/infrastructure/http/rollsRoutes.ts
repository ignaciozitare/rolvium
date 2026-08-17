import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem, RollRequest } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import { rollDice } from '../../application/rolls/rollDice.js';

interface Opts extends FastifyPluginOptions { characters: ICharacterRepository; systemById: (id: string) => GameSystem | null }

const Group = z.object({ count: z.number().int().min(0).max(100), sides: z.number().int().min(2).max(1000), tag: z.string().max(32).optional() });
const Body = z.object({
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

/**
 * `POST /rolls` — the server generates the dice (CSPRNG) and the system
 * resolves them; the client only sends the intention. Persistence into a roll
 * log belongs to the `dice` hexagon (H6) — until then the outcome is returned
 * and the client applies `result.effects` through `PUT /characters/:id/sheet`.
 */
export async function rollsRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = Body.safeParse(request.body);
    if (!b.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid roll request' } });
    const req = b.data as RollRequest;
    let system: GameSystem | null = null;
    if (req.kind === 'system') {
      if (!req.systemId) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'systemId required' } });
      system = opts.systemById(req.systemId);
      if (!system) return reply.status(409).send({ ok: false, error: { code: 'SYSTEM_NOT_INSTALLED', message: req.systemId } });
    }
    if (req.characterId) {
      const c = await opts.characters.findForActor(req.characterId, request.identity.userId);
      if (!c) return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'character' } });
      if (!c.isMember) return reply.status(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'not a member' } });
    }
    return reply.send({ ok: true, data: rollDice(req, system) });
  });
}
