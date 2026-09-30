import { useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ACCEPTED_MIME, EmptyState, Modal, formatBytes, useDialog } from '@rolvium/ui';
import { SheetOverlay } from '@/modules/bestiary';
import { encodePhotoDrag, PHOTO_DRAG_MIME } from '@/shared/lib/photoDrag';
import type { PhotosPort } from '../domain/ports/PhotosPort';
import type { Photo, PhotoUsage } from '../domain/entities/Photo';
import { usePhotos } from './usePhotos';
import './photos.css';

interface Props {
  campaignId: string;
  /** Se inyecta en los tests; en la mesa lo pone el contenedor del módulo. */
  repo?: PhotosPort;
}

/** Lo que está abierto encima de la rejilla. Una cosa a la vez, como cualquier menú. */
type Open =
  | { kind: 'menu'; photo: Photo }
  | { kind: 'big'; photo: Photo }
  | { kind: 'remove'; photo: Photo; usage: PhotoUsage | null };

/**
 * LA GALERÍA (H13) — la pestaña del carril lateral, **y sólo del director**. Él la bautizó el 2026-09-24
 * («*cambia fotos por galeria*»). Spec: `specs/modules/photos/SPEC.md`.
 * Diseño: `rolvium.pen` § 4 · `Fotos/Biblioteca · el carril · sólo el director` y su lámina hermana de borrar.
 *
 * Aquí se ven, se buscan, se suben, se renombran y se borran las fotos de la campaña. Llevarlas a la escena y
 * mandarlas por el chat son las rebanadas siguientes: **no se pinta un botón que todavía no hace nada**.
 *
 * Reutilización declarada — **NEW (propio del módulo)** para la cola de subidas, a conciencia: `LibraryUpload`
 * de `maps` sube en lote y está muy bien, pero es UNA VENTANA con selector de paquete, y la lámina que él
 * aprobó pone las subidas DENTRO del carril, en 272 px y sin grupos (la galería no tiene carpetas). Lo que sí
 * se reutiliza sin copiar: `SheetOverlay` para verla a lo grande —la misma hoja que la foto de una criatura—,
 * `Modal` para el aviso de borrar, `EmptyState`, y `useDialog().prompt` para renombrar, como el carril de
 * aventuras.
 */
export function GalleryPanel({ campaignId, repo }: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const ph = usePhotos({ campaignId, ...(repo ? { repo } : {}) });
  const [open, setOpen] = useState<Open | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pedirFicheros = (files: FileList | null) => {
    const list = [...(files ?? [])].filter(f => (ACCEPTED_MIME as readonly string[]).includes(f.type));
    const rechazados = [...(files ?? [])].length - list.length;
    if (rechazados > 0) ph.setError('photos.error.mime');
    void ph.upload(list, t('photos.unnamed'));
  };

  const renombrar = async (photo: Photo) => {
    setOpen(null);
    const name = await dialog.prompt(t('photos.renamePrompt'), { title: t('photos.rename'), defaultValue: photo.name });
    if (name !== null) await ph.rename(photo, name);
  };

  /** Antes de borrar se pregunta a la base dónde se usa: es lo que hace honesto el aviso. */
  const pedirBorrar = async (photo: Photo) => {
    setOpen({ kind: 'remove', photo, usage: null });
    // Si ya lo cerró (o abrió otro), lo que llega tarde NO vuelve a abrirlo solo. En una conexión lenta el
    // aviso de BORRAR reaparecía por su cuenta después de Cancelar. (🐞 revisión del 2026-09-27.)
    const llega = (usage: PhotoUsage) =>
      setOpen(o => (o?.kind === 'remove' && o.photo.id === photo.id ? { ...o, usage } : o));
    try {
      llega(await ph.usage(photo));
    } catch {
      // Sin saber dónde se usa se sigue pudiendo borrar: se avisa de que no se ha podido mirar.
      llega({ adventures: [], scenes: [], messages: -1 });
    }
  };

  return (
    <div className="ph-panel">
      <p className="ph-note">{t('photos.onlyYou')}</p>

      <label className="ph-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input type="search" value={ph.query} onChange={e => ph.setQuery(e.target.value)}
               placeholder={t('photos.search')} aria-label={t('photos.search')} />
      </label>

      <button type="button" className="ph-upload" onClick={() => fileInput.current?.click()}>
        <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
        {t('photos.upload')}
      </button>
      <input ref={fileInput} type="file" accept={ACCEPTED_MIME.join(',')} multiple hidden
             aria-label={t('photos.upload')} data-testid="ph-input"
             onChange={e => { pedirFicheros(e.target.files); e.target.value = ''; }} />

      {/* Lo dice la pantalla porque un arrastre no se ve venir: sin esta línea nadie sabe que se puede. */}
      <p className="ph-hint">{t('photos.dragHint')}</p>

      {ph.error && (
        <p className="ph-error" role="alert">
          {t(ph.error)}
          <button type="button" className="ph-link" onClick={() => ph.setError(null)}>{t('common.close')}</button>
        </p>
      )}

      {ph.uploads.length > 0 && (
        <ul className="ph-uploads" aria-label={t('photos.uploading')}>
          {ph.uploads.map(u => (
            <li key={u.key} className={`ph-up ph-up-${u.state}`}>
              <div className="ph-up-head">
                <span className="ph-up-name">{u.fileName}</span>
                <span className="ph-up-state">
                  {u.state === 'done' ? t('photos.up.done')
                    : u.state === 'failed' ? t('photos.up.failed')
                      : u.state === 'uploading' ? t('photos.up.uploading') : t('photos.up.compressing')}
                </span>
                <button type="button" className="ph-up-x" aria-label={t('common.close')} onClick={() => ph.dismiss(u.key)}>
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              {/* Cuánto ha adelgazado, que es lo que él quiso ver desde las texturas. */}
              {u.before !== undefined && u.after !== undefined && (
                <span className="ph-up-size">{formatBytes(u.before)} → {formatBytes(u.after)}</span>
              )}
              {u.error && <span className="ph-up-err">{t(u.error)}</span>}
            </li>
          ))}
        </ul>
      )}

      {ph.loading
        ? <p className="ph-state">{t('common.loading')}</p>
        : ph.visible.length === 0
          ? (
            <EmptyState
              icon="photo_library"
              title={ph.query ? t('photos.noMatch') : t('photos.empty')}
              description={ph.query ? '' : t('photos.emptyHint')}
            />
          )
          : (
            <div className="ph-grid">
              {ph.visible.map(photo => (
                <figure key={photo.id} className="ph-cell">
                  {/*
                    * ARRASTRARLA A LA ESCENA (orden suya, 2026-09-24: «*asegurate que pueda arrastrar las
                    * fotos a la escena y no que solo sea con el boton*»). Va en la miniatura, que es lo que la
                    * mano quiere coger. El id y el TAMAÑO viajan juntos para que el mapa sepa la huella en el
                    * momento de soltar, sin ir a preguntar a la base y sin que la foto aparezca tarde.
                    */}
                  <button type="button" className="ph-thumb" onClick={() => setOpen({ kind: 'big', photo })}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData(PHOTO_DRAG_MIME, encodePhotoDrag(photo));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          aria-label={t('photos.see', { name: photo.name })}>
                    {ph.urls[photo.id]
                      ? <img src={ph.urls[photo.id]} alt="" />
                      : <span className="material-symbols-outlined" aria-hidden="true">image</span>}
                  </button>
                  <button type="button" className="ph-more" aria-haspopup="menu"
                          aria-expanded={open?.kind === 'menu' && open.photo.id === photo.id}
                          aria-label={t('photos.menu', { name: photo.name })}
                          onClick={() => setOpen(o => (o?.kind === 'menu' && o.photo.id === photo.id ? null : { kind: 'menu', photo }))}>
                    <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
                  </button>
                  <figcaption className="ph-name">{photo.name}</figcaption>

                  {open?.kind === 'menu' && open.photo.id === photo.id && (
                    <>
                      <div className="ph-catch" onClick={() => setOpen(null)} aria-hidden="true" />
                      <div className="ph-menu" role="menu" aria-label={t('photos.menu', { name: photo.name })}>
                        <button type="button" role="menuitem" className="ph-item" onClick={() => void renombrar(photo)}>
                          <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                          {t('photos.rename')}
                        </button>
                        <button type="button" role="menuitem" className="ph-item" onClick={() => setOpen({ kind: 'big', photo })}>
                          <span className="material-symbols-outlined" aria-hidden="true">open_in_full</span>
                          {t('photos.seeBig')}
                        </button>
                        <button type="button" role="menuitem" className="ph-item ph-item-danger" onClick={() => void pedirBorrar(photo)}>
                          <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                          {t('photos.remove')}
                        </button>
                      </div>
                    </>
                  )}
                </figure>
              ))}
            </div>
          )}

      {open?.kind === 'big' && (
        <SheetOverlay title={open.photo.name} width={760} noPadding onClose={() => setOpen(null)}>
          <div className="ph-big">
            {ph.urls[open.photo.id]
              ? <img src={ph.urls[open.photo.id]} alt={t('photos.see', { name: open.photo.name })} />
              : <p className="ph-state">{t('photos.error.load')}</p>}
          </div>
          <div className="ph-big-foot">
            <span className="ph-big-name">{open.photo.name}</span>
            <span className="ph-big-meta">{open.photo.width} × {open.photo.height}</span>
          </div>
        </SheetOverlay>
      )}

      {open?.kind === 'remove' && (
        <Modal title={t('photos.removeTitle', { name: open.photo.name })} onClose={() => setOpen(null)}>
          <div className="ph-remove">
            <p className="ph-remove-lead">{t('photos.removeLead')}</p>
            {open.usage === null
              ? <p className="ph-state">{t('common.loading')}</p>
              : <Usage usage={open.usage} />}
            <div className="ph-remove-foot">
              <button type="button" className="ph-btn" onClick={() => setOpen(null)}>{t('common.cancel')}</button>
              <button type="button" className="ph-btn ph-btn-danger" disabled={open.usage === null}
                      onClick={async () => { const p = open.photo; setOpen(null); await ph.remove(p); }}>
                {t('photos.remove')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Dónde se usa la foto. Con `messages: -1` no se pudo mirar, y se dice — no se finge que no se usa en nada. */
function Usage({ usage }: { usage: PhotoUsage }): JSX.Element {
  const { t } = useTranslation();
  if (usage.messages < 0) return <p className="ph-remove-warn">{t('photos.usageUnknown')}</p>;
  const nada = usage.adventures.length === 0 && usage.scenes.length === 0 && usage.messages === 0;
  if (nada) return <p className="ph-remove-none">{t('photos.usageNone')}</p>;
  return (
    <>
      <span className="ph-remove-label">{t('photos.usedIn')}</span>
      <ul className="ph-usage">
        {usage.adventures.map(a => (
          <li key={a.id}><span className="material-symbols-outlined" aria-hidden="true">menu_book</span>{a.title}</li>
        ))}
        {usage.scenes.map(s => (
          <li key={s.id}><span className="material-symbols-outlined" aria-hidden="true">map</span>{s.name}</li>
        ))}
        {usage.messages > 0 && (
          <li><span className="material-symbols-outlined" aria-hidden="true">forum</span>{t('photos.usageMessages', { n: String(usage.messages) })}</li>
        )}
      </ul>
      <p className="ph-remove-warn">{t('photos.removeConsequence')}</p>
    </>
  );
}
