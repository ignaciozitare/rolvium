import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { usePermissions } from '@/shared/permissions/usePermissions';
import { MODULES } from '@/shared/modules/registry';
import { UserMenu } from '@/shared/ui/UserMenu';
import { useTheme } from '@/shared/hooks/useTheme';
import { TopBar, type TopBarLink } from '@rolvium/ui';
import './RolviumApp.css';

/** Authenticated shell: sidebar (modules the user can see) + topbar + content. */
export function RolviumApp({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const { canSee, canOpenAdmin } = usePermissions();
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const nav = MODULES.filter(m => m.core || canSee(m.id));
  const links: TopBarLink[] = [
    ...nav.map(m => ({ key: m.id, label: t(m.labelKey), active: location.pathname.startsWith(m.path), render: (cls: string, ch: ReactNode) => <NavLink key={m.id} to={m.path} className={cls}>{ch}</NavLink> })),
    ...(canOpenAdmin ? [{ key: 'admin', label: t('nav.admin'), active: location.pathname.startsWith('/admin'), render: (cls: string, ch: ReactNode) => <NavLink key="admin" to="/admin" className={cls}>{ch}</NavLink> }] : []),
  ];

  return (
    <div className="rv-shell rv-shell-top" data-theme={theme}>
      <TopBar
        brand={<NavLink to="/campaigns" className="rv-brand" aria-label={t('app.name')}><img src="/brand/mark.svg" alt="" width={28} height={28} />{t('app.name')}</NavLink>}
        links={links}
        right={<>
          <button type="button" className="rv-icon-btn" onClick={toggle}
            aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')} title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <UserMenu />
        </>} />
      <main className="rv-content-top">{children}</main>
    </div>
  );
}
