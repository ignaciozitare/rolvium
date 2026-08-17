import { useState, type FormEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card, Field } from '@rolvium/ui';
import type { IdentityDeps } from '../container';
import { validatePasswordPair } from '../domain/useCases/identityRules';

/** rolvium.pen `Cuenta/Perfil › Contraseña y acceso`. */
export function PasswordSection({ deps }: { deps: IdentityDeps }): JSX.Element {
  const { t } = useTranslation();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validatePasswordPair(pw, pw2);
    if (v) { setMsg({ ok: false, text: t(`identity.account.password.errors.${v}`) }); return; }
    setBusy(true); setMsg(null);
    const r = await deps.identity.updatePassword(pw);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: t(`identity.account.password.errors.${r.error}`) }); return; }
    setPw(''); setPw2('');
    setMsg({ ok: true, text: t('identity.account.password.done') });
  };

  return (
    <Card padding={18}>
      <form noValidate onSubmit={submit} aria-label={t('identity.account.password.title')} className="rv-account-card">
        <div><h3 className="rv-aside-title">{t('identity.account.password.title')}</h3><p className="rv-aside-sub" style={{ margin: 0 }}>{t('identity.account.password.subtitle')}</p></div>
        <div className="rv-account-pwrow">
          <Field id="pw-new" label={t('identity.account.password.new')} type="password" autoComplete="new-password" required minLength={8} placeholder={t('identity.account.password.newHint')} value={pw} onChange={e => setPw(e.target.value)} error={msg && !msg.ok ? ' ' : null} />
          <Field id="pw-repeat" label={t('identity.account.password.repeat')} type="password" autoComplete="new-password" required placeholder={t('identity.account.password.repeatHint')} value={pw2} onChange={e => setPw2(e.target.value)} error={msg && !msg.ok ? ' ' : null} />
          <Btn type="submit" variant="primary" size="sm" loading={busy} disabled={busy}>{busy ? t('identity.account.password.saving') : t('identity.account.password.submit')}</Btn>
        </div>
        {msg && <span role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'rv-hint' : 'rv-err'} style={{ margin: 0, color: msg.ok ? 'var(--green)' : undefined }}>{msg.text}</span>}
      </form>
    </Card>
  );
}
