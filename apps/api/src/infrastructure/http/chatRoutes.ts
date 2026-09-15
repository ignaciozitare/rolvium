import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem, RollRequest } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { IChatRollRepository } from '../../domain/chatRoll/IChatRollRepository.js';
import { performChatRoll } from '../../application/chatRolls/performChatRoll.js';
import { RollRequestBody } from './rollBody.js';

interface Opts extends FastifyPluginOptions { characters: ICharacterRepository; chatRolls: IChatRollRepository; systemById: (id: string) => GameSystem | null; rng?: (sides: number) => number }

// Same shape as `POST /rolls`, minus `visibility` (a whisper has no such thing — it's already private) and with
// `conversationId` instead of `campaignId`: the campaign is derived server-side from the conversation.
const Body = RollRequestBody.omit({ visibility: true }).extend({ conversationId: z.string().uuid() });

const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, SYSTEM_NOT_INSTALLED: 409 };

/**
 * `POST /chat/rolls` — a roll made inside a SUSURROS conversation. Same server-side fairness as `POST /rolls`
 * (CSPRNG, the system rebuilds the pool), but committed to `chat_messages` via `chat_commit_roll`: it never
 * touches `dice_rolls`, so there is no path by which it could reach the Registro.
 */
export async function chatRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/rolls', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = Body.safeParse(request.body);
    if (!b.success) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid roll request' } });
    const { conversationId, ...req } = b.data;
    if (req.kind === 'system' && !req.systemId) return reply.status(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'systemId required' } });
    const r = await performChatRoll(opts, { actorId: request.identity.userId, conversationId, request: req as RollRequest });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
