import type { BestiaryEntry, BestiaryEntryPatch, NewBestiaryEntry } from '../entities/BestiaryEntry';

/**
 * Acceso a las entradas PROPIAS del director (`bestiary_entries`). Las del manual no pasan por aquí:
 * son datos del paquete del sistema y no tienen fila.
 *
 * La RLS ya limita todo a su dueño y director, así que estos métodos no llevan `ownerId`: quien pregunta
 * es quien la sesión dice que es. `listForCampaign` devuelve las de la campaña MÁS las guardadas para
 * todas — es lo que el director espera ver cuando abre el bestiario dentro de una partida.
 */
export interface BestiaryPort {
  /** Las de esa campaña y las globales del director, en un solo listado. */
  listForCampaign(campaignId: string, systemId: string): Promise<BestiaryEntry[]>;
  create(input: NewBestiaryEntry): Promise<BestiaryEntry>;
  update(id: string, patch: BestiaryEntryPatch): Promise<BestiaryEntry>;
  remove(id: string): Promise<void>;
  /** Sube la imagen del token ya comprimida y devuelve su URL pública (bucket `tokens`). */
  uploadToken(entryId: string, file: Blob): Promise<string>;
}
