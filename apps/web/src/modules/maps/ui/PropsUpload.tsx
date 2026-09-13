import { useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ACCEPTED_MIME, CompressError, compressImage, Modal, type CompressResult } from '@rolvium/ui';
import type { PropPack } from '../domain/entities/Scene';
import { nameFromFile } from '../domain/useCases/propRules';

/** Lo que hace falta para crear la pieza: el resto (foto, quién, escala) lo pone quien la guarda. */
export interface PropUploadInput { name: string; packId: string | null; naturalWidth: number; naturalHeight: number }

interface Props {
  packs: readonly PropPack[];
  /** El paquete al que van: el abierto en el catálogo, cambiable aquí. `null` = «Sin clasificar». */
  packId: string | null;
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  /**
   * Guardar UNA pieza ya comprimida. Quien recibe esto sube y crea la fila; aquí sólo se comprime (camino
   * único de `specs/core/images/SPEC.md`) y se lleva la cola. Si lanza, la fila de la cola queda en «no se pudo».
   */
  onAdd: (input: PropUploadInput, blob: Blob) => Promise<void>;
  onClose: () => void;
}

type Status = 'queued' | 'uploading' | 'done' | 'failed';
interface Item { key: string; file: File; name: string; status: Status; error: string | null }

/** Comprimir con el destino `prop` (1024 px, calidad 0,9). Aparte para poder doblarlo en los tests. */
export type Compressor = (file: File) => Promise<CompressResult>;
const compressProp: Compressor = file => compressImage(file, 'prop');

/**
 * SUBIR PIEZAS EN LOTE (`rolvium.pen` · `DCs6S`, aprobado el 2026-09-11).
 *
 * La zona de arrastre («PNG o WEBP con fondo transparente · varias a la vez»), A QUÉ PAQUETE, la cola con el
 * estado de cada fichero (en cola · subiendo · listo · no se pudo) y el pie con CANCELAR / AÑADIR N PIEZAS.
 *
 * 🔑 EL NOMBRE DEL FICHERO SE QUEDA COMO NOMBRE DE LA PIEZA (sin la extensión), como dice la nota de la lámina:
 * se cambia luego con «Renombrar». Y la transparencia se conserva: WebP lleva alfa y el compresor no aplana.
 *
 * Se sube una a una y en orden: así una que falle deja las demás intactas, y la lista dice cuál fue.
 */
export function PropsUpload({ packs, packId: initialPack, initialFiles, onAdd, onClose, compress = compressProp }: Props & { compress?: Compressor }): JSX.Element {
  const { t } = useTranslation();
  /** Un contador para las claves de la cola: dos ficheros iguales tienen que poder convivir en la lista. */
  const seq = useRef(0);
  const toItem = (file: File): Item => {
    seq.current += 1;
    return { key: `${file.name}:${file.size}:${file.lastModified}:${seq.current}`, file, name: nameFromFile(file.name), status: 'queued', error: null };
  };
  const [packId, setPackId] = useState<string | null>(initialPack);
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
    if (e instanceof CompressError) return t(`maps.props.upload.err.${e.code}`);
    return t('maps.props.upload.err.upload');
  };

  /** Una a una, en orden. Al acabar sin fallos se cierra solo: ya no hay nada que mirar aquí. */
  const subir = async (): Promise<void> => {
    if (busy || !pendientes.length) return;
    setBusy(true);
    let fallos = 0;
    for (const item of pendientes) {
      setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'uploading', error: null } : i)));
      try {
        const r = await compress(item.file);
        await onAdd({ name: item.name, packId, naturalWidth: r.width, naturalHeight: r.height }, r.blob);
        setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'done' } : i)));
      } catch (e) {
        fallos += 1;
        setItems(l => l.map(i => (i.key === item.key ? { ...i, status: 'failed', error: errorDe(e) } : i)));
      }
    }
    setBusy(false);
    if (fallos === 0) onClose();
  };

  const STATUS_ICON: Record<Status, string> = { queued: 'schedule', uploading: 'progress_activity', done: 'check', failed: 'error' };

  return (
    <Modal onClose={onClose} title={t('maps.props.upload.title')} width={560}>
      <div className="mp-propup" data-testid="mp-propup">
        <div className={`mp-propup-drop ${dragging ? 'on' : ''}`} data-testid="mp-propup-drop"
          onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}>
          <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
          <span className="mp-propup-drop-t">{t('maps.props.upload.drop')}</span>
          <span className="mp-propup-drop-s">{t('maps.props.upload.dropHint')}</span>
          <button type="button" className="mp-propup-browse" onClick={() => input.current?.click()}>{t('maps.props.upload.browse')}</button>
          <input ref={input} type="file" accept={ACCEPTED_MIME.join(',')} multiple hidden data-testid="mp-propup-input"
            onChange={e => { add(e.target.files); e.target.value = ''; }} />
        </div>

        <label className="mp-propup-pack">
          <span className="mp-texcat-count">{t('maps.props.upload.pack')}</span>
          <select value={packId ?? ''} onChange={e => setPackId(e.target.value || null)} aria-label={t('maps.props.upload.pack')} disabled={busy}>
            {packs.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            <option value="">{t('maps.props.upload.unsorted')}</option>
          </select>
        </label>

        {items.length > 0 && (
          <ul className="mp-propup-list" aria-label={t('maps.props.upload.title')}>
            {items.map(i => (
              <li key={i.key} className={`mp-propup-item ${i.status}`} data-status={i.status}>
                <span className={`material-symbols-outlined mp-propup-st ${i.status}`} aria-hidden="true">{STATUS_ICON[i.status]}</span>
                <span className="mp-propup-file">{i.file.name}</span>
                <span className="mp-propup-state">{i.error ?? t(`maps.props.upload.${i.status}`)}</span>
                {i.status !== 'uploading' && i.status !== 'done' && !busy && (
                  <button type="button" className="mp-propup-x" aria-label={t('maps.props.upload.remove', { name: i.file.name })} onClick={() => quitar(i.key)}>
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mp-texcat-hint">{t('maps.props.upload.note')}</p>

        <div className="mp-propup-foot">
          <button type="button" className="mp-propup-btn" onClick={onClose} disabled={busy}>{t('maps.props.upload.cancel')}</button>
          <button type="button" className="mp-propup-btn blood" onClick={() => void subir()} disabled={busy || !pendientes.length}>
            {busy ? t('maps.props.upload.adding') : pendientes.length === 1 ? t('maps.props.upload.addOne') : t('maps.props.upload.add', { n: String(pendientes.length) })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
