import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Field } from '@rolvium/ui';
import { AuthShell } from '@/shared/ui/AuthShell';
import { identityDeps, type IdentityDeps } from '../container';

/** rolvium.pen `Auth/Recuperar contraseña`. Same message whether or not the e-mail exists. */
export function ForgotPage({ deps = identityDeps }: { deps?: IdentityDeps }): JSX.Element {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await deps.identity.requestPasswordReset(email, `${window.location.origin}/reset`);
    setBusy(false); setSent(true);
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="rv-login-card" role="status">
          <h2 className="rv-login-title">{t('identity.forgot.sentTitle')}</h2>
          <p className="rv-login-sub">{t('identity.forgot.sent')}</p>
          <p className="rv-login-signup"><Link to="/login" className="rv-link">{t('identity.forgot.backToLogin')}</Link></p>
        </div>
      ) : (
        <form className="rv-login-card" onSubmit={submit} aria-label={t('identity.forgot.title')}>
          <h2 className="rv-login-title">{t('identity.forgot.title')}</h2>
          <p className="rv-login-sub">{t('identity.forgot.subtitle')}</p>
          <Field id="email" label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy}>{busy ? t('identity.forgot.sending') : t('identity.forgot.submit')}</Btn>
          <p className="rv-login-signup">{t('identity.forgot.remembered')} <Link to="/login" className="rv-link">{t('identity.forgot.backToLogin')}</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
