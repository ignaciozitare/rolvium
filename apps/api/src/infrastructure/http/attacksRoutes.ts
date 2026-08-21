import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem, RollRequest } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IRollRepository } from '../../domain/roll/IRollRepository.js';
import type { IAttackRepository } from '../../domain/attack/IAttackRepository.js';
import { answerAttack, openAttack } from '../../application/attacks/answerAttack.js';
import { RollRequestBody } from './rollBody.js';

interface Opts extends FastifyPluginOptions {
  characters: ICharacterRepository; rolls: IRollRepository; attacks: IAttackRepository;
  systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number;
}

const uuidOrNull = z.string().uuid().nullable().optional();
const OpenBody = z.object({
  campaignId: z.string().uuid(),
  sceneId: uuidOrNull,
  attackerTokenId: uuidOrNull,
  targetTokenId: uuidOrNull,
  attackerName: z.string().max(80),
  targetCharacterId: z.string().uuid(),
  dice: z.number().int().min(0).max(40),
  request: RollRequestBody,
});
const Params = z.object({ id: z.string().uuid() });
/** 0 es una respuesta —«no me defiendo»— y no lo mismo que el silencio, así que es un valor válido. */
const AnswerBody = z.object({ defence: z.number().int().min(0).max(40) });

const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, NOT_PENDING: 409, POOL_EMPTY: 409, SYSTEM_NOT_INSTALLED: 409 };
const bad = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid attack request' } };

/**
 * Ataques cuerpo a cuerpo a la espera de respuesta (`.pen` columna 5, `specs/modules/dice/SPEC.md`).
 *
 * `POST /attacks` — el director abre el ataque: se guarda la intención y al jugador le SALTA el aviso.
 * `POST /attacks/:id/answer` — el jugador contesta con sus dados de defensa y la tirada sale ahí mismo.
 *
 * Los dos pasos son del servidor porque los dados los genera el servidor: si el navegador pudiera escribir
 * la tabla, podría abrirse un ataque a sí mismo o contestarlo por otro.
 */
export async function attacksRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = OpenBody.safeParse(request.body);
    if (!b.success) return reply.status(400).send(bad);
    const { request: req, ...rest } = b.data;
    if (req.kind === 'system' && !req.systemId) return reply.status(400).send(bad);
    const r = await openAttack(opts, {
      actorId: request.identity.userId,
      campaignId: rest.campaignId,
      sceneId: rest.sceneId ?? null,
      attackerTokenId: rest.attackerTokenId ?? null,
      targetTokenId: rest.targetTokenId ?? null,
      attackerName: rest.attackerName,
      targetCharacterId: rest.targetCharacterId,
      dice: rest.dice,
      request: req as RollRequest,
    });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });

  app.post('/:id/answer', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    const b = AnswerBody.safeParse(request.body);
    if (!p.success || !b.success) return reply.status(400).send(bad);
    const r = await answerAttack(opts, { actorId: request.identity.userId, attackId: p.data.id, defence: b.data.defence });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
