import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { usePermissions } from '@/shared/permissions/usePermissions';
import { MODULES } from '@/shared/modules/registry';
import { UserMenu } from '@/shared/ui/UserMenu';
import './RolviumApp.css';

type Theme = 'dark' | 'light';
const THEME_KEY = 'rolvium_theme';
const readTheme = (): Theme => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
const storeTheme = (t: Theme): void => { try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ } };

/** Authenticated shell: sidebar (modules the user can see) + topbar + content. */
export function RolviumApp({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const { canSee, canOpenAdmin } = usePermissions();
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storeTheme(theme);
  }, [theme]);

  const nav = MODULES.filter(m => m.core || canSee(m.id));

  return (
    <div className="rv-shell rv-shell-top" data-theme={theme}>
      <header className="rv-topnav">
        <div className="rv-topnav-left">
          <NavLink to="/campaigns" className="rv-brand" aria-label={t('app.name')}>
            <img src="/brand/mark.svg" alt="" width={28} height={28} />{t('app.name')}
          </NavLink>
          <nav className="rv-topnav-links" aria-label={t('nav.main')}>
            {nav.map(m => (
              <NavLink key={m.id} to={m.path} className={({ isActive }) => `rv-nav-btn ${isActive ? 'active' : ''}`}>{t(m.labelKey)}</NavLink>
            ))}
            {canOpenAdmin && (
              <NavLink to="/admin" className={`rv-nav-btn ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>{t('nav.admin')}</NavLink>
            )}
          </nav>
        </div>
        <div className="rv-topnav-right">
          <button type="button" className="rv-icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')} title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <UserMenu />
        </div>
      </header>
      <main className="rv-content-top">{children}</main>
    </div>
  );
}
