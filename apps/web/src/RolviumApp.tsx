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
    <div className="rv-shell" data-theme={theme}>
      <aside className="rv-side">
        <div className="rv-brand"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>swords</span>{t('app.name')}</div>
        {nav.map(m => (
          <NavLink key={m.id} to={m.path} className={({ isActive }) => `rv-nav-btn ${isActive ? 'active' : ''}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{m.icon}</span>{t(m.labelKey)}
          </NavLink>
        ))}
        <div className="rv-side-foot">
          {canOpenAdmin && (
            <NavLink to="/admin" className={`rv-nav-btn ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>admin_panel_settings</span>{t('nav.admin')}
            </NavLink>
          )}
        </div>
      </aside>
      <div className="rv-main">
        <header className="rv-topbar">
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" className="rv-icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')} title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <UserMenu />
          </div>
        </header>
        <main className="rv-content">{children}</main>
      </div>
    </div>
  );
}
