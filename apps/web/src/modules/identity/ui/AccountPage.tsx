import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { PageHeader } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { identityDeps, type IdentityDeps } from '../container';
import { ProfileSection } from './ProfileSection';
import { PasswordSection } from './PasswordSection';
import { DevicesSection } from './DevicesSection';
import { PreferencesSection } from './PreferencesSection';

type SectionId = 'profile' | 'password' | 'devices' | 'prefs';
const NAV: { id: SectionId; icon: string }[] = [
  { id: 'profile', icon: 'person' }, { id: 'password', icon: 'lock' }, { id: 'devices', icon: 'devices' }, { id: 'prefs', icon: 'translate' },
];

/** rolvium.pen `Cuenta/Perfil`: left nav + stacked cards (Perfil · Contraseña y acceso · Dispositivos · Idioma y tema). */
export function AccountPage({ deps = identityDeps }: { deps?: IdentityDeps }): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [active, setActive] = useState<SectionId>('profile');
  if (!user) return null;

  const go = (id: SectionId) => {
    setActive(id);
    document.getElementById(`account-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="rv-account">
      <nav className="rv-account-nav" aria-label={t('identity.account.title')}>
        <PageHeader title={t('identity.account.title')} />
        {NAV.map(n => (
          <button key={n.id} type="button" className={`rv-nav-btn ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={active === n.id ? 'true' : undefined}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 'var(--icon-md)' }}>{n.icon}</span>{t(`identity.account.nav.${n.id}`)}
          </button>
        ))}
        <button type="button" className="rv-nav-btn rv-nav-btn-soon" disabled>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 'var(--icon-md)' }}>notifications</span>{t('identity.account.nav.notifications')}
          <span className="rv-chip" style={{ marginLeft: 'auto' }}>{t('identity.account.soon')}</span>
        </button>
      </nav>
      <div className="rv-account-main">
        <section id="account-profile"><ProfileSection deps={deps} /></section>
        <section id="account-password"><PasswordSection deps={deps} /></section>
        <section id="account-devices"><DevicesSection deps={deps} /></section>
        <section id="account-prefs"><PreferencesSection deps={deps} /></section>
      </div>
    </div>
  );
}
