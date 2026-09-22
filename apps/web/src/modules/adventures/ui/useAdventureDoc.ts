import { useCallback, useEffect, useRef, useState } from 'react';
import { docFitsLimit, emptyDoc, type RichDoc } from '@rolvium/core';
import { AdventureConflictError, type Adventure, type AdventurePatch } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';

export type DocLoad = 'loading' | 'ready' | 'not_found' | 'error';
export type DocSave = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'too_big';

/** Lo mismo que en Notas y Bitácora: ni a cada letra, ni tan tarde que se note. */
export const SAVE_DELAY_MS = 1200;

export interface UseAdventureDoc {
  adventure: Adventure | null;
  doc: RichDoc;
  edit: (doc: RichDoc) => void;
  /** Cambiar el título. Se guarda igual de solo que el texto. */
  rename: (title: string) => void;
  /**
   * Cambiar la cabecera de ESTA aventura (estado, orden…) desde fuera —la pestaña—, pasando por la misma fila
   * que el texto. Falla si la base no lo acepta: quien llama decide qué enseñar.
   */
  patch: (patch: AdventurePatch) => Promise<void>;
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

  /** La aventura que se está mirando AHORA. Lo que llegue tarde de otra no toca la pantalla. */
  const current = useRef(adventureId);
  current.current = adventureId;
  /**
   * La marca de tiempo con la que se guarda, UNA POR AVENTURA: al archivar o borrar la abierta la pestaña salta a
   * otra, y lo último escrito en la de antes tiene que salir con SU marca, no con la de la nueva.
   */
  const stamps = useRef(new Map<string, string>());
  /**
   * 🐞 UNA SOLA FILA para todo lo que se escribe (medido en su base local, 2026-09-21). CUALQUIER cambio de la
   * fila mueve `updated_at` (`adventures_touch`), también el del título o el estado, y el texto se guarda
   * comparando contra esa marca: se guardaba con la de antes de renombrar y salía «se guardó desde otro sitio»
   * sin que nadie más lo tocara. En fila, cada escritura sale con la marca que dejó la anterior.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(op, op);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);
  /** Lo escrito que aún no ha salido, con la aventura de la que es. */
  const pending = useRef<{ id: string; doc: RichDoc } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const open = useCallback(() => {
    if (!adventureId) { setLoad('not_found'); return; }
    setLoad('loading');
    adventures.getById(adventureId).then(row => {
      if (!alive.current || current.current !== adventureId) return;
      if (!row) { setLoad('not_found'); return; }
      stamps.current.set(row.id, row.updatedAt);
      if (pending.current?.id === row.id) pending.current = null;
      setAdventure(row);
      setDoc(row.doc);
      setSave('idle');
      setLoad('ready');
    }).catch(() => { if (alive.current && current.current === adventureId) setLoad('error'); });
  }, [adventureId, adventures]);

  const write = useCallback((id: string, next: RichDoc) => {
    if (pending.current?.id === id) pending.current = null;
    if (current.current === id) setSave('saving');
    enqueue(() => adventures.saveDoc(id, next, stamps.current.get(id) ?? '')).then(at => {
      stamps.current.set(id, at);
      if (!alive.current || current.current !== id) return;
      setSave('saved');
      setSavedAt(Date.now());
    }).catch((error: unknown) => {
      // Lo que NO entró sigue pendiente (lo mismo que en `journal`): si no, un fallo de red se llevaba el
      // texto en silencio — `Cmd+S` y el guardado al cerrar se quedaban sin nada que mandar.
      if (!pending.current) pending.current = { id, doc: next };
      if (!alive.current || current.current !== id) return;
      setSave(error instanceof AdventureConflictError ? 'conflict' : 'error');
    });
  }, [adventures, enqueue]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const next = pending.current;
    if (next) write(next.id, next.doc);
  }, [write]);

  // Al cambiar de aventura, y al cerrar, lo pendiente de la de antes sale ANTES de abrir la siguiente.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    alive.current = true;
    open();
    return () => { flushRef.current(); alive.current = false; };
  }, [open]);

  const edit = useCallback((next: RichDoc) => {
    if (!adventureId) return;
    setDoc(next);
    // EL TOPE DE 200 KB del spec (§ Rules & limits). Se avisa y NO se manda: la base lo aceptaría hoy, pero un
    // documento sin tope acaba siendo un documento que no se puede abrir. Lo escrito se queda en pantalla.
    if (!docFitsLimit(next)) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      pending.current = null;
      setSave('too_big');
      return;
    }
    pending.current = { id: adventureId, doc: next };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; write(adventureId, next); }, SAVE_DELAY_MS);
  }, [adventureId, write]);

  const patch = useCallback((changes: AdventurePatch): Promise<void> => {
    const id = adventureId;
    if (!id) return Promise.resolve();
    setAdventure(a => (a && a.id === id ? { ...a, ...changes } : a));
    return enqueue(() => adventures.update(id, changes)).then(at => { if (at) stamps.current.set(id, at); });
  }, [adventureId, adventures, enqueue]);

  const rename = useCallback((title: string) => {
    patch({ title }).catch(() => { if (alive.current) setSave('error'); });
  }, [patch]);

  return { adventure, doc, edit, rename, patch, load, save, savedAt, flush, reload: open };
}
