import type { NewPhoto, Photo, PhotoUsage } from '../entities/Photo';

/**
 * LA BIBLIOTECA DE FOTOS contra la base (H13). Todo bajo RLS: la tabla sólo se la da la base al director de la
 * campaña (y a un admin, de soporte), y el fichero de una foto sólo se firma a quien pueda verla.
 */
export interface PhotosPort {
  /** Todas las de la campaña, de la más nueva a la más vieja. */
  list(campaignId: string): Promise<Photo[]>;
  /**
   * Da de alta una foto: primero la fila, luego el fichero. Si el fichero no sube, la fila se deshace — nada
   * se queda a medias.
   */
  create(campaignId: string, photo: NewPhoto): Promise<Photo>;
  rename(photoId: string, name: string): Promise<Photo>;
  /** Borra la fila y su fichero. La base la quita de las escenas y deja los mensajes sin foto. */
  remove(photo: Pick<Photo, 'id' | 'campaignId'>): Promise<void>;
  /** Dónde se usa, para avisar antes de borrarla. */
  usage(photo: Pick<Photo, 'id' | 'campaignId'>): Promise<PhotoUsage>;
  /**
   * Enlaces firmados para pintarlas, por id. Una que la base no deje leer simplemente no viene: para un jugador,
   * una foto fuera del área de juego no tiene enlace.
   */
  urlsFor(campaignId: string, photoIds: readonly string[]): Promise<Record<string, string>>;
}
