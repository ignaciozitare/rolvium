import { useState, type FormEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card, Field, ImagePicker, StatusChip, UserAvatar } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import type { IdentityDeps } from '../container';
import { normalizeAlias } from '../domain/useCases/identityRules';

const ROLE_TONE: Record<string, 'purple' | 'amber' | 'green' | 'gray'> = { admin: 'amber', game_master: 'purple', player: 'green' };

/** rolvium.pen `Cuenta/Perfil › Perfil`: avatar (upload/crop) + name, alias, e-mail (read-only), platform role. */
export function ProfileSection({ deps }: { deps: IdentityDeps }): JSX.Element | null {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [alias, setAlias] = useState(user?.alias ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picking, setPicking] = useState(false);
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await deps.identity.updateProfile(user.id, { name: name.trim(), alias: normalizeAlias(alias) });
      await refresh();
      setMsg({ ok: true, text: t('identity.account.profile.saved') });
    } catch { setMsg({ ok: false, text: t('identity.account.profile.error') }); }
    setBusy(false);
  };

  const upload = async (blob: Blob) => { await deps.identity.uploadAvatar(user.id, blob); await refresh(); setPicking(false); };
  const remove = async () => { await deps.identity.removeAvatar(user.id); await refresh(); setPicking(false); };
  const roleKey = (['admin', 'game_master', 'player'] as const).find(r => r === user.role);

  return (
    <Card padding={18}>
      <form onSubmit={save} aria-label={t('identity.account.profile.title')} className="rv-account-card">
        <div><h3 className="rv-aside-title">{t('identity.account.profile.title')}</h3><p className="rv-aside-sub" style={{ margin: 0 }}>{t('identity.account.profile.subtitle')}</p></div>
        <div className="rv-account-row">
          <div className="rv-account-avatar">
            <UserAvatar user={{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }} size={96} imageWidth={256} />
            <Btn type="button" variant="ghost" size="sm" onClick={() => setPicking(v => !v)} aria-expanded={picking}>{t('identity.account.profile.upload')}</Btn>
            <span className="rv-hint" style={{ margin: 0 }}>{t('identity.account.profile.avatarHint')}</span>
          </div>
          <div className="rv-account-fields">
            <div className="rv-account-grid2">
              <Field id="acc-name" label={t('identity.account.profile.name')} required maxLength={80} value={name} onChange={e => setName(e.target.value)} />
              <Field id="acc-alias" label={t('identity.account.profile.alias')} maxLength={40} value={alias} onChange={e => setAlias(e.target.value)} hint={t('identity.account.profile.aliasHint')} placeholder={user.name} />
            </div>
            <Field id="acc-email" label={t('identity.account.profile.email')} type="email" value={user.email} readOnly disabled hint={t('identity.account.profile.emailHint')} />
            <div className="rv-account-role">
              <span className="rv-label" style={{ margin: 0 }}>{t('identity.account.profile.role')}</span>
              <StatusChip tone={ROLE_TONE[user.role] ?? 'gray'}>{user.role.replace('_', ' ').toUpperCase()}</StatusChip>
              {roleKey && <span className="rv-hint" style={{ margin: 0 }}>{t(`identity.account.profile.roleHint.${roleKey}`)}</span>}
            </div>
          </div>
        </div>
        {picking && (
          <ImagePicker shape="circle" currentUrl={user.avatarUrl && !user.avatarUrl.startsWith('preset:') ? user.avatarUrl : null} onUpload={upload} onRemove={user.avatarUrl ? remove : undefined}
            maxSizeKB={2048} outputDimension={512} acceptMime={['image/png', 'image/jpeg', 'image/webp']}
            labels={{ label: t('identity.account.profile.avatarLabel'), helpText: t('identity.account.profile.avatarHint'), dropCta: t('identity.account.profile.avatarDrop'), cropTitle: t('identity.account.profile.avatarCrop'), zoom: t('identity.account.profile.avatarZoom'), save: t('identity.account.profile.avatarSave'), back: t('identity.account.profile.avatarBack'), remove: t('identity.account.profile.avatarRemove'), loading: t('identity.account.profile.avatarLoading'), errorMime: t('identity.account.profile.avatarErrMime'), errorSize: t('identity.account.profile.avatarErrSize'), errorRead: t('identity.account.profile.avatarErrRead'), errorUpload: t('identity.account.profile.avatarErrUpload') }} />
        )}
        <div className="rv-account-acts">
          <Btn type="submit" variant="primary" size="sm" loading={busy} disabled={busy || !name.trim()}>{busy ? t('identity.account.profile.saving') : t('identity.account.profile.save')}</Btn>
          {msg && <span role="status" className={msg.ok ? 'rv-hint' : 'rv-err'} style={{ margin: 0, color: msg.ok ? 'var(--green)' : undefined }}>{msg.text}</span>}
        </div>
      </form>
    </Card>
  );
}
