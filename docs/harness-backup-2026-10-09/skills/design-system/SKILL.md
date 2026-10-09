---
name: design-system
description: Sistema de diseño de Rolvium ("Candlelit Grimoire") — colores, superficies, tipografía, tokens, elevación, botones, cards, chips y reglas de light/dark. Se dispara en cualquier trabajo visual/UI en apps/web o packages/ui para aplicar el look correcto sin hardcodear hex/px.
---

# Design System — Rolvium

All UI work MUST follow the Rolvium design system. This is non-negotiable.

### Creative North Star: Candlelit Grimoire
Rolvium is a table for playing tabletop RPGs online, and the UI should feel like
sitting at that table by candlelight: **deep ink surfaces**, **warm parchment
text**, an **ember/gold accent** for the things that matter (primary actions,
active states, the die that just rolled), and **arcane violet** as the tertiary
note for magic, highlights and rare states. Dark and quiet by default; light
mode is the same grimoire read by daylight — parchment surfaces, ink text, the
same ember accent. We reject flat enterprise looks and generic "fantasy" clutter
alike: hierarchy comes from **Tonal Layering** — surface depth and glow, not
boxes and borders. No ornaments, no textures, no drop-caps; the mood comes from
color, weight and space.

### Where the colors live (single source of truth)
- **The concrete hex values live ONLY in `apps/web/src/RolviumApp.css`**:
  `:root` = dark theme, `[data-theme="light"]` = light theme. This skill
  intentionally does NOT list hex values — if you need one, read that file;
  if you need a new one, add it there (both themes) and consume it as a var.
- Components consume **`var(--…)`** exclusively. Never a hex, never an rgb()
  literal, never a `var()` fallback.

### Color & surface tokens
| Token | Role |
|---|---|
| `--bg` | Page canvas (deep ink / daylight parchment) |
| `--sf` | Base surface — cards, panels |
| `--sf2` | Raised surface — nested cards, hover |
| `--sf3` | Highest surface — floating, active rows, inputs on hover |
| `--bd` | Ghost border (low-contrast; use sparingly, never for layout) |
| `--bd2` | Stronger border for focus / accessibility only |
| `--ac` | Accent — ember/gold. Primary actions, active nav, focused controls |
| `--ac2` | Accent secondary — lighter ember for gradients and hover |
| `--glow` | Accent glow (translucent) for shadows/halos on primary CTAs |
| `--green` | Success, healed, on-track |
| `--amber` | Warning, caution, "your turn" |
| `--red` | Danger, damage, destructive actions |
| `--purple` | Arcane violet — tertiary: magic, highlights, rare states |
| `--tx` | Main text (warm parchment on dark; ink on light) |
| `--tx2` | Muted text |
| `--tx3` | Dim text — meta, placeholders |
| `--r` | Base radius (small controls, chips) |
| `--r2` | Larger radius (cards, modals) — corners never exceed it |
| `--shadow` | Standard elevation shadow — the ONLY shadow allowed besides `--glow` |

Semantic colors (`--green --amber --red --purple`) are for meaning, not
decoration. Do not use `--purple` as a second accent for buttons.

### The "No-Line" Rule
1px solid borders for layout are **prohibited**. Use background shifts
(`--bg` → `--sf` → `--sf2` → `--sf3`) and tonal transitions instead. If a border
is needed for accessibility, use `var(--bd)` ("Ghost Border") — never `--bd2`
for layout.

### The "Glass & Ember" Rule
- Floating elements (menus, popovers, drawers): `--sf3` with translucency +
  20-40px backdrop blur.
- Primary CTAs: `linear-gradient(135deg, var(--ac2), var(--ac))` with a
  `var(--glow)` shadow.
- Button hover: intensify the `--glow` halo; do not change the radius or
  add a border.

### Typography (Inter for UI)
- **Display:** Semi-Bold 600, tracking -0.02em
- **Headlines:** Medium 500, tracking -0.01em
- **Titles:** Medium 500, tracking 0.01em
- **Body:** Regular 400, tracking 0.01em
- **Labels:** Bold 700, tracking 0.05em, ALL-CAPS
- A display/serif face for campaign titles or headers is allowed ONLY if it is
  defined as a token in `RolviumApp.css` and approved in `rolvium.pen` first.

### Typography Scale Tokens (Mandatory)
- **NEVER write raw `fontSize: 13` (or any pixel literal) in components.** Pick
  one of the tokens defined in `apps/web/src/RolviumApp.css`:
  - `var(--fs-2xs)` — ALL-CAPS labels, tiny badges
  - `var(--fs-xs)` — meta, code badges, captions
  - `var(--fs-sm)` — secondary body
  - `var(--fs-body)` — default body, list titles, inputs
  - `var(--fs-md)` — emphasized body
  - `var(--fs-lg)` — section title
  - `var(--fs-xl)` — large title
  - `var(--fs-display)` — hero
- Material Symbols icons use the icon scale: `var(--icon-xs|sm|md|lg)`.
- Line heights: `var(--lh-tight|normal|loose)`.
- The whole app's typography scales by editing those tokens in one file.
  Components must consume them — adding raw px literals is technical debt.

### Elevation
- **Recessed:** `--bg` — inputs, wells, the canvas behind a card grid
- **Canvas:** `--sf` — page-level panels
- **Raised:** `--sf2` — cards, modules
- **Floating:** `--sf3` + glass (translucency + blur) + `var(--shadow)`

### Icons
Use **Material Symbols Outlined** (Google Fonts). Weight: 300 light (default),
filled on interaction/active. **NEVER use emojis in the UI** — not for dice,
not for status, not for empty states.

### Buttons
- **Primary:** Ember gradient fill + `--glow` shadow. Radius `var(--r)`.
- **Ghost:** `--sf3` at ~80% opacity + backdrop blur, `--tx` text.
- **Semantic:** `--green` (approve/heal), `--red` (danger/damage) — flat fill
  or gradient of that single color; never mix accents.

### Cards
- No divider lines inside cards. Use whitespace (1.5rem+) or a tonal shift
  (`--sf` → `--sf2`).
- Background: `--sf2` on a `--sf`/`--bg` canvas, radius `var(--r2)`, ghost
  border top-edge only if needed for separation.

### Semantic Chips
- Success: `--green` text on `--green` at ~10% bg (`color-mix`), no border
- Error: `--red` text on `--red` at ~10% bg
- Warning: `--amber` text on `--amber` at ~10% bg
- Arcane / rare: `--purple` text on `--purple` at ~10% bg

### Light / Dark Mode (Mandatory)
- **NEVER use hardcoded hex color values for backgrounds, text, or borders in
  inline styles or embedded CSS.** Always use the CSS variables above.
- CSS variables are defined in `apps/web/src/RolviumApp.css` with `:root`
  (dark) and `[data-theme="light"]` (light) selectors. Every new token MUST be
  defined in both.
- **Do NOT use fallback values in CSS vars** (e.g., `var(--tx,#e4e4ef)` is
  forbidden — just use `var(--tx)`).
- If you need a component-scoped variable, define it with a
  `[data-theme="light"]` override in a `<style>` block — never as a raw literal
  in the component.
- Never `#FFFFFF`, in either theme.

### Do's and Don'ts
- **Do** embrace asymmetry, high-contrast font weights, `--sf3` for active
  elements, generous whitespace, ember only where attention belongs.
- **Don't** use `#FFFFFF`, standard Material shadows, dividers, corners larger
  than `--r2`, decorative textures/ornaments, or emojis.

---

> Estas reglas se verifican de forma determinista con `npm run audit` (checks de
> `#fff`, hex crudo, `fontSize` px crudo, `var()` con fallback, emojis) y las
> revisa el subagente Review (grep de hex en `apps/web/src` fuera de
> `RolviumApp.css`). Reutilizá componentes vía la skill `ui-reuse`. Diseñá
> primero en `rolvium.pen` (comando `design.md`).
