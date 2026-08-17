import { useState } from 'react';

/** Optional UI labels. i18n-agnostic by convention (packages/ui has no i18n
 *  dependency) — callers pass translated strings; sensible English defaults. */
export interface IconPickerLabels {
  search?: string;
  iconColor?: string;
  colorDefault?: string;
  colorGreen?: string;
  colorAmber?: string;
  colorRed?: string;
  colorPurple?: string;
  colorGray?: string;
}

export interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  size?: number;
  /** Current icon color (CSS value). Null/undefined falls back to var(--ac). */
  color?: string | null;
  /** Called when the user picks a color from the swatch row. Null = reset to default. */
  onColorChange?: (color: string | null) => void;
  labels?: IconPickerLabels;
}

const DEFAULT_LABELS: Required<IconPickerLabels> = {
  search: 'Search icons…',
  iconColor: 'Icon color',
  colorDefault: 'Default',
  colorGreen: 'Green',
  colorAmber: 'Amber',
  colorRed: 'Red',
  colorPurple: 'Purple',
  colorGray: 'Gray',
};

/** Curated palette for icon color. Each swatch stores the CSS var reference
 *  that drives the icon fill; null = default accent (theme-aware). */
const COLOR_SWATCHES: Array<{ value: string | null; varName: string; labelKey: keyof IconPickerLabels }> = [
  { value: null,            varName: 'var(--ac)',     labelKey: 'colorDefault' },
  { value: 'var(--green)',  varName: 'var(--green)',  labelKey: 'colorGreen' },
  { value: 'var(--amber)',  varName: 'var(--amber)',  labelKey: 'colorAmber' },
  { value: 'var(--red)',    varName: 'var(--red)',    labelKey: 'colorRed' },
  { value: 'var(--purple)', varName: 'var(--purple)', labelKey: 'colorPurple' },
  { value: 'var(--tx3)',    varName: 'var(--tx3)',    labelKey: 'colorGray' },
];

/**
 * Curated icon library from Material Symbols Outlined — a hand-picked subset
 * useful for task types and project entities. Click the trigger to open a
 * popover grid and pick one. Shared component (was vector-logic-local).
 */
const ICONS = [
  'priority_high', 'keyboard_double_arrow_up', 'keyboard_arrow_up',
  'drag_handle', 'remove', 'keyboard_arrow_down', 'keyboard_double_arrow_down',
  'bolt', 'whatshot', 'local_fire_department', 'crisis_alert', 'report',
  'task_alt', 'check_circle', 'radio_button_unchecked', 'flag',
  'star', 'bookmark', 'label', 'category', 'inventory_2',
  'bug_report', 'pest_control', 'warning', 'error', 'verified',
  'lightbulb', 'rocket_launch', 'auto_awesome', 'construction', 'build',
  'extension', 'api', 'memory', 'precision_manufacturing', 'developer_mode',
  'code', 'terminal', 'integration_instructions', 'commit', 'merge',
  'fork_right', 'call_merge', 'difference', 'data_object', 'schema',
  'design_services', 'palette', 'brush', 'draw', 'color_lens',
  'view_quilt', 'dashboard', 'view_kanban', 'view_timeline', 'view_module',
  'description', 'article', 'edit_note', 'edit_document', 'book',
  'menu_book', 'auto_stories', 'sticky_note_2', 'note',
  'person', 'group', 'groups', 'support_agent', 'forum', 'chat',
  'mark_unread_chat_alt', 'rate_review', 'reviews',
  'schedule', 'event', 'calendar_month', 'calendar_today', 'today',
  'history', 'hourglass_top', 'av_timer', 'timer',
  'payments', 'sell', 'shopping_cart', 'receipt_long', 'request_quote',
  'attach_money', 'savings', 'credit_card',
  'mail', 'send', 'inbox', 'outbox', 'drafts', 'forward_to_inbox',
  'analytics', 'monitoring', 'insights', 'trending_up', 'leaderboard',
  'pie_chart', 'bar_chart', 'show_chart',
  'lock', 'security', 'shield', 'gpp_good', 'admin_panel_settings',
  'verified_user', 'fingerprint', 'vpn_key',
  'database', 'storage', 'cloud', 'folder', 'snippet_folder', 'topic',
  'flash_on', 'campaign',
  'celebration', 'workspace_premium', 'military_tech', 'emoji_events',
];

export function IconPicker({ value, onChange, size = 24, color, onColorChange, labels }: IconPickerProps) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search ? ICONS.filter(i => i.toLowerCase().includes(search.toLowerCase())) : ICONS;
  const effectiveColor = color || 'var(--ac)';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: size + 16, height: size + 16, borderRadius: 8,
          background: 'var(--sf3)', border: '1px solid var(--bd)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: effectiveColor, fontFamily: 'inherit',
          transition: 'all .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ac)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}>
        <span className="material-symbols-outlined" style={{ fontSize: size }}>{value || 'add'}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 101,
            width: 320, maxHeight: 360, overflow: 'hidden',
            background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: 10, borderBottom: '1px solid var(--bd)' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} autoFocus placeholder={L.search}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                  background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--tx)', outline: 'none',
                }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
              {filtered.map(name => {
                const selected = value === name;
                return (
                  <button key={name} type="button" title={name}
                    onClick={() => { onChange(name); setOpen(false); }}
                    style={{
                      width: 34, height: 34, borderRadius: 6,
                      background: selected ? 'var(--ac-dim)' : 'transparent',
                      border: selected ? '1px solid var(--ac)' : '1px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: selected ? effectiveColor : 'var(--tx2)', fontFamily: 'inherit', transition: 'all .12s',
                    }}
                    onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = 'var(--sf2)'; e.currentTarget.style.color = 'var(--tx)'; } }}
                    onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tx2)'; } }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-md)' }}>{name}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1', fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', textAlign: 'center', padding: '20px 0' }}>
                  No icons match "{search}"
                </div>
              )}
            </div>

            {onColorChange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--bd)', background: 'var(--sf2)' }}>
                <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '.08em', color: 'var(--tx3)', textTransform: 'uppercase' }}>{L.iconColor}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {COLOR_SWATCHES.map(sw => {
                    const active = (color ?? null) === sw.value;
                    return (
                      <button key={sw.labelKey} type="button" title={L[sw.labelKey]}
                        onClick={() => onColorChange(sw.value)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', background: sw.varName,
                          border: active ? '2px solid var(--tx)' : '2px solid transparent',
                          cursor: 'pointer', padding: 0, boxShadow: active ? '0 0 0 2px var(--bg)' : 'none', transition: 'all .12s',
                        }} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
