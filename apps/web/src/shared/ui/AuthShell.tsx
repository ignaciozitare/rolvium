import type { ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { SystemChip } from '@rolvium/ui';
import { SYSTEMS } from '@/systems/registry';

/**
 * rolvium.pen `Auth/*`: the shared hero (brand, claim, features, systems) on the
 * left and a card on the right. Login, sign-up, join, forgot and reset all use it.
 */
export function AuthShell({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const features: [string, string][] = [['groups', t('auth.feat.campaigns')], ['casino', t('auth.feat.dice')], ['map', t('auth.feat.maps')]];
  return (
    <div className="rv-login">
      <section className="rv-login-hero" aria-hidden="true">
        <div className="rv-login-brand"><img src="/brand/mark.svg" alt="" width={40} height={40} /><span>{t('app.name')}</span></div>
        <div className="rv-login-hero-body">
          <h1>{t('auth.headline')}</h1>
          <p>{t('auth.tagline')}</p>
          <ul className="rv-login-feats">
            {features.map(([ic, txt]) => <li key={ic}><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--ac)' }}>{ic}</span>{txt}</li>)}
          </ul>
        </div>
        <div className="rv-login-systems">
          <span className="rv-label" style={{ margin: 0 }}>{t('auth.systems')}</span>
          {SYSTEMS.map(s => <SystemChip key={s.id} muted={!s.installed}>{t(s.nameKey)}{!s.installed && ` · ${t('campaigns.comingSoon')}`}</SystemChip>)}
        </div>
      </section>
      <section className="rv-login-form">{children}</section>
    </div>
  );
}
