import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IRollRepository } from '../../domain/roll/IRollRepository.js';
import type { IRollRequestRepository } from '../../domain/rollRequest/IRollRequestRepository.js';
import { answerRollRequest, openRollRequests } from '../../application/rollRequests/answerRollRequest.js';

interface Opts extends FastifyPluginOptions {
  characters: ICharacterRepository; rolls: IRollRepository; rollRequests: IRollRequestRepository;
  systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number;
}

const OpenBody = z.object({
  campaignId: z.string().uuid(),
  targetCharacterIds: z.array(z.string().uuid()).min(1).max(20),
  stat: z.string().min(1).max(40),
  difficulty: z.number().int().min(0).max(12),
  specialtyAllowed: z.boolean().default(false),
});
const Params = z.object({ id: z.string().uuid() });

const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, NOT_PENDING: 409, POOL_EMPTY: 409, SYSTEM_NOT_INSTALLED: 409 };
const bad = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid roll request' } };

/**
 * Peticiones de tirada del director (`.pen` columna 4, `specs/modules/dice/SPEC.md`).
 *
 * `POST /roll-requests` — el director pide: una fila por personaje del lote, y a cada jugador le SALTA el aviso.
 * `POST /roll-requests/:id/answer` — el jugador contesta y la tirada sale ahí mismo, armada desde SU ficha.
 *
 * Los dos pasos son del servidor: los dados los genera el servidor y el puñado lo rehace `poolFor` — el
 * navegador no manda ni grupos ni opciones.
 */
export async function rollRequestsRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = OpenBody.safeParse(request.body);
    if (!b.success) return reply.status(400).send(bad);
    const r = await openRollRequests(opts, { actorId: request.identity.userId, ...b.data });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });

  app.post('/:id/answer', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    if (!p.success) return reply.status(400).send(bad);
    const r = await answerRollRequest(opts, { actorId: request.identity.userId, requestId: p.data.id });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
