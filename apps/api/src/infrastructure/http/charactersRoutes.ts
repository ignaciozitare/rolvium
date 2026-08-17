import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import { saveSheet } from '../../application/characters/saveSheet.js';

interface Opts extends FastifyPluginOptions { characters: ICharacterRepository; systemById: (id: string) => GameSystem | null }

const IdParams = z.object({ id: z.string().uuid() });
const Body = z.object({
  data: z.record(z.unknown()),
  origin: z.enum(['sheet', 'roll', 'damage', 'progression', 'dm']).default('sheet'),
  xp: z.number().int().min(0).optional(),
});
const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, SYSTEM_NOT_INSTALLED: 409, INVALID_SHEET: 400 };

/** `PUT /characters/:id/sheet` — the authoritative sheet save (validate → derive → persist as the actor). */
export async function charactersRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.put('/:id/sheet', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = IdParams.safeParse(request.params);
    const b = Body.safeParse(request.body);
    if (!p.success || !b.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } });
    const r = await saveSheet({ characters: opts.characters, systemById: opts.systemById }, { characterId: p.data.id, actorId: request.identity.userId, data: b.data.data, origin: b.data.origin, ...(b.data.xp !== undefined ? { xp: b.data.xp } : {}) });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code, ...(r.issues ? { issues: r.issues } : {}) } });
    return reply.send({ ok: true, data: { derived: r.derived, health: r.health } });
  });
}
