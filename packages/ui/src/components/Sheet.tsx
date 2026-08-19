import { useId, type ReactNode } from 'react';
import type { ActionDef, Catalogs, FieldDef, SectionDef, SheetData, SheetPatch, SheetSchema } from '@rolvium/core';
import './sheet.css';

// ─── <Sheet> — neutral, schema-driven character sheet ────────────────────────
// Renders SectionDefs/FieldDefs from a GameSystem's `sheetSchema`. It knows no
// game: labels come through `t(key)`, rule tooltips through `refText(refKey)`,
// action buttons through `actions` (ActionDef) and the look through --sys-* vars.

export interface SheetRef { page: number; title: string; summary: string }
/** Platform strings the sheet needs (passed in so the kit stays i18n-agnostic). */
export interface SheetLabels { roll: string; add: string; remove: string; manual: string; of: string; pick?: string; soon?: string }
export interface SheetProps {
  schema: SheetSchema;
  data: SheetData;
  derived?: Record<string, unknown>;
  readOnly?: boolean;
  onChange?: (patch: SheetPatch) => void;
  /** Rolls and system actions: `roll` (stat rows) or an ActionDef id; `itemId` = stat/row id. */
  onAction?: (actionId: string, itemId: string, options?: Record<string, unknown>) => void;
  actions?: ActionDef[];
  /** Catalog rows fill derived table columns (`catalogs[field.id]` → item.data[col.id]). */
  catalogs?: Catalogs;
  t: (key: string) => string;
  refText?: (refKey: string) => SheetRef | null;
  labels: SheetLabels;
  /** Dice a stat rolls right now (shown on the roll button). */
  poolSize?: (statId: string) => number | null;
  /** Vetoes a change (e.g. creation budget). Return false to disable the control. */
  canChange?: (fieldId: string, next: unknown) => boolean;
  onImagePick?: (fieldId: string) => void;
  /** Only these fields (any section) are rendered — used by the generator steps. */
  fields?: string[];
  /** Hide roll/action buttons (generator, previews). */
  showActions?: boolean;
  /** Icon hints from `VisualTheme.icons` (`stat: 'crescent'`, `health: 'moon-phase'`). */
  icons?: Record<string, string>;
  /** Extra content rendered at the end of a section (e.g. the damage control under `state`). */
  extras?: Record<string, ReactNode>;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : []);
const WIDE_TYPES = new Set(['table', 'longtext', 'image']);
/**
 * Whether ONE option of a `<select>` must be shown disabled, given the guard (`canChange`).
 *
 * Per option and not on the whole control: a budget rules out some choices, almost never the
 * field itself — greying the `<select>` would hide the choices the player can still afford.
 * Without this a refused pick died in silence: `set` skips `onChange` when the guard says no,
 * so React re-rendered the old value and the dropdown "bounced back" with no explanation
 * (owner, 2026-08-19: «los dones no me deja elegirlos, me deja el último»). The counters had
 * this signal through `allowed` from the start; the selects did not.
 *
 * The value already selected is never disabled — a disabled selected option is a broken
 * control, and re-picking what is already there costs nothing anyway.
 */
const optionVetoed = (value: string, current: string, disabled: boolean, allowed: (v: unknown) => boolean): boolean =>
  !disabled && value !== current && !allowed(value);

const isWide = (s: SectionDef) => s.layout === 'row' || s.fields.some(f => WIDE_TYPES.has(f.type));

export function Sheet(p: SheetProps): JSX.Element {
  const derived = p.derived ?? {};
  const ro = !!p.readOnly;
  const showActions = p.showActions ?? true;
  const set = (id: string, value: unknown) => { if (!ro && (p.canChange?.(id, value) ?? true)) p.onChange?.({ [id]: value }); };
  const allowed = (id: string, value: unknown) => !ro && (p.canChange?.(id, value) ?? true);
  const sections = p.schema.sections
    .map(s => ({ ...s, fields: p.fields ? s.fields.filter(f => p.fields!.includes(f.id)) : s.fields }))
    .filter(s => s.fields.length > 0);

  const label = (f: Pick<FieldDef, 'label' | 'ref'>, extra?: ReactNode) => <Label text={p.t(f.label)} refKey={f.ref} refText={p.refText} manual={p.labels.manual} extra={extra} />;

  const renderField = (f: FieldDef): ReactNode => {
    const v = f.derived ? derived[f.id] : p.data[f.id];
    switch (f.type) {
      case 'text': case 'longtext': {
        const Tag = f.type === 'longtext' ? 'textarea' : 'input';
        return <div className={`rv-sheet-field ${f.type === 'longtext' ? 'span' : ''}`}>{label(f)}<Tag className="rv-sheet-inp" aria-label={p.t(f.label)} value={str(v)} disabled={ro || !!f.derived} onChange={e => set(f.id, e.target.value)} /></div>;
      }
      case 'number':
        return (
          <div className="rv-sheet-field">{label(f)}
            {f.derived || ro ? <div className="rv-sheet-derived"><span className="rv-sheet-value">{str(v) || '—'}</span></div>
              : <input type="number" className="rv-sheet-inp num" aria-label={p.t(f.label)} value={num(v)} min={f.min} max={f.max} onChange={e => set(f.id, Number(e.target.value))} />}
          </div>
        );
      case 'counter':
        return <div className="rv-sheet-field">{label(f)}<Counter value={num(v, f.min ?? 0)} min={f.min} max={f.max} labelText={p.t(f.label)} disabled={ro || !!f.derived} allowed={n => allowed(f.id, n)} onChange={n => set(f.id, n)} /></div>;
      case 'boxes': {
        const max = Math.max(0, num(derived[`${f.id}Max`], f.max ?? 0));
        const val = Math.min(num(v), Math.max(max, num(v)));
        return (
          <div className="rv-sheet-field">{label(f)}
            <div className="rv-sheet-boxes" role="group" aria-label={p.t(f.label)}>
              {Array.from({ length: Math.max(max, val) }, (_, i) => (
                <button key={i} type="button" className={`rv-sheet-box ${i < val ? 'on' : ''}`} disabled={ro} aria-pressed={i < val} aria-label={`${p.t(f.label)} ${i + 1}`}
                  onClick={() => set(f.id, i + 1 === val ? i : i + 1)} />
              ))}
            </div>
            <span className="rv-sheet-caption">{val} {p.labels.of} {max}</span>
          </div>
        );
      }
      case 'select': {
        const dis = ro || !!f.derived;
        return (
          <div className="rv-sheet-field">{label(f)}
            <select className="rv-sheet-inp" aria-label={p.t(f.label)} value={str(v)} disabled={dis} onChange={e => set(f.id, e.target.value)}>
              {(f.options ?? []).map(o => <option key={o.value} value={o.value} disabled={optionVetoed(o.value, str(v), dis, x => allowed(f.id, x))}>{p.t(o.label)}</option>)}
            </select>
          </div>
        );
      }
      case 'health': {
        const opts = f.options ?? [];
        return (
          <div className="rv-sheet-field span">{label(f)}
            <div className="rv-sheet-health" role="radiogroup" aria-label={p.t(f.label)}>
              {opts.map((o, i) => (
                <button key={o.value} type="button" role="radio" aria-checked={str(v) === o.value} className={`rv-sheet-health-opt ${str(v) === o.value ? 'on' : ''}`} disabled={ro} onClick={() => set(f.id, o.value)}>
                  {p.icons?.health === 'moon-phase' ? <PhaseDisc fraction={opts.length > 1 ? i / (opts.length - 1) : 0} /> : <span className="rv-sheet-value">{i + 1}</span>}
                  <span>{p.t(o.label)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'stat': return <StatRow key={f.id} f={f} p={p} ro={ro} showActions={showActions} allowed={allowed} set={set} label={label} />;
      case 'image': {
        const url = str(v);
        const initials = str(p.data.name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div className="rv-sheet-field rv-sheet-image">
            <span className="rv-sheet-image-disc" aria-label={p.t(f.label)}>{url ? <img src={url} alt="" /> : initials}</span>
            {!ro && p.onImagePick && <button type="button" className="rv-sheet-btn" onClick={() => p.onImagePick?.(f.id)}>{p.labels.pick ?? p.t(f.label)}</button>}
            {/* No picker wired yet: say so rather than leave a disc the user pokes at. */}
            {!ro && !p.onImagePick && p.labels.soon && <span className="rv-sheet-caption">{p.labels.soon}</span>}
          </div>
        );
      }
      case 'list': return <ListField f={f} p={p} ro={ro} showActions={showActions} set={set} label={label} allowed={allowed} />;
      case 'table': return <TableField f={f} p={p} ro={ro} showActions={showActions} set={set} label={label} />;
    }
    return null;
  };

  return (
    <div className="rv-sheet">
      {sections.map(s => (
        <section key={s.id} className={`rv-sheet-section ${isWide(s) ? 'wide' : ''}`} data-section={s.id} aria-label={p.t(s.label)}>
          <header className="rv-sheet-section-head">
            <h3 className="rv-sheet-section-title">{p.t(s.label)}</h3>
            {sectionRef(s, p)}
          </header>
          <div className={`rv-sheet-fields ${s.layout ?? 'stack'}`}>
            {s.fields.map(f => <FieldWrap key={f.id}>{renderField(f)}</FieldWrap>)}
          </div>
          {p.extras?.[s.id]}
        </section>
      ))}
    </div>
  );
}

const FieldWrap = ({ children }: { children: ReactNode }) => <>{children}</>;

/** Section-level hint: «reglas · p.XX» from the first field carrying a `ref` when the section is a single list/table. */
function sectionRef(s: SectionDef, p: SheetProps): ReactNode {
  const f = s.fields.length === 1 && s.fields[0]?.ref && (s.fields[0].type === 'list' || s.fields[0].type === 'table') ? s.fields[0] : null;
  const r = f?.ref ? p.refText?.(f.ref) : null;
  return r ? <span className="rv-sheet-section-ref">{r.title} · {p.labels.manual} · p.{r.page}</span> : null;
}

function Label({ text, refKey, refText, manual, extra }: { text: string; refKey?: string | undefined; refText?: SheetProps["refText"] | undefined; manual: string; extra?: ReactNode | undefined }): JSX.Element {
  const r = refKey ? refText?.(refKey) ?? null : null;
  const id = useId();
  if (!r) return <span className="rv-sheet-label">{text}{extra}</span>;
  return (
    <span className="rv-sheet-label has-tip" tabIndex={0} aria-describedby={id} title={`${r.summary} · ${manual} · p.${r.page}`}>
      {text}<span className="rv-sheet-page">p.{r.page}</span>{extra}
      <span role="tooltip" id={id} className="rv-sheet-tip"><span className="rv-sheet-tip-head"><span>{r.title}</span><em>{manual} · p.{r.page}</em></span>{r.summary}</span>
    </span>
  );
}

function Counter({ value, min, max, labelText, disabled, allowed, onChange }: { value: number; min?: number | undefined; max?: number | undefined; labelText: string; disabled: boolean; allowed: (n: number) => boolean; onChange: (n: number) => void }): JSX.Element {
  const dec = value - 1, inc = value + 1;
  const canDec = !disabled && (min === undefined || dec >= min) && allowed(dec);
  const canInc = !disabled && (max === undefined || inc <= max) && allowed(inc);
  return (
    <span className="rv-sheet-counter" role="group" aria-label={labelText}>
      {!disabled && <button type="button" className="rv-sheet-btn" aria-label={`− ${labelText}`} disabled={!canDec} onClick={() => onChange(dec)}>−</button>}
      <span className="rv-sheet-value">{value}</span>
      {!disabled && <button type="button" className="rv-sheet-btn" aria-label={`+ ${labelText}`} disabled={!canInc} onClick={() => onChange(inc)}>+</button>}
    </span>
  );
}

type Shared = { f: FieldDef; p: SheetProps; ro: boolean; showActions: boolean; set: (id: string, v: unknown) => void; label: (f: Pick<FieldDef, 'label' | 'ref'>, extra?: ReactNode) => ReactNode };

/** A characteristic: icon · name · specialties · value · TIRAR n. Edit mode adds −/+ and specialty selects. */
function StatRow({ f, p, ro, showActions, allowed, set, label }: Shared & { allowed: (id: string, v: unknown) => boolean }): JSX.Element {
  const raw = p.data[f.id];
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : { value: num(raw, 1), specialties: [] };
  const value = num(o.value, 1);
  const specs = Array.isArray(o.specialties) ? o.specialties.filter((s): s is string => typeof s === 'string') : [];
  const specField = f.itemFields?.[0];
  const optLabel = (id: string) => specField?.options?.find(x => x.value === id)?.label;
  const setSpecs = (next: string[]) => set(f.id, { ...o, value, specialties: next });
  const pool = p.poolSize?.(f.id) ?? null;
  return (
    <div className="rv-sheet-stat" data-stat={f.id}>
      {p.icons?.stat === 'crescent' && <Crescent size={26} />}
      <div className="rv-sheet-stat-main">
        {label(f)}
        <div className="rv-sheet-stat-sub">
          {ro || !specField ? (specs.length ? specs.map(s => p.t(optLabel(s) ?? s)).join(' · ') : '—') : (
            <>
              {specs.map((s, i) => (
                <span key={`${s}-${i}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <select className="rv-sheet-inp" aria-label={`${p.t(f.label)} · ${p.t(specField.label)} ${i + 1}`} value={s} onChange={e => setSpecs(specs.map((x, j) => (j === i ? e.target.value : x)))}>
                    {(specField.options ?? []).map(op => <option key={op.value} value={op.value}>{p.t(op.label)}</option>)}
                  </select>
                  <button type="button" className="rv-sheet-x" aria-label={`${p.labels.remove} ${p.t(specField.label)} ${i + 1}`} onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>×</button>
                </span>
              ))}
              <select className="rv-sheet-inp" aria-label={`${p.labels.add} ${p.t(specField.label)} · ${p.t(f.label)}`} value="" onChange={e => { if (e.target.value) setSpecs([...specs, e.target.value]); }}>
                <option value="">+ {p.t(specField.label)}</option>
                {(specField.options ?? []).filter(op => !specs.includes(op.value)).map(op => <option key={op.value} value={op.value}>{p.t(op.label)}</option>)}
              </select>
            </>
          )}
        </div>
      </div>
      {ro ? <span className="rv-sheet-value big">{value}</span>
        : <Counter value={value} min={f.min} max={f.max} labelText={p.t(f.label)} disabled={false} allowed={n => allowed(f.id, { ...o, value: n, specialties: specs })} onChange={n => set(f.id, { ...o, value: n, specialties: specs })} />}
      {showActions && p.onAction && <button type="button" className="rv-sheet-btn gold" onClick={() => p.onAction?.('roll', f.id)}>{p.labels.roll}{pool !== null ? ` ${pool}` : ''}</button>}
    </div>
  );
}

/** Actions that apply to a list/table field: the declared `field.action` id or every ActionDef whose `appliesTo` is the field. */
const actionsFor = (f: FieldDef, actions: ActionDef[] | undefined): ActionDef[] => {
  if (!f.action || !actions) return [];
  const exact = actions.find(a => a.id === f.action);
  return exact ? [exact] : actions.filter(a => a.appliesTo === f.id);
};
const rowId = (r: Record<string, unknown>, i: number) => str(r.id) || String(i);
/**
 * React key of a list OR table row. NOT `rowId`: a blank row takes the first option of its select,
 * so two unfilled gifts (or two unfilled weapons, both `unarmed`) carry the SAME id and React then
 * treats them as one — "Encountered two children with the same key", which React documents as
 * unsupported: children may be duplicated or omitted (owner, 2026-08-19). Every mutation here is by
 * index (`patchRow`, the × button), so the index IS the row's identity.
 *
 * `rowId` stays for what it is actually about — the identity handed to `onAction` and used to look
 * a row up in a catalog — which is the row's game id, not its position.
 */
const rowKey = (r: Record<string, unknown>, i: number) => `${i}:${str(r.id)}`;
const blankRow = (defs: FieldDef[]): Record<string, unknown> => Object.fromEntries(defs.filter(d => !d.derived).map(d => [d.id, d.type === 'select' ? d.options?.[0]?.value ?? '' : d.type === 'counter' || d.type === 'number' ? d.min ?? 0 : d.type === 'text' ? '' : null]));

function ItemActions({ f, p, item, i, ro, showActions, list, set }: Shared & { item: Record<string, unknown>; i: number; list: Record<string, unknown>[] }): JSX.Element {
  const acts = actionsFor(f, p.actions);
  return (
    <span className="rv-sheet-item-actions">
      {showActions && p.onAction && acts.map(a => (
        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {a.cost && <span className="rv-sheet-item-cost">{p.t(a.cost)}</span>}
          <button type="button" className="rv-sheet-icon-btn" title={p.t(a.label)} aria-label={`${p.t(a.label)} · ${rowLabel(f, item, p)}`} onClick={() => p.onAction?.(a.id, rowId(item, i))}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">{a.icon}</span>
          </button>
        </span>
      ))}
      {!ro && <button type="button" className="rv-sheet-x" aria-label={`${p.labels.remove} · ${rowLabel(f, item, p)}`} onClick={() => set(f.id, list.filter((_, j) => j !== i))}>×</button>}
    </span>
  );
}
const rowLabel = (f: FieldDef, item: Record<string, unknown>, p: SheetProps): string => {
  const first = (f.itemFields ?? f.columns ?? [])[0];
  const v = first ? str(item[first.id]) : '';
  const opt = first?.options?.find(o => o.value === v);
  return opt ? p.t(opt.label) : v;
};

function ListField({ f, p, ro, showActions, set, label, allowed }: Shared & { allowed: (id: string, v: unknown) => boolean }): JSX.Element {
  const list = rows(p.data[f.id]);
  const defs = f.itemFields ?? [];
  const withRow = (i: number, k: string, v: unknown) => list.map((r, j) => (j === i ? { ...r, [k]: v } : r));
  const patchRow = (i: number, k: string, v: unknown) => set(f.id, withRow(i, k, v));
  const rowAllows = (i: number, k: string, v: unknown) => allowed(f.id, withRow(i, k, v));
  const canAdd = allowed(f.id, [...list, blankRow(defs)]);
  return (
    <div className="rv-sheet-field span">
      <div className="rv-sheet-list" role="list" aria-label={p.t(f.label)}>
        {list.map((item, i) => (
          <div key={rowKey(item, i)} className="rv-sheet-item" role="listitem">
            {p.icons?.stat === 'crescent' && <Crescent size={20} />}
            {defs.map(d => <Cell key={d.id} d={d} value={item[d.id]} ro={ro} p={p} allowed={v => rowAllows(i, d.id, v)} onChange={v => patchRow(i, d.id, v)} />)}
            <ItemActions f={f} p={p} item={item} i={i} ro={ro} showActions={showActions} list={list} set={set} label={label} />
          </div>
        ))}
      </div>
      {!ro && <button type="button" className="rv-sheet-btn rv-sheet-add" disabled={!canAdd} onClick={() => set(f.id, [...list, blankRow(defs)])}>+ {p.labels.add} · {p.t(f.label)}</button>}
    </div>
  );
}

function TableField({ f, p, ro, showActions, set, label }: Shared): JSX.Element {
  const list = rows(p.data[f.id]);
  const cols = f.columns ?? [];
  const catalog = p.catalogs?.[f.id] ?? [];
  const patchRow = (i: number, k: string, v: unknown) => set(f.id, list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const derivedCell = (row: Record<string, unknown>, c: FieldDef): string => {
    const own = row[c.id];
    if (own !== undefined && own !== null && own !== '') return str(own);
    const item = catalog.find(x => x.id === str(row.id));
    const v = item?.data?.[c.id];
    return v === undefined || v === null ? '—' : typeof v === 'string' ? p.t(v) : str(v);
  };
  return (
    <div className="rv-sheet-field span">
      <table className="rv-sheet-table" aria-label={p.t(f.label)}>
        <thead><tr>{cols.map(c => <th key={c.id} className={c.type === 'number' || c.type === 'counter' ? 'num' : ''}>{p.t(c.label)}</th>)}<th /></tr></thead>
        <tbody>
          {list.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {cols.map(c => <td key={c.id} className={c.type === 'number' || c.type === 'counter' ? 'num' : ''}>{c.derived ? derivedCell(row, c) : <Cell d={c} value={row[c.id]} ro={ro} p={p} onChange={v => patchRow(i, c.id, v)} />}</td>)}
              <td><ItemActions f={f} p={p} item={row} i={i} ro={ro} showActions={showActions} list={list} set={set} label={label} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!ro && <button type="button" className="rv-sheet-btn rv-sheet-add" onClick={() => set(f.id, [...list, blankRow(cols)])}>+ {p.labels.add} · {p.t(f.label)}</button>}
    </div>
  );
}

/** Inline editor for a list item / table cell (select · counter · number · text). */
function Cell({ d, value, ro, p, onChange, allowed = () => true }: { d: FieldDef; value: unknown; ro: boolean; p: SheetProps; onChange: (v: unknown) => void; allowed?: (v: unknown) => boolean }): JSX.Element {
  const dis = ro || !!d.derived;
  if (d.type === 'select') {
    if (dis) return <span>{p.t(d.options?.find(o => o.value === str(value))?.label ?? str(value))}</span>;
    return <select className="rv-sheet-inp" aria-label={p.t(d.label)} value={str(value)} onChange={e => onChange(e.target.value)}>{(d.options ?? []).map(o => <option key={o.value} value={o.value} disabled={optionVetoed(o.value, str(value), dis, allowed)}>{p.t(o.label)}</option>)}</select>;
  }
  if (d.type === 'counter') {
    if (value === null || value === undefined) return <span className="rv-sheet-caption">—</span>;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="rv-sheet-caption">{p.t(d.label)}</span><Counter value={num(value)} min={d.min} max={d.max} labelText={p.t(d.label)} disabled={dis} allowed={n => allowed(n)} onChange={onChange} /></span>;
  }
  if (d.type === 'number') return dis ? <span>{str(value)}</span> : <input type="number" className="rv-sheet-inp num" aria-label={p.t(d.label)} value={num(value)} min={d.min} max={d.max} onChange={e => onChange(Number(e.target.value))} />;
  return dis ? <span>{str(value)}</span> : <input className="rv-sheet-inp" aria-label={p.t(d.label)} value={str(value)} onChange={e => onChange(e.target.value)} />;
}

// ─── SVG primitives (PL/Creciente, PL/Salud) — colours from --sys-moon-* ─────
/**
 * The crescent, traced from the master (rolvium.pen `PL/Creciente` → `Luna`): the outline is the design's own path,
 * not an approximation with two arcs — the arc version had the wrong inner curve and no rim or shadow, which is what
 * made it read as a different moon.
 */
const CRESCENT_PATH =
  'M31 4.51c-3.8-2.7-8.47-3.91-13.12-3.39-4.64 0.52-8.93 2.73-12.04 6.22-3.12 3.48-4.84 7.99-4.84 12.66 0 4.67 1.72 9.18 4.84 12.66 3.11 3.49 7.4 5.7 12.04 6.22 4.65 0.52 9.32-0.69 13.13-3.39-3.81 0.99-7.85 0.53-11.35-1.27-3.49-1.81-6.2-4.84-7.61-8.51-1.4-3.68-1.4-7.74 0-11.42 1.41-3.67 4.12-6.7 7.61-8.51 3.5-1.8 7.54-2.26 11.35-1.27z';

export function Crescent({ size = 26 }: { size?: number }): JSX.Element {
  const uid = useId();
  return (
    <svg className="rv-sheet-svg" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" overflow="visible">
      <defs>
        <radialGradient id={`rvc${uid}`} cx="0.28" cy="0.25" r="0.75">
          <stop offset="0%" stopColor="var(--sys-moon-hi)" />
          <stop offset="50%" stopColor="var(--sys-moon-mid)" />
          <stop offset="100%" stopColor="var(--sys-moon-lo)" />
        </radialGradient>
        <filter id={`rvcs${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.25" floodColor="var(--sys-ink)" floodOpacity="0.35" />
        </filter>
      </defs>
      <path d={CRESCENT_PATH} fill={`url(#rvc${uid})`} stroke="var(--sys-moon-mid)" strokeOpacity="0.4" strokeWidth="0.6"
        strokeLinejoin="round" filter={`url(#rvcs${uid})`} />
    </svg>
  );
}
/** Disc whose dark share grows with `fraction` (0 = full light, 1 = full dark). */
export function PhaseDisc({ fraction, size = 40 }: { fraction: number; size?: number }): JSX.Element {
  const uid = useId();
  const f = Math.max(0, Math.min(1, fraction));
  const bulge = Math.abs(1 - 2 * f) * 20; // inner terminator radius
  const path = f <= 0 ? '' : f >= 1 ? 'M20 0 A20 20 0 1 1 20 40 A20 20 0 1 1 20 0 Z' : `M20 0 A20 20 0 0 1 20 40 A${bulge} 20 0 0 ${f < 0.5 ? 0 : 1} 20 0 Z`;
  return (
    <svg className="rv-sheet-svg rv-sheet-disc" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs><radialGradient id={`rvd${uid}`} cx="0.3" cy="0.3" r="0.8"><stop offset="0%" stopColor="var(--sys-paper-hi)" /><stop offset="100%" stopColor="var(--sys-moon-hi)" /></radialGradient></defs>
      <circle cx="20" cy="20" r="19" fill={`url(#rvd${uid})`} stroke="var(--sys-line)" strokeWidth="0.5" />
      {path && <path d={path} fill="var(--sys-moon-lo)" />}
    </svg>
  );
}
