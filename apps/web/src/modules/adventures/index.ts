// La puerta del módulo `adventures` (H12). Desde fuera se importa `@/modules/adventures`, nunca un fichero de
// dentro (CLAUDE.md § «La puerta de cada módulo»).
export * from './container';
export * from './domain/entities/Adventure';
export type { AdventuresPort } from './domain/ports/AdventuresPort';
