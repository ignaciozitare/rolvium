import type { RichDoc } from '@rolvium/core';

/**
 * LAS DOS SUPERFICIES QUE SE ESCRIBEN EN UNA CAMPAÑA (specs/modules/journal/SPEC.md).
 *
 * Las dos guardan el MISMO árbol de bloques (`RichDoc`, en `@rolvium/core`); lo que cambia es de quién son:
 * las Notas son de una persona y nadie más las lee —ni el director ni un admin—, y la Bitácora es de la
 * campaña entera.
 */

/** Los apuntes privados de UNA persona en UNA campaña (`journal_notes`). */
export interface CampaignNotes {
  id: string;
  campaignId: string;
  userId: string;
  doc: RichDoc;
  updatedAt: string;
}

/** La bitácora COMPARTIDA de la campaña (`journal_logbook`): una sola, la escriben todos. */
export interface CampaignLogbook {
  id: string;
  campaignId: string;
  doc: RichDoc;
  /** Quién guardó el último, para poder decir de quién es el cambio que pisaría el tuyo. `null` si esa cuenta ya no está. */
  updatedBy: string | null;
  updatedAt: string;
}

/**
 * Se intentó guardar la Bitácora y alguien la había guardado antes (v1: un escritor a la vez). El texto NO se
 * pierde y NO se pisa lo del otro: la pantalla lo cuenta y ofrece recargar.
 */
export class LogbookConflictError extends Error {
  constructor(readonly serverUpdatedAt: string) {
    super('logbook-conflict');
    this.name = 'LogbookConflictError';
  }
}
