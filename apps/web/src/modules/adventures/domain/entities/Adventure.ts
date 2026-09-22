import type { RichDoc } from '@rolvium/core';

/**
 * UNA AVENTURA (H12, specs/modules/adventures/SPEC.md): el guion de una historia dentro de una campaña, con su
 * texto y sus escenas colgando. **Material del director**: el jugador no la ve ni pidiéndola por su id — no es
 * que se le escondan campos, es que la base no le da la fila (RLS, migración `20260919120100`).
 */
export interface Adventure {
  id: string;
  campaignId: string;
  title: string;
  /** Una línea para el carril; el resto se escribe dentro del documento. */
  summary: string | null;
  doc: RichDoc;
  status: AdventureStatus;
  sortOrder: number;
  updatedAt: string;
}

/** `running` es la que la mesa abre por defecto; `archived` se saca de en medio sin borrar nada. */
export type AdventureStatus = 'draft' | 'running' | 'done' | 'archived';

export const ADVENTURE_STATUSES: readonly AdventureStatus[] = ['draft', 'running', 'done', 'archived'];

/** Lo que se puede cambiar de la cabecera de una aventura. El documento se guarda aparte. */
export interface AdventurePatch {
  title?: string;
  summary?: string | null;
  status?: AdventureStatus;
  sortOrder?: number;
}

/** Tope del título, el mismo que exige la base (`CHECK char_length(title) BETWEEN 1 AND 120`). */
export const ADVENTURE_TITLE_MAX = 120;

/**
 * Se intentó guardar el documento y ya lo habían guardado (v1: un escritor a la vez). Pasa de verdad con una
 * sola persona: la pestaña de la mesa y la ventana aparte son dos vistas del mismo documento.
 */
export class AdventureConflictError extends Error {
  constructor(readonly serverUpdatedAt: string) {
    super('adventure-conflict');
    this.name = 'AdventureConflictError';
  }
}
