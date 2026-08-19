import type { ReactNode } from 'react';
import './tooltip.css';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** Already-translated text. Kept short: this is a name, not a help paragraph. */
  label: string;
  /** The trigger. It MUST keep its own `aria-label` — that is the accessible name; this is only the visual half. */
  children: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
}

/**
 * Small label shown on hover and on keyboard focus (rolvium.pen `PL/Tooltip herramienta`).
 *
 * Why not the browser's `title`: it waits about a second, lands wherever it likes and ignores the system's
 * look. Icon-only buttons are unreadable without it — the owner could not tell what `fence` meant
 * (specs/modules/maps/SPEC.md § «Barra vertical de herramientas»).
 */
export function Tooltip({ label, children, placement = 'right', className }: TooltipProps) {
  return (
    <span className={`rv-tip-wrap${className ? ` ${className}` : ''}`} data-tooltip={label}>
      {children}
      {/* `aria-hidden`: the trigger's own `aria-label` already carries this name, and announcing it twice is noise. */}
      <span className="rv-tip" data-placement={placement} aria-hidden="true">{label}</span>
    </span>
  );
}
