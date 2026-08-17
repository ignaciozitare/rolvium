import { useTranslation } from '@rolvium/i18n';
import { Btn, Badge, UserAvatar } from '@rolvium/ui';
import type { Campaign } from '../domain/entities/Campaign';
import { freeSeats, isFull } from '../domain/useCases/campaignRules';
import { SYSTEMS } from '@/systems/registry';

interface Props {
  campaign: Campaign;
  onEnter?: (c: Campaign) => void;
  onRequestJoin?: (c: Campaign) => void;
}

/** Card as designed in rolvium.pen `Card/Campaign` (mine vs open variants). */
export function CampaignCard({ campaign: c, onEnter, onRequestJoin }: Props): JSX.Element {
  const { t } = useTranslation();
  const sys = SYSTEMS.find(s => s.id === c.systemId);
  const installed = !!sys?.installed;
  const mine = !!c.myRole;
  const dm = c.myRole === 'dm';
  return (
    <article className="rv-camp-card" style={{ opacity: installed ? 1 : 0.55 }} aria-label={c.name}>
      <div className="rv-camp-body">
        <div className="rv-camp-head">
          <h3 className="rv-camp-title">{c.name}</h3>
          <Badge color="accent">{sys ? t(sys.nameKey) : c.systemId}</Badge>
          {!installed && <Badge color="amber">{t('campaigns.systemNotInstalled')}</Badge>}
          {installed && dm && <Badge color="purple">{t('campaigns.youDirect')}</Badge>}
          {installed && !dm && mine && <Badge color="green">{t('campaigns.active')}</Badge>}
          {installed && !mine && <Badge color="green">{t('campaigns.freeSeats', { n: String(freeSeats(c)) })}</Badge>}
        </div>
        {c.description && <p className="rv-camp-desc">{c.description}</p>}
        <div className="rv-camp-meta">
          <UserAvatar user={{ name: c.dmName, avatarUrl: null }} size={22} />
          <span>{dm ? t('campaigns.metaYouDirect') : t('campaigns.metaDm', { name: c.dmName })}  ·  {t('campaigns.metaPlayers', { n: String(c.playersCount), seats: String(c.seats) })}</span>
        </div>
      </div>
      <div className="rv-camp-side">
        {mine && (
          <Btn variant="primary" onClick={() => onEnter?.(c)} disabled={!installed}>
            {dm ? t('campaigns.openTable') : t('campaigns.enterTable')}
          </Btn>
        )}
        {!mine && (
          <Btn variant="ghost" onClick={() => onRequestJoin?.(c)} disabled={!installed || isFull(c)}>
            {installed ? t('campaigns.requestJoin') : t('campaigns.comingSoon')}
          </Btn>
        )}
      </div>
    </article>
  );
}
