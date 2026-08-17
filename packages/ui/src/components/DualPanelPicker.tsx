import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DualPanelItem {
  value: string;
  label: string;
  hint?: string;
}

export interface DualPanelPickerProps {
  /** Section label shown above the panels. */
  label: string;
  /** Full catalog of items (available + selected). */
  allItems: DualPanelItem[];
  /** Currently selected values. */
  selected: string[];
  /** Called when an item is moved to the "selected" panel. */
  onAdd: (value: string) => void;
  /** Called when an item is moved back to "available". */
  onRemove: (value: string) => void;
  /**
   * Panels GROW past the default 280px cap to use the parent's free height, so
   * long catalogs stop scrolling inside a small box when the page has room.
   *
   * ⚠️ It can only ever ENLARGE: 280px stays the floor. Do not "simplify" this
   * to `minHeight: 0`. Measured in a real browser (Chrome headless, harness
   * below), without the floor this prop does the OPPOSITE of its purpose below
   * **~916px of viewport** — that is the break-even where the panel dips under
   * the plain 280 box; at 819px the list is 112px (vs 209), and by 713px it has
   * collapsed to 8px. Why: a sibling with a fixed basis keeps its full height,
   * while this panel (`flex: 1` ⇒ basis 0) has a scaled shrink factor of
   * `1 × 0 = 0` and therefore absorbs *all* of the scarcity. The panel you
   * wanted bigger is the one flex starves.
   *
   * Opt-in on purpose: the parent must be a flex column with a resolved height
   * (and `minHeight: 0`), and must stay scrollable so the floor has somewhere to
   * overflow to. Default keeps the plain 280px cap, so existing consumers are
   * untouched.
   */
  fillHeight?: boolean;
  /**
   * Renders `hint` in its OWN column, with the label in a fixed-width column of
   * this many px, so hints line up and read as a column. Without it the hint
   * stays inline, right-aligned next to the label.
   *
   * Opt-in: it only pays off with long descriptions (the roles editor). With
   * short hints like "(subtarea)" the inline form is tighter.
   */
  labelColumnWidth?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Two-panel picker with drag-and-drop and click-to-move.
 * Left panel shows available items, right panel shows selected items.
 * Used for selecting item types, statuses, etc.
 */
export function DualPanelPicker({
  label, allItems, selected, onAdd, onRemove, fillHeight = false, labelColumnWidth,
}: DualPanelPickerProps) {
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [searchAvail, setSearchAvail] = useState('');
  const [searchSel, setSearchSel] = useState('');

  // Deduplicate items by value (sources may repeat the same value)
  const uniqueItems = (() => {
    const seen = new Set<string>();
    return allItems.filter(it => seen.has(it.value) ? false : (seen.add(it.value), true));
  })();

  const available = uniqueItems.filter(it => !selected.includes(it.value));
  const selectedItems = selected.map(v => uniqueItems.find(it => it.value === v)).filter(Boolean) as DualPanelItem[];

  const filteredAvail = searchAvail
    ? available.filter(it => it.label.toLowerCase().includes(searchAvail.toLowerCase()))
    : available;
  const filteredSel = searchSel
    ? selectedItems.filter(it => it.label.toLowerCase().includes(searchSel.toLowerCase()))
    : selectedItems;

  const panelStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, background: 'var(--sf2)', borderRadius: 8,
    border: '1px solid var(--bd)', display: 'flex', flexDirection: 'column',
    // fillHeight: 280 pasa de TOPE a PISO — el panel crece con el contenedor
    // pero nunca queda más chico que la caja fija que reemplaza (ver el prop).
    ...(fillHeight ? { minHeight: 280 } : { maxHeight: 280 }),
    overflow: 'hidden',
  };
  const headerStyle: React.CSSProperties = {
    padding: '8px 10px', borderBottom: '1px solid var(--bd)',
    fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--tx3)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  };
  const listStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 4 };
  const itemBase: React.CSSProperties = {
    display: 'flex', gap: 6, padding: '5px 8px',
    // Con la descripción en columna la fila puede tener 2 líneas → alinear
    // arriba, si no el label queda flotando respecto de su descripción.
    alignItems: labelColumnWidth ? 'flex-start' : 'center',
    borderRadius: 6, fontSize: 'var(--fs-xs)', cursor: 'grab', transition: 'background .1s',
    fontFamily: 'inherit', border: 'none', width: '100%', textAlign: 'left',
  };
  const searchStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', fontSize: 'var(--fs-2xs)', fontFamily: 'inherit',
    background: 'var(--sf)', border: '1px solid var(--bd)',
    borderRadius: 4, color: 'var(--tx)', outline: 'none',
  };
  const hintStyle: React.CSSProperties = { fontSize: 'var(--fs-2xs)', color: 'var(--tx3)' };

  /**
   * Label + hint de una fila. Con `labelColumnWidth` van en dos columnas (el
   * label en ancho fijo → todas las descripciones arrancan en la misma x); sin
   * él, el hint queda en línea a la derecha, como siempre.
   */
  const itemContent = (it: DualPanelItem) => (labelColumnWidth ? (
    <>
      <span style={{ width: labelColumnWidth, flexShrink: 0, lineHeight: 1.35 }}>{it.label}</span>
      <span style={{ ...hintStyle, flex: 1, minWidth: 0, lineHeight: 1.35 }}>{it.hint}</span>
    </>
  ) : (
    <>
      <span style={{ flex: 1 }}>{it.label}</span>
      {it.hint && <span style={hintStyle}>{it.hint}</span>}
    </>
  ));

  return (
    <div style={fillHeight
      ? { marginBottom: 14, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }
      : { marginBottom: 14 }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, ...(fillHeight ? { flex: 1, minHeight: 0 } : {}) }}>
        {/* Available */}
        <div style={panelStyle}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (dragItem && selected.includes(dragItem)) { onRemove(dragItem); setDragItem(null); } }}>
          <div style={headerStyle}>
            <span>Disponibles ({available.length})</span>
          </div>
          <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--bd)' }}>
            <input placeholder="Buscar…" value={searchAvail} onChange={e => setSearchAvail(e.target.value)} style={searchStyle} />
          </div>
          <div style={listStyle}>
            {filteredAvail.map(it => (
              <div key={it.value} draggable
                onDragStart={() => setDragItem(it.value)}
                onClick={() => onAdd(it.value)}
                style={{ ...itemBase, background: 'transparent', color: 'var(--tx)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(79,110,247,.08)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}>
                <span style={hintStyle}>⠿</span>
                {itemContent(it)}
                <span style={{ fontSize: 'var(--fs-2xs)', color: '#4f6ef7' }}>→</span>
              </div>
            ))}
            {filteredAvail.length === 0 && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', textAlign: 'center', padding: 12 }}>
                {available.length === 0 ? 'Todos seleccionados' : 'Sin resultados'}
              </div>
            )}
          </div>
        </div>

        {/* Selected */}
        <div style={{ ...panelStyle, borderColor: selected.length ? '#4f6ef7' : 'var(--bd)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (dragItem && !selected.includes(dragItem)) { onAdd(dragItem); setDragItem(null); } }}>
          <div style={{ ...headerStyle, color: '#4f6ef7' }}>
            <span>Seleccionados ({selected.length})</span>
          </div>
          <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--bd)' }}>
            <input placeholder="Buscar…" value={searchSel} onChange={e => setSearchSel(e.target.value)} style={searchStyle} />
          </div>
          <div style={listStyle}>
            {filteredSel.map(it => (
              <div key={it.value} draggable
                onDragStart={() => setDragItem(it.value)}
                onClick={() => onRemove(it.value)}
                style={{ ...itemBase, background: 'rgba(79,110,247,.08)', color: 'var(--tx)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,.08)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(79,110,247,.08)')}>
                <span style={hintStyle}>⠿</span>
                {itemContent(it)}
                <span style={{ fontSize: 'var(--fs-2xs)', color: '#ef4444' }}>←</span>
              </div>
            ))}
            {filteredSel.length === 0 && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', textAlign: 'center', padding: 12 }}>
                {selected.length === 0 ? 'Arrastra o haz click para añadir' : 'Sin resultados'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
