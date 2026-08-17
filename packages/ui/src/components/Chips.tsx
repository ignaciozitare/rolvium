import type { CSSProperties, ReactNode } from 'react';

const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r)', fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' };

/** rolvium.pen `Chip/System`: Material icon + system name on accent-dim. `muted` for not-installed systems. */
export function SystemChip({ children, icon = 'auto_stories', muted = false, style }: { children: ReactNode; icon?: string; muted?: boolean; style?: CSSProperties }) {
  return (
    <span style={{ ...base, background: muted ? 'var(--sf2)' : 'var(--ac-dim)', color: muted ? 'var(--tx3)' : 'var(--ac)', ...style }}>
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{muted ? 'schedule' : icon}</span>{children}
    </span>
  );
}

export type StatusTone = 'green' | 'purple' | 'amber' | 'red' | 'gray';
const TONES: Record<StatusTone, [string, string]> = {
  green: ['var(--green-dim)', 'var(--green)'], purple: ['var(--purple-dim)', 'var(--purple)'], amber: ['var(--amber-dim)', 'var(--amber)'],
  red: ['var(--red-dim)', 'var(--red)'], gray: ['var(--sf3)', 'var(--tx3)'],
};
/** rolvium.pen `Chip/Status`: dot + label on tone-dim. */
export function StatusChip({ children, tone = 'green', style }: { children: ReactNode; tone?: StatusTone; style?: CSSProperties }) {
  const [bg, fg] = TONES[tone];
  return (
    <span style={{ ...base, background: bg, color: fg, ...style }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />{children}
    </span>
  );
}
