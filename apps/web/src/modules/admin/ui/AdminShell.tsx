import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import type { AdminPermissionKey } from '@rolvium/shared-types';
import { useAuth } from '@/shared/hooks/useAuth';
import { usePermissions } from '@/shared/permissions/usePermissions';
import { adminDeps as defaultDeps, type AdminDeps } from '../container';
import { AdminSettings } from './AdminSettings';
import { AdminUsers } from './AdminUsers';
import { AdminRoles } from './AdminRoles';

type Section = 'settings' | 'users' | 'roles';
const NAV: { id: Section; icon: string; labelKey: string; perm: AdminPermissionKey }[] = [
  { id: 'settings', icon: 'settings',             labelKey: 'admin.settings', perm: 'manage_settings' },
  { id: 'users',    icon: 'group',                labelKey: 'admin.users',    perm: 'manage_users' },
  { id: 'roles',    icon: 'admin_panel_settings', labelKey: 'admin.roles',    perm: 'manage_roles' },
];

/**
 * Admin area. Section visibility = permission. `?mod=` keeps the section in the
 * URL so deep links work. Users with no admin permission are sent home.
 */
export function AdminShell({ deps = defaultDeps }: { deps?: AdminDeps }): JSX.Element | null {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const { can, canOpenAdmin } = usePermissions();
  const [search, setSearch] = useSearchParams();

  if (isLoading) return null;
  if (!user || !canOpenAdmin) return <Navigate to="/home" replace />;

  const visible = NAV.filter(n => can(n.perm));
  const requested = search.get('mod') as Section | null;
  const mod: Section = visible.some(n => n.id === requested) ? (requested as Section) : (visible[0]?.id ?? 'settings');
  const setMod = (next: Section) => { const sp = new URLSearchParams(search); sp.set('mod', next); setSearch(sp); };

  return (
    <div className="rv-admin">
      <nav className="rv-admin-nav" aria-label={t('admin.title')}>
        <div className="rv-admin-nav-t">{t('admin.sidebar')}</div>
        {visible.map(item => (
          <button key={item.id} type="button" className={`rv-nav-btn ${mod === item.id ? 'active' : ''}`} onClick={() => setMod(item.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
      <div className="rv-admin-content">
        {mod === 'settings' && can('manage_settings') && <AdminSettings />}
        {mod === 'users' && can('manage_users') && <AdminUsers userRepo={deps.userRepo} roleRepo={deps.roleRepo} userAdmin={deps.userAdmin} currentUserId={user.id} />}
        {mod === 'roles' && can('manage_roles') && <AdminRoles roleRepo={deps.roleRepo} />}
      </div>
    </div>
  );
}
