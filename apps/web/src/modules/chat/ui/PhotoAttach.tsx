import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ACCEPTED_MIME, EmptyState, Modal } from '@rolvium/ui';
import { usePhotos, type PhotosPort } from '@/modules/photos';

interface Props {
  campaignId: string;
  /** Se ha elegido una foto (ya subida y guardada en la galería): quien manda el mensaje es el chat. */
  onPick: (photoId: string) => void;
  /** Se inyecta en los tests; en la mesa lo pone el contenedor del módulo de fotos. */
  photos?: PhotosPort;
}

/**
 * EL CLIP DEL CHAT (H13, rebanada 5) — mandar una foto por un susurro. **Sólo del director**: quien lo pinta
 * ya comprueba el papel, y la base lo vuelve a decir por su cuenta (`chat_messages_insert`).
 * Diseño: `rolvium.pen` § 4 · `Fotos/En el chat · mandarla y verla`, aprobado el 2026-09-24.
 *
 * 🔑 **Es un ICONO, no una palabra.** Orden suya del 2026-09-28: «*ten muchi ojo esto tiene que ser un icono
 * no una palabra no hay mucho lugar*». En la fila de escribir caben la caja, el dado, el clip y enviar, y nada
 * más — por eso ese mismo día ENVIAR también dejó de ser palabra.
 *
 * Los dos caminos son los de la lámina: **del ordenador** (se comprime, entra en la galería y se manda) y
 * **de la galería** (lo que ya está subido). Subir desde aquí NO crea una foto suelta: la biblioteca de la
 * campaña es una sola, así que la foto queda ahí para volver a usarla.
 *
 * Reutilización declarada — **REUSE**: `Modal` y `EmptyState` de `@rolvium/ui`, y sobre todo `usePhotos`, el
 * mismo motor que lleva la pestaña del carril, así que subir, comprimir, buscar y los rechazos se comportan
 * igual en los dos sitios. `Btn` NO encaja aquí: el clip es un icono desnudo dentro de la fila de escribir,
 * hermano de `.ch-roll-btn` y `.ch-send`, que ya viven ahí con esa misma pinta.
 */
export function PhotoAttach({ campaignId, onPick, photos }: Props): JSX.Element {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  /** Un fichero recién elegido del ordenador, esperando a que el selector lo suba. Por instancia: con dos
   *  pastillas abiertas, la foto de una no puede acabar en la conversación de la otra. */
  const [pendiente, setPendiente] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const cerrar = (): void => { setPicker(false); setPendiente(null); };

  return (
    <>
      <button type="button" className="ch-clip" aria-haspopup="menu" aria-expanded={menu}
        aria-label={t('chat.photo.attach')} title={t('chat.photo.attach')}
        onClick={() => setMenu(o => !o)}>
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">attach_file</span>
      </button>

      <input ref={fileInput} type="file" accept={ACCEPTED_MIME.join(',')} hidden data-testid="ch-photo-input"
        aria-label={t('chat.photo.fromComputer')}
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) { setPendiente(f); setPicker(true); }
        }} />

      {menu && (
        <>
          <div className="ch-catch" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="ch-clip-menu" role="menu" aria-label={t('chat.photo.attach')}>
            <button type="button" role="menuitem" className="ch-clip-item" onClick={() => { setMenu(false); fileInput.current?.click(); }}>
              <span className="material-symbols-outlined" aria-hidden="true">upload</span>
              {t('chat.photo.fromComputer')}
            </button>
            <button type="button" role="menuitem" className="ch-clip-item" onClick={() => { setMenu(false); setPicker(true); }}>
              <span className="material-symbols-outlined" aria-hidden="true">photo_library</span>
              {t('chat.photo.fromGallery')}
            </button>
          </div>
        </>
      )}

      {picker && (
        <PhotoPicker campaignId={campaignId} {...(photos ? { photos } : {})} subir={pendiente}
          onClose={cerrar}
          onPick={id => { cerrar(); onPick(id); }} />
      )}
    </>
  );
}

interface PickerProps {
  campaignId: string;
  /** Un fichero recién elegido del ordenador: se sube nada más abrir y se manda solo al terminar. */
  subir: File | null;
  onPick: (photoId: string) => void;
  onClose: () => void;
  photos?: PhotosPort;
}

/**
 * LA GALERÍA, para elegir una. No es una galería nueva: reutiliza `usePhotos`, el mismo que lleva la pestaña
 * del carril, así que buscar, subir, comprimir y los rechazos se comportan exactamente igual en los dos
 * sitios. Se monta sólo al abrirlo: nadie pide la biblioteca entera por tener un chat abierto.
 */
function PhotoPicker({ campaignId, subir, onPick, onClose, photos }: PickerProps): JSX.Element {
  const { t } = useTranslation();
  const ph = usePhotos({ campaignId, ...(photos ? { repo: photos } : {}) });
  const [subiendo, setSubiendo] = useState(subir !== null);
  const lanzada = useRef(false);

  /*
   * El fichero del ordenador entra en la galería y se manda SOLO: pedirle que lo vuelva a elegir de una
   * rejilla en la que acaba de aparecer sería tonto. `lanzada` evita que un repintado lo suba dos veces.
   */
  useEffect(() => {
    if (!subir || lanzada.current) return;
    lanzada.current = true;
    void ph.upload([subir], t('photos.unnamed')).then(creadas => {
      setSubiendo(false);
      // Si no entró (formato, tamaño), el aviso lo pone `usePhotos` y la rejilla se queda para elegir a mano.
      if (creadas[0]) onPick(creadas[0].id);
    });
  }, [subir, ph, t, onPick]);

  return (
    <Modal title={t('chat.photo.pickTitle')} onClose={onClose} width={520}>
      <div className="ch-picker">
        {ph.error && <p className="ch-picker-error" role="alert">{t(ph.error)}</p>}
        {subiendo
          ? <p className="ch-picker-state">{t('chat.photo.uploading')}</p>
          : ph.loading
            ? <p className="ch-picker-state">{t('common.loading')}</p>
            : ph.visible.length === 0
              ? <EmptyState icon="photo_library" title={t('chat.photo.empty')} description={t('chat.photo.emptyHint')} />
              : (
                <div className="ch-picker-grid">
                  {ph.visible.map(foto => (
                    <button key={foto.id} type="button" className="ch-picker-cell"
                      aria-label={foto.name} onClick={() => onPick(foto.id)}>
                      {ph.urls[foto.id]
                        ? <img src={ph.urls[foto.id]} alt="" />
                        : <span className="material-symbols-outlined" aria-hidden="true">image</span>}
                      <span className="ch-picker-name">{foto.name}</span>
                    </button>
                  ))}
                </div>
              )}
      </div>
    </Modal>
  );
}
