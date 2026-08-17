import { forwardRef, type InputHTMLAttributes, type ReactNode, type CSSProperties } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** ALL-CAPS label as in rolvium.pen `Field`. */
  label: string;
  id: string;
  error?: string | null;
  hint?: string;
  /** Trailing element inside the input box (icon button, e.g. show password). */
  trailing?: ReactNode;
  /** Monospace/display style for codes (invite code). */
  code?: boolean;
  style?: CSSProperties;
}

/** rolvium.pen `Field`: label (2xs, bold, tracking) + input on --bg with ghost border, focus = accent ring. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, id, error, hint, trailing, code = false, style, ...input }, ref) {
  return (
    <div className="rv-field" style={style}>
      <label className="rv-label" htmlFor={id}>{label}</label>
      <div className="rv-inp-wrap">
        <input ref={ref} id={id} className={`rv-inp ${error ? 'err' : ''} ${code ? 'rv-inp-code' : ''}`} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : undefined} {...input} />
        {trailing && <span className="rv-inp-trailing">{trailing}</span>}
      </div>
      {error && error.trim() && <div id={`${id}-err`} className="rv-err" role="alert">{error}</div>}
      {!error && hint && <div className="rv-hint">{hint}</div>}
    </div>
  );
});
