/**
 * DataTable — a table whose columns can be reordered (drag the ⠿ handle) and
 * resized (drag the header's right edge; double-click = auto). Controlled: the
 * parent owns `order` + `widths` and persists them wherever it wants.
 *
 * Sorting (opt-in via `sortable`): clicking a column title cycles asc → desc →
 * none and the table sorts its rows (stable; missing values last). Controlled
 * (`sort`/`onSortChange`) or self-managed. Columns opt out with
 * `sortable: false`; custom keys via `sortValue`. Tables that already sort
 * externally keep using `onHeaderClick` and simply don't set `sortable`.
 *
 * Pagination (opt-in via `pageSize`): slices rows and renders a footer with a
 * range summary + prev/next. Self-managed page or controlled via
 * `page`/`onPageChange`. The summary text is i18n-agnostic (`pageSummary`).
 *
 * Migration-friendly: the reorder handle is SEPARATE from the header label, so
 * the header click can still sort (`onHeaderClick`). Style overrides
 * (`headerStyle`/`headerCellStyle`/`cellStyle`/`stickyHeader`) + per-column
 * `render`/`header` let a migrated table keep its exact look while gaining
 * reorder + resize. Carbon Logic / CSS vars, light-dark safe.
 */
import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';

/**
 * Resize affordance: a divider line that stays invisible until you hover a
 * column header (so the table keeps its clean, line-free look at rest), then
 * shows where to grab and brightens to the accent over the grip itself.
 */
const DT_RESIZE_CSS = `
.dt-resize-grip{position:absolute;right:0;top:0;bottom:0;width:9px;cursor:col-resize;touch-action:none;display:flex;justify-content:flex-end;align-items:center}
.dt-resize-line{width:2px;height:55%;border-radius:2px;background:var(--bd2);opacity:0;transition:opacity .12s ease,background .12s ease,height .12s ease}
.dt-col-head:hover .dt-resize-line{opacity:.6}
.dt-resize-grip:hover .dt-resize-line{opacity:1;height:100%;background:var(--ac)}
`;

export interface DataTableColumn {
  id: string;
  header: ReactNode;
  /** Cell renderer; defaults to String(row[id]). */
  render?: (row: Record<string, unknown>) => ReactNode;
  minWidth?: number;
  align?: 'left' | 'right';
  /** Opt this column out of sorting when the table is `sortable`. */
  sortable?: boolean;
  /** Value to sort by; defaults to row[id]. */
  sortValue?: (row: Record<string, unknown>) => unknown;
}

export interface DataTableSort { id: string; dir: 'asc' | 'desc' }

interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  getRowKey?: (row: Record<string, unknown>, i: number) => string | number;
  /** Optional per-row `data-testid` — lets a migrated table keep its exact row selectors. */
  getRowTestId?: (row: Record<string, unknown>, i: number) => string | undefined;
  order?: string[];
  onOrderChange?: (next: string[]) => void;
  widths?: Record<string, number>;
  onWidthsChange?: (next: Record<string, number>) => void;
  /** Header click (e.g. to sort externally). The reorder handle is separate, so this fires only on the label. */
  onHeaderClick?: (id: string) => void;
  /** Row click (e.g. to open a detail). Cells with their own handlers should stopPropagation.
   *  With `sortable`/`pageSize` active, `i` is the index within the VISIBLE (sorted, paged) rows. */
  onRowClick?: (row: Record<string, unknown>, i: number) => void;
  empty?: ReactNode;
  reorderable?: boolean;
  resizable?: boolean;
  /** Built-in sorting: click a column title to cycle asc → desc → none. */
  sortable?: boolean;
  /** Controlled sort state; omit to let the table manage it. `null` = unsorted. */
  sort?: DataTableSort | null;
  onSortChange?: (next: DataTableSort | null) => void;
  /** Initial sort when self-managed. */
  defaultSort?: DataTableSort | null;
  /** Rows per page; unset = no pagination. Footer shows only when rows overflow one page. */
  pageSize?: number;
  /** Controlled page (0-based); omit to let the table manage it. */
  page?: number;
  onPageChange?: (next: number) => void;
  /** Range summary for the pagination footer. Default: `${from}–${to} / ${total}` (language-neutral). */
  pageSummary?: (from: number, to: number, total: number) => ReactNode;
  /** Tooltips for the pager buttons. Pass already-translated strings; omit for none. */
  prevPageTitle?: string;
  nextPageTitle?: string;
  /** Tooltip on the resize grip. Pass an already-translated string (the
   *  component is i18n-agnostic); omit it to render no tooltip. */
  resizeTitle?: string;
  /** Sticky header (needs a scrolling container around the table). */
  stickyHeader?: boolean;
  /** Style overrides to preserve a migrated table's look. */
  headerStyle?: CSSProperties;     // header row
  headerCellStyle?: CSSProperties; // each th
  cellStyle?: CSSProperties;       // each td
  rowStyle?: CSSProperties;        // each tr
  rowClassName?: string;           // each tr (e.g. for hover CSS)
  containerStyle?: CSSProperties;  // outer wrapper (override the default boxed look)
  testIdPrefix?: string;
}

/** Missing values last regardless of direction; numbers numerically, rest as locale text. */
function compareCells(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined || a === '';
  const bNull = b === null || b === undefined || b === '';
  if (aNull || bNull) return aNull && bNull ? 0 : aNull ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable({
  columns, rows, getRowKey, getRowTestId, order, onOrderChange, widths, onWidthsChange, onHeaderClick, onRowClick,
  empty, reorderable = true, resizable = true, resizeTitle,
  sortable = false, sort, onSortChange, defaultSort = null,
  pageSize, page, onPageChange, pageSummary, prevPageTitle, nextPageTitle,
  stickyHeader = false,
  headerStyle, headerCellStyle, cellStyle, rowStyle, rowClassName, containerStyle, testIdPrefix = 'dt',
}: DataTableProps) {
  const byId = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c])), [columns]);
  const cols: DataTableColumn[] = useMemo(() => {
    if (!order) return columns;
    const ordered = order.map(id => byId[id]).filter((c): c is DataTableColumn => Boolean(c));
    for (const c of columns) if (!order.includes(c.id)) ordered.push(c);
    return ordered;
  }, [columns, order, byId]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startW: number } | null>(null);
  const [draftWidths, setDraftWidths] = useState<Record<string, number> | null>(null);
  const effWidths = draftWidths ?? widths ?? {};

  // ── sort (controlled with self-managed fallback) ──
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(defaultSort);
  const effSort = sort !== undefined ? sort : internalSort;
  const colSortable = (c: DataTableColumn) => sortable && c.sortable !== false;

  // ── page (controlled with self-managed fallback) ──
  const [internalPage, setInternalPage] = useState(0);
  const rawPage = page !== undefined ? page : internalPage;

  const setSort = (next: DataTableSort | null) => {
    if (sort === undefined) setInternalSort(next);
    onSortChange?.(next);
    // A new order makes the current page meaningless — go back to the first.
    if (page === undefined) setInternalPage(0);
    else if (rawPage !== 0) onPageChange?.(0);
  };

  const headerClick = (c: DataTableColumn) => {
    onHeaderClick?.(c.id);
    if (!colSortable(c)) return;
    setSort(effSort?.id !== c.id ? { id: c.id, dir: 'asc' } : effSort.dir === 'asc' ? { id: c.id, dir: 'desc' } : null);
  };

  const sortedRows = useMemo(() => {
    if (!sortable || !effSort) return rows;
    const col = byId[effSort.id];
    if (!col) return rows;
    const dir = effSort.dir === 'asc' ? 1 : -1;
    const value = (r: Record<string, unknown>) => (col.sortValue ? col.sortValue(r) : r[effSort.id]);
    const missing = (v: unknown) => v === null || v === undefined || v === '';
    return rows
      .map((r, i) => [r, i] as const)
      .sort((a, b) => {
        const va = value(a[0]), vb = value(b[0]);
        // Missing values sink to the bottom regardless of direction — never `* dir`.
        if (missing(va) !== missing(vb)) return missing(va) ? 1 : -1;
        const cmp = compareCells(va, vb);
        return cmp !== 0 ? cmp * dir : a[1] - b[1]; // stable
      })
      .map(([r]) => r);
  }, [rows, sortable, effSort, byId]);

  const total = sortedRows.length;
  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const effPage = Math.min(Math.max(0, rawPage), pageCount - 1);
  const visibleRows = pageSize ? sortedRows.slice(effPage * pageSize, (effPage + 1) * pageSize) : sortedRows;
  const goToPage = (next: number) => {
    if (page === undefined) setInternalPage(next);
    onPageChange?.(next);
  };

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) => {
      const dx = e.clientX - resizing.startX;
      const min = byId[resizing.id]?.minWidth ?? 60;
      setDraftWidths(d => ({ ...(d ?? widths ?? {}), [resizing.id]: Math.max(min, Math.round(resizing.startW + dx)) }));
    };
    const up = () => { setDraftWidths(d => { if (d) onWidthsChange?.(d); return null; }); setResizing(null); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [resizing, widths, byId, onWidthsChange]);

  const reorder = () => {
    if (!dragId || !overId || dragId === overId) { setDragId(null); setOverId(null); return; }
    const ids = cols.map(c => c.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(overId);
    const next = [...ids];
    const [m] = next.splice(from, 1);
    if (m !== undefined) next.splice(to, 0, m);
    onOrderChange?.(next);
    setDragId(null); setOverId(null);
  };

  const sizeStyle = (c: DataTableColumn): CSSProperties => {
    const w = effWidths[c.id];
    return w ? { width: w, flexShrink: 0, flexGrow: 0 } : { flex: 1, minWidth: c.minWidth ?? 80 };
  };
  const baseCell: CSSProperties = { padding: '8px 12px', fontSize: 'var(--fs-2xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const pagerBtn = (disabled: boolean): CSSProperties => ({
    width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--sf2)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: disabled ? 'var(--tx-off)' : 'var(--tx)', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1, padding: 0,
  });

  const from = pageSize && total > 0 ? effPage * pageSize + 1 : 0;
  const to = pageSize ? Math.min(total, (effPage + 1) * pageSize) : total;

  return (
    <div data-testid={`${testIdPrefix}-table`} style={{ borderRadius: 8, overflow: 'auto', border: '1px solid var(--bd)', ...containerStyle }}>
      <style>{DT_RESIZE_CSS}</style>
      {/* header */}
      <div style={{ display: 'flex', background: 'var(--sf2)', minWidth: 'fit-content', position: stickyHeader ? 'sticky' : undefined, top: stickyHeader ? 0 : undefined, zIndex: stickyHeader ? 1 : undefined, ...headerStyle }}>
        {cols.map(c => (
          <div
            key={c.id}
            className="dt-col-head"
            data-testid={`${testIdPrefix}-h-${c.id}`}
            onDragOver={reorderable ? (e: DragEvent) => { e.preventDefault(); setOverId(c.id); } : undefined}
            onDrop={reorderable ? reorder : undefined}
            style={{
              ...baseCell, ...sizeStyle(c), ...headerCellStyle,
              position: 'relative', display: 'flex', alignItems: 'center', gap: 4,
              fontWeight: 700, letterSpacing: '0.5px', color: 'var(--tx3)',
              justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
              background: overId === c.id ? 'var(--ac-dim)' : undefined,
            }}
          >
            {reorderable && (
              <span
                data-testid={`${testIdPrefix}-drag-${c.id}`}
                className="material-symbols-outlined"
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragEnd={reorder}
                style={{ fontSize: 14, color: 'var(--tx3)', cursor: 'grab', opacity: 0.5, flexShrink: 0 }}
              >drag_indicator</span>
            )}
            <span
              data-testid={`${testIdPrefix}-label-${c.id}`}
              onClick={onHeaderClick || colSortable(c) ? () => headerClick(c) : undefined}
              style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                cursor: onHeaderClick || colSortable(c) ? 'pointer' : 'default',
                textAlign: c.align === 'right' ? 'right' : 'left',
                color: effSort?.id === c.id && colSortable(c) ? 'var(--ac)' : undefined,
              }}
            >{c.header}</span>
            {colSortable(c) && effSort?.id === c.id && (
              <span
                data-testid={`${testIdPrefix}-sort-${c.id}`}
                className="material-symbols-outlined"
                style={{ fontSize: 'var(--icon-xs)', color: 'var(--ac)', flexShrink: 0 }}
              >{effSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
            )}
            {resizable && (
              <span
                className="dt-resize-grip"
                data-testid={`${testIdPrefix}-resize-${c.id}`}
                title={resizeTitle}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setResizing({ id: c.id, startX: e.clientX, startW: effWidths[c.id] ?? (e.currentTarget.parentElement?.getBoundingClientRect().width || 120) }); }}
                onDoubleClick={(e) => { e.stopPropagation(); const next = { ...effWidths }; delete next[c.id]; onWidthsChange?.(next); }}
              >
                <span className="dt-resize-line" />
              </span>
            )}
          </div>
        ))}
      </div>
      {/* body */}
      {total === 0 ? (
        <div style={{ padding: 14, color: 'var(--tx3)', fontSize: 'var(--fs-2xs)' }}>{empty}</div>
      ) : (
        visibleRows.map((r, i) => (
          <div
            key={getRowKey ? getRowKey(r, i) : i}
            data-testid={getRowTestId?.(r, i)}
            className={rowClassName}
            onClick={onRowClick ? () => onRowClick(r, i) : undefined}
            style={{ display: 'flex', borderTop: '1px solid var(--sf2)', minWidth: 'fit-content', cursor: onRowClick ? 'pointer' : undefined, ...rowStyle }}
          >
            {cols.map(c => (
              <div key={c.id} style={{ ...baseCell, ...sizeStyle(c), color: 'var(--tx)', textAlign: c.align ?? 'left', ...cellStyle }}>
                {c.render ? c.render(r) : String(r[c.id] ?? '—')}
              </div>
            ))}
          </div>
        ))
      )}
      {/* pagination footer — only when the rows overflow one page */}
      {pageSize !== undefined && total > pageSize && (
        <div
          data-testid={`${testIdPrefix}-pager`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--sf2)', minWidth: 'fit-content' }}
        >
          <span data-testid={`${testIdPrefix}-pager-summary`} style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)' }}>
            {pageSummary ? pageSummary(from, to, total) : `${from}–${to} / ${total}`}
          </span>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <button
              type="button"
              data-testid={`${testIdPrefix}-pager-prev`}
              title={prevPageTitle}
              aria-label={prevPageTitle}
              disabled={effPage === 0}
              onClick={() => goToPage(effPage - 1)}
              style={pagerBtn(effPage === 0)}
            ><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>chevron_left</span></button>
            <button
              type="button"
              data-testid={`${testIdPrefix}-pager-next`}
              title={nextPageTitle}
              aria-label={nextPageTitle}
              disabled={effPage >= pageCount - 1}
              onClick={() => goToPage(effPage + 1)}
              style={pagerBtn(effPage >= pageCount - 1)}
            ><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>chevron_right</span></button>
          </span>
        </div>
      )}
    </div>
  );
}
