import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Card, EmptyState, PageHeader, SectionTitle, StatusChip, SystemChip, UserAvatar } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS, systemRegistry } from '@/systems/registry';
import { campaignsRepo as defaultCampaigns } from '@/modules/campaigns/container';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import type { Character } from '../domain/entities/Character';
import type { CharactersPort } from '../domain/ports/CharactersPort';
import { charactersRepo as defaultRepo } from '../container';
import { characterAvatar, groupByCampaign, isUnassigned } from '../domain/useCases/characterRules';
import { sysT } from '../domain/useCases/systemText';

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** «Estado» and «Destaca» lines of a card, read from the system schema (health label · top stats). */
export function cardSummary(c: Character, system: GameSystem | null, ts: (k: string) => string): { state: string; highlights: string } {
  if (!system) return { state: c.health ?? '', highlights: '' };
  const fields = system.sheetSchema.sections.flatMap(s => s.fields);
  const health = fields.find(f => f.type === 'health');
  const healthLabel = health?.options?.find(o => o.value === c.health)?.label;
  const stats = fields.filter(f => f.type === 'stat').map(f => { const r = c.data[f.id]; return { label: ts(f.label), value: r && typeof r === 'object' ? num((r as Record<string, unknown>).value) : num(r) }; });
  const top = [...stats].sort((a, b) => b.value - a.value).slice(0, 3).map(s => `${s.label} ${s.value}`).join(' · ');
  return { state: healthLabel ? ts(healthLabel) : (c.health ?? ''), highlights: top };
}

interface Props { repo?: CharactersPort; campaigns?: CampaignsPort }

/** `/characters` — my characters grouped by campaign + unclaimed PCs of my campaigns (rolvium.pen Personajes). */
export function CharactersPage({ repo = defaultRepo, campaigns = defaultCampaigns }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Character[] | null>(null);
  const [unassigned, setUnassigned] = useState<Character[]>([]);
  const [systems, setSystems] = useState<Record<string, GameSystem>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await repo.listMine();
      setMine(list); setError(null);
      const camps = await campaigns.listMine().catch(() => []);
      const perCampaign = await Promise.all(camps.map(c => repo.listByCampaign(c.id).catch(() => [])));
      setUnassigned(perCampaign.flat().filter(isUnassigned));
      const ids = Array.from(new Set([...list, ...perCampaign.flat()].map(c => c.systemId)));
      const loaded = await Promise.all(ids.map(async id => [id, await systemRegistry.load(id).catch(() => null)] as const));
      setSystems(Object.fromEntries(loaded.filter((x): x is readonly [string, GameSystem] => !!x[1])));
    } catch { setError(t('common.error')); setMine([]); }
  }, [repo, campaigns, t]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => groupByCampaign(mine ?? []), [mine]);
  const claim = async (c: Character) => { await repo.claim(c.id); await load(); };

  return (
    <div className="rv-chars-page">
      <PageHeader title={t('characters.title')} subtitle={t('characters.subtitle')}
        actions={<Btn variant="primary" onClick={() => navigate('/campaigns')} title={t('characters.createHint')}>{t('characters.createBtn')}</Btn>} />
      {error && <div className="rv-err" role="alert">{error}</div>}
      {mine === null && <p className="rv-page-sub">{t('common.loading')}</p>}
      {mine && mine.length === 0 && (
        <Card><EmptyState icon="person_add" title={t('characters.empty.title')} description={t('characters.empty.desc')}
          actions={<Btn variant="primary" onClick={() => navigate('/campaigns')}>{t('characters.empty.cta')}</Btn>} /></Card>
      )}
      {groups.map(g => (
        <section key={g.campaignId} aria-labelledby={`camp-${g.campaignId}`}>
          <SectionTitle id={`camp-${g.campaignId}`}>{g.campaignName}</SectionTitle>
          <div className="rv-chars-grid">
            {g.characters.map(c => <CharacterCard key={c.id} c={c} system={systems[c.systemId] ?? null} ts={sysT(systems[c.systemId] ?? { locales: {} }, locale)} ownerAvatarUrl={user?.avatarUrl ?? null}
              onOpen={() => navigate(`/table/${c.campaignId}`)} onSheet={() => navigate(`/characters/${c.id}`)} />)}
          </div>
        </section>
      ))}
      {unassigned.length > 0 && (
        <section aria-labelledby="unassigned-h">
          <SectionTitle id="unassigned-h">{t('characters.unassignedTitle')}</SectionTitle>
          <div className="rv-chars-grid">
            {unassigned.map(c => <CharacterCard key={c.id} c={c} system={systems[c.systemId] ?? null} ts={sysT(systems[c.systemId] ?? { locales: {} }, locale)} ownerAvatarUrl={null}
              onSheet={() => navigate(`/characters/${c.id}`)} onClaim={() => void claim(c)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

interface CardProps { c: Character; system: GameSystem | null; ts: (k: string) => string; ownerAvatarUrl: string | null; onOpen?: () => void; onSheet: () => void; onClaim?: () => void }

/** rolvium.pen `Card/Personaje`: avatar · name · concept · chips · CAMPAÑA / ESTADO / DESTACA · actions. */
export function CharacterCard({ c, system, ts, ownerAvatarUrl, onOpen, onSheet, onClaim }: CardProps): JSX.Element {
  const { t } = useTranslation();
  const sys = SYSTEMS.find(s => s.id === c.systemId);
  const { state, highlights } = cardSummary(c, system, ts);
  const unassigned = isUnassigned(c);
  return (
    <article className="rv-chars-card" aria-label={c.name}>
      <div className="rv-chars-head">
        <UserAvatar user={{ name: c.name, avatarUrl: characterAvatar(c, ownerAvatarUrl) }} size={56} />
        <div className="rv-chars-id">
          <h3 className="rv-chars-name">{c.name}</h3>
          {c.concept && <p className="rv-chars-concept">{c.concept}</p>}
          <div className="rv-chars-chips">
            <SystemChip>{sys ? t(sys.nameKey) : c.systemId}</SystemChip>
            {c.kind === 'npc' ? <StatusChip tone="purple">{t('characters.card.npc')}</StatusChip>
              : unassigned ? <StatusChip tone="gray">{t('characters.card.unassigned')}</StatusChip>
                : <StatusChip tone="green">{t('characters.card.inCampaign')}</StatusChip>}
          </div>
        </div>
      </div>
      <dl className="rv-chars-meta">
        <dt>{t('characters.card.campaign')}</dt><dd>{c.campaignName}</dd>
        <dt>{t('characters.card.state')}</dt><dd>{[state, t('characters.card.xp', { n: String(c.xp) })].filter(Boolean).join(' · ')}</dd>
        {highlights && <><dt>{t('characters.card.highlights')}</dt><dd>{highlights}</dd></>}
      </dl>
      <div className="rv-chars-actions">
        {onClaim && <Btn variant="primary" size="sm" onClick={onClaim}>{t('characters.claim')}</Btn>}
        {onOpen && <Btn variant="primary" size="sm" onClick={onOpen}>{t('characters.card.openTable')}</Btn>}
        <Btn variant="ghost" size="sm" onClick={onSheet}>{t('characters.card.viewSheet')}</Btn>
      </div>
    </article>
  );
}
