import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ConfirmModal, EmptyState } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { emptyEntry, emptyNpc } from '../domain/useCases/bestiaryRules';
import type { BestiaryEntry, OriginFilter } from '../domain/entities/BestiaryEntry';
import { useBestiary } from './useBestiary';
import { EntryCard } from './EntryCard';
import { EntrySheetModal } from './EntrySheetModal';
import { PhotoModal } from './PhotoModal';
import { NpcSheetModal } from './NpcSheetModal';
import type { BestiaryPort } from '../domain/ports/BestiaryPort';
import './bestiary.css';

interface Props {
  campaignId: string;
  system: GameSystem;
  /** Colocar en escena lo resuelve `maps`; aquí sólo se elige qué colocar. */
  onPlace?: (entry: BestiaryEntry) => void;
  onRoll?: (entry: BestiaryEntry) => void;
  repo?: BestiaryPort;
}

const FILTERS: OriginFilter[] = ['all', 'manual', 'custom', 'npc'];

/**
 * Catálogo del bestiario, a pantalla completa dentro de la mesa — `.pen` «Bestiario/Catálogo · pantalla completa».
 *
 * **Sólo el director llega aquí**: la pestaña no existe para un jugador (`tabsFor`), y aunque llegara, la RLS no
 * le devolvería ni una fila. Las dos barreras son a propósito: la de pantalla es comodidad, la de base es la real.
 */
export function BestiaryTab({ campaignId, system, onPlace, onRoll, repo }: Props): JSX.Element {
  const { t } = useTranslation();
  const bs = useBestiary({ campaignId, system, ...(repo ? { repo } : {}) });
  const [editing, setEditing] = useState<BestiaryEntry | null>(null);
  const [photo, setPhoto] = useState<BestiaryEntry | null>(null);
  const [deleting, setDeleting] = useState<BestiaryEntry | null>(null);

  /** Del manual no se edita: se duplica y se edita la copia, que es lo que abre la ficha. */
  const openEditor = async (entry: BestiaryEntry) => setEditing(entry.editable ? entry : await bs.duplicate(entry));

  const createNew = async () => setEditing(await bs.create(emptyEntry(campaignId, system.id, t('bestiary.newName'))));
  /** Un PNJ aliado nace con ficha de personaje vacía, no con bloque de criatura. */
  const createNpc = async () => setEditing(await bs.create(emptyNpc(campaignId, system.id, t('bestiary.newNpcName'))));

  return (
    <section className="bs-tab" aria-busy={bs.loading}>
      <header className="bs-head">
        <div>
          <h2 className="bs-title">{t('bestiary.title')}</h2>
          <p className="bs-sub">{t('bestiary.counts', { all: String(bs.counts.all), manual: String(bs.counts.manual), own: String(bs.counts.custom + bs.counts.npc) })}</p>
        </div>
        <span className="bs-card-sp" />
        <label className="bs-search">
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>search</span>
          <input type="search" value={bs.query} onChange={e => bs.setQuery(e.target.value)}
                 placeholder={t('bestiary.search')} aria-label={t('bestiary.search')} />
        </label>
        <button type="button" className="bs-btn bs-btn-lg" onClick={createNpc}>{t('bestiary.newNpc')}</button>
        <button type="button" className="bs-btn bs-btn-on bs-btn-lg" onClick={createNew}>{t('bestiary.new')}</button>
      </header>

      <p className="bs-onlydm">
        <span className="bs-onlydm-tag">{t('bestiary.onlyDm')}</span>
        {t('bestiary.onlyDmNote')}
      </p>

      <div className="bs-filters" role="group" aria-label={t('bestiary.filters')}>
        {FILTERS.map(f => (
          <button key={f} type="button" className={`bs-btn ${bs.filter === f ? 'on' : ''}`}
                  aria-pressed={bs.filter === f} onClick={() => bs.setFilter(f)}>
            {t(`bestiary.filter.${f}`)}
          </button>
        ))}
      </div>

      {bs.error && <p className="bs-error" role="alert">{bs.error}</p>}

      {!bs.loading && bs.visible.length === 0
        ? <EmptyState icon="pest_control" title={t('bestiary.empty')} description={t('bestiary.emptyHint')} />
        : (
          <div className="bs-grid">
            {bs.visible.map(e => (
              <EntryCard key={`${e.origin}:${e.id}`} entry={e} specialtyLabel={bs.specialtyLabel}
                         onRoll={() => onRoll?.(e)} onPlace={() => onPlace?.(e)}
                         onEdit={openEditor} onPhoto={setPhoto} onMore={openEditor} derive={system.engine.derived} />
            ))}
          </div>
        )}

      {photo && <PhotoModal entry={photo} onClose={() => setPhoto(null)} onOpenSheet={() => { setPhoto(null); void openEditor(photo); }} />}

      {editing?.origin === 'npc' && (
        <NpcSheetModal
          entry={editing}
          system={system}
          campaignId={campaignId}
          onSave={async patch => { await bs.update(editing.id, patch); }}
          onDelete={() => { setDeleting(editing); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing && editing.origin !== 'npc' && (
        <EntrySheetModal
          entry={editing}
          system={system}
          campaignId={campaignId}
          specialtyLabel={bs.specialtyLabel}
          onSave={async patch => { await bs.update(editing.id, patch); }}
          onUploadImage={file => bs.repo.uploadToken(editing.id, file)}
          onDuplicate={async () => setEditing(await bs.duplicate(editing))}
          onDelete={() => { setDeleting(editing); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          danger
          message={t('bestiary.deleteConfirm', { name: deleting.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => { await bs.remove(deleting.id); setDeleting(null); }}
        />
      )}
    </section>
  );
}
