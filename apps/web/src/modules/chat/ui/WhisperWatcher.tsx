import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { ChatPort } from '../domain/ports/ChatPort';
import type { SoundPort } from '../domain/ports/SoundPort';
import { chatPort as defaultChat, whisperSound as defaultSound } from '../container';
import { WhisperPill } from './WhisperPill';

/** Cuántas pastillas caben a la vez. La cuarta cierra la más vieja: más no entran sin tapar la mesa. */
const MAX_PILLS = 3;

interface Pill {
  conversationId: string;
  title: string;
  open: boolean;
  unread: number;
}

interface Props {
  campaignId: string;
  myUserId: string;
  system: GameSystem | null;
  chat?: ChatPort;
  sound?: SoundPort;
  /** «Abre esta conversación como pastilla» — lo manda el directorio de la columna a través de `TablePage`. */
  requestOpen?: { id: string; title: string } | null;
  onRequestOpenConsumed?: () => void;
  /** Total de no leídos de toda la campaña, para la campanita de la pestaña SUSURROS. */
  onUnreadChange?: (total: number) => void;
  /** Cambia cuando se marca leída una conversación en la columna: el total se recuenta. */
  refreshKey?: number;
}

/**
 * EL RINCÓN DE LAS PASTILLAS (`rolvium.pen` `oPbeF`): la fila de ventanitas de conversación abajo a la derecha,
 * encima de la mesa. Vive en `TablePage` y no dentro de una pestaña, por lo mismo que `AttackWatcher`: un
 * susurro tiene que poder leerse y contestarse esté el jugador donde esté, incluso con la columna plegada.
 *
 * Aquí vive el ir y venir —el tiempo real, cuántas pastillas hay, cuáles están desplegadas, el total de no
 * leídos y el ruidito—; `WhisperPill` sólo pinta lo que le dan.
 *
 * Reglas, todas suyas (2026-09-16):
 *   · Abrir una conversación en el directorio deja su pastilla MINIMIZADA (barrita): la conversación se lee en
 *     la columna, y la ventanita la despliega él si la quiere. Antes nacía desplegada y se veía la misma
 *     conversación dos veces a la vez (decisión suya, 2026-09-16).
 *   · Si te susurran y no tenías esa pastilla, nace MINIMIZADA, en sangre y con un ruidito.
 *   · Si ya la tenías desplegada, el mensaje entra dentro y no suena nada: lo estás mirando.
 *   · Lo tuyo nunca suena ni te pone contador.
 */
export function WhisperWatcher({ campaignId, myUserId, system, chat = defaultChat, sound = defaultSound, requestOpen, onRequestOpenConsumed, onUnreadChange, refreshKey = 0 }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const [pills, setPills] = useState<Pill[]>([]);
  /* Espejo en un ref: el oyente de tiempo real necesita saber si la pastilla YA existe *antes* de tocar el
     estado, porque el ruidito no puede sonar dentro de un actualizador (React lo llama dos veces en
     desarrollo y sonaría doble). */
  const pillsRef = useRef<Pill[]>(pills);
  pillsRef.current = pills;
  const consumedRef = useRef(onRequestOpenConsumed);
  consumedRef.current = onRequestOpenConsumed;
  /* En un ref para que un `onUnreadChange` escrito en línea por el padre no tire y rehaga el canal de tiempo
     real en cada repintado de la mesa (hoy llega el `setChatUnread` de siempre, pero esto lo deja atado). */
  const unreadRef = useRef(onUnreadChange);
  unreadRef.current = onUnreadChange;

  /**
   * UNA sola lectura del directorio para dos cosas: el total de no leídos (la campanita de la pestaña) y el
   * TÍTULO de verdad de cada pastilla.
   *
   * 🐞 Lo del título no es un adorno: una pastilla que nace de un susurro sólo sabe quién escribió, y en un
   * GRUPO eso es un nombre suelto —«Marta»— cuando la conversación es de tres. El directorio es el único que
   * sabe cómo se llama de verdad («Marta, Dani»), así que en cuanto contesta se corrige.
   */
  const pullDirectory = useCallback(() => {
    chat.listDirectory(campaignId, myUserId).then(rows => {
      unreadRef.current?.(rows.reduce((n, r) => n + r.unreadCount, 0));
      const porId = new Map(rows.filter(r => r.conversationId).map(r => [r.conversationId as string, r.title]));
      setPills(prev => (prev.some(p => porId.get(p.conversationId) !== undefined && porId.get(p.conversationId) !== p.title)
        ? prev.map(p => ({ ...p, title: porId.get(p.conversationId) ?? p.title }))
        : prev));
    }).catch(() => {});
  }, [chat, campaignId, myUserId]);

  useEffect(() => { pullDirectory(); }, [pullDirectory, refreshKey]);

  /** Sitio para una más: la cuarta echa a la más vieja (la primera de la fila). */
  const fit = (list: Pill[]): Pill[] => (list.length > MAX_PILLS ? list.slice(list.length - MAX_PILLS) : list);

  /**
   * Pone la pastilla en el rincón a petición del directorio. Nace como BARRITA, no desplegada: la conversación
   * ya se está leyendo en la columna. Si la pastilla YA estaba puesta se respeta como la dejó él —desplegada o
   * barrita— y sólo se le pone el contador a cero, porque lo que llegue lo va a ver en la columna.
   */
  const openPill = useCallback((conversationId: string, title: string) => {
    setPills(prev => {
      const i = prev.findIndex(p => p.conversationId === conversationId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, title, unread: 0 };
        return next;
      }
      return fit([...prev, { conversationId, title, open: false, unread: 0 }]);
    });
  }, []);

  useEffect(() => {
    if (!requestOpen) return;
    openPill(requestOpen.id, requestOpen.title);
    consumedRef.current?.();
  }, [requestOpen, openPill]);

  useEffect(() => {
    const off = chat.subscribeMessages(campaignId, m => {
      pullDirectory();
      if (m.authorId === myUserId) return;
      const ya = pillsRef.current.find(p => p.conversationId === m.conversationId);
      if (ya?.open) return;                      // la estás mirando: el mensaje ya entra en la conversación
      if (!ya) sound.play();                     // pastilla nueva: suena una vez
      setPills(prev => {
        const i = prev.findIndex(p => p.conversationId === m.conversationId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i]!, unread: next[i]!.unread + 1 };
          return next;
        }
        // Quien escribió, de momento: si es un grupo, `pullDirectory` lo corrige con los nombres de todos.
        return fit([...prev, { conversationId: m.conversationId, title: m.authorName, open: false, unread: 1 }]);
      });
    });
    return () => { off(); };
  }, [chat, campaignId, myUserId, sound, pullDirectory]);

  const toggle = (conversationId: string) => setPills(prev => prev.map(p =>
    p.conversationId === conversationId ? { ...p, open: !p.open, unread: p.open ? p.unread : 0 } : p));
  const close = (conversationId: string) => setPills(prev => prev.filter(p => p.conversationId !== conversationId));
  const read = (conversationId: string) => {
    setPills(prev => prev.map(p => (p.conversationId === conversationId ? { ...p, unread: 0 } : p)));
    pullDirectory();
  };

  if (pills.length === 0) return null;
  return (
    <div className="ch-dock" aria-label={t('chat.pill.dock')}>
      {pills.map(p => (
        <WhisperPill key={p.conversationId} campaignId={campaignId} conversationId={p.conversationId} title={p.title}
          myUserId={myUserId} system={system} open={p.open} unread={p.unread}
          onToggle={() => toggle(p.conversationId)} onClose={() => close(p.conversationId)} onRead={() => read(p.conversationId)}
          {...(chat ? { chat } : {})} />
      ))}
    </div>
  );
}
