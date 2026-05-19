# Verum Design System — SKILL

> Engineering Project Development Tool. Two surfaces: **Verum** (marketing) and **App** (in-product).

## When to use this skill
Anything visual for the Engineering Project Development Tool / Verum product:
- **Marketing / pitch / decks / landing pages** → Verum surface (cream + forest, Fraunces).
- **In-product UI / dashboards / settings / admin / data tables** → App surface (Inter 13px, GitHub-style light + midnight).

If the user asks for "the brand" or for marketing material, default to Verum. If they ask for "the app" or anything in-product, default to App. If unclear, ask.

## Loading the system
Add a single CSS link, then put `.verum` **or** `.app` on a wrapper. Never both.

```html
<link rel="stylesheet" href="/path/to/colors_and_type.css" />

<!-- Marketing -->
<body class="verum">…</body>

<!-- In-product, light theme -->
<body class="app" data-theme="light">…</body>

<!-- In-product, midnight theme -->
<body class="app" data-theme="midnight">…</body>
```

Tokens are scoped CSS variables — read them from inside the wrapper:
- Verum: `--ink-primary`, `--ink-muted`, `--surface-base`, `--surface-raised`, `--border-default`, `--accent-primary` (forest `#1B4332`), `--font-display` (Fraunces), `--font-body` (Geist), `--font-mono` (JetBrains Mono).
- App: `--theme-bg`, `--theme-surface`, `--theme-sidebar`, `--theme-text`, `--theme-text-muted`, `--theme-border`, `--theme-accent` (blue), `--app-font` (Inter), `--app-font-mono` (JetBrains Mono).

Helper classes: `.h1` / `.h2` / `.h3` / `.body-lg` / `.eyebrow` / `.caption` / `.mono` (Verum); `.page-title` / `.toolbar-title` / `.label-caps` / `.body-text` / `.meta` / `.mono` (App).

## What is in this kit

```
README.md                 ← read this first; full content + visual foundations
colors_and_type.css       ← all tokens for both surfaces
assets/
  logo.png                ← primary blue arrow-A mark
  icon-light.svg
  icon-dark.svg
preview/                  ← reference cards (type, color, spacing, components, brand)
ui_kits/
  verum-marketing/        ← landing-page reference (Verum)
  app/                    ← dashboard reference (App, light)
```

## Hard rules

- **No emoji.** Anywhere.
- **No gradients.** Verum is flat ink-on-cream. App is flat ink-on-grey.
- **No drop-shadow card elevations.** Borders define cards on both surfaces.
- **Lucide icons in App only**, at `size={16}` (toolbar / list rows), `15` (sidebar nav), `14` (small chrome), `13` (tiny inline). Verum has **zero** SVG icons — only mono pills, dots, and editorial punctuation.
- **Type scale is canonical and dense.** Verum body 15px / 1.55. App body 13px / 1.4. Don't enlarge.
- **One accent per surface.** Verum forest `#1B4332`. App blue `#0969da` (light) / `#2f81f7` (midnight).
- **Status hues** appear only on small pills, never as flood color.
- **Sentence case** for every heading and button label. No title case.
- **Mono for any identifier**: REQ-IDs, hashes, model names, prompt revisions, baseline codes, file paths.
- **Animations are minimal**: 80–120ms ease-out on hover; 200ms on layout collapse; nothing else. Honor `prefers-reduced-motion`.

## Voice cheat-sheet

**Verum (marketing).** Short declarative sentences. Period-terminated metric phrases ("15 minutes. First requirement written."). Standards quoted in mono. Sentence-case headings. Em-dashes and middle dots for editorial rhythm. No "amazing", no exclamation marks, no marketing adjectives — claims are metrics or standards.

**App (in-product).** Plain, terse, imperative. Buttons are verb + object ("Save", "Delete project"). Errors describe the situation, not feelings. Mono for IDs and machine values. No emoji.

## Standard moves

- **Verum landing section** → 1200px container, 32px side padding, 96–128px y-padding, top hairline border, eyebrow (mono caps + forest) + h2 (Fraunces 56px), 50%/50% pair layout alternating with `pair--reverse`.
- **Verum CTA** → forest fill on primary, 14px ghost link with `→` chevron next to it.
- **App page** → 16px page-toolbar with title (16/600), ghost utility buttons, primary action on the right; stat-tile row (4 cols, gap 12); split layout `2fr 1fr` for table + activity; 12px table text on hairline rows.
- **App sidebar** → grouped `nav-cap` (10px caps, muted) + `nav-item` (13px, 6×10 padding, 2px left-border accent on active).

## When the user asks for assets we don't have
Ask. Use placeholders rather than inventing logos, photographs, or brand fonts. The system has no photography style — keep imagery monochrome/duotone, archival, technical.

## Decks
No deck template was provided. If asked for slides, derive layouts from `ui_kits/verum-marketing/index.html`: cream backgrounds, Fraunces 56–88px display, forest stat numerals, mono eyebrows, paired-mock visuals on every other slide. Use `deck_stage.js` for the shell; 1920×1080.
