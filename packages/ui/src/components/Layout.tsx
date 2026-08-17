import type { CSSProperties, ReactNode } from 'react';

/** rolvium.pen "Section Head": ALL-CAPS title followed by a hairline rule. */
export function SectionTitle({ children, id, style }: { children: ReactNode; id?: string; style?: CSSProperties }) {
  return (
    <h2 id={id} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px', fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx2)', ...style }}>
      {children}<span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
    </h2>
  );
}

/** rolvium.pen "Page Head": display title + subtitle + actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
      <div>
        <h1 className="rv-page-title" style={{ marginBottom: 4 }}>{title}</h1>
        {subtitle && <p className="rv-page-sub" style={{ marginBottom: 0 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
    </header>
  );
}

/** rolvium.pen "Vacío/…" cards: icon disc + title + description + actions, centred. */
export function EmptyState({ icon, title, description, actions, tone = 'accent' }: { icon: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; tone?: 'accent' | 'red' }) {
  const [bg, fg] = tone === 'red' ? ['var(--red-dim)', 'var(--red)'] : ['var(--ac-dim)', 'var(--ac)'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '40px 32px' }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }} aria-hidden="true">{icon}</span>
      </span>
      <h3 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--tx)' }}>{title}</h3>
      {description && <p style={{ margin: 0, fontSize: 'var(--fs-xs)', lineHeight: 'var(--lh-loose)', color: 'var(--tx2)', maxWidth: 380 }}>{description}</p>}
      {actions && <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{actions}</div>}
    </div>
  );
}

export interface TopBarLink { key: string; label: string; active?: boolean; render: (className: string, children: ReactNode) => ReactNode; }
/** rolvium.pen `Shell/TopBar`: brand · nav links · right cluster. Links are rendered by the caller (router-agnostic). */
export function TopBar({ brand, links, right }: { brand: ReactNode; links: TopBarLink[]; right?: ReactNode }) {
  return (
    <header className="rv-topnav">
      <div className="rv-topnav-left">
        {brand}
        <nav className="rv-topnav-links">
          {links.map(l => l.render(`rv-nav-btn ${l.active ? 'active' : ''}`, l.label))}
        </nav>
      </div>
      <div className="rv-topnav-right">{right}</div>
    </header>
  );
}
