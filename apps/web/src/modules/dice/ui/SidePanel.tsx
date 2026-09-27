import { useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { RollLogPort } from '../domain/ports/RollLogPort';
import type { ChatPort } from '@/modules/chat/domain/ports/ChatPort';
import type { JournalPort } from '@/modules/journal';
import { SusurrosPanel } from '@/modules/chat/ui/SusurrosPanel';
import { JournalPanel } from '@/modules/journal';
import { GalleryPanel, type PhotosPort } from '@/modules/photos';
import { RollLog } from './RollLog';
import './dice.css';

export type SidePanelTab = 'log' | 'chat' | 'notes' | 'journal' | 'gallery';
const TABS: SidePanelTab[] = ['log', 'chat', 'notes', 'journal'];
/**
 * LA GALERÍA (H13) es SÓLO del director: la pestaña no existe para un jugador, y aunque llegara, la RLS no le
 * daría ni una fila. Las dos barreras son a propósito — la de pantalla es comodidad, la de base es la real.
 * Con cinco pestañas la barra pasa a dos líneas; `.dc-tabs` ya lo hacía solo (`flex-wrap: wrap`).
 */
const TABS_DM: SidePanelTab[] = [...TABS, 'gallery'];

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
  /** Notas y Bitácora (H9). Se inyecta en los tests; en la mesa lo pone el contenedor del módulo. */
  journal?: JournalPort;
  /** ¿Es el director? Sólo él tiene GALERÍA (H13). */
  isDm?: boolean;
  /** La biblioteca de fotos. Se inyecta como los demás puertos; sin esto iría contra Supabase en un test. */
  photos?: PhotosPort;
}

/**
 * The table's side column (rolvium.pen Mesa/Side): tabs Registro · Susurros · Notas · Bitácora, y GALERÍA
 * (H13) para el director desde el 2026-09-27.
 * Notas y Bitácora dejaron de ser «próximamente» el 2026-09-20: las pinta `JournalPanel` (H9).
 * The «Lanzador de dados» button is NOT here any more — the dice are the first tool of the scene toolbar, and two
 * ways to open the same thing is one too many.
 */
export function SidePanel({ campaignId, system, rollerOpen, onToggleRoller, log, myUserId, chatUnread = 0, pendingChatOpen, onPendingChatOpenConsumed, onChatRead, onChatOpen, chat, journal, isDm = false, photos }: Props): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SidePanelTab>('log');
  // Un pedido externo de abrir una conversación en la COLUMNA (hoy nadie lo manda: las pastillas lo hacen mejor).
  useEffect(() => { if (pendingChatOpen) setTab('chat'); }, [pendingChatOpen]);
  return (
    <div className="dc-side">
      <section className="dc-panel">
        <div className="dc-tabs" role="tablist" aria-label={t('dice.panel.tabs')}>
          {(isDm ? TABS_DM : TABS).map(p => (
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
              : tab === 'gallery'
                ? <GalleryPanel campaignId={campaignId} {...(photos ? { repo: photos } : {})} />
                : <JournalPanel kind={tab === 'notes' ? 'notes' : 'logbook'} campaignId={campaignId} myUserId={myUserId} {...(journal ? { journal } : {})} />}
        </div>
      </section>
    </div>
  );
}
