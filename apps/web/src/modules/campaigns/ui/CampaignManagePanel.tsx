import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Modal, StatusChip, UserAvatar, useDialog } from '@rolvium/ui';
import type { Campaign, CampaignMember, JoinRequest } from '../domain/entities/Campaign';
import type { CampaignsPort } from '../domain/ports/CampaignsPort';
import { fromDatetimeLocal, inviteUrl, toDatetimeLocal } from '../domain/useCases/campaignRules';
import { campaignsRepo } from '../container';

interface Props {
  campaign: Campaign;
  repo?: CampaignsPort;
  onClose: () => void;
  /** Called after any persisted change (regenerate, resolve, kick, update, archive) so the caller can reload. */
  onChanged?: () => void;
}

/**
 * DM management of a campaign (rolvium.pen Campañas/Home + Crear·Invitar code panel):
 * invite code + link, pending requests, players (expel), next session, progression, archive.
 */
export function CampaignManagePanel({ campaign, repo = campaignsRepo, onClose, onChanged }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const dialog = useDialog();
  const [code, setCode] = useState<string | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [nextSession, setNextSession] = useState(toDatetimeLocal(campaign.nextSessionAt));
  const [progression, setProgression] = useState(campaign.progressionEnabled);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, r, m] = await Promise.all([repo.getInviteCode(campaign.id), repo.listRequests(campaign.id), repo.listMembers(campaign.id)]);
      setCode(c); setRequests(r); setMembers(m); setError(null);
    } catch { setError(t('common.error')); }
  }, [repo, campaign.id, t]);
  useEffect(() => { void load(); }, [load]);

  const flash = (key: string) => { setNotice(t(key)); window.setTimeout(() => setNotice(null), 1800); };
  const run = async (key: string, fn: () => Promise<void>, doneKey = 'campaigns.manage.saved') => {
    setBusy(key); setError(null);
    try { await fn(); flash(doneKey); onChanged?.(); }
    catch { setError(t('common.error')); }
    finally { setBusy(null); }
  };

  const link = inviteUrl(window.location.origin, code);
  const players = members.filter(m => m.role === 'player');
  const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const copyLink = async () => { await navigator.clipboard?.writeText(link); flash('campaigns.manage.copied'); };
  const regenerate = async () => {
    if (!(await dialog.confirm(t('campaigns.manage.regenerateConfirm'), { danger: true, confirmLabel: t('campaigns.manage.regenerate'), cancelLabel: t('common.cancel') }))) return;
    await run('regen', async () => { setCode(await repo.regenerateInviteCode(campaign.id)); });
  };
  const resolve = (r: JoinRequest, accept: boolean) => run(`req-${r.id}`, async () => {
    await repo.resolveRequest(r.id, accept);
    setRequests(rs => rs.filter(x => x.id !== r.id));
    setMembers(await repo.listMembers(campaign.id));
  });
  const kick = async (m: CampaignMember) => {
    if (!(await dialog.confirm(t('campaigns.manage.kickConfirm', { name: m.name }), { danger: true, confirmLabel: t('campaigns.manage.kick'), cancelLabel: t('common.cancel') }))) return;
    await run(`kick-${m.userId}`, async () => { await repo.removeMember(campaign.id, m.userId); setMembers(ms => ms.filter(x => x.userId !== m.userId)); });
  };
  const saveSession = (value: string) => { setNextSession(value); void run('session', () => repo.update(campaign.id, { nextSessionAt: fromDatetimeLocal(value) })); };
  const toggleProgression = (on: boolean) => { setProgression(on); void run('progression', () => repo.update(campaign.id, { progressionEnabled: on })); };
  const archive = async () => {
    if (!(await dialog.confirm(t('campaigns.manage.archiveConfirm', { name: campaign.name }), { danger: true, confirmLabel: t('campaigns.manage.archive'), cancelLabel: t('common.cancel') }))) return;
    await run('archive', async () => { await repo.archive(campaign.id); onClose(); });
  };

  const showRequests = campaign.visibility === 'open' || requests.length > 0;

  return (
    <Modal title={t('campaigns.manage.title', { name: campaign.name })} onClose={onClose} width={760}>
      <div className="rv-manage" aria-live="polite">
        <p className="rv-wizard-sub">{t('campaigns.manage.subtitle')}</p>
        {error && <div className="rv-err" role="alert">{error}</div>}
        {notice && <StatusChip tone="green">{notice}</StatusChip>}

        <section aria-labelledby="mg-invite">
          <h4 id="mg-invite" className="rv-manage-h">{t('campaigns.manage.inviteTitle')}</h4>
          <p className="rv-wizard-sub">{t('campaigns.manage.inviteSub')}</p>
          <div className="rv-code-panel">
            <div><span className="rv-label">{t('campaigns.create.inviteCode')}</span><span className="rv-code" data-testid="invite-code">{code ?? '—'}</span></div>
            <div className="rv-code-link"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)', color: 'var(--tx3)' }}>link</span><span className="rv-code-url">{link}</span>
              <Btn variant="ghost" size="sm" onClick={() => void copyLink()} disabled={!code}>{t('campaigns.manage.copy')}</Btn>
              <Btn variant="ghost" size="sm" onClick={() => void regenerate()} loading={busy === 'regen'} disabled={busy === 'regen'}>{t('campaigns.manage.regenerate')}</Btn></div>
          </div>
        </section>

        {showRequests && (
          <section aria-labelledby="mg-req">
            <h4 id="mg-req" className="rv-manage-h">{t('campaigns.manage.requestsTitle')}</h4>
            {requests.length === 0 && <p className="rv-wizard-sub">{t('campaigns.manage.requestsEmpty')}</p>}
            <ul className="rv-manage-list">
              {requests.map(r => (
                <li key={r.id} className="rv-manage-row" aria-label={r.name}>
                  <UserAvatar user={{ name: r.name, avatarUrl: r.avatarUrl }} size={30} />
                  <span className="rv-manage-text"><strong>{r.name}</strong><small>{r.message || t('campaigns.manage.requestedAt', { date: fmtDate(r.createdAt) })}</small></span>
                  <Btn variant="success" size="sm" onClick={() => void resolve(r, true)} disabled={busy === `req-${r.id}`}>{t('campaigns.manage.accept')}</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => void resolve(r, false)} disabled={busy === `req-${r.id}`}>{t('campaigns.manage.reject')}</Btn>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="mg-members">
          <h4 id="mg-members" className="rv-manage-h">{t('campaigns.manage.membersTitle', { n: String(players.length), seats: String(campaign.seats) })}</h4>
          {players.length === 0 && <p className="rv-wizard-sub">{t('campaigns.manage.membersEmpty')}</p>}
          <ul className="rv-manage-list">
            {members.map(m => (
              <li key={m.userId} className="rv-manage-row" aria-label={m.name}>
                <UserAvatar user={{ name: m.name, avatarUrl: m.avatarUrl }} size={30} />
                <span className="rv-manage-text"><strong>{m.name}</strong><small>{m.role === 'dm' ? t('campaigns.manage.director') : m.characterId ? t('campaigns.manage.withCharacter') : t('campaigns.manage.noCharacter')}</small></span>
                {m.role === 'player' && <Btn variant="ghost" size="sm" onClick={() => void kick(m)} disabled={busy === `kick-${m.userId}`}>{t('campaigns.manage.kick')}</Btn>}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="mg-opts">
          <h4 id="mg-opts" className="rv-manage-h">{t('campaigns.manage.optionsTitle')}</h4>
          <div className="rv-manage-opts">
            <div className="rv-field" style={{ marginBottom: 0 }}>
              <label className="rv-label" htmlFor="mg-next">{t('campaigns.manage.nextSession')}</label>
              <div className="rv-join-row">
                <input id="mg-next" className="rv-inp" type="datetime-local" value={nextSession} onChange={e => saveSession(e.target.value)} />
                {nextSession && <Btn variant="ghost" size="sm" onClick={() => saveSession('')}>{t('campaigns.manage.clearSession')}</Btn>}
              </div>
              <p className="rv-aside-note">{t('campaigns.manage.nextSessionHint')}</p>
            </div>
            <div className="rv-field" style={{ marginBottom: 0 }}>
              <span className="rv-label">{t('campaigns.manage.progression')}</span>
              <label className="rv-check"><input type="checkbox" checked={progression} onChange={e => toggleProgression(e.target.checked)} /> {progression ? t('campaigns.manage.progressionOn') : t('campaigns.manage.progressionOff')}</label>
            </div>
          </div>
        </section>

        <section aria-labelledby="mg-archive" className="rv-manage-danger">
          <div className="rv-manage-text"><h4 id="mg-archive" className="rv-manage-h">{t('campaigns.manage.archiveTitle')}</h4><p className="rv-wizard-sub">{t('campaigns.manage.archiveSub')}</p></div>
          <Btn variant="danger" size="sm" onClick={() => void archive()} loading={busy === 'archive'} disabled={busy === 'archive'}>{t('campaigns.manage.archive')}</Btn>
        </section>
      </div>
    </Modal>
  );
}
