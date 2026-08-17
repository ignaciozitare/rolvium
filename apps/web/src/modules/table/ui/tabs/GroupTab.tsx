import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { PhaseDisc, UserAvatar } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import type { CampaignMember } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

interface Props { campaignId: string; system: GameSystem; members: CampaignMember[]; repo: CharactersPort; onView: (c: Character) => void }

/** DM «El grupo»: every PC with avatar precedence, resistance bar, health disc, xp (rolvium.pen Mesa/Director·El grupo). */
export function GroupTab({ campaignId, system, members, repo, onView }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [list, setList] = useState<Character[] | null>(null);
  useEffect(() => {
    let alive = true;
    void repo.listByCampaign(campaignId).then(l => { if (alive) setList(l.filter(c => c.kind === 'pc')); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [campaignId, repo]);
  const fields = system.sheetSchema.sections.flatMap(s => s.fields);
  const health = fields.find(f => f.type === 'health');
  const boxes = fields.find(f => f.type === 'boxes');
  const xpField = fields.find(f => f.id === 'xp');
  const healthIdx = (c: Character) => Math.max(0, (health?.options ?? []).findIndex(o => o.value === c.health));
  const healthN = health?.options?.length ?? 1;
  return (
    <div className="ch-group">
      <div className="ch-group-note"><span className="ch-tag">{t('characters.generator.dmOnly')}</span><span className="rv-sheet-label">{t('characters.table.groupTitle')}</span></div>
      {list === null && <section className="tb-hoja tb-placeholder">{t('common.loading')}</section>}
      {list && list.length === 0 && <section className="ch-empty"><p>{t('characters.table.groupEmpty')}</p></section>}
      {list?.map(c => {
        const owner = members.find(m => m.userId === c.ownerId);
        const cur = boxes ? num(c.data[boxes.id]) : 0;
        const max = boxes ? num(c.derived[`${boxes.id}Max`], boxes.max ?? 0) : 0;
        return (
          <article key={c.id} className="ch-group-row" aria-label={c.name}>
            <div className="ch-group-id">
              <UserAvatar user={{ name: c.name, avatarUrl: characterAvatar(c, owner?.avatarUrl) }} size={44} />
              <div><div className="ch-group-name">{c.name}</div><div className="ch-group-sub">{[c.concept, owner?.name ?? t('characters.table.unassigned')].filter(Boolean).join(' · ')}</div></div>
            </div>
            {boxes && (
              <div className="ch-group-res">
                <span className="rv-sheet-label">{ts(boxes.label)}</span>
                <div className="ch-bar" role="meter" aria-valuenow={cur} aria-valuemin={0} aria-valuemax={max} aria-label={ts(boxes.label)}><span style={{ width: `${max > 0 ? Math.min(100, (cur / max) * 100) : 0}%` }} /></div>
                <span className="ch-group-sub">{cur} / {max}</span>
              </div>
            )}
            {health && (
              <div className="ch-group-health">
                <PhaseDisc fraction={healthN > 1 ? healthIdx(c) / (healthN - 1) : 0} size={40} />
                <span className="rv-sheet-label">{ts(health.options?.[healthIdx(c)]?.label ?? '')}</span>
              </div>
            )}
            <div className="ch-group-stat"><span className="rv-sheet-label">{xpField ? ts(xpField.label) : t('characters.card.xp', { n: '' })}</span><b>{c.xp}</b></div>
            <button type="button" className="rv-sheet-btn" onClick={() => onView(c)}>{t('characters.table.viewSheet')}</button>
          </article>
        );
      })}
    </div>
  );
}
