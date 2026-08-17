import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Crescent, Sheet } from '@rolvium/ui';
import type { GameSystem, SheetData, SheetPatch } from '@rolvium/core';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import { campaignsRepo as defaultCampaigns } from '@/modules/campaigns/container';
import type { Character, CharacterKind } from '../domain/entities/Character';
import type { CharactersPort } from '../domain/ports/CharactersPort';
import { charactersRepo as defaultRepo } from '../container';
import { sysT } from '../domain/useCases/systemText';
import './characters.css';

interface Props {
  campaignId: string;
  system: GameSystem;
  role: TableRole;
  repo?: CharactersPort;
  campaigns?: CampaignsPort;
  onCancel: () => void;
  onCreated: (c: Character) => void;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Character generator driven by `system.generator` steps (rolvium.pen Generador/*):
 * step rail · budget bar · the step's fields through <Sheet> · footer. DM extra: kind + assign-to.
 */
export function GeneratorWizard({ campaignId, system, role, repo = defaultRepo, campaigns = defaultCampaigns, onCancel, onCreated }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const steps = system.generator;
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<SheetData>(() => system.newSheet());
  const [kind, setKind] = useState<CharacterKind>('pc');
  const [assignTo, setAssignTo] = useState<string>('');
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const isDm = role === 'dm';

  useEffect(() => {
    if (!isDm) return;
    let alive = true;
    void campaigns.listMembers(campaignId).then(m => { if (alive) setMembers(m.filter(x => x.role === 'player')); }).catch(() => {});
    return () => { alive = false; };
  }, [isDm, campaigns, campaignId]);

  const step = steps[i];
  if (!step) return <></>;
  const error = step.canAdvance(draft);
  const budget = step.budget?.(draft) ?? null;
  const last = i === steps.length - 1;
  const refText = (key: string) => { const r = system.references[key]; return r ? { page: r.page, title: ts(r.title), summary: ts(r.summary) } : null; };
  const labels = { roll: t('characters.sheet.roll'), add: t('characters.sheet.add'), remove: t('characters.sheet.remove'), manual: t('characters.sheet.manual'), of: t('characters.sheet.of') };
  /** A change is vetoed when it would push the step's budget below zero. */
  const canChange = (id: string, next: unknown) => { const b = step.budget?.({ ...draft, [id]: next }); return !b || b.remaining >= 0; };
  const patch = (p: SheetPatch) => setDraft(d => ({ ...d, ...p }));

  const finish = async () => {
    setBusy(true); setFailed(false);
    try {
      const data = system.finalizeDraft ? system.finalizeDraft(draft) : draft;
      const created = await repo.create({
        campaignId, name: str(data.name).trim(), concept: str(data.concept), kind: isDm ? kind : 'pc',
        ...(isDm ? { ownerId: assignTo || null } : {}),
        data, derived: system.engine.derived(data), health: str(data.health) || null,
      });
      onCreated(created);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };

  return (
    <div className="ch-gen" aria-label={t('characters.generator.title')}>
      {isDm && (
        <div className="ch-gen-dm">
          <span className="ch-tag">{t('characters.generator.dmOnly')}</span><small>{t('characters.generator.dmOnlyHint')}</small>
          <span className="rv-sheet-label">{t('characters.generator.kind')}</span>
          <button type="button" className={`rv-sheet-btn ${kind === 'pc' ? 'solid' : ''}`} aria-pressed={kind === 'pc'} onClick={() => setKind('pc')}>{t('characters.generator.kindPc')}</button>
          <button type="button" className={`rv-sheet-btn ${kind === 'npc' ? 'solid' : ''}`} aria-pressed={kind === 'npc'} onClick={() => setKind('npc')}>{t('characters.generator.kindNpc')}</button>
          {kind === 'pc' && (
            <>
              <span className="rv-sheet-label">{t('characters.generator.assignTo')}</span>
              <select className="rv-sheet-inp" style={{ width: 'auto' }} aria-label={t('characters.generator.assignTo')} value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">{t('characters.generator.unassigned')}</option>
                {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
              <small>{t('characters.generator.unassignedHint')}</small>
            </>
          )}
        </div>
      )}

      <nav className="ch-gen-steps" aria-label={t('characters.generator.step', { n: String(i + 1), total: String(steps.length) })}>
        {steps.map((s, j) => (
          <button key={s.id} type="button" className={`ch-gen-step ${j === i ? 'on' : ''} ${j < i ? 'done' : ''}`} aria-current={j === i ? 'step' : undefined} disabled={j > i} onClick={() => j < i && setI(j)}>
            <Crescent size={18} />{ts(s.label)}
          </button>
        ))}
      </nav>

      {budget && (
        <div className="ch-gen-budget" role="status">
          <div className="ch-gen-budget-left"><span className="rv-sheet-label">{ts(budget.label)}</span><span className="ch-gen-budget-n">{budget.remaining}</span>{budget.detail && <span className="ch-gen-hint">{budget.detail}</span>}</div>
        </div>
      )}

      {step.fields.length > 0
        ? <Sheet schema={system.sheetSchema} data={draft} derived={system.engine.derived(draft)} fields={step.fields} showActions={false} onChange={patch} canChange={canChange} t={ts} refText={refText} labels={labels} icons={system.theme.icons ?? {}} />
        : <><p className="ch-gen-hint">{t('characters.generator.summaryHint')}</p><Sheet schema={system.sheetSchema} data={draft} derived={system.engine.derived(draft)} readOnly showActions={false} t={ts} refText={refText} labels={labels} icons={system.theme.icons ?? {}} /></>}

      <footer className="ch-gen-foot">
        <div className="ch-gen-foot-left">
          <button type="button" className="rv-sheet-btn" onClick={onCancel} disabled={busy}>{t('characters.generator.cancel')}</button>
          <button type="button" className="rv-sheet-btn" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0 || busy}>{t('characters.generator.back')}</button>
        </div>
        <div className="ch-gen-foot-right">
          {error && <span className="ch-gen-err" role="alert">{ts(error)}</span>}
          {failed && <span className="ch-gen-err" role="alert">{t('characters.generator.failed')}</span>}
          {last
            ? <button type="button" className="rv-sheet-btn solid" disabled={!!error || busy} onClick={() => void finish()}>{busy ? t('characters.generator.creating') : t('characters.generator.finish')}</button>
            : <button type="button" className="rv-sheet-btn solid" disabled={!!error} onClick={() => setI(x => x + 1)}>{t('characters.generator.next')}</button>}
        </div>
      </footer>
    </div>
  );
}
