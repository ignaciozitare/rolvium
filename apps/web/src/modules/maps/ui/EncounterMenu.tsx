import { useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem } from '@rolvium/core';
import { filterEntries, initialsOf } from '../domain/useCases/mapRules';

interface Props { entries: CatalogItem[]; labelOf: (e: CatalogItem) => string; selectedId: string | null; onSelect: (e: CatalogItem) => void; onClose: () => void }

/** DM «Colocar encuentro»: bestiary search over the system catalog; picking an entry arms the placement (click on the map places a copy). */
export function EncounterMenu({ entries, labelOf, selectedId, onSelect, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const list = useMemo(() => filterEntries(entries, q, labelOf), [entries, q, labelOf]);
  return (
    <div className="mp-pop mp-encounter" role="dialog" aria-label={t('maps.encounter.title')}>
      <div className="mp-pop-head">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>swords</span>
        <span className="mp-pop-title">{t('maps.encounter.title')}</span>
        <button type="button" className="mp-pop-x" aria-label={t('common.close')} onClick={onClose}><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span></button>
      </div>
      <label className="mp-search"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>search</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('maps.encounter.search')} aria-label={t('maps.encounter.search')} />
      </label>
      <ul className="mp-enc-list">
        {list.length === 0 && <li className="mp-enc-empty tb-dim tb-italic">{t('maps.encounter.empty')}</li>}
        {list.map(e => {
          const name = labelOf(e);
          const res = e.data?.resistance, prot = e.data?.protection;
          const sub = [typeof res === 'number' ? t('maps.encounter.resistance', { n: String(res) }) : null, typeof prot === 'number' ? t('maps.encounter.protection', { n: String(prot) }) : null].filter(Boolean).join(' · ');
          return (
            <li key={e.id}>
              <button type="button" className={`mp-enc-row ${selectedId === e.id ? 'on' : ''}`} aria-pressed={selectedId === e.id} aria-label={t('maps.encounter.select', { name })} onClick={() => onSelect(e)}>
                <span className="mp-enc-avatar">{initialsOf(name)}</span>
                <span className="mp-enc-txt"><span className="mp-enc-name">{name}</span>{sub && <span className="mp-enc-sub">{sub}</span>}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>add_location_alt</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mp-pop-hint tb-italic tb-dim">{t('maps.encounter.hint')}</p>
    </div>
  );
}
