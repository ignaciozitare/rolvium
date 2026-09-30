import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { ChatDirectoryEntry } from '../domain/entities/Chat';
import type { ChatPort } from '../domain/ports/ChatPort';
import { chatPort as defaultChat } from '../container';
import { Directory } from './Directory';
import type { PhotosPort } from '@/modules/photos';
import { ConversationView } from './ConversationView';
import './chat.css';

type View = 'directory' | { conversationId: string; title: string };

interface Props {
  campaignId: string;
  myUserId: string;
  system: GameSystem | null;
  chat?: ChatPort;
  /** ¿Es el director? Sólo él manda fotos por el chat (H13). */
  isDm?: boolean;
  /** La galería de la campaña: elegir la foto que se manda y firmar la que se ve. */
  photos?: PhotosPort;
  /** Se pinchó la pastilla mientras se estaba en otra pestaña: abrir directo esa conversación. */
  pendingOpen?: { id: string; title: string } | null;
  onPendingOpenConsumed?: () => void;
  /** Una conversación acaba de marcarse leída — sube hasta `WhisperWatcher` para refrescar la campanita. */
  onRead?: (conversationId: string) => void;
  /** Se abrió una conversación: sube a `TablePage` para que salga TAMBIÉN su pastilla sobre la mesa (2026-09-16). */
  onOpenConversation?: (conversationId: string, title: string) => void;
}

/** SUSURROS (H8): directorio ⟷ conversación, dentro de la pestaña de la columna lateral (`SidePanel`). */
export function SusurrosPanel({ campaignId, myUserId, system, chat = defaultChat, pendingOpen, onPendingOpenConsumed, onRead, onOpenConversation, isDm = false, photos }: Props): JSX.Element {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ChatDirectoryEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<View>('directory');

  const reload = useCallback(() => {
    setStatus('loading');
    chat.listDirectory(campaignId, myUserId).then(list => { setEntries(list); setStatus('ready'); }).catch(() => setStatus('error'));
  }, [chat, campaignId, myUserId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (pendingOpen) { setView({ conversationId: pendingOpen.id, title: pendingOpen.title }); onPendingOpenConsumed?.(); }
  }, [pendingOpen, onPendingOpenConsumed]);

  const openEntry = async (entry: ChatDirectoryEntry) => {
    const id = entry.conversationId ?? await chat.openConversation(campaignId, entry.memberIds);
    setView({ conversationId: id, title: entry.title });
    onOpenConversation?.(id, entry.title);
  };
  const createGroup = async (memberIds: string[]) => {
    if (memberIds.length === 0) return;
    const id = await chat.openConversation(campaignId, memberIds);
    const title = t('chat.directory.newGroupTitle');
    setView({ conversationId: id, title });
    onOpenConversation?.(id, title);
  };
  const back = () => { setView('directory'); reload(); };

  if (view !== 'directory') {
    // 🔑 `isDm` VIAJA HASTA AQUÍ. Sin esto el director no veía el clip en la conversación de la COLUMNA —sólo
    // en las pastillas—, que es justo donde más se escribe. (🐞 revisión del 2026-09-28.)
    return <ConversationView campaignId={campaignId} conversationId={view.conversationId} title={view.title} myUserId={myUserId} system={system} onBack={back} chat={chat} isDm={isDm} {...(photos ? { photos } : {})} {...(onRead ? { onRead } : {})} />;
  }
  if (status === 'error') return <p className="dc-log-error" role="alert">{t('chat.directory.error')}</p>;
  return <Directory entries={entries} onOpen={entry => { void openEntry(entry); }} onCreateGroup={ids => { void createGroup(ids); }} />;
}
