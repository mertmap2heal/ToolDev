# Claude Design — visual reference

Source: Anthropic Labs **Claude Design** Research Preview
(claude.ai/design). The screenshot in the project's design notes is the
canonical reference; tokens below are best-fit hex values extracted
from it. Use this when an issue or PR explicitly asks for "Claude
design"; otherwise stick with the existing app theme tokens (see
`.claude/rules.md` §7).

---

## When to apply

- Prototype-only screens (e.g. an experimental landing page).
- Marketing surfaces aimed at the customer rather than internal users.
- A feature explicitly tagged "Claude design" in the issue.

**Do NOT** retrofit the rest of the app to this palette. Internal
modules (Parameters, Requirements, Verification, Configuration
Management, etc.) stay on the existing theme tokens for consistency.

---

## Color palette

### Light mode (the screenshot shows light mode only)

| Token | Hex | Notes |
|-------|-----|-------|
| `bg-page` | `#FAF9F5` | Warm off-white page background |
| `bg-surface` | `#FFFFFF` | Cards, panels |
| `bg-tile-blue` | `#E0EAF2` | Pale blue feature tile |
| `bg-tile-peach` | `#F5DCD6` | Pale peach folder tile |
| `border-warm` | `#E5E3DA` | Card and divider lines |
| `border-strong` | `#D4D2C7` | Inputs |
| `text-primary` | `#1F1E1D` | Body + headings |
| `text-muted` | `#7A7873` | Captions, secondary copy |
| `accent-primary` | `#C96442` | Terracotta — links + emphasis text |
| `accent-cta-bg` | `#E8A28C` | Peach button background |
| `accent-cta-text` | `#FFFFFF` | Button label |
| `outline-selected` | `#4A6FA5` | Selected card / focus ring |

### Dark mode (inferred — keep warm, never pure black)

| Token | Hex |
|-------|-----|
| `dark-bg-page` | `#262624` |
| `dark-bg-surface` | `#30302E` |
| `dark-border` | `#3F3E3B` |
| `dark-text-primary` | `#F0EEE6` |
| `dark-text-muted` | `#B0AEA6` |
| `dark-accent-primary` | `#D97757` (slightly brighter for AA) |

---

## Typography

- **Headings**: serif. Reads as Tiempos Headline (commercial). Free
  fallback: `'Source Serif 4', Georgia, ui-serif, serif`.
- **Body**: sans-serif. Reads as Styrene B (commercial). Free
  fallback: `'Inter', ui-sans-serif, system-ui, sans-serif`.
- **Mono** (when needed): `'JetBrains Mono', ui-monospace, monospace`.

Scale (matches docs.anthropic.com pattern):
- H1 36–40px / 500 weight / line-height 1.15
- H2 28px / 500 / 1.25, generous top margin (~3rem)
- H3 22px / 500
- Body 16px / 400 / line-height 1.65–1.75
- Caption 14px / 400

---

## Spacing & layout

- Base unit: 4px (Tailwind default).
- Prose max-width: ~720px (45rem) for readable line length.
- Page padding: 2rem mobile, 4rem desktop top/bottom.
- Section vertical rhythm: 3rem between H2s, 1.5rem between paragraphs.
- Tile grid: 2 columns on the right rail (Designs / Examples / Design
  systems tabs), 16px gutter.

---

## Component patterns

1. **Header**: small icon (palette / 🎨), serif title, "Research
   Preview" pill in the warm-bg surface. Tagline in muted small text
   underneath.
2. **Sidebar tabs**: black underline + bold active state, no
   background change.
3. **Pill toggle group** (Recent / Your designs): rounded-full
   container, active item gets a white surface card with a soft
   shadow; inactive transparent.
4. **Card / tile**: rounded-2xl (16px radius), 1px `border-warm`, no
   drop shadow — relies on the warm tonal contrast.
5. **Primary button**: `accent-cta-bg`, white text, rounded-lg,
   12px/20px padding, weight 500, `+` icon on the left when
   "Create"-style.
6. **Form input**: 1px `border-strong`, rounded-md, white surface,
   placeholder in muted text.
7. **Selected card**: 2px `outline-selected` ring + soft shadow. Used
   for the High-fidelity choice in the screenshot.
8. **Footer note**: 13px muted text, centred.

---

## Iconography

- Lucide-style line icons, 1.5px stroke, rounded line caps. Sizes
  16/20/24px.
- Decorative graphics (apple, folder) are flat illustrations in
  `accent-primary` / muted gray.

---

## Tailwind translation

The project's existing palette already maps cleanly:

| Claude token | Tailwind equivalent |
|--------------|---------------------|
| `bg-page` | `bg-stone-50` |
| `bg-surface` | `bg-white` |
| `text-primary` | `text-stone-900` |
| `text-muted` | `text-stone-500` |
| `accent-primary` | `text-orange-700` |
| `accent-cta-bg` | `bg-orange-300` |
| `border-warm` | `border-stone-200` |
| `outline-selected` | `ring-blue-500` |

For dark mode, swap to `stone-950 / stone-100 / stone-400 /
orange-400 / stone-800 / blue-400`.

Prose: use `prose prose-stone dark:prose-invert` from
`@tailwindcss/typography` (already installed).

---

## Source

- claude.ai/design Research Preview (login required).
- Screenshot referenced: `Pictures/Screenshots/Screenshot 2026-04-26 213317.png`.
- Hex values are best-fit estimates. Update if Anthropic publishes
  exact tokens.
