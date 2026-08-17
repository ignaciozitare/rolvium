import { useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Modal, Badge } from '@rolvium/ui';
import type { Campaign, CampaignVisibility, CreateCampaignInput } from '../domain/entities/Campaign';
import { validateCreateStep } from '../domain/useCases/campaignRules';
import { SYSTEMS } from '@/systems/registry';

type StepId = 'name' | 'system' | 'seats' | 'options' | 'invite';
const STEPS: StepId[] = ['name', 'system', 'seats', 'options', 'invite'];

interface Props {
  onClose: () => void;
  onCreate: (input: CreateCampaignInput) => Promise<Campaign>;
  onOpenTable: (c: Campaign) => void;
}

/** Wizard as designed in rolvium.pen `Campañas/Crear` (Nombre → Sistema → Visibilidad y plazas → Opciones → Invitar). */
export function CreateCampaignWizard({ onClose, onCreate, onOpenTable }: Props): JSX.Element {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemId, setSystemId] = useState<string | null>(SYSTEMS.find(s => s.installed)?.id ?? null);
  const [visibility, setVisibility] = useState<CampaignVisibility>('invite');
  const [seats, setSeats] = useState(5);
  const [progression, setProgression] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Campaign | null>(null);

  const current = STEPS[step] ?? 'name';
  const stepError = useMemo(() => {
    if (current === 'name') return validateCreateStep('name', { name, systemId, seats });
    if (current === 'system') return validateCreateStep('system', { name, systemId, seats });
    if (current === 'seats') return validateCreateStep('seats', { name, systemId, seats });
    return null;
  }, [current, name, systemId, seats]);

  const next = async () => {
    if (stepError) { setError(t(stepError)); return; }
    setError(null);
    if (current === 'options') {
      const sys = SYSTEMS.find(s => s.id === systemId);
      if (!sys) return;
      setBusy(true);
      try {
        const c = await onCreate({ name, description, systemId: sys.id, systemVersion: sys.version, visibility, seats, progressionEnabled: progression, sharedResources: {} });
        setCreated(c);
        setStep(step + 1);
      } catch { setError(t('common.error')); }
      finally { setBusy(false); }
      return;
    }
    setStep(step + 1);
  };

  const inviteUrl = created ? `${window.location.origin}/join/${created.inviteCode ?? ''}` : '';

  return (
    <Modal title={t('campaigns.create.title')} onClose={onClose} width={900} noPadding>
      <div className="rv-wizard">
        <ol className="rv-wizard-steps" aria-label={t('campaigns.create.steps')}>
          {STEPS.map((s, i) => (
            <li key={s} className={`rv-wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} aria-current={i === step ? 'step' : undefined}>
              <span className="rv-wizard-num">{i < step ? <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>check</span> : i + 1}</span>
              {t(`campaigns.create.step.${s}`)}
            </li>
          ))}
        </ol>
        <div className="rv-wizard-content">
          {current === 'name' && (
            <>
              <h3 className="rv-wizard-q">{t('campaigns.create.nameQ')}</h3>
              <div className="rv-field"><label className="rv-label" htmlFor="c-name">{t('campaigns.create.name')}</label>
                <input id="c-name" className="rv-inp" value={name} onChange={e => setName(e.target.value)} placeholder={t('campaigns.create.namePh')} autoFocus /></div>
              <div className="rv-field"><label className="rv-label" htmlFor="c-desc">{t('campaigns.create.description')}</label>
                <textarea id="c-desc" className="rv-inp" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('campaigns.create.descriptionPh')} /></div>
            </>
          )}
          {current === 'system' && (
            <>
              <h3 className="rv-wizard-q">{t('campaigns.create.systemQ')}</h3>
              <p className="rv-wizard-sub">{t('campaigns.create.systemSub')}</p>
              <div className="rv-sys-options" role="radiogroup" aria-label={t('campaigns.create.step.system')}>
                {SYSTEMS.map(s => (
                  <button key={s.id} type="button" role="radio" aria-checked={systemId === s.id} disabled={!s.installed}
                    className={`rv-sys-option ${systemId === s.id ? 'selected' : ''} ${s.installed ? '' : 'locked'}`} onClick={() => s.installed && setSystemId(s.id)}>
                    <span className="rv-radio" aria-hidden="true" />
                    <span className="rv-sys-text">
                      <span className="rv-sys-name">{t(s.nameKey)} <small>{s.publisher}</small></span>
                      <span className="rv-sys-desc">{t(`systems.${s.id}.desc`)}</span>
                    </span>
                    {!s.installed && <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)', color: 'var(--tx3)' }}>lock</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {current === 'seats' && (
            <>
              <h3 className="rv-wizard-q">{t('campaigns.create.seatsQ')}</h3>
              <div className="rv-field"><span className="rv-label">{t('campaigns.create.visibility')}</span>
                <div className="rv-seg" role="radiogroup">
                  {(['invite', 'open'] as CampaignVisibility[]).map(v => (
                    <button key={v} type="button" role="radio" aria-checked={visibility === v} className={`rv-seg-btn ${visibility === v ? 'active' : ''}`} onClick={() => setVisibility(v)}>{t(`campaigns.visibility.${v}`)}</button>
                  ))}
                </div>
                <p className="rv-wizard-sub">{t(`campaigns.visibility.${visibility}Desc`)}</p></div>
              <div className="rv-field" style={{ maxWidth: 160 }}><label className="rv-label" htmlFor="c-seats">{t('campaigns.create.seats')}</label>
                <input id="c-seats" className="rv-inp" type="number" min={1} max={12} value={seats} onChange={e => setSeats(Number(e.target.value))} /></div>
            </>
          )}
          {current === 'options' && (
            <>
              <h3 className="rv-wizard-q">{t('campaigns.create.optionsQ')}</h3>
              <label className="rv-check"><input type="checkbox" checked={progression} onChange={e => setProgression(e.target.checked)} /> {t('campaigns.create.progression')}</label>
              <p className="rv-wizard-sub">{t('campaigns.create.progressionSub')}</p>
            </>
          )}
          {current === 'invite' && created && (
            <>
              <h3 className="rv-wizard-q"><span className="material-symbols-outlined" style={{ color: 'var(--green)', verticalAlign: 'middle', marginRight: 8 }}>check_circle</span>{t('campaigns.create.createdQ', { name: created.name })}</h3>
              <p className="rv-wizard-sub">{t('campaigns.create.createdSub')}</p>
              <div className="rv-code-panel">
                <div><span className="rv-label">{t('campaigns.create.inviteCode')}</span><span className="rv-code">{created.inviteCode}</span></div>
                <div className="rv-code-link"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)', color: 'var(--tx3)' }}>link</span><span className="rv-code-url">{inviteUrl}</span>
                  <Btn variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(inviteUrl)}>{t('campaigns.create.copy')}</Btn></div>
              </div>
              <div className="rv-camp-meta" style={{ marginTop: 12 }}><Badge color="gray">{t('campaigns.create.seatsTaken', { n: '0', seats: String(created.seats) })}</Badge></div>
            </>
          )}
          {error && <div className="rv-err" role="alert" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      </div>
      <footer className="rv-wizard-foot">
        {current !== 'invite' ? <Btn variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>{step === 0 ? t('common.cancel') : t('common.back')}</Btn> : <Btn variant="ghost" onClick={onClose}>{t('campaigns.create.inviteLater')}</Btn>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="rv-wizard-count">{t('campaigns.create.stepCount', { n: String(step + 1), total: String(STEPS.length) })}</span>
          {current !== 'invite'
            ? <Btn variant="primary" onClick={() => void next()} loading={busy} disabled={busy}>{current === 'options' ? t('campaigns.create.createBtn') : t('campaigns.create.next')}</Btn>
            : <Btn variant="primary" onClick={() => created && onOpenTable(created)}>{t('campaigns.openTable')}</Btn>}
        </div>
      </footer>
    </Modal>
  );
}
