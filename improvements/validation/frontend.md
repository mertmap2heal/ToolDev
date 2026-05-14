# Validation — Frontend Review

Five pages, each backed by a single shared service (`frontend/src/services/validation.service.ts`, 638 lines) and a 14-component supporting fleet under `frontend/src/components/validation/`. The pages are all behind `<FeatureGuard moduleId="validation">` and ship in the Complete tier per `feature-flags.md`.

---

## 1. `ValidationPage` (3,063 lines) — the spine

**Path.** `/projects/:projectId/validation` → `frontend/src/pages/Validation/ValidationPage.tsx`.

**What it does.** List view of `ValidationItem` rows with create / from-requirements / bulk / sign-off / baseline / settings / DER / activity surfaces. Filters: search, status, method, milestone, owner, criterion-outcome, tags, starred-only, overdue-only, suspect-only, archived. Two view modes (list and board) with localStorage-persisted state per project. Keyboard-first: `/`, `n`, `N`, `?`, `j`, `k`, `Enter`, `Esc` (with capture-phase listeners so `/` beats Firefox quick-find). Eight always-on table columns plus five togglable (method, milestone, priority, due, sign-offs). Saved views (personal + project scope) persisted server-side via `SavedView` with `viewKind = 'validation'`.

**Above-the-fold compliance with `design-system.md`.** The page does these things right:

- §2.4 progressive disclosure — primary actions ("New item", "From requirements") right-aligned in the title row; secondary actions ("Baseline", DER, Activity, Settings) tucked behind a `More` dropdown.
- §8.2 objective view as home view — coverage strip (`Validation items` / `Requirements covered` / `Validated` / `Without validation`) sits directly under the title and links into the uncovered-requirements modal on click. This is closer to the §8.2 ideal than the rest of the app.
- §6.2 canonical list view — `<thead>` + `<tbody>` with mono ID column, status pill, owner, updated timestamp; togglable columns hidden by default.
- Empty / loading copy is concrete: "Loading baseline B-2024-11..." is not used but "No baselines yet. Open the Validation page and click 'Baseline state'..." is — engineer-respecting per §5.4.

**Where it diverges from `design-system.md`.**

- **Colour tokens.** The page uses module-local CSS custom properties from `validation-v2.css` (`--pv-bg`, `--pv-fg`, `--pv-line`, `--pv-amber`, `--val-bar-validated`, etc.) instead of the canonical `surface.base` / `accent.primary` tokens in §3.1. This is the parameter-improvements convention and is consistent within the module, but it duplicates the design system. Cross-cutting: every page in the module pulls `import './validation-v2.css'` separately rather than via Tailwind theme extension. The token migration is a separate ticket on top of all per-module pages, not specific to Validation.
- **Border-radius 6px on the coverage region and sub-bar (`borderRadius: 6`).** Allowed values from §3.5 are 2 / 4 / 8 / 16 / 9999. 6px is a deliberate choice (between `radius.sm = 4` and `radius.md = 8`) but is technically outside the token set.
- **Inline styles everywhere.** `style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--pv-fg-3)' }}` is the norm. The page does not use Tailwind utility classes consistently; it mixes Tailwind (`flex items-center gap-2`, `space-y-4`) with raw inline styles. Not buyer-visible but high maintenance debt.
- **One sin in the `style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}` on the More menu** — `design-system.md` §3.6 allows shadows on dropdown menus, so this is in policy, just noted for review.

**Competitor mapping.**

| Capability | This page | Jama Connect | Polarion | Codebeamer |
|---|---|---|---|---|
| Saved filter views | Personal + project scope, stored in `SavedView.viewKind='validation'` | Native (Advanced Filters with sub-filters across relationships) | Native (saved queries in Query Builder) | Native (in Tracker tables) |
| Inline rename on row | Double-click on title cell | Yes (List View) | Yes (table inline) | Yes |
| Group by category | Group by milestone (collapsible) | Yes (Component tree) | Yes (Document hierarchy) | Yes (Tracker tree) |
| Coverage roll-up on page entry | Yes — Validated/Total + Suspect chip | Coverage Report (separate view) | Multilevel Traceability widget (separate page) | Coverage Browser (separate page) |
| Burndown by milestone | Yes — stacked horizontal bar of validated/executed/planned/blocked/obsolete per milestone | Add-on (eazyBI for Jira-Xray) | LiveDashboard widget | Widget |
| Suspect propagation | `isSuspect` flag derived server-side (`linked-requirement.updatedAt > item.updatedAt`) | Live Traceability suspect flag | Native | Native |

Where it leads: **the coverage strip + milestone burndown + suspect chip + "Without validation" launcher on the same screen** is more opinionated than any of the named competitors. Jama's `Coverage Report` is a separate view requiring authoring; Polarion's `Multilevel Traceability` is a widget you must drop into a LiveReport page; Codebeamer's `Coverage Browser` is a tab on the tracker. The Validation page renders this state by default — which is exactly the `design-system.md` §8.2 ambition.

Where it lags: **no diff-view between two baselines on this page** (the diff lives only inside `BaselinesPage`). Jama, Polarion, Codebeamer all ship a baseline-vs-baseline diff at the list level.

---

## 2. `DERView` (299 lines) — printable, aerospace-specific

**Path.** `/projects/:projectId/validation/der` → `frontend/src/pages/Validation/DERView.tsx`.

**What it does.** Read-only, milestone-grouped table of every live `ValidationItem`, plus a 5-tile coverage summary (Items / Validated / Requirements covered / Blocked / Suspect). Print stylesheet hides the `Back to Validation` / `Print` / `MD` / `PDF` buttons (`@media print { .der-print-hide { display: none !important; } body { background: #fff; color: #000; }`). Three export buttons: Print (browser), Markdown (`/report.md`), PDF (`/report.pdf` via pdfkit on the backend).

**Why this surface is load-bearing.** DER is the **Designated Engineering Representative** — a person formally appointed by the FAA under 14 CFR Part 183 to act on the Administrator's behalf when issuing findings of compliance. EASA has the parallel role (DAS — Design Assurance Service appointee). When a DER reviews a programme, they need to see, in one read-only surface:

1. Every objective the programme is claiming to satisfy.
2. Which artefacts contribute to each objective's evidence.
3. Whether each artefact is signed off.
4. Whether the upstream trace is broken (suspect propagation).
5. Whether the cert package is exportable.

The current `DERView.tsx` is **closer to a printable validation grid than a real DER pre-check.** It groups by milestone — useful — but does not surface objective satisfaction, broken traces, evidence gaps, or sign-off chains in a way that maps onto the DER's findings template. Compare to `vision-and-usp.md` §9.3: "*Automated DER pre-check. A T2 agent walks the whole project and produces a DER findings-ready report listing every unsigned objective, every broken trace, every evidence gap.*" That work is in front of us; the current page is the placeholder.

**Print stylesheet — what works, what is missing.**

Works:
- `body { background: #fff; color: #000; }` resets the dark-mode background on print.
- `a { color: inherit !important; text-decoration: none !important; }` prevents the link colour from carrying over.
- `.der-card { break-inside: avoid; }` keeps a milestone group together on one printed page when it fits.

Missing (compared to a regulator-ready printout):
- No header on every printed page (programme name, project ID, baseline ID, date, page X of Y).
- No footer with "Generated by [Tool] · [version] · [date]" attribution.
- No QR / signature block for the DER's wet-ink countersign.
- No "Read-only audit view" watermark in the print stylesheet — the on-screen pill at line 89 is `.der-print-hide`-adjacent so it shows on print, but it is rendered as a small pill, not a corner watermark.
- No `@page { size: A4; margin: 18mm 14mm; }` declaration — current print uses browser defaults.

The fix is non-trivial but high-buyer-value: a DER who can print a PSAC-shaped, milestone-indexed, sign-off-stamped, watermarked PDF in one click is a demo moment no incumbent matches (`gap-summary.md` #2 — `vision-and-usp.md` §8.3 — "audit package as a command").

**Competitor mapping.** No competitor in `competitor-matrix.md` ships a DER-specific view. Jama / Polarion / Codebeamer / DOORS all rely on "build a Velocity/BIRT/LiveReport template for your auditor's preferred format." That is the customisation tax `vision-and-usp.md` §8.3 attacks. Shipping a DER view is the opening move — making the printout *actually regulator-grade* is the follow-through.

---

## 3. `BaselinesPage` (407 lines) — list + drawer + diff

**Path.** `/projects/:projectId/validation/baselines` → `frontend/src/pages/Validation/BaselinesPage.tsx`.

**What it does.** List every `ValidationBaseline` (label, description, item count, creator, age) with click-to-open right-side drawer (`width: min(880px, 96vw)`). The drawer shows:

- Header with baseline label, item count, "taken X ago by Y", optional description.
- A diff summary: `+N added`, `-N removed`, `~N changed`, `N unchanged`. Computed client-side by comparing `openBaseline.snapshot[]` (frozen JSON from `ValidationBaseline.snapshot`) against `liveItems[]` (current state via `validationService.list`). The diff covers `status`, `targetMilestone`, `methodType`, `priority`, `title`, and a derived `criteriaMet` count.
- An expandable `<details>` showing field-level changes per item (`status: BLOCKED → VALIDATED`, etc.) with deep-forest-style colour coding (`from` red, `to` green) — note these use raw hex (`#1B4332`, `#8B0000`) inline, not Tailwind classes.
- The full frozen snapshot rendered as a table (Key / Title / Method / Milestone / Status / Criteria / Sign-offs).

**Strengths.**

- Diff is real, not "we'll add it later." Field-level diff is exactly what Jama's baseline diff, Polarion's paragraph history, and Codebeamer's stream diff offer — and is gap #7 in `gap-summary.md` (diff view between artefact versions). For this one entity (ValidationItem) the gap is closed at the page level.
- The drawer correctly stops backdrop clicks (`onClick={(e) => e.stopPropagation()}` on the panel) and listens for ESC on open (`useEffect → keydown → 'Escape' → setOpenId(null)`).
- The empty state is engineer-respecting per `design-system.md` §5.4: "No baselines yet. Open the Validation page and click 'Baseline state' to take the first snapshot."

**Weaknesses.**

- **`MILESTONE_LABEL` is referenced in a dead `<span style={{ display: 'none' }}>` at line 400.** Comment says "kept here to avoid unused import noise" — this is a real-world `eslint-disable`-style hack and should be removed. Either use the label in the milestone column or remove the import.
- **The diff is client-side only.** A 5,000-item project would download every baseline and the live list before showing diffs. For aerospace small teams (3-50 engineers per `vision-and-usp.md` §4) this is acceptable; once a customer crosses ~10k items it must move server-side.
- **No baseline-vs-baseline diff.** The drawer compares baseline N to current state only. Comparing baseline N to baseline M (the "between PDR and CDR" question) is what Jama, Polarion, and Codebeamer all offer.
- **No signature on baselines.** `gap-summary.md` cross-cutting refactor #3 — the baseline is created with `createdById` and `createdAt` but no reauthentication, no immutable lock, and the schema does not record a signature row against the baseline. Today's UI offers a `Trash2` icon to delete any baseline by any project member — a Part-11 violation if used as the cert anchor.

**Competitor mapping.**

| Capability | This page | Jama | Polarion | Codebeamer |
|---|---|---|---|---|
| Named baseline list | Yes | Yes | Yes (Document Baselines) | Yes (Stream Baselines) |
| Baseline-vs-current diff | Yes (client-side) | Yes | Yes (paragraph-level) | Yes |
| Baseline-vs-baseline diff | **No** | Yes | Yes | Yes |
| E-signature on baseline | **No** | Yes (Part 11) | Yes (workflow gate) | Yes (Part 11) |
| Auto-baseline on review start | **No** | Yes (Review Center) | Yes (workflow) | Yes |

---

## 4. `ActivityPage` (230 lines) — project-wide audit feed

**Path.** `/projects/:projectId/validation/activity` → `frontend/src/pages/Validation/ActivityPage.tsx`.

**What it does.** Reads `AuditLog` rows scoped to `action` starting with `validation:` (via `GET /projects/:projectId/activity?limit=300`). Renders a single-column list grouped by action chip, filterable by action (dropdown of distinct seen actions) and by user. Clicking a row navigates to the validation drawer (`?open=<id>`) or to the baselines page when the action mentions `baselineId`.

**Strengths.**

- Direct reuse of the existing `AuditLog` table — no parallel feed. This is the pattern `gap-summary.md` cross-cutting refactor #6 wants for every module ("eleven audit tables → one universal provenance log").
- Action-chip colour-coding maps cleanly to `validation-v2.css` design tokens (`--val-bar-validated` for sign-offs, `--val-bar-blocked` for deletes, `--pv-amber` for suspect-ack). Consistent with the rest of the module.
- Deep-link target is computed from the JSON `details` blob — works for item-scoped events (`validationItemId`) and baseline-scoped events (`baselineId`). No deep-link for bulk events without an item id, which is correctly flagged in the title ("No deep-link for this event type").

**Weaknesses.**

- **No date filter.** Today filters are action + user only. For a long-running project the list is unbounded (capped at 300 server-side). Adding date-range filter is one ticket.
- **No grouping or daypoint summary.** Every event is a flat row. Jama's Review Center activity feed groups by day; Codebeamer's Review Hub UI 3.2 groups by review. For 300+ events the flat list is harder to scan.
- **`details` field rendered as raw JSON.** The third column renders `r.details ?? ''` as text — meaning a user sees `{"validationItemId":"abc-123","key":"VAL-014","reason":"superseded by VAL-014"}` raw. Helpful for forensic readers, painful for engineers. A two-line summary per action type would be a quick win.
- **The page does not consume `validation:settings-update`, `validation:comment-create`, `validation:comment-update`, `validation:comment-delete` actions visibly in the action-color-coding helper** — they fall through to `var(--pv-fg-3)` (neutral). Not a defect but the visual density loses information.

**Competitor mapping.** This is the closest the module gets to a Jama Activity Stream / Polarion History View / Codebeamer Audit Trail. None of those competitors ship the deep-link-on-click pattern (clicking a Jama activity event takes you to the item with no scroll-to-context). This implementation is competitive on UX; weaker on filtering depth.

---

## 5. `ValidationSettingsPage` (462 lines) — prefixes, tags, criterion templates

**Path.** `/projects/:projectId/validation/settings` → `frontend/src/pages/Validation/ValidationSettingsPage.tsx`.

**What it does.** Three sections:

1. **Key prefixes.** Edit the per-project `ValidationSettings.prefixes` JSON array (`{ prefix, label, description?, isDefault }`). Used by `createWithUniqueKey()` in the backend service to allocate `VAL-001` / `VAL-SYS-001` / etc. with a Postgres advisory lock per prefix. Validation: uppercase letters/numbers/dashes ending in a dash; one default; unique label.
2. **Tag library.** Edit `ValidationSettings.tags` JSON array (`{ label, color }`). Tags on items can ONLY be picked from the library — free-text tags are rejected server-side. Five-colour palette: `#1B4332` (deep forest, matches `accent.primary`), `#B8860B` (status.warning amber), `#8B0000` (status.danger), `#2D4A63` (status.info), `#6B6660` (ink.muted).
3. **Criterion templates.** Edit `ValidationSettings.criterionTemplates` JSON array (`{ label, criteria: string[] }`). Templates are insertable into the criteria list of any item from the drawer. Replaces a localStorage-only v1 — see `ValidationItemDetailDrawer.tsx:248` where the migration from localStorage is implemented.

**Strengths.**

- The tag palette **exactly matches** the `design-system.md` §3.1 token list. This is the first per-module settings page that picked up the deep-forest accent. (Worth noting in a positive review.)
- The page enforces `requireProjectOwnerOrAdmin` server-side (`router.put('/projects/:projectId/settings', requireProjectOwnerOrAdmin, updateSettings)`) and renders a `ReadOnlyView` fallback when the API returns "owner or admin only". Correct gating.
- Project-scoped criterion templates replace per-browser localStorage. This is the pattern more modules should follow (`gap-summary.md` honourable mention).

**Weaknesses.**

- **The page mixes Tailwind classes (`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900`) with the validation-v2 CSS variable pattern used by the other four pages.** Inconsistency — the form fields under "Key prefixes" use Tailwind dark-mode variants and the standard "Add prefix" affordance is a blue-text link (`text-blue-600 hover:text-blue-700`). Blue is on the `design-system.md` §3.1 kill-list outside `status.info`.
- **No "save indicator" persistence cue beyond a 1.5s "Saved" pill in the button.** A user who types into 12 fields, clicks Save, sees "Saved" briefly, and then refreshes the page has no way to verify the change other than checking each field. Compare to `design-system.md` §7 motion: "Success confirmations: a 1.5s pill that slides in from the top-right." The current pattern is in spirit but understates persistence.
- **No "Reset to defaults" affordance for prefixes.** The default `[{ prefix: "VAL-", label: "Validation", description: "Default validation activities", isDefault: true }]` lives in the schema but the UI provides no way to revert. If a user deletes all prefixes and saves, the server-side validation rejects the empty array (`"at least one key prefix is required"`) — so the only path back is recreating the default by hand.
- **The "Validation Approver" engineering role bootstrap is invisible to settings.** The role is auto-upserted on module boot (`ensureValidationApproverRole()` at `validation.routes.ts:56`). The settings page does NOT show that this role exists, who holds it on this project, or how to assign it. The role is referenced in the drawer copy ("`Validation Approver` role-holders are the intended signers") but the user cannot administer it from here. Gap to close.

**Competitor mapping.**

| Capability | This page | Jama | Polarion | Codebeamer |
|---|---|---|---|---|
| Per-project key prefix | Yes | Limited (item-type prefix is tenant-level) | Limited | Yes (tracker config) |
| Per-project tag library with enforced membership | Yes — rejects free-text tags | Yes | Yes | Yes |
| Per-project criterion templates | Yes — moves from localStorage to backend | Add-on (template library) | Native (Document templates) | Native |
| Role-aware sign-off settings | **No** | Yes (Review Center config) | Yes (workflow signers) | Yes (Review Hub) |

---

## 6. Cross-page patterns

### Frontend service (`validation.service.ts`, 638 lines)

One service object (`validationService`) exposing 35 methods. Pattern: `apiClient.get/post/put/delete(/validation/projects/:projectId/...)` returning `ApiResponse<T>`. CSV / PDF / MD downloads use a custom `triggerDownload(blob, filename)` helper to avoid `window.open` for protected endpoints — correct pattern, copy-paste candidate for other modules.

### Detail drawer (`ValidationItemDetailDrawer.tsx`, 1,835 lines)

The biggest non-page file in the module. Mirrors the canonical `RequirementDetailDrawer` / `ParameterDetailDrawer` pattern from `react-typescript.md`. Notable:

- **Bulk sign-off is in the dock** (per recent commit `afb8591 feat(validation): revoke sign-off from drawer + bulk sign-off in dock`). Sign-off and revoke flows live in this drawer.
- **`canSignOff = !!draft && draft.status === 'EXECUTED' && !isAuthor`** — enforces the "author cannot sign off own work" rule client-side (server-side is the authority, but the UI does not show the affordance to the author).
- **Ambiguity check runs inline against the title** (`checkAmbiguity(draft.title)` at line 551) — flags hedging language as "Advisory" with severity tagging. This is the T2 EARS-adjacent advisor mentioned in `gap-summary.md` #3, here implemented for one field on one entity. Pattern worth extending.
- **Markdown editor with `@`-mention support against project members and `REQ-/VAL-/PRM-/`-style entity chips.** Consistent with the user's memory preference ("Standardized markdown editor").
- **Comments use the shared `EntityDiscussion` component.** Consistent with the user's memory preference ("Universal chat/discussion — one shared `<EntityDiscussion>`").

### Deep-link adapter

`frontend/src/linkage/` has 18 entity adapters (per `architecture.md`). **There is no `validation.ts` adapter.** A cross-module deep-link to a validation item from (e.g.) a change request or an issue cannot be built without one. Today the codebase navigates via `/projects/:projectId/validation?open=<itemId>` directly — but this is not registered in `buildDeepLink.ts`. Quick win.

### Onboarding banner (`ValidationOnboardingBanner.tsx`, 77 lines)

A first-run hint pointing users at the "From requirements" action. Dismissible. Per `design-system.md` §5.4 the copy is concrete ("Start with a system-level requirement, or import from an existing baseline."). Consistent with the design system, no findings.

### Help drawer (`ValidationHelpDrawer.tsx`, 259 lines)

In-app reference to validation concepts (Validation vs Verification, method types, milestones, status meaning, sign-off rules). Pairs with a `<Link to="/help/validation">` in the title bar. Good pattern — `kb/user-manual-standards.md` calls for in-product help linked to the manual, and this page does it.
