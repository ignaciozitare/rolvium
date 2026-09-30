import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { RollEntry } from '@/modules/dice/ui/RollLog';
import type { Roll } from '@/modules/dice/domain/entities/Roll';
import type { ChatMessage } from '../domain/entities/Chat';
import type { ChatPort } from '../domain/ports/ChatPort';
import { chatPort as defaultChat } from '../container';
import { usePhotoUrls, type PhotoUrlSigner } from '@/shared/hooks/usePhotoUrls';
import type { PhotosPort } from '@/modules/photos';
import { ChatRollPopover } from './ChatRollPopover';
import { PhotoAttach } from './PhotoAttach';

interface Props {
  campaignId: string;
  conversationId: string;
  title: string;
  myUserId: string;
  system: GameSystem | null;
  onBack: () => void;
  /** Dentro de una PASTILLA la cabecera la pone ella (avatar, nombre, minimizar, cerrar): dos seguidas sobran. */
  hideHead?: boolean;
  /**
   * Se acaba de marcar leído (al abrir, y con cada mensaje ajeno que llega): quien lleve la campanita, que se
   * refresque. Dice CUÁL se ha leído porque el rincón de las pastillas lo necesita: si esta conversación tiene
   * pastilla, se le quita el contador —la está leyendo, aunque sea en la columna y no en la ventanita.
   */
  onRead?: (conversationId: string) => void;
  chat?: ChatPort;
  /** ¿Es el director? Sólo él manda fotos (H13) — y la base lo vuelve a comprobar por su cuenta. */
  isDm?: boolean;
  /** La galería de la campaña: para elegir la foto que se manda y para firmar la que se ve. */
  photos?: PhotosPort;
}

/** Hasta dónde crece la caja de escribir antes de hacer scroll: ~5 líneas. Más se come la conversación. */
const COMPOSER_MAX_PX = 104;

/** A `ChatMessage` of `kind = 'roll'`, reshaped as a `Roll` so it can render through the Registro's own `RollEntry`. */
function asRoll(m: ChatMessage): Roll {
  return {
    id: m.id, campaignId: '', characterId: m.characterId, characterName: m.characterName,
    authorId: m.authorId, authorName: m.authorName, authorAvatarUrl: m.authorAvatarUrl, systemId: m.systemId,
    kind: m.rollKind ?? 'free', title: m.body ?? '', request: m.rollRequest!, dice: m.rollDice!, result: m.rollResult!,
    visibility: 'table', correctsId: null, createdAt: m.createdAt,
  };
}

/** SUSURROS · conversación (`rolvium.pen` `H8P1R`): mensajes uno debajo de otro, entrada abajo. */
export function ConversationView({ campaignId, conversationId, title, myUserId, system, onBack, hideHead = false, onRead, chat = defaultChat, isDm = false, photos }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => (system ? sysT(system, locale) : (k: string) => k), [system, locale]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [rolling, setRolling] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const cajaRef = useRef<HTMLTextAreaElement>(null);
  /** Dónde dejar el cursor tras escribir un salto de línea a mano. `null` = no tocarlo. */
  const cursor = useRef<number | null>(null);
  // En un ref para que un `onRead` inline del padre no reinicie el efecto (recargaría los mensajes y resuscribiría).
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    chat.listMessages(conversationId).then(list => { if (alive) { setMessages(list); setStatus('ready'); } }).catch(() => { if (alive) setStatus('error'); });
    const markRead = () => chat.markRead(conversationId).then(() => { if (alive) onReadRef.current?.(conversationId); });
    void markRead();
    const off = chat.subscribeMessages(campaignId, m => {
      if (m.conversationId !== conversationId) return;
      setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
      if (m.authorId !== myUserId) void markRead();
    });
    return () => { alive = false; off(); };
  }, [chat, campaignId, conversationId, myUserId]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // La caja crece con lo que se escribe. Se reinicia a `auto` antes de medir o nunca podría MENGUAR al borrar.
  // Y aquí se coloca el cursor tras un salto de línea: SÍNCRONO, antes de que llegue la siguiente tecla.
  useLayoutEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    caja.style.height = 'auto';
    caja.style.height = `${Math.min(caja.scrollHeight, COMPOSER_MAX_PX)}px`;
    if (cursor.current !== null) {
      caja.selectionStart = caja.selectionEnd = cursor.current;
      cursor.current = null;
    }
  }, [body]);

  /**
   * ENTER MANDA; **Opción+Enter en Mac y Control+Enter en Windows hacen un salto de línea** (suyo,
   * 2026-09-28). Mayúsculas+Enter también, que es lo que la mano ya sabe de cualquier otro chat.
   *
   * 🔑 El salto hay que escribirlo A MANO. Un `<textarea>` sólo salta solo con Mayúsculas+Enter: con Alt o
   * con Control el navegador no escribe nada, así que dejar pasar el gesto no habría hecho nada y él habría
   * vuelto a decir que no va.
   */
  const alTeclear = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (e.shiftKey) return; // El navegador ya lo hace bien.
    e.preventDefault();
    if (!(e.altKey || e.ctrlKey || e.metaKey)) { void send(); return; }
    const { selectionStart: desde, selectionEnd: hasta } = e.currentTarget;
    setBody(prev => `${prev.slice(0, desde)}\n${prev.slice(hasta)}`);
    /*
     * El cursor tiene que quedar DETRÁS del salto, y hay que ponerlo SIN esperar un fotograma. Se hacía con
     * `requestAnimationFrame` y era un fallo de verdad (2026-09-28): si él seguía escribiendo antes de que
     * el fotograma llegara, las letras caían donde estaba el cursor viejo y luego el cursor saltaba — salía
     * «Primera\ndasegun» en vez de «Primera\nsegunda». Ahora lo apunta aquí y lo aplica el efecto de abajo,
     * que corre en cuanto el DOM está puesto y antes de que se procese la siguiente tecla.
     */
    cursor.current = desde + 1;
  };

  /**
   * LAS FOTOS DE LOS MENSAJES. El fichero vive en un bucket privado y el mensaje sólo guarda QUÉ foto es: el
   * enlace se firma aparte, y quien puede verla lo decide la base — un jugador de la conversación sí, uno de
   * fuera no, aunque se sepa el id.
   */
  const idsFoto = useMemo(
    () => [...new Set(messages.map(m => m.photoId).filter((id): id is string => id !== null))],
    [messages],
  );
  const photoUrls = usePhotoUrls(campaignId, idsFoto, photos as PhotoUrlSigner | undefined);

  const mandarFoto = async (photoId: string) => {
    if (sending) return;
    setSending(true);
    // El pie es lo que estuviera escrito: mandar una foto con su frase es un solo gesto, no dos mensajes.
    try { await chat.sendPhoto(conversationId, myUserId, photoId, body.trim() || undefined); setBody(''); }
    finally { setSending(false); }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try { await chat.sendText(conversationId, myUserId, text); setBody(''); } finally { setSending(false); }
  };

  return (
    <div className="ch-conversation">
      {!hideHead && (
        <div className="ch-conversation-head">
          <button type="button" className="ch-back" onClick={onBack} aria-label={t('chat.conversation.back')}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>
          </button>
          <UserAvatar user={{ name: title, avatarUrl: null }} size={22} />
          <span className="ch-conversation-title">{title}</span>
        </div>
      )}
      {status === 'error' && <p className="dc-log-error" role="alert">{t('chat.conversation.error')}</p>}
      {status === 'ready' && messages.length === 0 && <p className="dc-log-empty">{t('chat.conversation.empty')}</p>}
      <ul className="ch-messages" ref={listRef} aria-label={t('chat.conversation.messages')} aria-busy={status === 'loading'}>
        {messages.map(m => m.kind === 'roll'
          ? <RollEntry key={m.id} roll={asRoll(m)} t={t} ts={ts} system={system} />
          : <li key={m.id} className="ch-message">
              <UserAvatar user={{ name: m.authorName, avatarUrl: m.authorAvatarUrl }} size={22} />
              <div className="ch-message-body">
                <div className="ch-message-head">
                  <span className="ch-message-author">{m.authorName}</span>
                  <span className="ch-message-time">{new Date(m.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {m.kind === 'photo'
                  ? (
                    <>
                      {/*
                        * `photoId` a nulo significa **foto borrada**, no «sin foto»: al borrarla de la
                        * galería la base vacía la referencia y el mensaje se queda entero, con su hueco. Un
                        * mensaje viejo no se rompe porque se limpie la biblioteca.
                        */}
                      {m.photoId && photoUrls[m.photoId]
                        ? <img className="ch-message-photo" src={photoUrls[m.photoId]} alt={m.body ?? t('chat.photo.sent')} />
                        : <p className="ch-message-gone">{t('chat.photo.deleted')}</p>}
                      {m.body && <p className="ch-message-text">{m.body}</p>}
                    </>
                  )
                  : <p className="ch-message-text">{m.kind === 'roll_ref' ? t('chat.directory.rollRefPreview') : m.body}</p>}
              </div>
            </li>)}
      </ul>
      <p className="ch-conversation-note">{t('chat.conversation.privateRollNote')}</p>
      <div className="ch-composer">
        <div className="ch-composer-input">
          {/*
            * VARIAS LÍNEAS, no una. Era un `<input>`, donde un salto de línea es IMPOSIBLE por definición —
            * por eso «no me deja hacer un salto de linea» (suyo, 2026-09-28). Crece solo hasta un tope y
            * entonces hace scroll: la caja no se puede comer la conversación.
            */}
          <textarea ref={cajaRef} rows={1} value={body} placeholder={t('chat.conversation.placeholder', { name: title })}
            onChange={e => setBody(e.target.value)} onKeyDown={alTeclear} disabled={sending} />
        </div>
        {isDm && <PhotoAttach campaignId={campaignId} onPick={id => { void mandarFoto(id); }} {...(photos ? { photos } : {})} />}
        <button type="button" className="ch-roll-btn" aria-label={t('chat.roll.title')} aria-expanded={rolling} onClick={() => setRolling(o => !o)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>casino</span>
        </button>
        <button type="button" className="ch-send" aria-label={t('chat.conversation.send')} title={t('chat.conversation.send')}
          disabled={sending || !body.trim()} onClick={() => { void send(); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">send</span>
        </button>
        {rolling && <ChatRollPopover conversationId={conversationId} onClose={() => setRolling(false)} />}
      </div>
    </div>
  );
}
