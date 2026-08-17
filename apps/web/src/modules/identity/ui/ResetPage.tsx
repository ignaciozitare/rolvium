import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Field } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { AuthShell } from '@/shared/ui/AuthShell';
import { identityDeps, type IdentityDeps } from '../container';
import { validatePasswordPair } from '../domain/useCases/identityRules';

/**
 * rolvium.pen `Auth/Restablecer contraseña`. The recovery link lands here with a
 * recovery session (Supabase parses the URL); without one we send the user back to /forgot.
 */
export function ResetPage({ deps = identityDeps }: { deps?: IdentityDeps }): JSX.Element {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validatePasswordPair(pw, pw2);
    if (v) { setError(t(`identity.account.password.errors.${v}`)); return; }
    setBusy(true); setError(null);
    const r = await deps.identity.updatePassword(pw);
    setBusy(false);
    if (r.error) { setError(t(`identity.account.password.errors.${r.error}`)); return; }
    navigate('/campaigns', { replace: true });
  };

  if (isLoading) return <div style={{ background: 'var(--bg)', minHeight: '100vh' }} />;

  return (
    <AuthShell>
      {!user ? (
        <div className="rv-login-card" role="alert">
          <h2 className="rv-login-title">{t('identity.reset.title')}</h2>
          <p className="rv-login-sub">{t('identity.reset.noSession')}</p>
          <p className="rv-login-signup">{t('identity.reset.linkProblem')} <Link to="/forgot" className="rv-link">{t('identity.reset.requestAnother')}</Link></p>
        </div>
      ) : (
        <form className="rv-login-card" noValidate onSubmit={submit} aria-label={t('identity.reset.title')}>
          <h2 className="rv-login-title">{t('identity.reset.title')}</h2>
          <p className="rv-login-sub">{t('identity.reset.subtitle')}</p>
          <Field id="password" label={t('identity.reset.password')} type="password" autoComplete="new-password" required minLength={8} placeholder={t('identity.signup.passwordHint')} value={pw} onChange={e => setPw(e.target.value)} error={error ? ' ' : null} />
          <Field id="password2" label={t('identity.reset.repeat')} type="password" autoComplete="new-password" required placeholder={t('identity.reset.repeatHint')} value={pw2} onChange={e => setPw2(e.target.value)} error={error ? ' ' : null} />
          {error && <div className="rv-err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy}>{busy ? t('identity.reset.saving') : t('identity.reset.submit')}</Btn>
          <p className="rv-login-signup">{t('identity.reset.linkProblem')} <Link to="/forgot" className="rv-link">{t('identity.reset.requestAnother')}</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
