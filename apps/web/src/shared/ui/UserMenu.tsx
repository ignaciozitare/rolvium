import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVAILABLE_LOCALES, useTranslation } from '@rolvium/i18n';
import { UserAvatar } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { usePermissions } from '@/shared/permissions/usePermissions';

export function UserMenu(): JSX.Element | null {
  const { t, locale, setLocale } = useTranslation();
  const { user, logout } = useAuth();
  const { canOpenAdmin } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;
  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--tx)', cursor: 'pointer', borderRadius: 'var(--r)', fontSize: 'var(--fs-sm)', textAlign: 'left' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={user.name} onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tx)', padding: 4, borderRadius: 'var(--r)' }}>
        <UserAvatar user={{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }} size={30} />
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{user.name}</span>
        <span className="rv-chip ac">{user.role}</span>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 220, background: 'var(--sf2)', borderRadius: 'var(--r2)', boxShadow: 'var(--shadow)', padding: 6, zIndex: 50 }}>
          <button type="button" role="menuitem" style={item} onClick={() => { setOpen(false); navigate('/account'); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>person</span>{t('nav.account')}
          </button>
          {canOpenAdmin && (
            <button type="button" role="menuitem" style={item} onClick={() => { setOpen(false); navigate('/admin'); }}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>admin_panel_settings</span>{t('nav.admin')}
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, padding: '6px 12px' }}>
            {AVAILABLE_LOCALES.map(l => (
              <button key={l.id} type="button" role="menuitem" onClick={() => setLocale(l.id)}
                className={`rv-chip ${locale === l.id ? 'ac' : ''}`} style={{ cursor: 'pointer', border: 'none' }}>{l.id.toUpperCase()}</button>
            ))}
          </div>
          <button type="button" role="menuitem" style={{ ...item, color: 'var(--red)' }} onClick={() => void logout()}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>logout</span>{t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
