import { useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ACCEPTED_MIME, CompressError, Modal, type CompressResult } from '@rolvium/ui';

/** Lo que hace falta para crear la cosa subida: el resto (foto, quién) lo pone quien la guarda. */
export interface LibraryUploadInput { name: string; groupId: string | null; naturalWidth: number; naturalHeight: number }

/** Preparar UN fichero antes de guardarlo: comprimirlo (piezas) o dejarlo tal cual (texturas). Aparte para doblarlo en los tests. */
export type Preparer = (file: File) => Promise<CompressResult>;

export interface LibraryUploadProps {
  /** El prefijo de las claves de texto: `maps.props.upload` o `maps.textures.upload`. Las dos caras llevan las mismas. */
  keys: string;
  /** Los grupos a los que puede ir: paquetes o categorías, ya con su nombre. */
  groups: readonly { id: string; name: string }[];
  /** ¿Existe «Sin clasificar» como destino? Sí con paquetes propios; no con las categorías cerradas. */
  allowUnsorted: boolean;
  /** El grupo al que van: el abierto en el catálogo, cambiable aquí. `null` = «Sin clasificar». */
  groupId: string | null;
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  prepare: Preparer;
  /** El nombre a partir del fichero. */
  nameOf: (fileName: string) => string;
  /**
   * Guardar UNA ya preparada. Quien recibe esto sube y crea la fila; aquí sólo se prepara y se lleva la cola.
   * Si lanza, la fila de la cola queda en «no se pudo».
   */
  onAdd: (input: LibraryUploadInput, blob: Blob) => Promise<void>;
  onClose: () => void;
}

type Status = 'queued' | 'uploading' | 'done' | 'failed';
interface Item { key: string; file: File; name: string; status: Status; error: string | null }

const STATUS_ICON: Record<Status, string> = { queued: 'schedule', uploading: 'progress_activity', done: 'check', failed: 'error' };

/**
 * SUBIR EN LOTE (`rolvium.pen` · `DCs6S`, aprobado el 2026-09-11; para las texturas el 2026-09-13, § 6.8 punto 1:
 * «*esta buenísimo y puedo subir de a muchas*»). UNA SOLA VENTANA CON DOS CARAS: las piezas van a un paquete y
 * se comprimen conservando la transparencia; las texturas van a una categoría y entran tal cual.
 *
 * La zona de arrastre, A QUÉ PAQUETE / CATEGORÍA, la cola con el estado de cada fichero (en cola · subiendo ·
 * listo · no se pudo) y el pie con CANCELAR / AÑADIR N.
 *
 * 🔑 EL NOMBRE DEL FICHERO SE QUEDA COMO NOMBRE (sin la extensión), como dice la nota de la lámina: se cambia
 * luego con «Renombrar». Se sube una a una y en orden: así una que falle deja las demás intactas, y la lista
 * dice cuál fue.
 */
export function LibraryUpload({ keys, groups, allowUnsorted, groupId: initialGroup, initialFiles, prepare, nameOf, onAdd, onClose }: LibraryUploadProps): JSX.Element {
  const { t } = useTranslation();
  const k = (key: string, vars?: Record<string, string>): string => t(`${keys}.${key}`, vars);
  /** Un contador para las claves de la cola: dos ficheros iguales tienen que poder convivir en la lista. */
  const seq = useRef(0);
  const toItem = (file: File): Item => {
    seq.current += 1;
    return { key: `${file.name}:${file.size}:${file.lastModified}:${seq.current}`, file, name: nameOf(file.name), status: 'queued', error: null };
  };
  const [groupId, setGroupId] = useState<string | null>(initialGroup);
  const [items, setItems] = useState<Item[]>(() => (initialFiles ?? []).map(toItem));
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const add = (files: FileList | File[] | null | undefined): void => {
    if (!files) return;
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setItems(l => [...l, ...imgs.map(toItem)]);
  };
  const quitar = (key: string): void => setItems(l => l.filter(i => i.key !== key));
  const pendientes = items.filter(i => i.status === 'queued' || i.status === 'failed');

  const errorDe = (e: unknown): string => {
    if (e instanceof CompressError) return k(`err.${e.code}`);
    return k('err.upload');
  };

  /** Una a una, en orden. Al acabar sin fallos se cierra solo: ya no hay nada que mirar aquí. */
  const subir = async (): Promise<void> => {
    if (busy || !pendientes.length) return;
    setBusy(true);
    let fallos = 0;
    for (const item of pendientes) {
      setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'uploading', error: null } : i)));
      try {
        const r = await prepare(item.file);
        await onAdd({ name: item.name, groupId, naturalWidth: r.width, naturalHeight: r.height }, r.blob);
        setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'done' } : i)));
      } catch (e) {
        fallos += 1;
        setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'failed', error: errorDe(e) } : i)));
      }
    }
    setBusy(false);
    if (fallos === 0) onClose();
  };

  return (
    <Modal onClose={onClose} title={k('title')} width={560}>
      <div className="mp-propup" data-testid="mp-propup">
        <div className={`mp-propup-drop ${dragging ? 'on' : ''}`} data-testid="mp-propup-drop"
          onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}>
          <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
          <span className="mp-propup-drop-t">{k('drop')}</span>
          <span className="mp-propup-drop-s">{k('dropHint')}</span>
          <button type="button" className="mp-propup-browse" onClick={() => input.current?.click()}>{k('browse')}</button>
          <input ref={input} type="file" accept={ACCEPTED_MIME.join(',')} multiple hidden data-testid="mp-propup-input"
            onChange={e => { add(e.target.files); e.target.value = ''; }} />
        </div>

        <label className="mp-propup-pack">
          <span className="mp-texcat-count">{k('pack')}</span>
          <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value || null)} aria-label={k('pack')} disabled={busy}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            {allowUnsorted && <option value="">{k('unsorted')}</option>}
          </select>
        </label>

        {items.length > 0 && (
          <ul className="mp-propup-list" aria-label={k('title')}>
            {items.map(i => (
              <li key={i.key} className={`mp-propup-item ${i.status}`} data-status={i.status}>
                <span className={`material-symbols-outlined mp-propup-st ${i.status}`} aria-hidden="true">{STATUS_ICON[i.status]}</span>
                <span className="mp-propup-file">{i.file.name}</span>
                <span className="mp-propup-state">{i.error ?? k(i.status)}</span>
                {i.status !== 'uploading' && i.status !== 'done' && !busy && (
                  <button type="button" className="mp-propup-x" aria-label={k('remove', { name: i.file.name })} onClick={() => quitar(i.key)}>
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mp-texcat-hint">{k('note')}</p>

        <div className="mp-propup-foot">
          <button type="button" className="mp-propup-btn" onClick={onClose} disabled={busy}>{k('cancel')}</button>
          <button type="button" className="mp-propup-btn blood" onClick={() => void subir()} disabled={busy || !pendientes.length}>
            {busy ? k('adding') : pendientes.length === 0 ? k('title') : pendientes.length === 1 ? k('addOne') : k('add', { n: String(pendientes.length) })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
