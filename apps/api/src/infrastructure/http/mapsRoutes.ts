import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { IMapsRepository } from '../../domain/maps/IMapsRepository.js';
import { computeSceneVision, paintSceneFog, type VisionErrorCode } from '../../application/maps/sceneVision.js';

interface Opts extends FastifyPluginOptions { maps: IMapsRepository }

const Params = z.object({ sceneId: z.string().uuid() });
const PaintBody = z.object({
  op: z.enum(['reveal', 'hide']),
  all: z.boolean().optional(),
  at: z.object({ x: z.number().finite(), y: z.number().finite(), radius: z.number().positive().max(4000) }).optional(),
}).refine(b => b.all === true || b.at !== undefined, { message: 'at or all required' });

/** Posición provisional de un token propio mientras se arrastra. No mueve nada: sólo pregunta qué vería ahí. */
const VisionBody = z.object({
  at: z.object({
    tokenId: z.string().uuid(), x: z.number().finite(), y: z.number().finite(),
    /** Desde dónde sale el barrido: la posición ACTUAL del token en el navegador. Sin él, la guardada. */
    from: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
  }).optional(),
  /** «Ver con los ojos de»: el director pide lo que vería ESA ficha. Se ignora para quien no lo sea. */
  asTokenId: z.string().uuid().optional(),
});

const STATUS: Record<VisionErrorCode, number> = { NOT_FOUND: 404, FORBIDDEN: 403 };
const bad = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid scene request' } };

/**
 * Vision and fog (H7 slice 2). The client never computes what it can see: it asks here, and the server answers with
 * a polygon and a set of cells. That is the security boundary — the walls a player must not know about never leave
 * this process (specs/modules/maps/SPEC.md § «Rules & limits»).
 */
export async function mapsRoutes(app: FastifyInstance, opts: Opts): Promise<void> {
  /** Recompute for whoever asks: on entering the scene, on moving a token, on a door/light/wall change. */
  app.post('/:sceneId/vision', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    if (!p.success) return reply.status(400).send(bad);
    // Cuerpo OPCIONAL: la posición provisional del token que se está arrastrando, para que la niebla lo siga
    // sin esperar a que lo suelten. Un cuerpo mal formado se ignora y se contesta la visión de siempre — una
    // consulta de dibujo no debe tumbarse por eso.
    const at = VisionBody.safeParse(request.body ?? {});
    const r = await computeSceneVision(opts, {
      sceneId: p.data.sceneId, userId: request.identity.userId,
      ...(at.success && at.data.at ? { at: at.data.at } : {}),
      ...(at.success && at.data.asTokenId ? { asTokenId: at.data.asTokenId } : {}),
    });
    if (!r.ok) return reply.status(STATUS[r.code]).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });

  /** The DM's reveal/hide brush — writes on every player's explored cells at once. */
  app.post('/:sceneId/fog', { preHandler: [app.authenticate] }, async (request, reply) => {
    const p = Params.safeParse(request.params);
    const b = PaintBody.safeParse(request.body);
    if (!p.success || !b.success) return reply.status(400).send(bad);
    const { op, at, all } = b.data;
    const r = await paintSceneFog(opts, { sceneId: p.data.sceneId, userId: request.identity.userId, op, ...(at ? { at } : {}), ...(all ? { all } : {}) });
    if (!r.ok) return reply.status(STATUS[r.code]).send({ ok: false, error: { code: r.code, message: r.code.toLowerCase() } });
    return reply.send({ ok: true, data: r.data });
  });
}
