/** Neutral SVG primitives used by the table; colours come from the system theme vars. */
export function Crescent({ size = 28 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <radialGradient id="tb-crescent-g" cx="0.28" cy="0.25" r="0.8">
          <stop offset="0%" stopColor="var(--sys-moon-hi)" /><stop offset="50%" stopColor="var(--sys-moon-mid)" /><stop offset="100%" stopColor="var(--sys-moon-lo)" />
        </radialGradient>
        <filter id="tb-crescent-s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="var(--sys-ink)" floodOpacity="0.35" /></filter>
      </defs>
      <path filter="url(#tb-crescent-s)" fill="url(#tb-crescent-g)" d="M31 4.51 A19 19 0 1 0 31 35.49 A16 16 0 0 1 31 4.51 Z" />
    </svg>
  );
}
