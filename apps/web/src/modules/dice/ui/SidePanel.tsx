import { useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { RollLogPort } from '../domain/ports/RollLogPort';
import type { ChatPort } from '@/modules/chat/domain/ports/ChatPort';
import { SusurrosPanel } from '@/modules/chat/ui/SusurrosPanel';
import { RollLog } from './RollLog';
import './dice.css';

export type SidePanelTab = 'log' | 'chat' | 'notes' | 'journal';
const TABS: SidePanelTab[] = ['log', 'chat', 'notes', 'journal'];

interface Props {
  campaignId: string;
  system: GameSystem | null;
  rollerOpen: boolean;
  onToggleRoller: () => void;
  log?: RollLogPort;
  /** Para SUSURROS (H8): quién mira y cuántos no leídos lleva la pestaña (los cuenta `WhisperWatcher`, montado
   * en `TablePage`). Desde el 16-09 el camino contrario —abrir una conversación— va de aquí HACIA `TablePage`
   * (`onChatOpen`), que es quien saca la pastilla sobre la mesa. */
  myUserId: string;
  chatUnread?: number;
  pendingChatOpen?: { id: string; title: string } | null;
  onPendingChatOpenConsumed?: () => void;
  /** Se marcó leída una conversación: `TablePage` se lo pasa a `WhisperWatcher` para que recuente. */
  onChatRead?: (conversationId: string) => void;
  /** Se abrió una conversación en el directorio: `TablePage` saca TAMBIÉN su pastilla sobre la mesa. */
  onChatOpen?: (conversationId: string, title: string) => void;
  chat?: ChatPort;
}

/**
 * The table's side column (rolvium.pen Mesa/Side): tabs Registro · Susurros · Notas · Bitácora.
 * The «Lanzador de dados» button is NOT here any more — the dice are the first tool of the scene toolbar, and two
 * ways to open the same thing is one too many.
 */
export function SidePanel({ campaignId, system, rollerOpen, onToggleRoller, log, myUserId, chatUnread = 0, pendingChatOpen, onPendingChatOpenConsumed, onChatRead, onChatOpen, chat }: Props): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SidePanelTab>('log');
  // Un pedido externo de abrir una conversación en la COLUMNA (hoy nadie lo manda: las pastillas lo hacen mejor).
  useEffect(() => { if (pendingChatOpen) setTab('chat'); }, [pendingChatOpen]);
  return (
    <div className="dc-side">
      <section className="dc-panel">
        <div className="dc-tabs" role="tablist" aria-label={t('dice.panel.tabs')}>
          {TABS.map(p => (
            <button key={p} type="button" role="tab" className="dc-tab" aria-selected={tab === p} onClick={() => setTab(p)}>
              {t(`table.panel.${p}`)}
              {p === 'chat' && tab !== 'chat' && chatUnread > 0 && <span className="ch-tab-unread">{chatUnread}</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="dc-log-scroll">
          {tab === 'log'
            ? <RollLog campaignId={campaignId} system={system} {...(log ? { log } : {})} />
            : tab === 'chat'
              ? <SusurrosPanel campaignId={campaignId} myUserId={myUserId} system={system} {...(chat ? { chat } : {})} pendingOpen={pendingChatOpen ?? null} {...(onPendingChatOpenConsumed ? { onPendingOpenConsumed: onPendingChatOpenConsumed } : {})} {...(onChatRead ? { onRead: onChatRead } : {})} {...(onChatOpen ? { onOpenConversation: onChatOpen } : {})} />
              : <div className="dc-soon" aria-live="polite"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>construction</span>{t('dice.panel.soon')}</div>}
        </div>
      </section>
    </div>
  );
}
