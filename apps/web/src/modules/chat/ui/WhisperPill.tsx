import { useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import type { ChatPort } from '../domain/ports/ChatPort';
import { ConversationView } from './ConversationView';

interface Props {
  campaignId: string;
  conversationId: string;
  title: string;
  myUserId: string;
  system: GameSystem | null;
  /** Desplegada (la conversación entera) o minimizada (sólo la barrita). */
  open: boolean;
  /** Sin leer mientras estuvo minimizada. Estando desplegada siempre es 0: se leen según llegan. */
  unread: number;
  onToggle: () => void;
  onClose: () => void;
  onRead: () => void;
  chat?: ChatPort;
}

/**
 * LA PASTILLA (`rolvium.pen` `oPbeF`, lámina `XwDVn`) — una ventanita de conversación abajo a la derecha,
 * encima de la mesa, como las de LinkedIn. Suyo, 2026-09-16: «*cuando abro una conversación tiene que estar
 * la pastilla, se tiene que poder minimizar… no es fija, se tiene que poder cerrar*».
 *
 * 🔑 **No es un aviso.** Hasta el 16-09 esto era un cartel que saltaba y se iba solo a los ocho segundos —
 * invención mía, no lo que él pidió. Ahora la pastilla ES la conversación: se despliega, se minimiza a su
 * barrita y se cierra con la X. Cerrarla no borra nada: la conversación se reabre desde el directorio.
 *
 * Minimizada y con mensajes sin leer va en SANGRE (suyo: «*que se vea*»); el ruidito lo pone `WhisperWatcher`,
 * que es quien sabe si la pastilla acaba de nacer.
 *
 * Por dentro no reinventa nada: el cuerpo es el MISMO `ConversationView` de la columna, con `hideHead` porque
 * aquí la cabecera la pone la pastilla.
 */
export function WhisperPill({ campaignId, conversationId, title, myUserId, system, open, unread, onToggle, onClose, onRead, chat }: Props): JSX.Element {
  const { t } = useTranslation();
  const alert = !open && unread > 0;
  return (
    <section className={`ch-pill${open ? ' open' : ''}${alert ? ' alert' : ''}`} aria-label={t('chat.pill.window', { name: title })}>
      <div className="ch-pill-head">
        <button type="button" className="ch-pill-toggle" onClick={onToggle} aria-expanded={open}
          aria-label={open ? t('chat.pill.minimize', { name: title }) : t('chat.pill.expand', { name: title })}>
          <UserAvatar user={{ name: title, avatarUrl: null }} size={20} />
          <span className="ch-pill-who">{title}</span>
          {alert && <span className="ch-pill-unread" aria-label={t('chat.pill.unread', { n: String(unread) })}>{unread}</span>}
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
            {open ? 'remove' : 'keyboard_arrow_up'}
          </span>
        </button>
        <button type="button" className="ch-pill-x" onClick={onClose} aria-label={t('chat.pill.close', { name: title })}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span>
        </button>
      </div>
      {open && (
        <div className="ch-pill-body">
          <ConversationView campaignId={campaignId} conversationId={conversationId} title={title} myUserId={myUserId}
            system={system} hideHead onBack={onClose} onRead={onRead} {...(chat ? { chat } : {})} />
        </div>
      )}
    </section>
  );
}
