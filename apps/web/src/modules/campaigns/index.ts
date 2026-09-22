/**
 * LA PUERTA DE `campaigns` (orden suya, 2026-09-17: «*hay que arreglar esto del index … procura no agregar
 * cosas sin él*»). Desde fuera se importa `@/modules/campaigns`, nunca un fichero de dentro.
 *
 * Se abre el 2026-09-20 porque AVENTURAS necesitaba saber de qué campaña es lo que abre: lo viejo se cierra
 * según se toca, y esta rama tocó aquí. Las importaciones antiguas que todavía entran por dentro (la ficha,
 * el directorio de susurros, la mesa…) siguen midiéndose como deuda en `npm run audit` y se van pasando por
 * esta puerta a medida que se toque cada una — nunca en lote.
 */
export * from './container';
export * from './domain/entities/Campaign';
export type { CampaignsPort } from './domain/ports/CampaignsPort';
export * from './domain/useCases/campaignRules';
