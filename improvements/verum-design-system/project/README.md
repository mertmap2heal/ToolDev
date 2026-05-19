# Verum Design System

This design system covers the **Engineering Project Development Tool** — an AI-assisted requirements/verification/certification platform for safety-critical engineering teams. The product has two active brand surfaces; both are described here.

The marketing surface is branded **Verum**. The in-product UI is currently labeled **"Engineering Tool"** (with the tagline *Project Development*) and uses the same logo. Treat **Verum** as the working brand name.

---

## Source material

Built from `ChristianLuciano/ToolDevelopment` (GitHub, branch `dev`).

| Material | Where |
|---|---|
| Marketing/landing visual system | `frontend/src/pages/PreviewLanding/preview-landing.css` |
| Marketing copy + sections | `frontend/src/pages/PreviewLanding/sections/*.tsx` |
| Marketing mock components | `frontend/src/pages/PreviewLanding/mocks/*.tsx` |
| Global app theme tokens | `frontend/src/index.css` |
| App layout & navigation | `frontend/src/components/layout/{Sidebar,Header,MainLayout}.tsx` |
| Page conventions (audit) | `STYLE_CONSISTENCY_AUDIT.md` (root) |
| Logo (master) | `frontend/public/logo.png` |
| Project landing icons | `frontend/public/images/project-landing/icon-{light,dark}.svg` |
| Tailwind + Lucide setup | `frontend/tailwind.config.js`, `frontend/package.json` |

---

## Two products, two surfaces

The codebase has two visually distinct surfaces. Don't mix them.

### 1. Verum — marketing / pitch surface
Lives at the route `/preview/landing`. Cream + forest editorial system inspired by archival aerospace publications: Fraunces serif display, Geist sans body, JetBrains Mono for codes/IDs, calm warm neutrals, **borders not shadows**, no gradients, no stock illustration. The product visuals it shows (matrices, provenance records, MCP flow) are *truthy* — they look like the actual app, just on the brand palette.

Use this when designing decks, pitch pages, brochures, marketing site, sales material.

### 2. App — in-product UI
The full SaaS application (~50+ pages: Requirements, Verification, Tasks, Safety Analysis, Inventory, Risk, etc). Uses **Inter** at a dense **13px base**, dual GitHub-inspired themes (`light` + `midnight`), `--theme-*` CSS variables, Lucide icons at `size={16}`. Borders + flat surfaces, blue (`#0969da` / `#2f81f7`) as the only accent.

Use this when designing in-app screens, dashboards, modals, settings, admin tools.

---

## Index

| File | Purpose |
|---|---|
| `README.md` | This file. |
| `colors_and_type.css` | All tokens for both surfaces (`.verum` and `.app`). Drop the class on a wrapper. |
| `SKILL.md` | Skill manifest — read for usage instructions. |
| `assets/` | Logo, icons. |
| `fonts/` | (Substitution note — see below.) |
| `preview/` | Design-system reference cards (typography, colors, spacing, components). |
| `ui_kits/verum-marketing/` | Verum brand UI kit — landing-page sections + components. |
| `ui_kits/app/` | In-product UI kit — sidebar, dashboard, requirements table, modals, etc. |

---

## Content fundamentals

### Voice — Verum (marketing)
**Authoritative, calm, technical, unboastful.** The language reads like an aerospace certification document re-edited for a website. It assumes the reader knows what DAL B is. It does not over-explain.

- **Short, declarative sentences.** "Certify in months. Not years." "AI proposes. A human disposes."
- **Period-terminated metric phrases.** "15 minutes. First requirement written." "One command. Certification package built." "Zero. Consulting engagements required."
- **Standards by name.** DO-178C, DO-254, ARP4754A, DO-326A, ISO/IEC 42001 — quoted verbatim, in mono.
- **Sentence case headings.** "Built around the objective." not "Built Around The Objective."
- **First person plural for the company; second person sparingly.** "We put the objective first." "Keep Azure DevOps. Keep Jira. Keep Git."
- **Em-dashes and middle dots.** Editorial punctuation: `—` for asides, `·` to separate metadata in mono lines (`DAL B · Baseline B-2026-04-12`).
- **No emoji. No exclamation marks. No "exciting", "amazing", "powerful".** A claim is the metric or the standard, never an adjective.
- **CTA verbs are bare.** "Start free", "Talk to an engineer". Not "Get started today!".

### Voice — App (in-product)
**Plain, neutral, terse.** The interface is for engineers doing work; copy gets out of the way.

- **Sentence case for actions and titles.** "Create Project", "Reset password", "Risk Matrix".
- **Imperative + object** for buttons: "Save", "Delete project", "Send temporary password".
- **Status banners describe the situation, not feelings.** "This project cannot be deleted while dependent records exist." not "Oops, something went wrong!"
- **Inline guidance is mechanical.** "Check that the backend is running, the database is connected, and you are logged in."
- **Mono for IDs, hashes, machine values.** `claude-opus-4-7 / 1.2.3`, `sha256:9f2e8c... 64ab`, `REQ-1024.title`.
- **No emoji.** Lucide icons carry semantics.

### Examples
> Certify in months. Not years.
> Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not AI autonomy.

> AI proposes. A human disposes.
> Every AI suggestion is traceable. Every sign-off is human.

> 15 minutes. First requirement written.
> One command. Certification package built.

> This project cannot be deleted while dependent records exist.

---

## Visual foundations

### Two anchors, one logo
Both surfaces use the same logo (`assets/logo.png`) — a stylised **A** drawn from two abstract trapezoidal forms (vehicle silhouettes / mountains, deliberately ambiguous), in a single mid-saturation **engineering blue** (`#1E83C8`). On the Verum surface it sits next to the "VERUM" wordmark in Fraunces; in the app it sits next to "Engineering Tool / Project Development" stacked in Inter.

### Color — Verum
Warm, archival, **paper-and-ink**. Forest green is the only saturated color; everything else is cream, sand, ink.

| Role | Token | Value |
|---|---|---|
| Ink primary | `--ink-primary` | `#0F1419` |
| Ink muted | `--ink-muted` | `#6B6660` |
| Ink faint | `--ink-faint` | `#A8A29A` |
| Surface base | `--surface-base` | `#FAF8F3` |
| Surface raised | `--surface-raised` | `#F2EEE3` |
| Surface inset | `--surface-inset` | `#EBE5D5` |
| Border default | `--border-default` | `#E2DCCD` |
| Border strong | `--border-strong` | `#C9C2AF` |
| Accent (forest) | `--accent-primary` | `#1B4332` |
| Accent hover | `--accent-primary-hover` | `#2D5A3D` |
| Status warning (gold) | `--status-warning` | `#B8860B` |
| Status danger (oxblood) | `--status-danger` | `#8B0000` |

### Color — App
GitHub-inspired neutral, dual theme. Saturated blue is the only color used for action.

| Role | Light | Midnight |
|---|---|---|
| Background | `#ffffff` | `#0d1117` |
| Surface | `#f6f8fa` | `#161b22` |
| Sidebar | `#f6f8fa` | `#010409` |
| Text | `#1f2328` | `#e6edf3` |
| Text muted | `#656d76` | `#8b949e` |
| Border | `#d0d7de` | `#30363d` |
| Accent | `#0969da` | `#2f81f7` |
| Accent subtle | `#ddf4ff` | `#1f3a5f` |
| Success | `#22c55e` | `#3fb950` |
| Warning | `#f59e0b` | `#d29922` |
| Danger | `#ef4444` | `#f85149` |

### Typography
- **Verum display** — Fraunces 500, opsz variable, tight (`-0.03em`) letter-spacing. Sentence case. Used for h1/h2/h3.
- **Verum body** — Geist 400, 15px base, 1.55 line-height, slight negative tracking.
- **Verum mono** — JetBrains Mono 500 for eyebrows, codes, status pills, identifiers.
- **App body** — Inter 400, **13px base**, 1.4 line-height. Page titles `text-lg font-bold` (per audit).
- **App mono** — JetBrains Mono for IDs, hashes, code refs.
- Substitutions: all four families are on Google Fonts and loaded via `@import` in `colors_and_type.css`. **No local font files are checked in** — we rely on Google Fonts. If you want self-hosted `.woff2` files, drop them into `fonts/` and add `@font-face` blocks. ⚠ See *Open caveats* below.

### Spacing & shape
- **Verum** — large editorial rhythm: section padding `96px` (tight `64px`, loose `128px`); container max-width `1200px`, side padding `32px`. Radii are tiny (`2px`/`4px`) — almost square. Cards live on **borders**, never shadows. 1px hairline dividers separate everything.
- **App** — dense: page gutters around `20-24px`, gaps `8-12px`, `rounded-lg` (`8px`) for cards, `rounded-md` (`6px`) for inputs, `rounded` (`4px`) for tag pills. Inputs are `5-6px` vertical / `10-12px` horizontal. Toolbar buttons are `px-3 py-2 text-sm`.

### Backgrounds & textures
**Flat surfaces only.** No gradients (Verum), no full-bleed photography, no patterns, no textures, no hand-drawn illustration. Decoration is achieved with hairline borders, mono labels, and structured product data (matrices, provenance tables, node diagrams). The marketing visuals you see in `mocks/` are *fake but truthy* renderings of real product UI — that's the trick: the brand IS the product.

The app's login screen is the only place a soft gradient appears: `from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800` for the auth split. Nowhere else.

### Animation
**Almost none.** Hover transitions are 80-120ms `ease-out` on `background-color`/`border-color`/`color`. Sidebar collapse is `200ms ease-in-out` on width. A briefly-flashed section highlight on sidebar deep-link uses a `0.6s ease` background fade. **No bounces, no spring physics, no entrance animations.** A `Loader2 className="animate-spin"` Lucide icon is the only motif of "in progress". `html.reduce-motion *` clamps every duration to `0.001ms` — respect `prefers-reduced-motion`.

### States
- **Hover** — Verum: tighter border (`--accent-primary` instead of `--border-strong`) and/or surface bump (`--surface-base` → `--surface-raised`); link border-bottom appears. App: `--theme-sidebar-item-hover` (≈8% gray) on rows, brighter blue (`bg-blue-700`) on primary buttons, and a slight `box-shadow` (`0 2px 8px rgba(0,0,0,0.15)`) on cards.
- **Active/Selected** — Verum: solid forest fill on primary CTA; mono pill swaps from neutral to forest tint. App: `border-l-2 border-[--theme-accent]` on the nav item, `--theme-sidebar-item-active` background.
- **Focus** — Verum: `outline: 2px solid var(--accent-primary); outline-offset: 2px; border-radius: 2px`. App: `ring-2 ring-blue-500/30` (a Tailwind/blue ring).
- **Disabled** — `opacity: 0.4-0.5`, `cursor: not-allowed`. No greying-out tricks.
- **Press** — *no* shrink/scale on press. Buttons darken only.

### Borders, shadows, transparency
- **Borders are the chrome.** 1px solid `var(--border-default)` / `var(--theme-border)` defines every card, every divider, every input. There are no `box-shadow`-based card elevations on the Verum surface. The app uses one tiny shadow on hover only.
- **No outer drop shadows** as decoration. The only shadow in the system is the modal overlay backdrop (`bg-black/60`).
- **Transparency is functional, not decorative.** Pill backgrounds use `rgba(27,67,50,0.10)` for tinted-on-cream pills; sidebar hover uses `rgba(175,184,193,0.20)`. Never blur. Never glassmorphism.

### Cards
A card on either surface = `1px solid border` + matching `surface-raised` background + small radius + `16-24px` padding. No glow, no gradient, no border-left accent stripe.

### Imagery vibe
The system avoids photography on the Verum brand entirely. The mocks stand in for what would normally be a hero screenshot. If imagery is ever introduced, it should be: **monochrome or duotone**, **archival/document-like**, **technical drawings or matrices**, never warm-lifestyle photography, never AI-generated 3D art, never gradient-drenched UI mockups.

### Layout rules
- **Container** — Verum: `max-width: 1200px`, `padding: 0 32px`. App: usually full-width with a `max-w-[1280px]` cap on dashboard rows.
- **Editorial alternation** — Verum sections alternate text-left/media-right and text-right/media-left (`pl-pair--reverse`).
- **Dense data** — App lists/tables stay tight: 12px row text, 16px row padding, hairline row borders, sticky toolbars at the top with `px-3 py-2` controls.
- **Fixed elements** — App: persistent sidebar (220px expanded, 48px collapsed) + 44px header + thin status bar. Sidebar `Ctrl+B` toggles collapse.

---

## Iconography

### App — Lucide React, exclusively
The application uses [`lucide-react`](https://lucide.dev) (v0.294.0) for **every** icon. They appear at:

- **`size={16}`** — toolbar buttons, search/filter affordances, list-row actions, sidebar settings (per `STYLE_CONSISTENCY_AUDIT.md`).
- **`size={15}`** — sidebar nav items.
- **`size={14}`** — collapse buttons, theme toggle.
- **`size={13}`** — small inline pickers, project-card actions.
- **`size={18}`** — login/error banner icons (auth pages only).

**Never invent icons.** Always pull from Lucide. The CSS includes a `<script type="module">` import block in `assets/lucide.html` so static HTML mocks can use them via `<i data-lucide="search"></i>` + `lucide.createIcons()`. For the design system here, **link from CDN** — see `ui_kits/app/index.html`.

Recurring icon vocabulary in the codebase:
- Navigation: `LayoutDashboard`, `Home`, `Settings`, `PanelLeftClose`, `PanelLeftOpen`, `ChevronDown`, `ChevronRight`, `X`
- Feature categories: `Code2` (Development), `Boxes` (System Definition), `ShieldCheck` (Assurance)
- Theme: `Sun`, `Moon`
- Toolbar: `Search`, `Filter`, `Plus`, `Download`, `FileDown`, `ListChecks`, `Trash2`
- Status: `AlertCircle`, `Loader2`, `Eye`, `EyeOff`, `CheckSquare`, `Square`
- Domain: `Users`, `BarChart3`, `LogOut`

### Verum — typographic glyphs only
The marketing surface uses **no SVG icons**. Visual weight is carried by:
- **Mono pills** with text content (`DAL B`, `Closed`, `Open`, `Signed off`, `prompt_v7_req_draft`).
- **Mono dots** (`<span class="pl-trust-strip__dot" />`) as inline separators.
- **HTML entities** for editorial punctuation: `&middot;` (·), `&mdash;` (—), `&rsquo;` (’).
- **Inline SVG only for diagrammatic connectors** (the dashed line + arrowhead in `MCPDiagramMock.tsx`) — never icons, only flow arrows.

If you need a glyph on the Verum brand, **use the mono font** (`var(--font-mono)`) or a single-character display-serif lockup. Do not import Lucide on the marketing surface.

### Logos
- `assets/logo.png` — primary brand mark (354×231, blue `#1E83C8` arrow-A on transparent). Used in app sidebar, login left panel, and Verum footer wordmark accompaniment.
- `assets/icon-light.svg` / `assets/icon-dark.svg` — angular "MA" / arrow lockup used on `ProjectLandingPage` (one per theme). Color: `#151F36` (near-black ink). 732×425.

### Emoji
**Never used.** The codebase has zero emoji in any surface.

---

## Open caveats

- **Fonts are not vendored locally.** Both surfaces load Fraunces, Geist, JetBrains Mono, and Inter from Google Fonts. If the user wants self-hosted assets for offline/CSP reasons, supply `.woff2` files and we'll wire them into `fonts/` + `@font-face`. This is the only "substitution" — the canonical families are unchanged.
- **No slide template was provided.** Verum has clear marketing typography but no decks in the repo, so `slides/` is not generated. Ask if a deck system is wanted; we'll synthesize one from the landing-page rules.
- **Internal app screens** (e.g. `RequirementsPage` at 2258 lines, `LifecycleManagementPage` at 4090 lines) are deep — the UI kit reproduces the structural language (sidebar, header, page chrome, toolbar grammar, table grammar, modals) but does not re-implement every individual page.
