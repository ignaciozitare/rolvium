import type { RichDoc } from '@rolvium/core';
import type { Adventure, AdventurePatch } from '../entities/Adventure';

/**
 * AVENTURAS (H12). Todo bajo RLS: la base sólo se las da al director de esa campaña (y a un admin de
 * plataforma). No hay ni un filtro de permisos escrito a mano en el cliente.
 *
 * Las ESCENAS de una aventura no están aquí: son de `maps` (`@/modules/maps`), que ya sabe listarlas,
 * crearlas y moverlas — una escena lleva su `adventureId` encima. Dos puertos para lo mismo sería la
 * duplicación que `CLAUDE.md` prohíbe.
 */
export interface AdventuresPort {
  /** Las aventuras de la campaña por orden del carril. Sin las archivadas salvo que se pidan. */
  list(campaignId: string, opts?: { includeArchived?: boolean }): Promise<Adventure[]>;
  getById(id: string): Promise<Adventure | null>;
  /** `sortOrder` = su sitio en el carril. Sin él la base pone 0, y todas las nuevas empataban en el primero. */
  create(campaignId: string, title: string, sortOrder?: number): Promise<Adventure>;
  /**
   * Cambia la cabecera (título, estado, orden). Devuelve la NUEVA marca de tiempo, o `null` si no había nada
   * que cambiar: la base la mueve con CUALQUIER cambio (`adventures_touch`), y quien tenga el documento abierto
   * la necesita, porque el siguiente guardado del texto se compara contra ella.
   */
  update(id: string, patch: AdventurePatch): Promise<string | null>;
  /**
   * Guarda el documento sólo si nadie lo ha tocado desde que se abrió; si lo han tocado lanza
   * `AdventureConflictError`. Devuelve la nueva marca de tiempo.
   */
  saveDoc(id: string, doc: RichDoc, expectedUpdatedAt: string): Promise<string>;
  /**
   * Borra la aventura. La base lo IMPIDE si todavía le cuelga una escena (`ON DELETE RESTRICT`): primero se
   * decide a dónde van, que es justo lo que el spec pide preguntar antes.
   */
  remove(id: string): Promise<void>;
}
