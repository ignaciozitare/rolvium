import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyDoc, type RichDoc } from '@rolvium/core';
import { LogbookConflictError } from '../domain/entities/Journal';
import type { JournalPort } from '../domain/ports/JournalPort';

export type JournalKind = 'notes' | 'logbook';
export type JournalLoad = 'loading' | 'ready' | 'error';
/** `conflict` sólo le puede pasar a la Bitácora: las Notas son de una sola persona. */
export type JournalSave = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

/** Cuánto se espera desde la última tecla antes de guardar. Ni a cada letra, ni tan tarde que se note. */
export const SAVE_DELAY_MS = 1200;

export interface UseJournalDoc {
  doc: RichDoc;
  /** Escribir. Programa el guardado solo; no hay botón de guardar en ninguna de las dos superficies. */
  edit: (doc: RichDoc) => void;
  load: JournalLoad;
  save: JournalSave;
  /** Cuándo entró el último guardado, para el «guardado hace un momento». */
  savedAt: number | null;
  /** Guardar YA (`Cmd+S`, o al cerrar). */
  flush: () => void;
  /** Volver a leer de la base. Es lo que se ofrece cuando otro guardó antes que tú. */
  reload: () => void;
}

/**
 * ABRIR, ESCRIBIR Y GUARDAR SOLO una de las dos superficies de `journal` (H9).
 *
 * - **Sin botón de guardar** («*el editor guarda solo*»): se guarda sola con retardo desde la última tecla.
 * - **La Bitácora no se pisa**: se guarda contra la marca de tiempo con la que se abrió, y si otro guardó antes
 *   esto acaba en `conflict` — el texto NO se pierde y la pantalla ofrece recargar (spec § States & errors).
 * - Lo que queda a medio escribir se guarda al desmontar: cambiar de pestaña no puede perder una frase.
 */
export function useJournalDoc(
  kind: JournalKind, campaignId: string, myUserId: string, journal: JournalPort,
): UseJournalDoc {
  const [doc, setDoc] = useState<RichDoc>(emptyDoc);
  const [load, setLoad] = useState<JournalLoad>('loading');
  const [save, setSave] = useState<JournalSave>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const rowId = useRef<string | null>(null);
  const updatedAt = useRef<string>('');
  const pending = useRef<RichDoc | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const open = useCallback(() => {
    setLoad('loading');
    const promise = kind === 'notes' ? journal.openNotes(campaignId, myUserId) : journal.openLogbook(campaignId);
    promise.then(row => {
      if (!alive.current) return;
      rowId.current = row.id;
      updatedAt.current = row.updatedAt;
      pending.current = null;
      setDoc(row.doc);
      setSave('idle');
      setLoad('ready');
    }).catch(() => { if (alive.current) setLoad('error'); });
  }, [kind, campaignId, myUserId, journal]);

  useEffect(() => {
    alive.current = true;
    open();
    return () => { alive.current = false; };
  }, [open]);

  const write = useCallback((next: RichDoc) => {
    const id = rowId.current;
    if (!id) return;
    pending.current = null;
    setSave('saving');
    const done = (at: string) => {
      updatedAt.current = at;
      if (!alive.current) return;
      setSave('saved');
      setSavedAt(Date.now());
    };
    const promise = kind === 'notes'
      ? journal.saveNotes(id, next)
      : journal.saveLogbook(id, next, updatedAt.current, myUserId);
    promise.then(done).catch((error: unknown) => {
      // Lo que NO entró sigue pendiente. Sin esto, un fallo de red se llevaba el texto en silencio: se había
      // vaciado `pending` al empezar, así que ni el `Cmd+S` ni el guardado al cerrar tenían ya nada que
      // mandar, y quien dejara de escribir al ver el aviso perdía lo escrito. Si mientras tanto se ha seguido
      // escribiendo, manda lo nuevo — es más reciente.
      if (!pending.current) pending.current = next;
      if (!alive.current) return;
      setSave(error instanceof LogbookConflictError ? 'conflict' : 'error');
    });
  }, [kind, journal, myUserId]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const next = pending.current;
    if (next) write(next);
  }, [write]);

  const edit = useCallback((next: RichDoc) => {
    setDoc(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; write(next); }, SAVE_DELAY_MS);
  }, [write]);

  // Lo que quede a medio guardar se manda al desmontar (cambiar de pestaña, cerrar la mesa).
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { flushRef.current(); }, []);

  return { doc, edit, load, save, savedAt, flush, reload: open };
}
