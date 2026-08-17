import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Badge } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS } from '@/systems/registry';

/** rolvium.pen `Auth/Login`: hero (brand, claim, features, systems) + login card (invite-code shortcut, sign-up). */
export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
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

  const features: [string, string][] = [['groups', t('auth.feat.campaigns')], ['casino', t('auth.feat.dice')], ['map', t('auth.feat.maps')]];

  return (
    <div className="rv-login">
      <section className="rv-login-hero" aria-hidden="true">
        <div className="rv-login-brand"><img src="/brand/mark.svg" alt="" width={40} height={40} /><span>{t('app.name')}</span></div>
        <div className="rv-login-hero-body">
          <h1>{t('auth.headline')}</h1>
          <p>{t('auth.tagline')}</p>
          <ul className="rv-login-feats">
            {features.map(([ic, txt]) => <li key={ic}><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--ac)' }}>{ic}</span>{txt}</li>)}
          </ul>
        </div>
        <div className="rv-login-systems">
          <span className="rv-label" style={{ margin: 0 }}>{t('auth.systems')}</span>
          {SYSTEMS.map(s => <Badge key={s.id} color={s.installed ? 'accent' : 'gray'}>{t(s.nameKey)}{!s.installed && ` · ${t('campaigns.comingSoon')}`}</Badge>)}
        </div>
      </section>

      <section className="rv-login-form">
        <form className="rv-login-card" onSubmit={submit} aria-label={t('auth.title')}>
          <h2 className="rv-login-title">{t('auth.title')}</h2>
          <p className="rv-login-sub">{t('auth.subtitle')}</p>

          <div className="rv-field">
            <label className="rv-label" htmlFor="email">{t('auth.email')}</label>
            <input id="email" className={`rv-inp ${error ? 'err' : ''}`} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="rv-field">
            <label className="rv-label" htmlFor="password">{t('auth.password')}</label>
            <div className="rv-inp-wrap">
              <input id="password" className={`rv-inp ${error ? 'err' : ''}`} type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="rv-inp-icon" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{showPw ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="rv-login-opts">
            <label className="rv-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />{t('auth.remember')}</label>
            <Link to="/forgot" className="rv-link">{t('auth.forgot')}</Link>
          </div>
          {error && <div className="rv-err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Btn>

          <div className="rv-login-or"><span>{t('auth.or')}</span></div>

          <Link to="/join" className="rv-login-invite">
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--ac)' }}>key</span>
            <span className="rv-login-invite-text"><strong>{t('auth.inviteTitle')}</strong><small>{t('auth.inviteSub')}</small></span>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)', color: 'var(--tx2)' }}>arrow_forward</span>
          </Link>

          <p className="rv-login-signup">{t('auth.noAccount')} <Link to="/signup" className="rv-link">{t('auth.createAccount')}</Link></p>
        </form>
      </section>
    </div>
  );
}
