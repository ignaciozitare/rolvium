import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AVAILABLE_LOCALES, useTranslation, type Locale } from '@rolvium/i18n';
import { Btn, Field, SystemChip } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { AuthShell } from '@/shared/ui/AuthShell';
import { SYSTEMS } from '@/systems/registry';
import { isValidInviteCode, normalizeInviteCode } from '@/modules/campaigns/domain/useCases/campaignRules';
import { identityDeps, type IdentityDeps } from '../container';
import type { InvitePreview } from '../domain/entities/Identity';
import { validateSignUp } from '../domain/useCases/identityRules';

type PreviewState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; preview: InvitePreview } | { kind: 'invalid' };

interface Props { deps?: IdentityDeps }

/**
 * rolvium.pen `Auth/Registro` (open sign-up) and `Auth/Registro con código`
 * (`/join/:code`: invite card + sign-up, or "join" when already signed in).
 */
export function SignupPage({ deps = identityDeps }: Props): JSX.Element {
  const { t, locale, setLocale } = useTranslation();
  const { user, login, refresh } = useAuth();
  const navigate = useNavigate();
  const { code: routeCode } = useParams<{ code?: string }>();
  const { pathname } = useLocation();
  const joinMode = routeCode !== undefined || pathname.startsWith('/join');

  const [code, setCode] = useState(() => normalizeInviteCode(routeCode ?? ''));
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<'name' | 'email' | 'password' | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const checkCode = async (c: string) => {
    if (!isValidInviteCode(c)) { setPreview({ kind: 'invalid' }); return; }
    setPreview({ kind: 'loading' });
    try {
      const p = await deps.invites.preview(c);
      setPreview(p ? { kind: 'ok', preview: p } : { kind: 'invalid' });
    } catch { setPreview({ kind: 'invalid' }); }
  };

  useEffect(() => { if (routeCode) void checkCode(normalizeInviteCode(routeCode)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [routeCode]);

  const joinAndGo = async (): Promise<boolean> => {
    const r = await deps.joinByCode(code);
    if ('error' in r) {
      setError(r.error === 'campaign_full' ? t('identity.invite.full') : r.error === 'invalid_code' ? t('identity.invite.invalid') : t('identity.invite.joinFailed'));
      return false;
    }
    navigate(`/table/${r.campaignId}`, { replace: true });
    return true;
  };

  const submitSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const fe = validateSignUp({ name, email, password });
    setFieldErr(fe);
    if (fe) { setError(t(`identity.signup.errors.${fe}`)); return; }
    setBusy(true);
    const redirectTo = joinMode && preview.kind === 'ok' ? `${window.location.origin}/join/${preview.preview.code}` : `${window.location.origin}/campaigns`;
    const r = await deps.identity.signUp({ email, password, name, locale, redirectTo });
    if ('error' in r) { setBusy(false); setError(t(`identity.signup.errors.${r.error}`)); return; }
    if (r.status === 'confirm_email') { setBusy(false); setConfirmEmail(true); return; }
    await refresh();
    if (joinMode && preview.kind === 'ok') { if (!(await joinAndGo())) setBusy(false); return; }
    navigate('/campaigns', { replace: true });
  };

  const submitLoginJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await login(email.trim(), password);
    if (!r.user) { setBusy(false); setError(r.error === 'account_disabled' ? t('auth.accountDisabled') : t('auth.invalidCredentials')); return; }
    if (!(await joinAndGo())) setBusy(false);
  };

  const submitJoinOnly = async () => {
    setError(null); setBusy(true);
    if (!(await joinAndGo())) setBusy(false);
  };

  const pwToggle = (
    <button type="button" className="rv-inp-icon" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}>
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{showPw ? 'visibility_off' : 'visibility'}</span>
    </button>
  );

  const inviteCard = joinMode && (
    <div className="rv-invite-card" data-state={preview.kind}>
      {preview.kind === 'ok' ? (
        <>
          <div className="rv-invite-row1">
            <div><span className="rv-label" style={{ marginBottom: 2 }}>{t('identity.invite.code')}</span><span className="rv-invite-code">{preview.preview.code}</span></div>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--green)' }}>check_circle</span>
          </div>
          <div className="rv-invite-camp">
            <strong>{preview.preview.campaignName}</strong>
            <div className="rv-invite-meta">
              <SystemChip>{t(SYSTEMS.find(s => s.id === preview.preview.systemId)?.nameKey ?? 'systems.plenilunio.name')}</SystemChip>
              <span>{t('identity.invite.dm', { name: preview.preview.dmName })} · {preview.preview.seatsFree === 1 ? t('identity.invite.seatsOne') : t('identity.invite.seats', { n: String(preview.preview.seatsFree) })}</span>
            </div>
          </div>
        </>
      ) : preview.kind === 'invalid' ? (
        <div className="rv-invite-row1">
          <div><strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx)' }}>{t('identity.invite.invalid')}</strong><p className="rv-hint" style={{ margin: '4px 0 0' }}>{t('identity.invite.invalidSub')}</p></div>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)', color: 'var(--red)' }}>error</span>
        </div>
      ) : (
        <form className="rv-invite-enter" onSubmit={e => { e.preventDefault(); void checkCode(code); }} aria-label={t('identity.invite.enterCode')}>
          <div style={{ flex: 1 }}>
            <label className="rv-label" htmlFor="invite-code">{t('identity.invite.code')}</label>
            <input id="invite-code" className="rv-inp rv-inp-code" value={code} placeholder={t('identity.invite.codePlaceholder')} maxLength={9} autoComplete="off"
              onChange={e => setCode(normalizeInviteCode(e.target.value))} />
          </div>
          <Btn type="submit" variant="ghost" loading={preview.kind === 'loading'} disabled={preview.kind === 'loading'}>{preview.kind === 'loading' ? t('identity.invite.checking') : t('identity.invite.check')}</Btn>
        </form>
      )}
      {preview.kind === 'invalid' && (
        <button type="button" className="rv-link" style={{ background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', padding: 0 }} onClick={() => { setPreview({ kind: 'idle' }); setCode(''); }}>{t('identity.invite.enterCode')}</button>
      )}
    </div>
  );

  // ── Signed-in visitor with a code: just join ────────────────────────────────
  if (user && joinMode) {
    return (
      <AuthShell>
        <div className="rv-login-card">
          <h2 className="rv-login-title">{t('identity.invite.joinTitle')}</h2>
          <p className="rv-login-sub">{t('identity.invite.joinSub')}</p>
          {inviteCard}
          {error && <div className="rv-err" role="alert" style={{ margin: '12px 0' }}>{error}</div>}
          <Btn variant="primary" size="lg" full loading={busy} disabled={busy || preview.kind !== 'ok'} onClick={() => void submitJoinOnly()} style={{ marginTop: 16 }}>
            {busy ? t('identity.invite.joining') : t('identity.invite.join')}
          </Btn>
          <p className="rv-login-signup"><Link to="/campaigns" className="rv-link">{t('nav.main')}</Link></p>
        </div>
      </AuthShell>
    );
  }

  if (confirmEmail) {
    return (
      <AuthShell>
        <div className="rv-login-card" role="status">
          <h2 className="rv-login-title">{t('identity.signup.confirmEmailTitle')}</h2>
          <p className="rv-login-sub">{t('identity.signup.confirmEmail')}</p>
          <p className="rv-login-signup"><Link to="/login" className="rv-link">{t('identity.signup.signIn')}</Link></p>
        </div>
      </AuthShell>
    );
  }

  const canJoin = joinMode && preview.kind === 'ok';

  return (
    <AuthShell>
      {loginMode ? (
        <form className="rv-login-card" onSubmit={submitLoginJoin} aria-label={t('identity.signup.signInWithCode')}>
          <h2 className="rv-login-title">{t('identity.signup.signInWithCode')}</h2>
          <p className="rv-login-sub">{t('identity.invite.joinSub')}</p>
          {inviteCard}
          <div style={{ height: 16 }} />
          <Field id="email" label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Field id="password" label={t('auth.password')} type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} trailing={pwToggle} />
          {error && <div className="rv-err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy || !canJoin}>{busy ? t('identity.invite.joining') : t('identity.invite.signInJoin')}</Btn>
          <p className="rv-login-signup">{t('auth.noAccount')} <button type="button" className="rv-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => { setLoginMode(false); setError(null); }}>{t('auth.createAccount')}</button></p>
        </form>
      ) : (
        <form className="rv-login-card" noValidate onSubmit={submitSignUp} aria-label={t('identity.signup.title')}>
          <h2 className="rv-login-title">{t('identity.signup.title')}</h2>
          <p className="rv-login-sub">{canJoin ? t('identity.signup.subtitleInvite') : t('identity.signup.subtitle')}</p>
          {inviteCard}
          {joinMode && <div style={{ height: 16 }} />}
          <Field id="name" label={t('identity.signup.name')} autoComplete="nickname" required maxLength={40} value={name} onChange={e => setName(e.target.value)} error={fieldErr === 'name' ? ' ' : null} />
          <Field id="email" label={t('identity.signup.email')} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} error={fieldErr === 'email' ? ' ' : null} />
          <Field id="password" label={t('identity.signup.password')} type={showPw ? 'text' : 'password'} autoComplete="new-password" required minLength={8} placeholder={t('identity.signup.passwordHint')}
            value={password} onChange={e => setPassword(e.target.value)} error={fieldErr === 'password' ? ' ' : null} trailing={pwToggle} />
          <div className="rv-field">
            <span className="rv-label">{t('identity.signup.language')}</span>
            <div className="rv-seg" role="radiogroup" aria-label={t('identity.signup.language')}>
              {AVAILABLE_LOCALES.map(l => (
                <button key={l.id} type="button" role="radio" aria-checked={locale === l.id} className={`rv-seg-btn ${locale === l.id ? 'active' : ''}`} onClick={() => setLocale(l.id as Locale)}>{l.label}</button>
              ))}
            </div>
          </div>
          {error && <div className="rv-err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <Btn type="submit" variant="primary" size="lg" full loading={busy} disabled={busy}>
            {canJoin ? t('identity.signup.submitInvite') : t('identity.signup.submit')}
          </Btn>
          <p className="rv-login-signup">
            {t('identity.signup.haveAccount')}{' '}
            {canJoin
              ? <button type="button" className="rv-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => { setLoginMode(true); setError(null); }}>{t('identity.signup.signInWithCode')}</button>
              : <Link to="/login" className="rv-link">{t('identity.signup.signIn')}</Link>}
          </p>
        </form>
      )}
    </AuthShell>
  );
}
