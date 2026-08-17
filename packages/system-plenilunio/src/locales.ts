import type { Locale, Messages } from '@rolvium/core';

export const messages: Partial<Record<Locale, Messages>> = {
  es: { system: { name: 'Plenilunio', destinyPool: 'Reserva de Destino', tagline: 'Malefic Time · d6, reserva de Destino' } },
  en: { system: { name: 'Plenilunio', destinyPool: 'Destiny pool', tagline: 'Malefic Time · d6, shared Destiny pool' } },
};
