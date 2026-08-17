import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Badge, UserAvatar } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS } from '@/systems/registry';
import type { TablePort } from '../domain/ports/TablePort';
import type { TableTab } from '../domain/entities/Table';
import { tableRepo } from '../container';
import { isConnected, tabsFor } from '../domain/useCases/tableRules';
import { useTable } from './useTable';
import { SharedResourceBar } from './SharedResourceBar';
import { Crescent } from './systemIcons';
import './table.css';

/** `/table/:id` — the live table, dressed with the campaign's game system (rolvium.pen Mesa/Plenilunio). */
export function TablePage({ repo = tableRepo }: { repo?: TablePort }): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const { snap, system, status, patchResources } = useTable(id, repo);
  const [tab, setTab] = useState<TableTab>('sheet');
  const [rollerOpen, setRollerOpen] = useState(false);

  // System fonts: load once per system (theme.fonts.url).
  useEffect(() => {
    const url = system?.theme.fonts?.url;
    if (!url || document.querySelector(`link[data-sys-font="${system?.id}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.dataset.sysFont = system?.id ?? ''; document.head.appendChild(link);
  }, [system]);

  const themeStyle = useMemo<CSSProperties>(() => {
    if (!system) return {};
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(system.theme.vars)) vars[`--sys-${k}`] = v;
    if (system.theme.backgroundImage) vars['--sys-bg-image'] = `url(${system.theme.backgroundImage})`;
    return vars as CSSProperties;
  }, [system]);

  if (status === 'loading') return <div className="tb-state">{t('common.loading')}</div>;
  if (status === 'not_member') return <TableNotice icon="lock" title={t('table.notMember')} />;
  if (status === 'system_not_installed') return <TableNotice icon="extension_off" title={t('table.systemNotInstalled')} />;
  if (status === 'error' || !snap || !system || !user) return <TableNotice icon="error" title={t('common.error')} />;

  const { campaign, members, presence, resources } = snap;
  const role = campaign.myRole ?? 'player';
  const sysInfo = SYSTEMS.find(s => s.id === campaign.systemId);
  const tabs = tabsFor(role);
  const dm = members.find(m => m.role === 'dm');
  const players = members.filter(m => m.role === 'player');
  const sysT = (key: string) => { const dict = ((system.locales[locale] ?? system.locales.es) ?? {}) as Record<string, unknown>; const v = key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict); return typeof v === 'string' ? v : key; };

  return (
    <div className="tb-root" data-system={system.id} style={themeStyle}>
      {/* Rolvium bar (platform chrome, stays in platform theme) */}
      <div className="tb-rvbar">
        <div className="tb-rvbar-left">
          <Link to="/campaigns" className="tb-rvbar-back"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>{t('modules.campaigns')}</Link>
          <img src="/brand/mark.svg" alt="" width={22} height={22} />
          <strong className="tb-rvbar-name">{campaign.name}</strong>
          <Badge color="accent">{sysInfo ? t(sysInfo.nameKey) : campaign.systemId}</Badge>
        </div>
        <div className="tb-rvbar-right">
          <span className="tb-rvbar-devices"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>devices</span>{t('table.devices', { n: String(presence.find(p => p.userId === user.id)?.devices ?? 1) })}</span>
          <UserAvatar user={{ name: user.name, avatarUrl: user.avatarUrl }} size={28} />
        </div>
      </div>

      {/* Themed table */}
      <div className="tb-table">
        <header className="tb-head">
          <div className="tb-head-left">
            <Crescent size={42} />
            <div>
              <div className="tb-sysname">{sysT(system.name).toUpperCase()}</div>
              <div className="tb-rotulo tb-dim">{campaign.name}</div>
            </div>
          </div>
          <div className="tb-head-right">
            <ul className="tb-people" aria-label={t('table.connected')}>
              {dm && <Person key={dm.userId} name={dm.name} avatarUrl={dm.avatarUrl} label={t('table.dm')} isDm connected={isConnected(presence, dm.userId)} me={dm.userId === user.id} />}
              {players.map(p => <Person key={p.userId} name={p.name} avatarUrl={p.avatarUrl} label={isConnected(presence, p.userId) ? p.name : t('table.absent')} connected={isConnected(presence, p.userId)} me={p.userId === user.id} />)}
            </ul>
            <span className={`tb-btn ${role === 'dm' ? 'tb-btn-gold' : 'tb-btn-solid'}`} aria-label={t('table.yourRole')}>{t(`table.role.${role}`)}</span>
          </div>
        </header>

        {(system.engine.sharedResources ?? []).map(def => (
          <div key={def.id} className="tb-res-wrap">
            <SharedResourceBar def={def} state={resources[def.id]} role={role} userId={user.id} label={sysT(def.label)}
              onTake={async () => { const r = await repo.takeResource(campaign.id, def.id, 1); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }}
              onReturn={async () => { const r = await repo.returnResource(campaign.id, def.id, 1); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }}
              onReset={async () => { const r = await repo.resetResource(campaign.id, def.id); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }} />
          </div>
        ))}

        <nav className="tb-tabs" aria-label={t('table.tabs')}>
          {tabs.map(tb => <button key={tb} type="button" className={`tb-btn ${tab === tb ? 'tb-btn-solid' : ''}`} aria-pressed={tab === tb} onClick={() => setTab(tb)}>{t(`table.tab.${tb}`)}</button>)}
        </nav>

        <div className="tb-body">
          <main className="tb-main">
            <section className="tb-hoja tb-placeholder" aria-live="polite">
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>construction</span>
              <div className="tb-rotulo">{t(`table.tab.${tab}`)}</div>
              <p>{t('table.comingNext')}</p>
            </section>
          </main>
          <aside className="tb-side">
            <button type="button" className={`tb-roller-btn ${rollerOpen ? 'on' : ''}`} onClick={() => setRollerOpen(o => !o)} aria-pressed={rollerOpen}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>casino</span>{t('table.roller')}
            </button>
            <section className="tb-hoja tb-panel">
              <div className="tb-panel-tabs">{(['log', 'chat', 'notes', 'journal'] as const).map((p, i) => <span key={p} className={`tb-btn tb-btn-xs ${i === 0 ? 'tb-btn-solid' : ''}`}>{t(`table.panel.${p}`)}</span>)}</div>
              <p className="tb-italic tb-dim">{t('table.logEmpty')}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Person({ name, avatarUrl, label, isDm = false, connected, me }: { name: string; avatarUrl: string | null; label: string; isDm?: boolean; connected: boolean; me: boolean }): JSX.Element {
  return (
    <li className={`tb-person ${connected ? 'on' : 'off'} ${me ? 'me' : ''}`} title={name}>
      <span className={`tb-halo ${isDm ? 'dm' : ''}`}><UserAvatar user={{ name, avatarUrl }} size={40} /></span>
      <span className="tb-person-label">{label.toUpperCase()}</span>
    </li>
  );
}

function TableNotice({ icon, title }: { icon: string; title: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="tb-state">
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)', color: 'var(--ac)' }}>{icon}</span>
      <h2>{title}</h2>
      <Link to="/campaigns" className="rv-nav-btn active" style={{ width: 'auto' }}>{t('common.back')}</Link>
    </div>
  );
}
