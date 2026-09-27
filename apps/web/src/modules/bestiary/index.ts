// La puerta del módulo `bestiary` (H5). Desde fuera se importa `@/modules/bestiary`, nunca un fichero de
// dentro (CLAUDE.md § «La puerta de cada módulo», orden suya del 2026-09-17). Dentro del módulo se sigue
// importando por ruta relativa.
//
// Nace el 2026-09-22, cuando `adventures` necesitó elegir criaturas del Bestiario desde sus tablas de
// PNJ/encuentro: lo nuevo entra por aquí. Lo viejo (`table`, `maps` y las pruebas, que todavía entran por
// dentro) se cierra poco a poco, según se toque cada módulo.
export * from './container';
export type {
  BestiaryEntry, BestiaryEntryPatch, CreatureData, EntryOrigin, NewBestiaryEntry, OriginFilter,
} from './domain/entities/BestiaryEntry';
export type { BestiaryPort } from './domain/ports/BestiaryPort';
export { useBestiary } from './ui/useBestiary';
export { BestiaryTab } from './ui/BestiaryTab';
export { EntryCard } from './ui/EntryCard';
export { EntrySheetModal } from './ui/EntrySheetModal';
export { NpcSheetModal } from './ui/NpcSheetModal';
export { CreatureRollPopover } from './ui/CreatureRollPopover';
/**
 * La HOJA DE PERGAMINO a pantalla completa. No es del Bestiario: es el contenedor de cualquier hoja que se abre
 * encima de la mesa, y por eso lo usa también la galería de fotos (H13). Vive aquí por dónde nació (2026-08-21),
 * no por dónde debería estar: el día que alguien toque esto, su sitio es `@rolvium/ui` o `shared/ui`.
 */
export { SheetOverlay } from './ui/SheetOverlay';
