import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { RollLogPort } from '../domain/ports/RollLogPort';
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
}

/**
 * The table's side column (rolvium.pen Mesa/Side): tabs Registro · Chat · Notas · Bitácora.
 * The «Lanzador de dados» button is NOT here any more — the dice are the first tool of the scene toolbar, and two
 * ways to open the same thing is one too many.
 */
export function SidePanel({ campaignId, system, rollerOpen, onToggleRoller, log }: Props): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SidePanelTab>('log');
  return (
    <div className="dc-side">
      <section className="dc-panel">
        <div className="dc-tabs" role="tablist" aria-label={t('dice.panel.tabs')}>
          {TABS.map(p => <button key={p} type="button" role="tab" className="dc-tab" aria-selected={tab === p} onClick={() => setTab(p)}>{t(`table.panel.${p}`)}</button>)}
        </div>
        <div role="tabpanel" className="dc-log-scroll">
          {tab === 'log'
            ? <RollLog campaignId={campaignId} system={system} {...(log ? { log } : {})} />
            : <div className="dc-soon" aria-live="polite"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>construction</span>{t('dice.panel.soon')}</div>}
        </div>
      </section>
    </div>
  );
}
