import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card, StatusChip, useDialog } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import type { IdentityDeps } from '../container';
import type { DeviceSession } from '../domain/entities/Identity';
import { describeUserAgent, sortSessions } from '../domain/useCases/identityRules';

function useAgo(): (iso: string) => string {
  const { t } = useTranslation();
  return (iso: string) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return t('identity.account.devices.now');
    if (mins < 60) return t('identity.account.devices.ago.minutes', { n: String(mins) });
    const h = Math.round(mins / 60);
    if (h < 24) return t('identity.account.devices.ago.hours', { n: String(h) });
    return t('identity.account.devices.ago.days', { n: String(Math.round(h / 24)) });
  };
}

/** rolvium.pen `Cuenta/Perfil › Sesiones y dispositivos`: current session first, others closable. */
export function DevicesSection({ deps }: { deps: IdentityDeps }): JSX.Element {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const dialog = useDialog();
  const ago = useAgo();
  const [list, setList] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList(sortSessions(await deps.identity.listSessions())); setError(false); }
    catch { setError(true); setList([]); }
  }, [deps]);
  useEffect(() => { void load(); }, [load]);

  const close = async (s: DeviceSession) => {
    const { device, browser } = describeUserAgent(s.userAgent);
    const ok = await dialog.confirm(s.isCurrent ? t('identity.account.devices.closeThisConfirm') : t('identity.account.devices.closeConfirm', { device: `${device} · ${browser}` }), { danger: true, confirmLabel: t('identity.account.devices.close'), cancelLabel: t('common.cancel') });
    if (!ok) return;
    if (s.isCurrent) { await logout(); return; }
    setClosing(s.id);
    try { await deps.identity.revokeSession(s.id); await load(); } catch { setError(true); }
    setClosing(null);
  };

  return (
    <Card padding={18}>
      <div className="rv-account-card">
        <div><h3 className="rv-aside-title">{t('identity.account.devices.title')}</h3><p className="rv-aside-sub" style={{ margin: 0 }}>{t('identity.account.devices.subtitle')}</p></div>
        {error && <div className="rv-err" role="alert" style={{ margin: 0 }}>{t('identity.account.devices.error')}</div>}
        <ul className="rv-devices" aria-label={t('identity.account.devices.title')}>
          {(list ?? []).map(s => {
            const d = describeUserAgent(s.userAgent);
            return (
              <li key={s.id} className={`rv-device ${s.isCurrent ? 'current' : ''}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--tx2)' }}>{d.icon}</span>
                <span className="rv-device-text">
                  <strong>{d.device} · {d.browser}</strong>
                  <small>{s.isCurrent ? `${t('identity.account.devices.thisSession')} · ${ago(s.lastSeenAt)}` : ago(s.lastSeenAt)}{s.ip ? ` · ${s.ip}` : ''}</small>
                </span>
                {s.isCurrent
                  ? <StatusChip tone="green">{t('identity.account.devices.current').toUpperCase()}</StatusChip>
                  : <Btn type="button" variant="ghost" size="sm" loading={closing === s.id} disabled={closing === s.id} onClick={() => void close(s)}>{closing === s.id ? t('identity.account.devices.closing') : t('identity.account.devices.close')}</Btn>}
              </li>
            );
          })}
        </ul>
        {list && list.length <= 1 && !error && <span className="rv-hint" style={{ margin: 0 }}>{t('identity.account.devices.empty')}</span>}
      </div>
    </Card>
  );
}
