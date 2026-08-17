import { useState, type FormEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.user) {
      setError(r.error === 'account_disabled' ? t('auth.accountDisabled') : r.error === 'invalid_credentials' ? t('auth.invalidCredentials') : t('common.error'));
    }
  };

  return (
    <div className="rv-login">
      <section className="rv-login-hero" aria-hidden="true">
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </section>
      <section className="rv-login-form">
        <form className="rv-login-card" onSubmit={submit} aria-label={t('auth.title')}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 'var(--fs-lg)', color: 'var(--tx)', marginBottom: 4 }}>{t('auth.title')}</h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)', marginBottom: 22 }}>{t('auth.subtitle')}</p>

          <div className="rv-field">
            <label className="rv-label" htmlFor="email">{t('auth.email')}</label>
            <input id="email" className={`rv-inp ${error ? 'err' : ''}`} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="rv-field">
            <label className="rv-label" htmlFor="password">{t('auth.password')}</label>
            <input id="password" className={`rv-inp ${error ? 'err' : ''}`} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <div className="rv-err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Btn>
        </form>
      </section>
    </div>
  );
}
