import { useState, type CSSProperties } from 'react';

/**
 * Carbon Logic palette of 16 swatches that map cleanly to dark + light
 * surfaces. The first 8 mirror the workspace's semantic tokens; the next 8
 * are vibrant fills suitable for client / team branding without clashing
 * against the dark canvas.
 */
export const COLOR_PICKER_PALETTE = [
  '#4d8eff', // primary
  '#00b954', // secondary
  '#b76dff', // tertiary
  '#f5a623', // amber
  '#ef4444', // danger
  '#3ecf8e', // green soft
  '#e05252', // red soft
  '#7b93ff', // accent 2
  '#22d3ee', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // teal
  '#14b8a6', // mint
  '#eab308', // yellow
] as const;

export interface ColorPickerProps {
  /** Currently selected hex color. */
  value: string;
  /** Called with the new hex value (always 7 chars starting with `#`). */
  onChange: (hex: string) => void;
  /** Override the default 16-swatch palette. Useful for legacy 8-color callers. */
  palette?: readonly string[];
  /** When `false`, hide the custom hex input + native picker. Default `true`. */
  allowCustom?: boolean;
}

const HEX_RX = /^#[0-9a-fA-F]{6}$/;

const swatchBase: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

/**
 * Reusable color picker — 16 swatches + optional custom hex input + native
 * picker fallback. Used by both `ClientFormModal v2` and (after refit)
 * `TeamFormModal`.
 */
export function ColorPicker({
  value,
  onChange,
  palette = COLOR_PICKER_PALETTE,
  allowCustom = true,
}: ColorPickerProps) {
  const [hexDraft, setHexDraft] = useState(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        role="radiogroup"
        aria-label="Color"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        {palette.map((swatch) => {
          const selected = value.toLowerCase() === swatch.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={swatch}
              onClick={() => {
                onChange(swatch);
                setHexDraft(swatch);
              }}
              style={{
                ...swatchBase,
                background: swatch,
                border: selected ? '2px solid var(--tx)' : '2px solid transparent',
              }}
            />
          );
        })}
      </div>

      {allowCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', fontFamily: 'Inter' }}>
            o color custom
          </span>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 8px', height: 30, borderRadius: 6,
              background: 'var(--sf2)', border: '1px solid var(--bd)',
            }}
          >
            <span
              aria-hidden
              style={{ width: 14, height: 14, borderRadius: 3, background: value, flexShrink: 0 }}
            />
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => {
                const next = e.target.value;
                setHexDraft(next);
                if (HEX_RX.test(next)) onChange(next);
              }}
              maxLength={7}
              spellCheck={false}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--tx)', fontFamily: 'Inter', fontSize: 'var(--fs-xs)',
                fontVariantNumeric: 'tabular-nums', width: 76,
              }}
              aria-label="Custom hex color"
            />
          </div>
          <label
            title="Picker"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 6,
              background: 'var(--sf2)', border: '1px solid var(--bd)',
              cursor: 'pointer',
            }}
          >
            <input
              type="color"
              value={HEX_RX.test(value) ? value : '#4d8eff'}
              onChange={(e) => {
                onChange(e.target.value);
                setHexDraft(e.target.value);
              }}
              style={{ opacity: 0, width: 1, height: 1, position: 'absolute', pointerEvents: 'none' }}
              aria-label="Custom color picker"
            />
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, color: 'var(--tx2)' }}
            >
              colorize
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
