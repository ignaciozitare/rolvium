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
import { ChatRollPopover } from './ChatRollPopover';

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
}

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
export function ConversationView({ campaignId, conversationId, title, myUserId, system, onBack, hideHead = false, onRead, chat = defaultChat }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => (system ? sysT(system, locale) : (k: string) => k), [system, locale]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [rolling, setRolling] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
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
                <p className="ch-message-text">{m.kind === 'roll_ref' ? t('chat.directory.rollRefPreview') : m.body}</p>
              </div>
            </li>)}
      </ul>
      <p className="ch-conversation-note">{t('chat.conversation.privateRollNote')}</p>
      <div className="ch-composer">
        <div className="ch-composer-input">
          <input type="text" value={body} placeholder={t('chat.conversation.placeholder', { name: title })}
            onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void send(); }} disabled={sending} />
        </div>
        <button type="button" className="ch-roll-btn" aria-label={t('chat.roll.title')} aria-expanded={rolling} onClick={() => setRolling(o => !o)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>casino</span>
        </button>
        <button type="button" className="ch-send" disabled={sending || !body.trim()} onClick={() => { void send(); }}>{t('chat.conversation.send')}</button>
        {rolling && <ChatRollPopover conversationId={conversationId} onClose={() => setRolling(false)} />}
      </div>
    </div>
  );
}
