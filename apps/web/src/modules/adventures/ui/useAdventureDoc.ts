import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyDoc, type RichDoc } from '@rolvium/core';
import { AdventureConflictError, type Adventure } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';

export type DocLoad = 'loading' | 'ready' | 'not_found' | 'error';
export type DocSave = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

/** Lo mismo que en Notas y Bitácora: ni a cada letra, ni tan tarde que se note. */
export const SAVE_DELAY_MS = 1200;

export interface UseAdventureDoc {
  adventure: Adventure | null;
  doc: RichDoc;
  edit: (doc: RichDoc) => void;
  /** Cambiar el título. Se guarda igual de solo que el texto. */
  rename: (title: string) => void;
  load: DocLoad;
  save: DocSave;
  savedAt: number | null;
  flush: () => void;
  reload: () => void;
}

/**
 * ABRIR, ESCRIBIR Y GUARDAR SOLA una aventura (H12) — la misma mecánica que `journal`, y a propósito: es el
 * mismo editor y la misma promesa («*el editor guarda solo*»).
 *
 * El conflicto NO es raro aquí aunque sólo haya un director: **la pestaña de la mesa y la ventana aparte son
 * dos vistas del mismo documento**. Lo segundo que se guarde avisa en vez de pisar.
 */
export function useAdventureDoc(adventureId: string | null, adventures: AdventuresPort): UseAdventureDoc {
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [doc, setDoc] = useState<RichDoc>(emptyDoc);
  const [load, setLoad] = useState<DocLoad>('loading');
  const [save, setSave] = useState<DocSave>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const updatedAt = useRef('');
  const pending = useRef<RichDoc | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const open = useCallback(() => {
    if (!adventureId) { setLoad('not_found'); return; }
    setLoad('loading');
    adventures.getById(adventureId).then(row => {
      if (!alive.current) return;
      if (!row) { setLoad('not_found'); return; }
      updatedAt.current = row.updatedAt;
      pending.current = null;
      setAdventure(row);
      setDoc(row.doc);
      setSave('idle');
      setLoad('ready');
    }).catch(() => { if (alive.current) setLoad('error'); });
  }, [adventureId, adventures]);

  useEffect(() => {
    alive.current = true;
    open();
    return () => { alive.current = false; };
  }, [open]);

  const write = useCallback((next: RichDoc) => {
    if (!adventureId) return;
    pending.current = null;
    setSave('saving');
    adventures.saveDoc(adventureId, next, updatedAt.current).then(at => {
      updatedAt.current = at;
      if (!alive.current) return;
      setSave('saved');
      setSavedAt(Date.now());
    }).catch((error: unknown) => {
      if (!alive.current) return;
      setSave(error instanceof AdventureConflictError ? 'conflict' : 'error');
    });
  }, [adventureId, adventures]);

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

  const rename = useCallback((title: string) => {
    if (!adventureId) return;
    setAdventure(a => (a ? { ...a, title } : a));
    adventures.update(adventureId, { title }).catch(() => { if (alive.current) setSave('error'); });
  }, [adventureId, adventures]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { flushRef.current(); }, []);

  return { adventure, doc, edit, rename, load, save, savedAt, flush, reload: open };
}
