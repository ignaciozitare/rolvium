import { z } from 'zod';

/**
 * La forma de una `RollRequest` tal y como entra por HTTP. Vive aparte porque la usan DOS rutas: la de
 * tirar (`POST /rolls`) y la de abrir un ataque a la espera (`POST /attacks`), que guarda la petición
 * entera para tirarla cuando el jugador conteste. Dos copias de estos límites serían dos verdades: una
 * de ellas se quedaría atrás el día que cambie un máximo.
 */
export const DiceGroupBody = z.object({
  count: z.number().int().min(0).max(100),
  sides: z.number().int().min(2).max(1000),
  tag: z.string().max(32).optional(),
});

export const RollRequestBody = z.object({
  systemId: z.string().max(64).nullable(),
  kind: z.enum(['system', 'free']),
  title: z.string().max(200),
  groups: z.array(DiceGroupBody).min(1).max(10),
  options: z.record(z.unknown()).optional(),
  sharedResources: z.record(z.number().int().min(0).max(50)).optional(),
  visibility: z.enum(['table', 'dm', 'secret']).default('table'),
  characterId: z.string().uuid().nullable().optional(),
  modifier: z.number().int().min(-100).max(100).optional(),
});
