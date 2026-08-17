import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import { CharacterSheetView } from '@/modules/characters/ui/CharacterSheetView';
import { GeneratorWizard } from '@/modules/characters/ui/GeneratorWizard';
import { useCharacterSheet } from '@/modules/characters/ui/useCharacterSheet';

interface Props {
  campaignId: string; system: GameSystem; role: TableRole; userId: string;
  repo: CharactersPort; rolls?: RollsPort;
  /** Roll options from the table (Destiny dice in hand…). */
  rollOptions?: Record<string, unknown>;
  /** Character to show (DM opening a sheet from «El grupo»); defaults to my own PC. */
  characterId?: string | null;
  onOpenCreate: () => void;
}

/** Finds my PC in the campaign (owner = me). */
export function useMyCharacter(campaignId: string, userId: string, repo: CharactersPort, override?: string | null) {
  const [mine, setMine] = useState<Character | null | undefined>(undefined);
  const load = useCallback(async () => {
    try { const list = await repo.listByCampaign(campaignId); setMine(list.find(c => c.ownerId === userId && c.kind === 'pc') ?? null); }
    catch { setMine(null); }
  }, [campaignId, userId, repo]);
  useEffect(() => { void load(); }, [load]);
  return useMemo(() => ({ id: override ?? mine?.id ?? null, ready: override !== undefined && override !== null ? true : mine !== undefined, reload: load }), [override, mine, load]);
}

/** Ficha tab: my sheet, or the empty state → generator (rolvium.pen Vacío/«No tienes personaje en esta campaña»). */
export function SheetTab({ campaignId, system, role, userId, repo, rolls, rollOptions, characterId, onOpenCreate }: Props): JSX.Element {
  const { t } = useTranslation();
  const my = useMyCharacter(campaignId, userId, repo, characterId);
  const state = useCharacterSheet(my.ready ? my.id : null, repo);
  const [editing, setEditing] = useState(false);
  if (!my.ready || (my.id && state.status === 'loading')) return <section className="tb-hoja tb-placeholder">{t('common.loading')}</section>;
  if (!my.id) {
    return (
      <section className="ch-empty" aria-live="polite">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>person</span>
        <h3>{t('characters.table.noneTitle')}</h3>
        <p>{role === 'dm' ? t('characters.table.dmNoSheet') : t('characters.table.noneDesc')}</p>
        <button type="button" className="rv-sheet-btn" onClick={onOpenCreate}>{t('characters.table.create')}</button>
      </section>
    );
  }
  if (state.status !== 'ready' || !state.character) return <section className="tb-hoja tb-placeholder">{t('common.error')}</section>;
  const owner = state.character.ownerId === userId;
  const canEdit = owner || (role === 'dm' && editing);
  return (
    <>
      <div className="ch-toolbar">
        <span className={`ch-status ${state.saveError ? 'error' : state.dirty ? 'dirty' : 'synced'}`}><span className="dot" />{state.saveError ? t('common.error') : state.dirty ? t('characters.sheet.dirty') : t('characters.sheet.synced')}</span>
        <div className="ch-toolbar-right">
          {role === 'dm' && !owner && <button type="button" className={`rv-sheet-btn ${editing ? 'solid' : ''}`} aria-pressed={editing} onClick={() => setEditing(e => !e)}>{editing ? t('characters.sheet.readOnly') : t('characters.sheet.edit')}</button>}
          <Link to={`/characters/${state.character.id}`} target="_blank" rel="noopener" className="rv-sheet-btn" style={{ textDecoration: 'none' }}>{t('characters.sheet.openApart')}</Link>
        </div>
      </div>
      <CharacterSheetView state={state} canEdit={canEdit} {...(rolls ? { rolls } : {})} {...(rollOptions ? { rollOptions } : {})} />
    </>
  );
}

/** Crear personaje tab: the system generator; on success the parent jumps to the sheet. */
export function CreateTab({ campaignId, system, role, repo, onCancel, onCreated }: { campaignId: string; system: GameSystem; role: TableRole; repo: CharactersPort; onCancel: () => void; onCreated: (c: Character) => void }): JSX.Element {
  return <GeneratorWizard campaignId={campaignId} system={system} role={role} repo={repo} onCancel={onCancel} onCreated={onCreated} />;
}
