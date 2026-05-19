# ROADMAP — UI Refresh (Verum App-surface)

Execution plan for the design refresh delivered as the **Verum Design System** handoff bundle (`improvements/verum-design-system/`). Sequenced for the agentic workflow in `AGENTIC-WORKFLOW.md`, the same pipeline used for the R-Wave and NX tickets.

Source bundle: a Claude Design export. The intent lives in `verum-design-system/chats/` (chat3 governs); the refreshed page mockups live in `verum-design-system/project/refresh/`; the workflow memo is `verum-design-system/project/refresh/improvements.html`.

---

## 1. What this is — two tracks

The bundle contains **two distinct bodies of work**. They are NOT the same effort and must not be bundled.

- **Track RF — the 8-page restyle.** A disciplined re-skin of 8 hero App pages + the shared chrome into one calm, dense, GitHub-grey-but-warmer visual language ("database-client, not AI-slop" — the chat1 origin complaint). Restructured IA, not a rewrite. This is the bulk of the literal "refresh."
- **Track WF — the workflow memo.** `improvements.html` is a separate ranked memo of 10 workflow proposals ("collapse multi-screen dances into single motions; surface what needs attention; suggest the next step"). Each is a real feature with backend depth — not a re-skin. Several map onto existing `ROADMAP-phase3.md` items.

This roadmap defines both. **Track RF executes first.** Track WF is a second, independent track sequenced after (or interleaved once RF-0/RF-1 land).

---

## 2. Open decisions — RESOLVE BEFORE RF-2

The chats scoped the refresh but did **not** record a per-page A/B verdict. **D1, D2, D7 were resolved by the user on 2026-05-19** (see table). D3/D4 are settled (both variants ship — they are tabs). D5/D6/D8 proceed on the stated recommendation.

| # | Decision | Resolution | Why |
|---|---|---|---|
| D1 | **Dashboard variant A or B** | **RESOLVED → B** (user, 2026-05-19) | B's right-rail "My queue" is the management-visibility thesis in one component. |
| D2 | **Project-landing variant A or B** | **RESOLVED → A** (user, 2026-05-19) | The current page is already a 3-column V-model navigator; A enriches it. |
| D3 | **Verification A vs B** | **Ship both** — not a choice | A (Runs) and B (Coverage matrix) are two existing tabs of one module. Both restyle their real screen. |
| D4 | **Safety A vs B** | **Ship both** — not a choice | Same: A (Hazards) and B (Overview) are two existing Safety pages. |
| D5 | **Midnight theme** | Author palette-C midnight values in RF-0 | The refresh mockups are light-only ("decide for me" → light). The app ships a midnight theme; refreshed pages would otherwise regress dark-mode users. |
| D6 | **Re-introduce the StatusBar** | Yes | The refresh chrome re-adds the always-on baseline/branch/version footer (currently commented out in `MainLayout.tsx`). On-theme for management visibility. |
| D7 | **Track WF scope** | **RESOLVED → build both tracks** (user, 2026-05-19) | Track RF (8-page restyle) and Track WF (the 10 workflow features) are both in scope. RF executes first; WF is the second track. |
| D8 | **App accent colour** | App surface keeps **blue** action accent; `design-system.md` §3.1 forest accent applies to the **Verum marketing** surface only | The refresh is App-surface and deliberately blue-action (forest only for passed/released status). RF-0 records this so it does not collide with R-9 Phase B. |

---

## 3. Track RF — the 8-page restyle

### Foundation (must land first, in order)

| Ticket | Scope | Surface | Effort | Deps |
|---|---|---|---|---|
| **RF-0 — Token reconciliation** — Issue #478 — Shipped 2026-05-19, PR #479, merge `5626a97` (code `5e8d546`) | Reconcile the refresh "palette C" into `frontend/src/index.css` `--theme-*` — warm-grey light surfaces (`#FBFBFA` bg, `#F4F5F2` surface), add `--theme-purple`/`--theme-teal` + the richer status hues. Author the **midnight** equivalents (D5). Record D8 (App = blue accent; §3.1 forest = Verum marketing only). Do NOT import `colors_and_type.css` — its `.app` block fights `--theme-*`. No page changes. | frontend | S | none |
| **RF-1 — Shared chrome + primitive library** — Issue #481 — Shipped 2026-05-19, PR #482, merge `d2c6fa0` | Build the `_chrome.css` vocabulary as real React components/token classes: `Button`(+split/ghost/sm), `Tabs`, `StatusPill`, `DalChip`, `SeverityBadge`, `MonoChip`, `Avatar`, `StatTile`, `Banner`, `Card`, `FilterPill`, `Table` primitives. Restyle `Sidebar`/`Header` to the refresh look — **keep** the dynamic `MODULES` accordion, `Ctrl+B` collapse, `FeaturePackage` filtering, `GlobalSearch`. Re-enable `StatusBar` (D6). Replace the `Sparkles` AI icon with a neutral glyph (`design-system.md` §4). This IS the Phase-3 primitive library `ROADMAP-phase3.md` NX-6 called for. | frontend | M | RF-0 |

### Per-page tickets (each depends on RF-1; otherwise parallel)

| Ticket | Page(s) | Variant | Surface | Effort |
|---|---|---|---|---|
| **RF-2 — Dashboard** — Issue #484 — Shipped 2026-05-19, PR #485, merge `92df567` | `DashboardPage` | per D1 | **fullstack** — needs a `dashboard-summary` aggregate endpoint (module roll-ups, gate state, sparkline series; B also my-queue + activity) | L |
| **RF-3 — Project landing** — Issue #487 — Shipped 2026-05-19, PR #498, merge `2f068c7` | `ProjectLandingPage` | A (D2) | fullstack (light) — per-discipline progress + per-module health counts; shares RF-2's aggregate | M |
| **RF-4 — Verification** | `VerificationPage` + `TraceabilityMatrixView` (under `CertModuleLayout`) | A Runs tab + B Matrix tab | fullstack (light) — run-history series, value-vs-tolerance fields (verify they exist on `VerTestResult`) | L |
| **RF-5 — Safety** | `HazardsPage` + `SafetyOverviewPage` (under `SafetyLayoutPage`) | A Hazards tab + B Overview tab | **fullstack — audit Safety persistence first** (FTA/Markov/risk-matrix/method-coverage; NX-9 landed only Hazard+FMEA). May be heavy. | M-L |
| **RF-6 — Tasks** | `TasksPage` | single | frontend-only — Tasks data model is mature | M |
| **RF-7 — Issues** | `IssuesPage` + `IssueDetailPage` → split-view | single — **route consolidation**; verify the `linkage/issue` deep-link adapter + `/issues/:issueId` bookmarks | fullstack (light) — SLA field if absent | M |
| **RF-8 — Documentation** | `DocumentationPage` | single | **fullstack (light)** — swap `mockData.ts` → real `Document`/`EvidencePack` wiring (partly pre-existing roadmap work) | M |
| **RF-9 — Settings** | `SettingsPage` | single | frontend-only | M |

### RF sequencing

`RF-0 → RF-1 → { RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-8, RF-9 }`. After RF-1, the page tickets are dependency-independent. Traffic order: **RF-2, RF-3, RF-4** first (they carry the management-visibility theme hardest), then RF-5–RF-9. Per `AGENTIC-WORKFLOW.md` §8, run at most three streams concurrently and **never two repo-writing agents in one repo at once** — page tickets ship sequentially or in worktrees.

---

## 4. Track WF — the workflow memo (`improvements.html`)

A separate track. Each item is a feature, not a re-skin. The memo ranks them; #1 + #2 + #5 are its recommended first wedge. Several map onto existing `ROADMAP-phase3.md` work.

| Ticket | Proposal | Maps to | Effort |
|---|---|---|---|
| **WF-1** | "Today" cross-module inbox/queue | overlaps NX-10 audit unification + a new aggregate | L, fullstack |
| **WF-2** | Failure triage drawer — fail → issue → CR → re-run in one motion | new; Verification + Issues + CR | L, fullstack |
| **WF-3** | Action-first ⌘K command palette | extends `GlobalSearch` | M, fullstack |
| **WF-4** | Smart suspect-link resolver | suspect-link cross-cutting work + AI tier | L, fullstack + AI |
| **WF-5** | Always-on audit-pack readiness gauge | N-2.2 (export engine shipped) + a readiness compute | M, fullstack |
| **WF-6** | Auto-link suggester | AI T1 feature | M, fullstack + AI |
| **WF-7** | Role-shaped saved views | extends `SavedView` | M |
| **WF-8** | Universal baseline diff | R-4 `BaselineRoot` + gap-summary #7 | M, fullstack |
| **WF-9** | Keyboard-first everywhere | cross-cutting "keyboard-first absent" finding | M |
| **WF-10** | Notification clustering + quiet hours | extends the notification service | M |

Recommended WF first wedge (the memo's own): **WF-5** (cheapest — N-2.2 already shipped the export engine), then **WF-1**, then **WF-2**.

---

## 5. Token strategy

Three colour-token systems exist today and none match: **(A)** `--theme-*` GitHub palette (`index.css` — what the app actually uses), **(B)** R-9's `--ink-*/--surface-*/--accent-*` forest (`design-system.md` §3.1 — declared, largely unconsumed), **(C)** the refresh's `.app` "palette C" (warm-grey `#FBFBFA`, blue accent, richer status set — what the mockups use).

**Resolution (RF-0):** collapse palette C into `--theme-*`. The App surface keeps `--theme-*` keyed off `data-theme` (`light`/`midnight`). R-9's §3.1 forest tokens are scoped to the **Verum marketing surface** only (`/preview/landing`). Do not import `colors_and_type.css`. This leaves two intentional systems — App `--theme-*` and Verum marketing `--ink/surface/accent-*` — not four.

---

## 6. Execution — agentic workflow

Each RF-* and WF-* ticket runs the 8-stage `AGENTIC-WORKFLOW.md` pipeline: PM intake → Architecture → Design → Dev → Review ∥ Security → QA → Release → Doc/Close. RF tickets are frontend-or-fullstack — the Design stage runs. The e2e suite authenticates again (the e2e-auth fix landed this session) — RF page tickets get real e2e coverage. GitHub Actions CI is billing-blocked account-wide; merges proceed on green local gates per the established session posture until the user resolves GitHub billing.

---

## 7. Risks

1. **A/B variants undecided** (D1–D4) — block RF-2/RF-3 until D1/D2 answered; RF-4/RF-5 ship both variants as tabs.
2. **Midnight theme** — undefined for palette C; RF-0 must author it or accept a dark-mode regression.
3. **Dashboard/Project-landing aggregates** — the biggest net-new backend; verify `projectService` before scoping RF-2.
4. **Safety persistence** — NX-9 landed Hazard+FMEA only; RF-5 must audit FTA/Markov/risk-matrix depth first or it restyles a mock.
5. **Documentation mock data** — RF-8 pairs the restyle with mock→real wiring.
6. **Static-prototype trap** — the mockups hard-code nav, drop `Ctrl+B`, have no modals/drawers/mobile. Implement the visual output; keep all existing dynamic behaviour.
7. **Route consolidation (RF-7)** — Issues split-view merges two routed pages; verify deep-links + bookmarks.

---

## 8. File index

| Path | What |
|---|---|
| `verum-design-system/README.md`, `project/README.md`, `project/SKILL.md` | The design system — two surfaces, tokens, voice, foundations |
| `verum-design-system/chats/chat{1,2,3}.md` | Design iteration transcripts — intent (chat3 governs) |
| `verum-design-system/project/refresh/0{1-8}-*.html` | The 8 refreshed page mockups (A/B on 1–4) |
| `verum-design-system/project/refresh/_chrome.{html,css}` | Shared chrome — sidebar/header/layout/primitives |
| `verum-design-system/project/refresh/improvements.html` | The workflow memo — Track WF source |
| `verum-design-system/project/refresh/index.html` | Refresh index |
| `verum-design-system/project/colors_and_type.css` | Token reference (NOT imported — reconciled by RF-0) |
| `improvements/ROADMAP-refresh.md` | This file |
