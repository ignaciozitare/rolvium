import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { GameSystem } from '@rolvium/core';
import type { ICharacterRepository } from '../../domain/character/ICharacterRepository.js';
import type { ICombatRepository } from '../../domain/combat/ICombatRepository.js';
import { advanceTurn, closeCombat, nextTurn, openCombat } from '../../application/combats/combat.js';

interface Opts extends FastifyPluginOptions {
  characters: ICharacterRepository; combats: ICombatRepository;
  systemById: (id: string) => GameSystem | null;
}

const uuidOrNull = z.string().uuid().nullable().optional();
const Candidate = z.object({
  key: z.string().min(1).max(64),
  tokenId: uuidOrNull,
  characterId: uuidOrNull,
  name: z.string().max(80),
  /** Sólo se miran en los puestos SIN personaje: la ficha de un personaje la lee el servidor. */
  stats: z.record(z.string(), z.number()).optional(),
});
const OpenBody = z.object({
  campaignId: z.string().uuid(),
  sceneId: z.string().uuid(),
  systemId: z.string().min(1).max(64),
  // `key` es la identidad del puesto DENTRO de la petición: es lo que devuelve el orden y con lo que se
  // desempata. Repetida, los dos puestos apuntarían al mismo candidato al montar los slots y uno de los dos
  // desaparecería del combate sin decirlo. Se corta en la puerta, que es donde se validan las formas.
  candidates: z.array(Candidate).min(1).max(40).refine(cs => new Set(cs.map(c => c.key)).size === cs.length),
  tiebreak: z.array(z.string().min(1).max(64)).max(40).optional(),
});
const Params = z.object({ id: z.string().uuid() });
const AdvanceBody = z.object({ slotId: z.string().uuid() });

const STATUS: Record<string, number> = {
  NOT_FOUND: 404, FORBIDDEN: 403, NOT_ACTIVE: 409, COMBAT_ACTIVE: 409, CANNOT_ADVANCE: 409,
  NO_FORTUNE: 409, UNDECIDED: 409, SYSTEM_NOT_INSTALLED: 409, NO_SLOTS: 400,
};
const bad = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid combat request' } };

/**
 * El ORDEN DE TURNOS (`specs/modules/dice/SPEC.md` § «El orden de turnos», p.92–94).
 *
 * `POST /combats`            — el director lo abre; **el orden lo pone el servidor** con la regla del sistema.
 * `POST /combats/:id/next`   — pasa el turno (y salda la deuda de dados del que acaba de actuar).
 * `POST /combats/:id/close`  — lo cierra.
 * `POST /combats/:id/advance`— un jugador se adelanta un puesto pagando 1 Fortuna.
 *
 * Abrir puede contestar **409 `UNDECIDED`** con los grupos empatados: no es un error de quien llama, es el
 * final de la regla del manual —«decide el director de juego»— y la app tiene que preguntárselo y reenviar
 * su respuesta en `tiebreak`. El servidor no coloca a nadie por su cuenta.
 */
export async function combatsRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const b = OpenBody.safeParse(request.body);
    if (!b.success) return reply.status(400).send(bad);
    const r = await openCombat(opts, {
      actorId: request.identity.userId,
      campaignId: b.data.campaignId,
      sceneId: b.data.sceneId,
      systemId: b.data.systemId,
      candidates: b.data.candidates.map(c => ({
        key: c.key, tokenId: c.tokenId ?? null, characterId: c.characterId ?? null, name: c.name,
        ...(c.stats ? { stats: c.stats } : {}),
      })),
      ...(b.data.tiebreak ? { tiebreak: b.data.tiebreak } : {}),
    });
    if (!r.ok) {
      const body = r.code === 'UNDECIDED'
        ? { ok: false, error: { code: r.code, message: 'undecided' }, undecided: r.undecided }
        : { ok: false, error: { code: r.code, message: r.code.toLowerCase() } };
      return reply.status(STATUS[r.code] ?? 400).send(body);
    }
    return reply.send({ ok: true, data: r.data });
  });

  app.post('/:id/next', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    if (!p.success) return reply.status(400).send(bad);
    const r = await nextTurn(opts, { actorId: request.identity.userId, combatId: p.data.id });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });

  app.post('/:id/close', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    if (!p.success) return reply.status(400).send(bad);
    const r = await closeCombat(opts, { actorId: request.identity.userId, combatId: p.data.id });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true });
  });

  app.post('/:id/advance', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    const b = AdvanceBody.safeParse(request.body);
    if (!p.success || !b.success) return reply.status(400).send(bad);
    const r = await advanceTurn(opts, { actorId: request.identity.userId, combatId: p.data.id, slotId: b.data.slotId });
    if (!r.ok) return reply.status(STATUS[r.code] ?? 400).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
