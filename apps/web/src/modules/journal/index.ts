// La puerta del módulo `journal` (H9) — Notas y Bitácora. Desde fuera se importa `@/modules/journal`,
// nunca un fichero de dentro (CLAUDE.md § «La puerta de cada módulo»).
export * from './container';
export * from './domain/entities/Journal';
export type { JournalPort } from './domain/ports/JournalPort';
export { JournalPanel } from './ui/JournalPanel';
