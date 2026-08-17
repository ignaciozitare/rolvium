import { useState, type FormEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card } from '@rolvium/ui';
import type { JoinError } from '../domain/entities/Campaign';
import { isValidInviteCode, normalizeInviteCode } from '../domain/useCases/campaignRules';

interface Props { onJoin: (code: string) => Promise<{ campaignId: string } | { error: JoinError }>; onJoined: (campaignId: string) => void; }

export function JoinByCodePanel({ onJoin, onJoined }: Props): JSX.Element {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidInviteCode(code)) { setError(t('campaigns.errors.invalidCode')); return; }
    setBusy(true); setError(null);
    const r = await onJoin(code);
    setBusy(false);
    if ('error' in r) setError(t(`campaigns.errors.${r.error === 'unknown' ? 'joinFailed' : r.error === 'not_authenticated' ? 'joinFailed' : r.error === 'campaign_full' ? 'campaignFull' : 'invalidCode'}`));
    else onJoined(r.campaignId);
  };

  return (
    <Card>
      <h3 className="rv-aside-title">{t('campaigns.joinTitle')}</h3>
      <p className="rv-aside-sub">{t('campaigns.joinSub')}</p>
      <form onSubmit={submit} className="rv-join-row" aria-label={t('campaigns.joinTitle')}>
        <div style={{ flex: 1 }}>
          <label className="rv-label" htmlFor="invite-code">{t('campaigns.code')}</label>
          <input id="invite-code" className={`rv-inp rv-inp-code ${error ? 'err' : ''}`} value={code} placeholder="LUNA-4F7K"
            onChange={e => setCode(normalizeInviteCode(e.target.value))} maxLength={9} autoComplete="off" />
        </div>
        <Btn type="submit" variant="primary" loading={busy} disabled={busy}>{t('campaigns.join')}</Btn>
      </form>
      {error && <div className="rv-err" role="alert">{error}</div>}
    </Card>
  );
}
