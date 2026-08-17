import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS } from '@/systems/registry';
import type { Campaign } from '../domain/entities/Campaign';
import type { CampaignsPort } from '../domain/ports/CampaignsPort';
import { campaignsRepo } from '../container';
import { CampaignCard } from './CampaignCard';
import { JoinByCodePanel } from './JoinByCodePanel';
import { CreateCampaignWizard } from './CreateCampaignWizard';

/** Home after login — rolvium.pen `Campañas/Home`. `repo` is injectable for tests. */
export function CampaignsPage({ repo = campaignsRepo }: { repo?: CampaignsPort }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Campaign[] | null>(null);
  const [open, setOpen] = useState<Campaign[]>([]);
  const [wizard, setWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, o] = await Promise.all([repo.listMine(), repo.listOpen()]);
      setMine(m); setOpen(o); setError(null);
    } catch { setError(t('common.error')); setMine([]); }
  }, [repo, t]);
  useEffect(() => { void load(); }, [load]);

  const canCreate = user?.role === 'game_master' || user?.role === 'admin';
  const goTable = (c: Campaign) => navigate(`/table/${c.id}`);

  return (
    <div className="rv-camp-page">
      <div className="rv-camp-main">
        <header className="rv-camp-header">
          <div>
            <h1 className="rv-page-title">{t('campaigns.hello', { name: user?.name?.split(' ')[0] ?? '' })}</h1>
            <p className="rv-page-sub" style={{ marginBottom: 0 }}>{mine && mine.length > 0 ? t('campaigns.subtitle', { n: String(mine.length) }) : t('campaigns.subtitleEmpty')}</p>
          </div>
          {canCreate && <Btn variant="primary" onClick={() => setWizard(true)}>{t('campaigns.createBtn')}</Btn>}
        </header>

        {error && <div className="rv-err" role="alert">{error}</div>}

        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="rv-section-title">{t('campaigns.mine')}</h2>
          {mine === null && <p className="rv-page-sub">{t('common.loading')}</p>}
          {mine && mine.length === 0 && (
            <Card><div className="rv-empty">
              <span className="material-symbols-outlined rv-empty-icon">auto_stories</span>
              <h3>{t('campaigns.empty.title')}</h3><p>{t('campaigns.empty.desc')}</p>
              {canCreate && <Btn variant="primary" onClick={() => setWizard(true)}>{t('campaigns.createBtn')}</Btn>}
            </div></Card>
          )}
          <div className="rv-camp-list">
            {mine?.map(c => <CampaignCard key={c.id} campaign={c} onEnter={goTable} />)}
          </div>
        </section>

        {open.length > 0 && (
          <section aria-labelledby="open-h">
            <h2 id="open-h" className="rv-section-title">{t('campaigns.open')}</h2>
            <div className="rv-camp-list">
              {open.map(c => <CampaignCard key={c.id} campaign={c} onRequestJoin={async (x) => { await repo.requestJoin(x.id); }} />)}
            </div>
          </section>
        )}
      </div>

      <aside className="rv-camp-aside">
        <JoinByCodePanel onJoin={code => repo.joinByCode(code)} onJoined={id => navigate(`/table/${id}`)} />
        <Card>
          <h3 className="rv-aside-title">{t('campaigns.systemsTitle')}</h3>
          <ul className="rv-sys-list">
            {SYSTEMS.map(s => (
              <li key={s.id} className={`rv-sys-item ${s.installed ? 'on' : ''}`}>
                <span className="rv-sys-icon"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{s.installed ? 'auto_stories' : 'schedule'}</span></span>
                <span><strong>{t(s.nameKey)}</strong><small>{s.installed ? t(`systems.${s.id}.tagline`) : t('campaigns.comingSoon')}</small></span>
              </li>
            ))}
          </ul>
          <p className="rv-aside-note">{t('campaigns.systemsNote')}</p>
        </Card>
      </aside>

      {wizard && <CreateCampaignWizard onClose={() => { setWizard(false); void load(); }} onCreate={input => repo.create(input)} onOpenTable={goTable} />}
    </div>
  );
}
