import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card, PageHeader, SectionTitle, EmptyState } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS, systemRegistry } from '@/systems/registry';
import { initialSharedResources } from '@rolvium/core';
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
        <PageHeader title={t('campaigns.hello', { name: user?.name?.split(' ')[0] ?? '' })}
          subtitle={mine && mine.length > 0 ? t('campaigns.subtitle', { n: String(mine.length) }) : t('campaigns.subtitleEmpty')}
          actions={canCreate && <Btn variant="primary" onClick={() => setWizard(true)}>{t('campaigns.createBtn')}</Btn>} />

        {error && <div className="rv-err" role="alert">{error}</div>}

        <section aria-labelledby="mine-h">
          <SectionTitle id="mine-h">{t('campaigns.mine')}</SectionTitle>
          {mine === null && <p className="rv-page-sub">{t('common.loading')}</p>}
          {mine && mine.length === 0 && (
            <Card><EmptyState icon="auto_stories" title={t('campaigns.empty.title')} description={t('campaigns.empty.desc')}
              actions={canCreate && <Btn variant="primary" onClick={() => setWizard(true)}>{t('campaigns.createBtn')}</Btn>} /></Card>
          )}
          <div className="rv-camp-list">
            {mine?.map(c => <CampaignCard key={c.id} campaign={c} onEnter={goTable} />)}
          </div>
        </section>

        {open.length > 0 && (
          <section aria-labelledby="open-h">
            <SectionTitle id="open-h">{t('campaigns.open')}</SectionTitle>
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

      {wizard && <CreateCampaignWizard onClose={() => { setWizard(false); void load(); }} onCreate={async input => { const sys = await systemRegistry.load(input.systemId); return repo.create({ ...input, sharedResources: initialSharedResources(sys) }); }} onOpenTable={goTable} />}
    </div>
  );
}
