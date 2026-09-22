// La puerta del módulo `dice` (H6). Desde fuera se importa `@/modules/dice`, nunca un fichero de dentro
// (CLAUDE.md § «La puerta de cada módulo»).
//
// Nace el 2026-09-22 con «tirar por él» desde una aventura: la ventana aparte necesita el puerto de tiradas
// y no hay mesa que se lo inyecte. Lo viejo se cierra según se toque cada módulo.
export * from './container';
export type { RollInput, RollsPort } from './domain/ports/RollsPort';
export type { RollLogPort } from './domain/ports/RollLogPort';
export type { AttacksPort } from './domain/ports/AttacksPort';
export type { AttackWatchPort } from './domain/ports/AttackWatchPort';
export type { RollRequestsPort } from './domain/ports/RollRequestsPort';
export type { RollRequestWatchPort } from './domain/ports/RollRequestWatchPort';
