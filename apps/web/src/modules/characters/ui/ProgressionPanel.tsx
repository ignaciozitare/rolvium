import { useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Crescent } from '@rolvium/ui';
import type { FieldDef } from '@rolvium/core';
import { sysT } from '../domain/useCases/systemText';
import type { CharacterSheetState } from './useCharacterSheet';
import './characters.css';

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
type Change = { kind: string; target: string; to?: string };

interface Props { state: CharacterSheetState; enabled: boolean }

/**
 * «Mejorar» (rolvium.pen Mejorar/habilitada·bloqueada). Costs come from `engine.progression.cost`;
 * candidates are read from the schema (stat fields → `stat` / `specialty.new`; the level list → `gift.new` / `gift.level`,
 * the port's v1 progression vocabulary). Blocked when the campaign has progression closed.
 */
export function ProgressionPanel({ state, enabled }: Props): JSX.Element | null {
  const { t, locale } = useTranslation();
  const { system, data, applyPatch } = state;
  const ts = useMemo(() => (system ? sysT(system, locale) : (k: string) => k), [system, locale]);
  const [specStat, setSpecStat] = useState('');
  const [specTo, setSpecTo] = useState('');
  const [newGift, setNewGift] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!system) return null;
  const xp = num(data.xp);
  const fields = system.sheetSchema.sections.flatMap(s => s.fields);
  const stats = fields.filter(f => f.type === 'stat');
  const giftList = fields.find(f => f.type === 'list' && f.itemFields?.some(x => x.type === 'counter') && f.itemFields.some(x => x.type === 'select')) ?? null;
  const cost = (c: Change) => system.engine.progression.cost(data, c);
  const apply = (c: Change) => {
    const k = cost(c);
    if (k === null) { setMsg(t('characters.progression.notEnough')); return; }
    if (xp < k) { setMsg(t('characters.progression.notEnough')); return; }
    const patch = system.engine.progression.apply(data, c);
    if (Object.keys(patch).length === 0) { setMsg(t('characters.progression.notEnough')); return; }
    setMsg(null); applyPatch(patch, 'progression', true);
  };
  const statVal = (f: FieldDef) => { const r = data[f.id]; return r && typeof r === 'object' ? num((r as Record<string, unknown>).value, 1) : num(r, 1); };
  const statSpecs = (f: FieldDef): string[] => { const r = data[f.id]; const s = r && typeof r === 'object' ? (r as Record<string, unknown>).specialties : []; return Array.isArray(s) ? s.filter((x): x is string => typeof x === 'string') : []; };
  const specField = stats.find(f => f.id === specStat)?.itemFields?.[0] ?? null;
  const specOptions = (specField?.options ?? []).filter(o => !statSpecs(stats.find(f => f.id === specStat)!).includes(o.value));
  const specCost = specStat && specTo ? cost({ kind: 'specialty.new', target: specStat, to: specTo }) : null;
  const giftRows = giftList ? (Array.isArray(data[giftList.id]) ? (data[giftList.id] as Record<string, unknown>[]) : []) : [];
  const giftSel = giftList?.itemFields?.find(x => x.type === 'select') ?? null;
  const giftLvl = giftList?.itemFields?.find(x => x.type === 'counter') ?? null;
  const giftOptions = (giftSel?.options ?? []).filter(o => !giftRows.some(r => str(r[giftSel!.id]) === o.value));
  const newGiftCost = newGift ? cost({ kind: 'gift.new', target: newGift }) : null;
  const xpField = fields.find(f => f.id === 'xp');
  const btn = (c: Change, label: (k: number) => string) => {
    const k = cost(c);
    return <button type="button" className="rv-sheet-btn" disabled={!enabled || k === null || xp < k} onClick={() => apply(c)}>{label(k ?? 0)}</button>;
  };

  return (
    <div className={`ch-prog ${enabled ? '' : 'locked'}`} aria-label={t('characters.progression.title')}>
      <div className="ch-prog-head">
        <h3 className="ch-prog-title">{t('characters.progression.title')}</h3>
        <span className="ch-prog-xp"><Crescent size={22} /><b>{xp}</b><span className="rv-sheet-label">{xpField ? ts(xpField.label) : t('characters.progression.xp')}</span></span>
      </div>
      <div className={`ch-prog-banner ${enabled ? '' : 'locked'}`} role="status">{enabled ? t('characters.progression.open') : t('characters.progression.locked')}</div>
      {msg && <div className="ch-gen-err" role="alert">{msg}</div>}
      <div className="ch-prog-body">
        {stats.length > 0 && (
          <section aria-label={t('characters.progression.stats')}>
            <div className="ch-prog-sub">{t('characters.progression.stats')}</div>
            {stats.map(f => (
              <div key={f.id} className="ch-prog-row">
                {system.theme.icons?.stat === 'crescent' && <Crescent size={20} />}
                <span className="name">{ts(f.label)}</span>
                <span className="val">{statVal(f)}</span>
                {btn({ kind: 'stat', target: f.id }, k => t('characters.progression.plusOne', { cost: String(k) }))}
              </div>
            ))}
          </section>
        )}
        {stats.some(f => f.itemFields?.[0]) && (
          <section aria-label={t('characters.progression.specialties')}>
            <div className="ch-prog-sub">{t('characters.progression.specialties')}</div>
            <div className="ch-prog-line">
              <select className="rv-sheet-inp" aria-label={t('characters.progression.stats')} value={specStat} onChange={e => { setSpecStat(e.target.value); setSpecTo(''); }}>
                <option value="">—</option>{stats.map(f => <option key={f.id} value={f.id}>{ts(f.label)}</option>)}
              </select>
              <select className="rv-sheet-inp" aria-label={t('characters.progression.specialties')} value={specTo} disabled={!specField} onChange={e => setSpecTo(e.target.value)}>
                <option value="">—</option>{specOptions.map(o => <option key={o.value} value={o.value}>{ts(o.label)}</option>)}
              </select>
              <button type="button" className="rv-sheet-btn" disabled={!enabled || specCost === null || xp < specCost} onClick={() => { apply({ kind: 'specialty.new', target: specStat, to: specTo }); setSpecTo(''); }}>{t('characters.progression.add', { cost: String(specCost ?? 0) })}</button>
            </div>
          </section>
        )}
        {giftList && giftSel && giftLvl && (
          <section aria-label={t('characters.progression.gifts')}>
            <div className="ch-prog-sub">{ts(giftList.label)}</div>
            {giftRows.map((r, i) => (
              <div key={`${str(r[giftSel.id])}-${i}`} className="ch-prog-row">
                {system.theme.icons?.stat === 'crescent' && <Crescent size={20} />}
                <span className="name">{ts(giftSel.options?.find(o => o.value === str(r[giftSel.id]))?.label ?? str(r[giftSel.id]))}</span>
                <span className="meta">{t('characters.progression.level', { n: String(num(r[giftLvl.id], 1)) })}</span>
                {btn({ kind: 'gift.level', target: str(r[giftSel.id]) }, k => t('characters.progression.plusOne', { cost: String(k) }))}
              </div>
            ))}
            <div className="ch-prog-line">
              <select className="rv-sheet-inp" aria-label={t('characters.progression.gifts')} value={newGift} onChange={e => setNewGift(e.target.value)}>
                <option value="">{t('characters.progression.giftNew')}</option>{giftOptions.map(o => <option key={o.value} value={o.value}>{ts(o.label)}</option>)}
              </select>
              <button type="button" className="rv-sheet-btn" disabled={!enabled || newGiftCost === null || xp < newGiftCost} onClick={() => { apply({ kind: 'gift.new', target: newGift }); setNewGift(''); }}>{t('characters.progression.add', { cost: String(newGiftCost ?? 0) })}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
