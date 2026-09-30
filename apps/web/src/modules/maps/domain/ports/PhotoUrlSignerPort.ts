/**
 * Lo ÚNICO que la escena necesita de la galería de fotos (H13, rebanada 4): firmarle el enlace de una foto
 * puesta. El fichero vive en un bucket privado y la fila no lleva enlace, así que sin esto no hay nada que
 * pintar.
 *
 * Es una puerta a propósito, y mínima: `maps` no conoce el módulo `photos` ni al revés — quien enchufa el de
 * verdad es la mesa, que es donde se componen los dos.
 */
export interface PhotoUrlSigner {
  urlsFor(campaignId: string, photoIds: readonly string[]): Promise<Record<string, string>>;
}
