import { PHOTO_NAME_MAX, type Photo } from '../entities/Photo';

/** Sin tildes y sin mayúsculas, como la búsqueda del Bestiario: «camara» encuentra «Cámara secreta». */
const fold = (v: string): string => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * El nombre con el que NACE una foto: el de su fichero sin la extensión (spec § What the user can do). Los
 * guiones bajos se leen como espacios; si no queda nada, `fallback`.
 */
export function nameFromFile(fileName: string, fallback: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (base || fallback).slice(0, PHOTO_NAME_MAX);
}

/** Un nombre que la base acepta: recortado, sin vacíos, y dentro del tope. `null` si no queda nada. */
export function cleanPhotoName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, PHOTO_NAME_MAX);
  return name ? name : null;
}

/** La búsqueda de la biblioteca: por nombre, sin tildes ni mayúsculas. Vacía = todas. */
export function searchPhotos<T extends Pick<Photo, 'name'>>(photos: readonly T[], query: string): T[] {
  const q = fold(query);
  return q ? photos.filter(p => fold(p.name).includes(q)) : [...photos];
}
