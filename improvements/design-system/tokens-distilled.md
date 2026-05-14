# Design Tokens — Distilled from Reference

Source-of-truth tokens extracted from `improvements/design-system/reference/parameters-page-v2.html` (the Anthropic-hosted Parameters Page v2 design) cross-referenced against `improvements/design-system.md` §3.

**Headline finding.** The reference design ships `improvements/design-system.md` §3 as a literal CSS variable set. Every cert-native colour, every font, every radius value in the founder doctrine is present in the reference. The design language is not a deviation — it is the reference implementation of the doctrine.

A second theme set (`--theme-*` GitHub-Primer style, both light and dark variants) coexists for an auxiliary surface (likely a code-style audit view). The primary brand stays deep-forest.

---

## 1. Colour tokens — primary cert-native theme

### 1.1 Ink (text)

| Variable | Value | design-system.md mapping |
|---|---|---|
| `--ink-primary` | `#0F1419` | §3.1 `ink.primary` ✅ exact match |
| `--ink-muted` | `#6B6660` | §3.1 `ink.muted` ✅ |
| `--ink-faint` | `#A8A29A` | §3.1 `ink.faint` ✅ |
| `--fg-1` | `var(--ink-primary)` | semantic alias |
| `--fg-2` | `var(--ink-muted)` | semantic alias |
| `--fg-3` | `var(--ink-faint)` | semantic alias |

### 1.2 Surface (background)

| Variable | Value | design-system.md mapping |
|---|---|---|
| `--surface-base` | `#FAF8F3` | §3.1 `surface.base` ✅ |
| `--surface-raised` | `#F2EEE3` | §3.1 `surface.raised` ✅ |
| `--surface-inset` | `#EBE5D5` | §3.1 `surface.inset` ✅ |
| `--bg-1` / `--bg-2` / `--bg-3` | aliases | semantic |

### 1.3 Border

| Variable | Value | design-system.md mapping |
|---|---|---|
| `--border-default` | `#E2DCCD` | §3.1 `border.default` ✅ |
| `--border-strong` | `#C9C2AF` | §3.1 `border.strong` ✅ |
| `--line-1` / `--line-2` | aliases | semantic |

### 1.4 Accent (brand)

| Variable | Value | design-system.md mapping |
|---|---|---|
| `--accent-primary` | `#1B4332` | §3.1 `accent.primary` ✅ deep forest |
| `--accent-primary-hover` | `#2D5A3D` | §3.1 `accent.primary-hover` ✅ |
| `--accent-primary-text` | `#FAF8F3` | foreground on accent backgrounds |

### 1.5 Status

| Variable | Value | design-system.md mapping |
|---|---|---|
| `--status-success` | `#1B4332` | §3.1 `status.success` ✅ (same as accent — semantically reads as "approved / signed-off / baselined") |
| `--status-warning` | `#B8860B` | §3.1 `status.warning` ✅ |
| `--status-danger` | `#8B0000` | §3.1 `status.danger` ✅ |
| (status.info) | not in primary theme | secondary theme provides info accent |

### 1.6 Pill / badge backgrounds (observed in SVG thumbnail)

These are NOT in the `:root` variables but are used inline for status pills. Codify as derived tokens:

| Semantic | bg | fg |
|---|---|---|
| Status pill — success | `#E5EFE9` (12% forest tint) | `#1B4332` |
| Status pill — warning | `#FBF0D8` | `#B8860B` |
| Status pill — danger | `#FBE9E7` | `#B42318` (slightly lighter than `--status-danger` for legibility on light bg) |
| Status pill — info (secondary theme) | `#DDF1FF` | `#054EA3` |
| Status pill — purple/secondary | `#F4E5F2` | `#5B21B6` (observed but design-system.md §3.1 bans `purple-*` — see §6 conflicts) |

---

## 2. Colour tokens — secondary theme (`--theme-*`)

A complete GitHub-Primer-style theme coexists, both light + dark. Likely used for an auxiliary surface (audit log diff view, code-style data viewer). The primary brand remains the cert-native theme above.

### 2.1 Light variant

```
--theme-bg:                  #ffffff
--theme-surface:             #f6f8fa
--theme-sidebar:             #f6f8fa
--theme-text:                #1f2328
--theme-text-muted:          #656d76
--theme-border:              #d0d7de
--theme-accent:              #0969da     ← GitHub blue
--theme-accent-subtle:       #ddf4ff
--theme-sidebar-item-hover:  rgba(175, 184, 193, 0.20)
--theme-sidebar-item-active: rgba(175, 184, 193, 0.30)
--theme-success:             #22c55e
--theme-warning:             #f59e0b
--theme-danger:              #ef4444
--theme-info:                #3b82f6
```

### 2.2 Dark variant (GitHub dark)

```
--theme-bg:                  #0d1117
--theme-surface:             #161b22
--theme-sidebar:             #010409
--theme-text:                #e6edf3
--theme-text-muted:          #8b949e
```

### 2.3 Reconciliation rule

The two themes do not mix. Primary cert-native theme is the **brand default** for every cert-relevant module page (Requirements, Verification, Validation, Parameters, Certification, CM, Documentation). The secondary `--theme-*` palette may skin opt-in code/log surfaces but never the brand-facing landing page or any module hero.

---

## 3. Typography

### 3.1 Fonts (exact match to design-system.md §3.2)

```
--font-display: "Fraunces", ui-serif, Georgia, serif;
--font-body:    "Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
```

### 3.2 Type scale (reference)

| Variable | Value | design-system.md §3.3 mapping |
|---|---|---|
| `--display-xl` | `72px` | §3.3 `display-xl` was 64px — reference goes larger |
| `--display-lg` | `56px` | §3.3 `display-lg` was 48px — reference goes larger |
| `--display-md` | `40px` | (new) intermediate display |
| `--title-lg` | `32px` | §3.3 `title-lg` ✅ exact match |
| `--title-md` | `24px` | §3.3 `title-md` ✅ |
| `--title-sm` | `18px` | §3.3 `title-sm` ✅ |
| `--body-lg` | `17px` | §3.3 `body-lg` ✅ |
| `--body-md` | `15px` | §3.3 `body-md` ✅ default body |
| `--body-sm` | `13px` | §3.3 `body-sm` ✅ dense tables |
| `--caption` | `12px` | §3.3 `caption` ✅ |

**Density caveat.** The Parameters page itself, in observed inline usage, leans on **11px / 12px / 13px** font-sizes for the dense table rows + chip metadata. This is below the §3.3 default `body-md: 15px`. Two interpretations:

- **A — Reference adopts dense data view.** Parameter tables are the densest surface in the codebase; 11-13px is GitHub Primer territory and intentional for >50-row tables.
- **B — Drift from §3.3.** The founder doctrine says "raise body default from 13px to 15px"; reference contradicts in tables.

Resolution: **density tiers per surface**. Add to `design-system.md`:

| Surface | Body size |
|---|---|
| Long-form reading (description fields, document mode) | 17px (`body-lg`) |
| Default UI text (drawers, panels, settings forms) | 15px (`body-md`) |
| Dense data tables (Parameters, Requirements list, Verification tests) | 13px (`body-sm`) |
| Table chip metadata, status pill text | 11-12px (`caption`) |
| Microcopy footnote | 11px (`caption`) |

The 15px default holds for prose UI; the 13px applies to dense data — both intentional, both governed.

### 3.3 Weights

```
300, 400, 500, 600, 700
```

5-step weight scale. Inline observation: 400 (regular) for body, 500 (medium) for titles + buttons, 600 (semibold) for table headers, 700 (bold) for emphasis, 300 (light) for very-large display text.

---

## 4. Radius

| Variable | Value | design-system.md §3.5 mapping |
|---|---|---|
| `--radius-xs` | `2px` | §3.5 `radius.xs` ✅ |
| `--radius-sm` | `4px` | §3.5 `radius.sm` ✅ |
| `--radius-md` | `6px` | (new) — §3.5 has `radius.sm: 4` then jumps to `radius.md: 8`. Reference uses 6px as the dominant value. **Adopt 6px as `radius.sm` and bump 8px to a new `radius.md`.** |
| (used in code) | `5px`, `8px`, `999px` | `5px` is a one-off; `8px` corresponds to §3.5 `radius.md`; `999px` = `radius.full` |

Observed prohibition holds: **no `rounded-2xl` (16px) or `rounded-3xl` (24px) anywhere in the reference**. Consistent with design-system.md §3.5.

---

## 5. Spacing

### 5.1 Section spacing (new — for landing-page composition)

```
--space-section:         96px
--space-section-tight:   64px
--space-section-loose:   128px
```

These are macro spacing units for marketing/landing-page section gaps. `design-system.md` §3.4 specifies the 8px grid (`0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128`) — these section tokens are pre-named picks from that scale (64 / 96 / 128). Adopt as `space.section.*` aliases in tokens.

### 5.2 Component padding (observed)

Inline values seen on buttons, badges, table cells, drawer headers:

| Pattern | Use |
|---|---|
| `1px 6px` | small inline badge / chip |
| `2px 7px` | status pill |
| `4px 4px` | icon-button square |
| `4px 8px` | compact button |
| `6px 10px` | medium button |
| `6px 12px` | tab / nav item |
| `7px 12px` | input |
| `8px 14px` | primary button |
| `8px 20px` | wide button |
| `10px 14px` | drawer subtitle row |
| `14px 20px` | drawer body |

All values from the 8px grid + 1/2/4-pixel half-steps for inline pills. No off-grid values. Codify these as named padding tokens (e.g. `padding.button-sm: 6px 10px`, `padding.button-md: 8px 14px`, `padding.pill: 2px 7px`, etc.).

---

## 6. Shadow

| Pattern | Use |
|---|---|
| `0 1px 4px rgba(0,0,0,0.08)` | low — micro-popover / inline pill (rare) |
| `inset 0 0 0 1px var(--line)` | hairline outline (no shadow; used as cheaper alternative to border) |
| `0 0 0 3px rgba(9,105,218,0.15)` | **focus ring** — 3px GitHub-blue tinted halo at 15% opacity |
| `0 0 0 3px rgba(9,105,218,0.12)` | focus ring — softer variant |
| `inset 2px 0 0 var(--blue, #2563EB)` | left-edge accent stripe (selected list row) |
| `0 6px 24px rgba(15,20,25,0.18), 0 2px 6px rgba(15,20,25,0.12)` | **drawer / modal lift** — main floating-surface shadow |
| `-8px 0 32px rgba(15, 23, 28, 0.10)` | side-drawer reveal shadow |

**Reconciliation with design-system.md §3.6.** The founder doctrine says "Shadows are forbidden on primary surfaces ... Allowed: dropdowns + drag preview." The reference allows drawers + focus rings — both consistent. Add explicit `drawer` shadow token and `focus-ring` shadow token to design-system.md §3.6.

### 6.1 Focus ring uses blue at low opacity

The focus ring is `rgba(9,105,218, 0.12–0.15)` — GitHub blue at 12-15% alpha. design-system.md §3.1 bans `blue-*` utility classes but does not address focus rings. **Reconciliation: blue is permitted at low alpha for focus visualisation only.** Add as `--focus-ring` token and document the exception in §3.1.

---

## 7. Conflicts vs `design-system.md` — three of them

### 7.1 Purple appears in reference

`#5B21B6` and `#6B2A66` show up in the reference (a "secondary status" pill colour, likely for an Architecture / MBSE-style tag). `design-system.md` §3.1 bans `purple-*`. Two options:

- **A.** Recolour those badges to use the existing `--status-info` slot (which design-system.md §3.1 says is `#2D4A63` / `#6B9AC4`).
- **B.** Whitelist a single dark-purple as `--status-secondary` reserved for "non-status taxonomic tags" (e.g. tag categories) and document it.

Recommend (A) for v1. Re-evaluate if a real taxonomy-tag use-case justifies (B).

### 7.2 Body size 13px in dense tables vs 15px doctrine default

Already resolved in §3.2 above — adopt density tiers per surface.

### 7.3 Two coexisting theme palettes

Reference ships `--theme-*` GitHub palette in addition to the cert-native palette. Decide: do we ship `--theme-*` at all? Recommendation:

- **Drop `--theme-*` from the canonical token set.** It is GitHub-Primer cosplay and weakens the brand differentiation `vision-and-usp.md` §7 demands.
- If a code-style surface ever needs dark-theme support, build a **cert-native dark** palette (a midnight tone derived from `#0F1419`) — already drafted in `design-system.md` §3.1 dark column.

---

## 8. Canonical CSS variable block to ship in `frontend/src/index.css`

```css
:root {
  /* Ink */
  --ink-primary: #0F1419;
  --ink-muted:   #6B6660;
  --ink-faint:   #A8A29A;

  /* Surface */
  --surface-base:   #FAF8F3;
  --surface-raised: #F2EEE3;
  --surface-inset:  #EBE5D5;

  /* Border */
  --border-default: #E2DCCD;
  --border-strong:  #C9C2AF;

  /* Accent (brand) */
  --accent-primary:       #1B4332;
  --accent-primary-hover: #2D5A3D;
  --accent-primary-text:  #FAF8F3;

  /* Status */
  --status-success: #1B4332;
  --status-warning: #B8860B;
  --status-danger:  #8B0000;
  --status-info:    #2D4A63;

  /* Status pill backgrounds (12% accent tints) */
  --pill-success-bg: #E5EFE9;
  --pill-warning-bg: #FBF0D8;
  --pill-danger-bg:  #FBE9E7;
  --pill-info-bg:    #E8F1F8;

  /* Focus (low-alpha brand) */
  --focus-ring: 0 0 0 3px rgba(27, 67, 50, 0.20);

  /* Drawer / modal lift */
  --shadow-drawer:    0 6px 24px rgba(15,20,25,0.18), 0 2px 6px rgba(15,20,25,0.12);
  --shadow-side-pane: -8px 0 32px rgba(15, 23, 28, 0.10);

  /* Fonts */
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-body:    "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* Type scale */
  --display-xl: 72px;
  --display-lg: 56px;
  --display-md: 40px;
  --title-lg:   32px;
  --title-md:   24px;
  --title-sm:   18px;
  --body-lg:    17px;
  --body-md:    15px;
  --body-sm:    13px;
  --caption:    12px;

  /* Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Section spacing (landing) */
  --space-section:       96px;
  --space-section-tight: 64px;
  --space-section-loose: 128px;
}
```

The Tailwind config (R-9 in ROADMAP-phase3.md) maps each utility name to the variable, e.g.:

```js
// frontend/tailwind.config.js (sketch)
theme: {
  extend: {
    colors: {
      ink:     { 1: 'var(--ink-primary)', 2: 'var(--ink-muted)', 3: 'var(--ink-faint)' },
      surface: { base: 'var(--surface-base)', raised: 'var(--surface-raised)', inset: 'var(--surface-inset)' },
      border:  { DEFAULT: 'var(--border-default)', strong: 'var(--border-strong)' },
      accent:  { DEFAULT: 'var(--accent-primary)', hover: 'var(--accent-primary-hover)' },
      status:  { success: 'var(--status-success)', warning: 'var(--status-warning)', danger: 'var(--status-danger)', info: 'var(--status-info)' },
    },
    fontFamily: {
      display: 'var(--font-display)',
      sans:    'var(--font-body)',
      mono:    'var(--font-mono)',
    },
    borderRadius: {
      xs: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      full: 'var(--radius-full)',
    },
  },
}
```

ESLint guard (per R-9):

```js
// .eslintrc tailwind-banned-utilities
{
  "no-restricted-syntax": [
    "error",
    { "selector": "Literal[value=/\\b(blue|indigo|purple|sky|cyan|teal|emerald|lime|amber|orange|rose|fuchsia|pink|violet)-\\d+/]", "message": "Use design-token color (accent/status/ink/surface/border) not raw palette" },
    { "selector": "Literal[value=/\\brounded-(2xl|3xl)/]", "message": "Forbidden radius. Use rounded-xs/sm/md/lg/full." }
  ]
}
```

---

## 9. Structural components observed in the SVG thumbnail

| Component | Composition seen in reference |
|---|---|
| **Topbar** | Full-width `#FBFBFA` background, `#DEE0E2` 1px bottom border, ~50px tall |
| **Sidebar** | 200px wide, `#F4F5F2` background, `#DEE0E2` right border; nav items 20px left padding, 8px tall pills (radius-xs), selected row has `#DDF1FF` background + `#0969DA` indicator |
| **Page header** | 280px wide title block in `--ink-primary` at `--title-md`; metadata line in `--ink-faint` at `--caption` |
| **Subbar** | Inline filter row: pill-buttons at 28px tall, radius-md (6px), `#F4F5F2` filled + `#DEE0E2` outlined |
| **Table** | Header row `#F4F5F2` background with `#6E7781` column labels; alternating body rows `#FBFBFA` / `#F8F8F6` (warm zebra stripe); row height 36px |
| **Status pill** | 18px tall, radius-xs (2-3px), 70px wide; bg = pill tint, fg = matching status colour |
| **Drawer** | Right-edge slide-in; `--shadow-side-pane` for reveal; `--shadow-drawer` for the floating-card variant per `kb/react-typescript.md` |

Each maps to a primitive in the `frontend/src/components/ui/` library per `roadmap.md` Phase 3.

---

## 10. Action items derived from this distillation

| # | Action | Effort | Where |
|---|---|---|---|
| D-1 | Patch `design-system.md` §3.3 to add density tiers (17/15/13/12/11) per surface | S | `improvements/design-system.md` |
| D-2 | Patch `design-system.md` §3.5 — add `radius.lg: 8px` (between md=6 and full=9999) | S | same |
| D-3 | Patch `design-system.md` §3.6 — add `shadow.drawer` and `focus-ring` exceptions explicitly | S | same |
| D-4 | Add `--focus-ring` to `:root` and ESLint guard that browsers' `outline:none` only allowed when `box-shadow: var(--focus-ring)` is present | S | `frontend/src/index.css` + `.eslintrc` |
| D-5 | Recolour purple `#5B21B6` usage in reference HTML → `--status-info` token (per §7.1 above) | S | (when implementing) |
| D-6 | Drop `--theme-*` GitHub-Primer secondary theme; design cert-native dark from `#0F1419` baseline instead | M | `frontend/src/index.css` `[data-theme="midnight"]` |
| D-7 | Add `space.section`, `space.section-tight`, `space.section-loose` to Tailwind config for landing page (NX-6) | S | `frontend/tailwind.config.js` |
| D-8 | Use this file's §8 block as the literal `:root` body in R-9 ticket | — | R-9 PR uses §8 verbatim |

D-1 through D-7 land alongside R-9 (design tokens + ESLint guard). D-8 is the R-9 deliverable itself.

---

## 11. References

- `improvements/design-system/reference/parameters-page-v2.html` — the source HTML (Anthropic-hosted Parameters Page v2 design)
- `improvements/design-system.md` — founder doctrine; this file confirms + extends it
- `improvements/ui-research.md` — AI-slop patterns this design successfully avoids
- `improvements/SHARED-SERVICES.md` §3.2 — frontend canonical components consuming these tokens
- `improvements/ROADMAP-phase3.md` R-9 — the ticket that lands this token block in code
