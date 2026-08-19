import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { Roll } from '../domain/entities/Roll';
import type { RollLogPort } from '../domain/ports/RollLogPort';
import { rollLog as defaultLog } from '../container';
import { describeRoll, type RollDie } from '../domain/useCases/rollRules';
import './dice.css';

interface Props {
  campaignId: string;
  /** The campaign's game system (its locales give the titles / verdicts); null while loading. */
  system: GameSystem | null;
  log?: RollLogPort;
  limit?: number;
}

/** Loads the recent rolls I may see and appends live inserts (RLS decides what arrives). */
export function useRollLog(campaignId: string, log: RollLogPort, limit = 50) {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    log.listRecent(campaignId, limit).then(list => { if (alive) { setRolls(list); setStatus('ready'); } }).catch(() => { if (alive) setStatus('error'); });
    const off = log.subscribe(campaignId, roll => setRolls(prev => (prev.some(r => r.id === roll.id) ? prev : [roll, ...prev].slice(0, limit))));
    return () => { alive = false; off(); };
  }, [campaignId, log, limit]);
  return { rolls, status };
}

/**
 * Registro (rolvium.pen Mesa/Side · Tirada/*): one entry per roll, **oldest first, newest at the bottom**, and it
 * follows the newest like a chat does. The store keeps them newest-first (that is what the query and the realtime
 * insert produce); only the reading order is flipped here, so the last thing you rolled is where your eyes are.
 */
export function RollLog({ campaignId, system, log = defaultLog, limit = 50 }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const { rolls, status } = useRollLog(campaignId, log, limit);
  const ts = useMemo(() => (system ? sysT(system, locale) : (k: string) => k), [system, locale]);
  const listRef = useRef<HTMLUListElement>(null);
  /** Layout effect, not effect: scroll before the browser paints, so the jump is never visible. */
  useLayoutEffect(() => {
    const el = listRef.current?.closest('.dc-log-scroll') ?? listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rolls.length]);
  if (status === 'error') return <p className="dc-log-error" role="alert">{t('dice.log.error')}</p>;
  if (status === 'ready' && rolls.length === 0) return <p className="dc-log-empty">{t('dice.log.empty')}</p>;
  return (
    <ul className="dc-log" ref={listRef} aria-label={t('dice.log.title')} aria-busy={status === 'loading'}>
      {[...rolls].reverse().map(r => <RollEntry key={r.id} roll={r} t={t} ts={ts} />)}
    </ul>
  );
}

function Die({ d, sharedLabel }: { d: RollDie; sharedLabel: string }): JSX.Element {
  return <span className={`dc-die ${d.tone} ${d.shared ? 'shared' : ''}`} title={d.shared ? sharedLabel : undefined}>{d.face}</span>;
}

export function RollEntry({ roll, t, ts }: { roll: Roll; t: (k: string, p?: Record<string, string>) => string; ts: (k: string) => string }): JSX.Element {
  const d = describeRoll(roll, t, ts);
  const sharedLabel = t('dice.log.shared');
  return (
    <li className={`dc-entry ${roll.kind}`} data-roll-id={roll.id}>
      <div className="dc-entry-head">
        <div className="dc-entry-author">
          {roll.kind === 'system' && <UserAvatar user={{ name: roll.authorName, avatarUrl: roll.authorAvatarUrl }} size={20} title={roll.authorName ?? undefined} />}
          <span className="dc-entry-title" title={d.title}>{d.title}</span>
          {roll.visibility !== 'table' && <span className="dc-vis">{t(`dice.log.visibility.${roll.visibility}`)}</span>}
        </div>
        {d.score !== null && <span className="dc-entry-score">{d.score}</span>}
      </div>
      <div className="dc-dice">
        {d.own.map((x, i) => <Die key={`o${i}`} d={x} sharedLabel={sharedLabel} />)}
        {d.opposition.length > 0 && <span className="dc-vs">{t('dice.log.vs')}</span>}
        {d.opposition.map((x, i) => <Die key={`p${i}`} d={x} sharedLabel={sharedLabel} />)}
      </div>
      {d.degree && <p className="dc-degree">{d.degree}</p>}
      {d.notices.map((n, i) => <div key={i} className={`dc-notice ${n.tone}`}>{n.text}</div>)}
    </li>
  );
}
