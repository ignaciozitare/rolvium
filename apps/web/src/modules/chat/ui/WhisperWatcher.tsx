import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../domain/entities/Chat';
import type { ChatPort } from '../domain/ports/ChatPort';
import { chatPort as defaultChat } from '../container';
import { WhisperPill } from './WhisperPill';

const PILL_TIMEOUT_MS = 8000;

interface Props {
  campaignId: string;
  myUserId: string;
  chat?: ChatPort;
  /** Se pinchó la pastilla: abrí SUSURROS en esa conversación. El título es el de quien te susurró — en un
   * grupo no son todos los nombres, pero es gratis (ya viene en el mensaje) y basta para saber a qué volvió. */
  onOpen: (conversationId: string, title: string) => void;
  /** Total de no leídos de toda la campaña, para la campanita de la pestaña SUSURROS. */
  onUnreadChange?: (total: number) => void;
  /** Cambia cuando el usuario marca leída una conversación (`ConversationView` → `SidePanel` → `TablePage`):
   * el total se recuenta. Sin esto la campanita se quedaba con el número viejo hasta el siguiente susurro. */
  refreshKey?: number;
}

/**
 * Vigila los susurros de toda la campaña (nunca de una sola conversación) y saca la pastilla — mismo
 * reparto Watcher/Alert que `AttackWatcher`/`AttackAlert`: el ir y venir (tiempo real, el total de no
 * leídos) vive aquí, `WhisperPill` sólo pinta lo que le dan.
 *
 * A diferencia de un ataque, una pastilla no espera respuesta: si no se pincha, se va sola — así que no
 * hace falta cola («uno cada vez, el más viejo primero»): la última sustituye a la que hubiera.
 */
export function WhisperWatcher({ campaignId, myUserId, chat = defaultChat, onOpen, onUnreadChange, refreshKey = 0 }: Props): JSX.Element | null {
  const [pill, setPill] = useState<ChatMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnread = useCallback(() => {
    if (!onUnreadChange) return;
    chat.listDirectory(campaignId, myUserId).then(rows => onUnreadChange(rows.reduce((n, r) => n + r.unreadCount, 0))).catch(() => {});
  }, [chat, campaignId, myUserId, onUnreadChange]);

  useEffect(() => { refreshUnread(); }, [refreshUnread, refreshKey]);

  useEffect(() => {
    const off = chat.subscribeMessages(campaignId, m => {
      refreshUnread();
      if (m.authorId === myUserId) return;
      setPill(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPill(null), PILL_TIMEOUT_MS);
    });
    return () => { off(); if (timer.current) clearTimeout(timer.current); };
  }, [chat, campaignId, refreshUnread, myUserId]);

  if (!pill) return null;
  return (
    <WhisperPill
      message={pill}
      onOpen={() => { setPill(null); onOpen(pill.conversationId, pill.authorName); }}
      onDismiss={() => setPill(null)}
    />
  );
}
