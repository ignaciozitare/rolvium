/**
 * LA BIBLIOTECA DE FOTOS de una campaña (H13, `specs/modules/photos/SPEC.md`). Sólo del director.
 *
 * Una foto es de UNA campaña y de ninguna otra («*las fotos estas viven dentro de la cmapaña no es para rolvium
 * en general*»). El fichero vive en el bucket PRIVADO `photos`, en `{campaignId}/{photoId}`, y quien no es el
 * director sólo puede leerlo si se le ha enseñado: en el área de juego de una escena que ve, o por el chat.
 */
export interface Photo {
  id: string;
  campaignId: string;
  /** Con lo que se busca. Nace con el nombre del fichero sin la extensión. */
  name: string;
  /** Tamaño natural ya comprimido: lo que hace que colocarla en la escena respete sus proporciones. */
  width: number;
  height: number;
  createdAt: string;
}

/** Lo que hace falta para darla de alta: el fichero ya comprimido y sus medidas. */
export interface NewPhoto {
  name: string;
  width: number;
  height: number;
  file: Blob;
}

/**
 * DÓNDE SE USA una foto, para el aviso de borrar (spec § What the user can do): borrarla la quita de las
 * escenas, y las aventuras y el chat se quedan con «foto borrada».
 */
export interface PhotoUsage {
  adventures: { id: string; title: string }[];
  scenes: { id: string; name: string }[];
  /** Mensajes del chat que la llevan. Basta el número: el aviso no enseña conversaciones ajenas. */
  messages: number;
}

/** Los mismos topes que la base (`photos_photos.name`). */
export const PHOTO_NAME_MAX = 120;

/** Dónde vive su fichero. Sin extensión, a propósito: la ruta se deduce de la campaña y el id. */
export const photoObjectPath = (campaignId: string, photoId: string): string => `${campaignId}/${photoId}`;
