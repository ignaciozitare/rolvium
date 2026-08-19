import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Badge } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { useAuth } from '@/shared/hooks/useAuth';
import { campaignsRepo as defaultCampaigns } from '@/modules/campaigns/container';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import '@/modules/table/ui/table.css';
import type { CharactersPort } from '../domain/ports/CharactersPort';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import { charactersRepo as defaultRepo, rollsPort as defaultRolls } from '../container';
import { canEditCharacter } from '../domain/useCases/characterRules';
import { useCharacterSheet } from './useCharacterSheet';
import { CharacterSheetView } from './CharacterSheetView';
import './characters.css';

/** Inline `--sys-*` vars from a system theme (same mapping the table uses). */
export function systemThemeStyle(system: GameSystem | null): CSSProperties {
  if (!system) return {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(system.theme.vars)) vars[`--sys-${k}`] = v;
  if (system.theme.backgroundImage) vars['--sys-bg-image'] = `url(${system.theme.backgroundImage})`;
  return vars as CSSProperties;
}

/** Loads the system's fonts once (theme.fonts.url). */
export function useSystemFonts(system: GameSystem | null): void {
  useEffect(() => {
    const url = system?.theme.fonts?.url;
    if (!url || document.querySelector(`link[data-sys-font="${system?.id}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.dataset.sysFont = system?.id ?? ''; document.head.appendChild(link);
  }, [system]);
}

interface Props { repo?: CharactersPort; campaigns?: CampaignsPort; rolls?: RollsPort }

/** `/characters/:id` — the sheet in its own window (rolvium.pen Personajes/Ficha aparte): full-screen, dressed by the system. */
export function CharacterSheetPage({ repo = defaultRepo, campaigns = defaultCampaigns, rolls = defaultRolls }: Props): JSX.Element {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const state = useCharacterSheet(id, repo);
  const { character, system, status, dirty, saving, saveError } = state;
  const [isDm, setIsDm] = useState(false);
  const [editing, setEditing] = useState(false);
  useSystemFonts(system);
  const themeStyle = useMemo(() => systemThemeStyle(system), [system]);

  // Keyed on campaignId (not the character object) so autosaves don't refetch the campaign.
  const campaignId = character?.campaignId ?? null;
  useEffect(() => {
    if (!campaignId) return;
    let alive = true;
    void campaigns.getById(campaignId).then(c => { if (alive) setIsDm(c?.myRole === 'dm'); }).catch(() => {});
    return () => { alive = false; };
  }, [campaigns, campaignId]);

  if (status === 'loading') return <div className="tb-state">{t('common.loading')}</div>;
  if (status === 'not_found' || !character) return <Notice icon="person_off" title={t('characters.sheet.notFound')} />;
  if (status === 'system_not_installed') return <Notice icon="extension_off" title={t('table.systemNotInstalled')} />;
  if (status === 'error' || !system || !user) return <Notice icon="error" title={t('common.error')} />;

  const owner = !!user && character.ownerId === user.id;
  const mayEdit = canEditCharacter(character, user.id, isDm);
  const canEdit = owner || (isDm && editing);

  return (
    <div className="tb-root tb-root-page" data-system={system.id} style={themeStyle}>
      <div className="tb-rvbar">
        <div className="tb-rvbar-left">
          <Link to={`/table/${character.campaignId}`} className="tb-rvbar-back"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>{t('characters.sheet.back')}</Link>
          <img src="/brand/mark.svg" alt="" width={22} height={22} />
          <strong className="tb-rvbar-name">{t('characters.sheet.title')} · {character.name} · {character.campaignName}</strong>
          <Badge color="accent">{character.systemId}</Badge>
        </div>
        <div className="tb-rvbar-right">
          {saveError ? <span className="ch-status error"><span className="dot" />{t('common.error')}</span>
            : saving ? <span className="ch-status">{t('characters.sheet.saving')}</span>
              : dirty ? <span className="ch-status dirty"><span className="dot" />{t('characters.sheet.dirty')}</span>
                : <span className="ch-status synced"><span className="dot" />{t('characters.sheet.synced')}</span>}
          {isDm && !owner && mayEdit && (
            <button type="button" className={`tb-btn ${editing ? 'tb-btn-solid' : ''}`} aria-pressed={editing} onClick={() => setEditing(e => !e)}>{editing ? t('characters.sheet.readOnly') : t('characters.sheet.edit')}</button>
          )}
        </div>
      </div>
      <div className="tb-table">
        <CharacterSheetView state={state} canEdit={canEdit} rolls={rolls} />
      </div>
    </div>
  );
}

function Notice({ icon, title }: { icon: string; title: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="tb-state">
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)', color: 'var(--ac)' }}>{icon}</span>
      <h2>{title}</h2>
      <Link to="/characters" className="rv-nav-btn active" style={{ width: 'auto' }}>{t('common.back')}</Link>
    </div>
  );
}
