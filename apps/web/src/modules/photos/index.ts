// La puerta del módulo `photos` (H13) — la biblioteca de fotos de cada campaña. Desde fuera se importa
// `@/modules/photos`, nunca un fichero de dentro (CLAUDE.md § «La puerta de cada módulo»).
export * from './container';
export * from './domain/entities/Photo';
export type { PhotosPort } from './domain/ports/PhotosPort';
export { nameFromFile, cleanPhotoName, searchPhotos } from './domain/useCases/photoRules';
export { GalleryPanel } from './ui/GalleryPanel';
export { usePhotos } from './ui/usePhotos';
