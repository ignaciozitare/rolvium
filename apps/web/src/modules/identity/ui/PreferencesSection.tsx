import { AVAILABLE_LOCALES, useTranslation, type Locale } from '@rolvium/i18n';
import type { ThemePref } from '@rolvium/shared-types';
import { Card } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTheme } from '@/shared/hooks/useTheme';
import type { IdentityDeps } from '../container';

const THEMES: { id: ThemePref; icon: string }[] = [{ id: 'dark', icon: 'dark_mode' }, { id: 'light', icon: 'light_mode' }, { id: 'system', icon: 'contrast' }];

/** rolvium.pen `Cuenta/Perfil › Idioma y tema`: applied instantly and saved to the profile. */
export function PreferencesSection({ deps }: { deps: IdentityDeps }): JSX.Element | null {
  const { t, locale, setLocale } = useTranslation();
  const { pref, setPref } = useTheme();
  const { user, refresh } = useAuth();
  if (!user) return null;

  const pickLocale = async (l: Locale) => { setLocale(l); await deps.identity.updateProfile(user.id, { locale: l }); await refresh(); };
  const pickTheme = async (p: ThemePref) => { setPref(p); await deps.identity.updateProfile(user.id, { themePref: p }); await refresh(); };

  return (
    <Card padding={18}>
      <div className="rv-account-card">
        <h3 className="rv-aside-title" style={{ margin: 0 }}>{t('identity.account.prefs.title')}</h3>
        <div className="rv-account-prefs">
          <div className="rv-field" style={{ margin: 0 }}>
            <span className="rv-label">{t('identity.account.prefs.language')}</span>
            <div className="rv-seg" role="radiogroup" aria-label={t('identity.account.prefs.language')}>
              {AVAILABLE_LOCALES.map(l => (
                <button key={l.id} type="button" role="radio" aria-checked={locale === l.id} className={`rv-seg-btn ${locale === l.id ? 'active' : ''}`} onClick={() => void pickLocale(l.id)}>{l.label}</button>
              ))}
            </div>
          </div>
          <div className="rv-field" style={{ margin: 0 }}>
            <span className="rv-label">{t('identity.account.prefs.theme')}</span>
            <div className="rv-seg" role="radiogroup" aria-label={t('identity.account.prefs.theme')}>
              {THEMES.map(th => (
                <button key={th.id} type="button" role="radio" aria-checked={pref === th.id} className={`rv-seg-btn ${pref === th.id ? 'active' : ''}`} onClick={() => void pickTheme(th.id)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)', verticalAlign: 'middle', marginRight: 6 }}>{th.icon}</span>{t(`identity.account.prefs.${th.id}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <span className="rv-hint" style={{ margin: 0 }}>{t('identity.account.prefs.note')}</span>
      </div>
    </Card>
  );
}
