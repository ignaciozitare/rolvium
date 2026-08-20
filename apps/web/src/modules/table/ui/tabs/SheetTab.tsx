import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import { CharacterSheetView } from '@/modules/characters/ui/CharacterSheetView';
import type { SharedPoolHandle } from '@/modules/characters/ui/RollPopover';
import { GeneratorWizard } from '@/modules/characters/ui/GeneratorWizard';
import { ProgressionPanel } from '@/modules/characters/ui/ProgressionPanel';
import { useCharacterSheet } from '@/modules/characters/ui/useCharacterSheet';

interface Props {
  campaignId: string; system: GameSystem; role: TableRole; userId: string;
  repo: CharactersPort; rolls?: RollsPort;
  /** Roll options from the table (Destiny dice in hand…). */
  rollOptions?: Record<string, unknown>;
  /** La reserva compartida de la mesa: el desplegable de tirar coge de ella (`.pen`, columna 1). */
  pool?: SharedPoolHandle;
  /** Character to show (DM opening a sheet from «El grupo»); defaults to my own PC. */
  characterId?: string | null;
  /** Whether the campaign has progression open — «Mejorar» shows the panel locked when it is closed. */
  progressionEnabled?: boolean;
  onOpenCreate: () => void;
  /**
   * Volver a «El grupo». Sólo llega cuando se ha entrado desde ahí: una ficha abierta desde el listado del
   * director no tenía salida, y la pestaña «Ficha» tampoco devolvía a la propia (dueño, 2026-08-21).
   */
  onBack?: () => void;
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
export function SheetTab({ campaignId, system, role, userId, repo, rolls, rollOptions, pool, characterId, progressionEnabled = false, onOpenCreate, onBack }: Props): JSX.Element {
  const { t } = useTranslation();
  const my = useMyCharacter(campaignId, userId, repo, characterId);
  const state = useCharacterSheet(my.ready ? my.id : null, repo);
  const [editing, setEditing] = useState(false);
  const [improving, setImproving] = useState(false);
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
        {/* Quién es y cómo salir. Sin esto el director veía una ficha ajena sin nombre y sin puerta. */}
        {onBack && (
          <button type="button" className="rv-sheet-btn ch-back" onClick={onBack}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>
            {t('characters.sheet.backToGroup')}
          </button>
        )}
        {onBack && !owner && <span className="ch-viewing">{t('characters.sheet.viewing', { name: state.character.name })}</span>}
        <span className={`ch-status ${state.saveError ? 'error' : state.dirty ? 'dirty' : 'synced'}`}><span className="dot" />{state.saveError ? t('common.error') : state.dirty ? t('characters.sheet.dirty') : t('characters.sheet.synced')}</span>
        <div className="ch-toolbar-right">
          {role === 'dm' && !owner && <button type="button" className={`rv-sheet-btn ${editing ? 'solid' : ''}`} aria-pressed={editing} onClick={() => setEditing(e => !e)}>{editing ? t('characters.sheet.readOnly') : t('characters.sheet.edit')}</button>}
          {/* «Mejorar» vive AQUÍ, no en la barra de pestañas: es algo que le haces a la ficha que
              tienes delante (dueño). Abre el panel encima de la ficha y se cierra con el mismo botón. */}
          <button type="button" className={`rv-sheet-btn ${improving ? 'solid' : ''}`} aria-pressed={improving} onClick={() => setImproving(v => !v)}>{t('table.tab.improve')}</button>
          <Link to={`/characters/${state.character.id}`} target="_blank" rel="noopener" className="rv-sheet-btn" style={{ textDecoration: 'none' }}>{t('characters.sheet.openApart')}</Link>
        </div>
      </div>
      {improving && <ProgressionPanel state={state} enabled={progressionEnabled} />}
      <CharacterSheetView state={state} canEdit={canEdit} {...(rolls ? { rolls } : {})} {...(rollOptions ? { rollOptions } : {})} {...(pool ? { pool } : {})} />
    </>
  );
}

/** Crear personaje tab: the system generator; on success the parent jumps to the sheet. */
export function CreateTab({ campaignId, system, role, repo, onCancel, onCreated }: { campaignId: string; system: GameSystem; role: TableRole; repo: CharactersPort; onCancel: () => void; onCreated: (c: Character) => void }): JSX.Element {
  return <GeneratorWizard campaignId={campaignId} system={system} role={role} repo={repo} onCancel={onCancel} onCreated={onCreated} />;
}
