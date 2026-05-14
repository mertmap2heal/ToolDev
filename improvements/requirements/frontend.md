# Requirements — Frontend Review

Scope: `frontend/src/pages/Requirements/RequirementsPage.tsx` (4,848 lines), `RequirementsDashboardPage.tsx` (224 lines), `RequirementsSettingsPage.tsx` (96 lines), `TraceabilityViewsPage.tsx` (885 lines), plus the support components `RequirementDetailDrawer.tsx` (2,748 lines), `CreateRequirementModal.tsx` (2,661 lines), `EditRequirementModal.tsx` (2,523 lines), `RequirementQualityPanel.tsx` (172 lines).

Total frontend surface for this package: ~14,000 lines across the page and its eight direct components. For comparison, the entire Parameters page is 3,200 lines and is widely regarded as the cleanest module in the codebase. The Requirements flagship is more than four times that size in one file.

---

## 1. `RequirementsPage` — a 4,848-line single page

### 1.1 State management

The single component owns **57 separate `useState` hooks** (counted lines 175–254). They split into four conceptual groups:

| Group | Count | Examples |
|---|---|---|
| URL-bound view state | 14 | `urlHydrated`, `selectedComponentId`, `selectedFunctionId`, `selectedVerificationNode`, `isPBSPanelOpen`, `panelTabDropdownOpen`, `leftPanelTab`, `searchQuery` |
| Modal-open booleans | 10 | `isCreateModalOpen`, `isTraceMatrixOpen`, `isSuspectReviewOpen`, `isBaselineManagerOpen`, `isExportOpen`, `isImportOpen`, `isAuditLogOpen`, `isDiagramOpen`, `isQualityPanelOpen`, `isChangeRequestModalOpen` |
| Filter / sort / pagination | 11 | `statusFilter`, `priorityFilter`, `ownerFilter`, `sourceFilter`, `requirementTypeFilter`, `categoryFilter`, `verificationStatusFilter`, `reviewStatusFilter`, `sortBy`, `sortOrder`, `currentPage` |
| Per-action transient | 22+ | `inlineEdit`, `lockWarning`, `linkedElementPreview`, `addLinkSourceRequirement`, `requirementsFlash`, `editingRequirement`, `deleteConfirmation`, `parentRequirement`, `initialComponentId`, `initialFunctionAllocations`, ... |

The dropdown-related state has its own pattern: seven separate booleans (`traceabilityDropdownOpen`, `dataDropdownOpen`, `viewDropdownOpen`, `analysisDropdownOpen`, `sortDropdownOpen`, `panelTabDropdownOpen`, `bulkActionDropdownOpen`) plus seven refs and a single 30-line `useEffect` for outside-click detection (lines 791–818). This is replicated boilerplate; a `useDropdown(ref)` hook would collapse it to seven lines.

**Symptom.** Adding any new dropdown requires editing six places: state declaration, ref declaration, outside-click `useEffect`, the trigger button, the panel JSX, and the close handler on every other dropdown. The branch `feature/validation-page` in the current git status shows the cost — re-touching seven of these locations to add an eighth dropdown is the expected cost of any new toolbar action.

**Recommendation.** Extract a `Toolbar` component (or, better, replicate Polarion LiveDocs's pattern of one dropdown that hosts every command). The new component receives `open: string | null` and `setOpen(name | null)` as props from the page. The page stays simple; the toolbar owns its own keyboard navigation, outside-click, and ARIA wiring.

### 1.2 Service coupling — the "10 services" problem

The imports at lines 33–43 reach into:

```
requirementService            (paginated + non-paginated requirement queries)
functionService               (functions for left-panel allocation tree)
issueService                  (linked issues for expansion row)
changeRequestService          (linked CRs for expansion row)
traceabilityService           (legacy trace link surface)
linkService                   (LINKAGE_V1 polymorphic link surface — coexists with above)
componentService              (PBS components)
verificationService           (test plans, cases, runs for verification tab)
baselineService               (baseline snapshots)
requirementsViewPreferencesService (server-persisted UI prefs)
```

Plus `loadPBSComponentTreeAsync` from the PBS module, plus the verification tree component which pulls its own services.

Three observations:

**A. Two link APIs live side-by-side.** `traceabilityService` (legacy) and `linkService` (new) co-exist because of the `LINKAGE_V1` flag (`config/featureFlags.ts`). The component re-fetches both and chooses based on the flag plus the baseline view state (`effectiveLinks` at line 1027). This is fragile: any future link feature has to be implemented twice or be guarded. The flag has shipped — kill it and migrate.

**B. The page hosts 13 React Query hooks.** Each is reasonable in isolation; together they make the dependency graph illegible. A `useRequirementsPageData(projectId, filters)` hook that returns `{ paginatedData, allRequirements, baseline, functions, traceLinks, links, issues, changeRequests, componentTree, verificationPlans, verificationCases, verificationSetups, verificationRuns }` would let the JSX read like a description of what is on the page, not a list of fetches that happen to need their results.

**C. The component imports its own children's services.** `VerificationTreePanel` is a self-contained component, but `RequirementsPage` also imports `verificationService` directly (line 40) to satisfy the same data. The child should own its own data. Today the parent runs the queries and passes the data down — the child has no way to refresh independently.

### 1.3 Performance

Three slow patterns to address before the page scales past ~500 requirements:

**Polymorphic link merging in the client.** `effectiveLinks` (line 1027) and `allocationLinks` (line 1036) build their own derived sets from the entire project's link table. Every render walks the array. With 5k links (typical mid-size programme) this is 5k items × N filter passes per render. The `useMemo` is correct, but the inputs change on every save, so memoisation rarely helps. Move filtering to the server: `GET /api/v1/links/:projectId?linkType=allocated_to&sourceType=requirement`.

**`allRequirementsLive` separate from `paginatedData`.** Line 863: the page fetches every requirement for the project regardless of pagination, because the PBS tree and the document view need them all. For projects with >1k requirements this is a multi-megabyte response on every page load. Jama Document View paginates the document; we should too.

**`buildRequirementLinkedItems` walks every requirement for every expanded row.** Imported at line 47 from `linkage/buildRequirementLinkedItems.ts`. Called inside the row-expansion render path. The function walks all links and all functions/CRs/issues for each row. With 50 visible rows and 5k links the per-render cost is 250k iterations. The TraceLink table already carries `cachedSourceDisplayId`/`cachedSourceTitle`/`cachedTargetDisplayId`/`cachedTargetTitle` (schema line 658) — denormalisation that is currently unused on the read path.

### 1.4 Accessibility

Tested against `design-system.md` §9 ("every focusable element must have a visible focus ring, every icon-only button must have an `aria-label`, every form field must have a real `<label>`").

| Issue | Where | Severity |
|---|---|---|
| Icon-only buttons missing `aria-label` | Lines 2451, 2642, 2667 — pencil, comments, lock icons | High — fails WCAG 2.1 4.1.2 |
| Custom dropdown without ARIA `role="menu"` / `role="menuitem"` | All seven toolbar dropdowns (lines 3082, 3097, ...) | High — keyboard navigation broken |
| Sort buttons (`ArrowUp` / `ArrowDown`) without descriptive label | Header cells with `ResizableTh` | Medium — sort-direction unannounced to AT |
| Inline edit `<input>` without label | Lines 2326, 2370, 2417, 2470, 2506 | High — every inline-edit cell |
| Click handlers on `<td>` without `role` and keyboard handler | Line 2306 (the description cell) | High — non-keyboard-accessible edit trigger |
| Focus trap in modals | `MODAL = '.fixed.inset-0'` but no focus trap library — `Tab` escapes the modal | Medium |
| Colour contrast on `text-blue-500 dark:text-blue-400` body text | Line 127 — `LinkedItemTypeIcon` | Low — used on small icons only |

The European Accessibility Act (June 2025) makes WCAG 2.1 AA a legal requirement for products sold to EU consumers. Aerospace small teams are EU-heavy. Fix before launch.

### 1.5 UX gaps vs competitors

Lined up against the four named adversaries in `competitor-matrix.md` §1:

| Capability | Jama (Document View) | Polarion (LiveDocs) | DOORS Next | Us today |
|---|---|---|---|---|
| Spec scrolls as a single document | Yes — paragraph-per-Work-Item | Yes — paragraph-per-Work-Item | Yes — module view | Partial — one card per requirement in document view, no spec-wide scroll |
| Paragraph reorder via drag | Yes | Yes | Yes | No |
| Inline-edit any field in document view | Yes | Yes (every field) | Yes | Title + description only (`RequirementDocumentCard`) |
| Word-style heading numbering (1.1.1, 1.1.2, ...) | Yes | Yes | Yes | No |
| Diff between baselines paragraph-by-paragraph | Yes | Yes (paragraph-level) | Yes (streams diff) | No |
| Suspect-link badge inline with the source paragraph | Yes (subtle) | Yes | Yes | No — surfaced in a separate "Suspect links" modal |
| AI suggestion inline with refused-save explanation | Jama Advisor (40 INCOSE rules) | Polarion Copilot (Content Validation) | Engineering AI Hub | No — `RequirementQualityPanel` runs project-wide on demand and returns SMART warnings only |
| Cell-level multi-select for bulk-edit | Yes | Yes | Yes | Row-level only |
| Saved column layout per user per project | Yes | Yes (Advanced Filters) | Yes | Yes (`requirementsViewPreferencesService`) — but per-project only, no per-user |
| Frozen left columns when scrolling horizontally | Yes | Yes | Yes | No — `ResizableTh` does width only |

The single most visible gap is **document mode parity**. Today's "document view" mode (set by `localStorage.requirements-list-view`) renders one card per requirement and stacks them. It is not the same surface as a Word-style spec scroll. An aerospace chief engineer who is migrating from DOORS will compare the two screens side by side and conclude we are not ready.

### 1.6 UX gaps vs `design-system.md`

| Rule | State | Citation |
|---|---|---|
| No `rounded-2xl` | Violated 2× in `RequirementDetailDrawer.tsx:1376, 2621` | `design-system.md` §3.5 |
| No `blue-*` tokens — accent is `#1B4332` deep forest | Violated 83× in `RequirementsPage.tsx`, 40× in detail drawer | `design-system.md` §3.1 |
| Lucide stroke 1.75px, two sizes only | Mixed — 12, 13, 14, 16, 18, 20 used across the file | `design-system.md` §4 |
| Body default 15px | Default Tailwind `text-sm = 13px` used throughout | `design-system.md` §3.3 |
| No sparkles for AI | OK — none present (`Zap` and `Wand2` used) | `design-system.md` §4 |
| Empty states address the engineer | Mixed — `<Inbox size={32}>` with "No requirements found" generic text (line 2274 area) | `design-system.md` §5.4 |
| Group headers visually distinct | OK — `groupByType` mode renders type buckets | `design-system.md` §6.2 |
| One decision per screen | Violated — the toolbar exposes 8 simultaneous dropdowns | `design-system.md` §2.4 |
| Show the standard in context | Violated — DAL, MoC code, objective satisfaction nowhere visible inline on the row | `design-system.md` §2.3 |

The third row is the loadbearing one for the package. `design-system.md` §2.3 — "Show the standard in context, never as a separate module" — is the doctrinal foundation for the certification-native claim. Today's row shows ID, title, status, priority, owner. It does not show: DAL, objective code, MoC, evidence count. The engineer has to open the drawer to see whether the row is even valid for its DAL.

---

## 2. `RequirementsDashboardPage` (224 lines)

### 2.1 What it shows

Five tiles (total requirements, coverage %, suspect links, baselines, recent baselines list) and two grouped count panels (by review status, by verification status). Wired to `getRequirementsDashboard` which serves a single response with all six aggregates (`requirement.controller.ts:3294`).

### 2.2 What it does not show

Per `design-system.md` §8.2:

> The default landing for a new project is the **objective completion matrix**, not a list of requirements. The user sees the DO-178C objective table with live completion status against their current artefacts.

The dashboard today is the inverse of this rule — it shows requirement counts, not objective satisfaction. The five tiles are all "how many things do we have" not "how many objectives are closed." This is the single biggest design-doctrine miss in the package.

What the page should show:

| Section | Content | Backed by |
|---|---|---|
| Objective satisfaction matrix | DO-178C Tables A-1 through A-10, rows = objectives, cells = pass/partial/fail with evidence count and signature state | `CertObjective` + `CertObjectiveRequirementLink` + `RequirementReview` + `VerEvidence` |
| Suspect links queue | Top 20 suspect links with author, date, target type | `TraceLink.isSuspect = true` |
| Reviews pending my action | Reviews where I am a reviewer in `pending` or `in_progress` state | `RequirementReviewer` (filtered by `req.user.id`) |
| Baseline pipeline | Current draft → in review → approved → frozen states with names and dates | `Baseline.status` enum |
| Standards adoption | DO-178C / DO-254 / ARP4754A — which is the project's primary, which DALs cover which artefacts | `Project.strictLifecycleGates` + `CertContext` |

The dashboard rewrites the conversation from "your team has 412 requirements" to "your team has closed 23 of 71 DO-178C objectives and the next review hits 41 of them." That is the demo moment in `vision-and-usp.md` §10.

### 2.3 Visual issues

- `bg-blue-100 dark:bg-blue-900/30` icon backgrounds on every tile (lines 41, 101, 119, 137) — violates §3.1.
- `rounded-xl` (lines 70, 82, 96, 116) — `design-system.md` §3.5 allows `radius.md = 8px`; `xl` is reserved for modals.
- `animate-pulse` skeleton loaders — OK, this is the `design-system.md` §7 shimmer pattern, but the skeleton dimensions do not match the final tile content shape so the layout shifts on load.
- No empty state — when a project has no requirements yet, the page renders six tiles with `0` everywhere. Per §5.4 empty states should name the action ("No requirements. Start with a system-level requirement, or import from an existing baseline.").

---

## 3. `RequirementsSettingsPage` (96 lines)

### 3.1 Scope

A flat list of `CustomOptionsManager` widgets for: requirement types (`RequirementTypesManager`), baseline type, baseline review type, requirement level, risk, complexity, verification method, source. Eight custom-options surfaces in one page, each rendering a similar add/edit/delete UI.

### 3.2 The architectural problem

Per `vision-and-usp.md` §9: "Custom-field anarchy on requirements. We do not allow arbitrary custom fields on requirements. Users who need them are using us wrong." And `design-system.md` §2.1: "We ship opinionated schemas per standard — DO-178C, DO-254, ARP4754A — that are versioned centrally, not per-tenant."

This page is the exact opposite of that policy. Customers configure their own requirement types, their own levels, their own risk classifications, their own verification methods, and their own sources. Two consequences:

- **Standards-loaded option sets are not visible.** A team starting a DO-178C project does not get the canonical types (Functional, Performance, Interface, Safety, Security, Environmental) pre-loaded with their standard mappings. They start blank.
- **Cross-project inconsistency.** Project A's "High Risk" and Project B's "High Risk" are different rows with different IDs. The compliance matrix across projects becomes impossible to roll up.

The page should be deprecated in favour of standard-scoped templates. Add a single "DO-178C" / "DO-254" / "ARP4754A" project setting that loads the canonical option sets; let a DER override per-standard in a separate "advanced" mode. This is `design-system.md` §2.4 ("Progressive disclosure. One decision per screen.").

### 3.3 Visual issues

- Three independent grid layouts (`grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` on line 62) for what is functionally one settings page. Inconsistent vertical rhythm.
- The "Baseline Options" section nests under an `h3` while the other custom-options sit directly under `h2`. Heading hierarchy is broken.

---

## 4. `TraceabilityViewsPage` (885 lines)

### 4.1 What works

The page implements a sound saved-views surface: folder tree on the left, view list in the middle, embedded `TraceabilityMatrix` on the right. Backed by `traceabilityViewsService` which surfaces 15 endpoints (folders + views + revisions + audit + baseline-run + compare). The revision model (`SavedViewRevision`) and audit model (`SavedViewAuditEvent`) genuinely earn audit-grade — they snapshot the view definition on every change, with audit-trail rows for create/update/delete/rollback. This is one of the few cases in the codebase where versioning is done well.

### 4.2 What is broken

**Two separate "saved view" stories.** The codebase has `SavedView` (this page) and `requirementsViewPreferencesService` (the column-width + visibility state on `RequirementsPage`). They write to different tables, use different audit semantics, and have no shared abstraction. A user who saves a column layout on the main page cannot share it with the team — only their `traceability_matrix` views are sharable. This will confuse every customer.

**Folder tree state lives on the page.** `expanded: Record<string, boolean>` on the page state means folder open/closed state is not persisted. A user with a 30-folder tree reopens the page and finds everything collapsed. Move to `localStorage` at minimum, server-persist via the view preferences service ideally.

**Selected folder defaults to `'unfiled'`.** Line 37. New users see an empty unfiled bucket and have no immediate cue that views exist in other folders. Default to `'all'`.

**The `viewKind` system is single-purpose.** Today the page only handles `viewKind === 'traceability_matrix'`. The schema allows any string but the UI does not surface any other view kind. Either rename the table to `TraceabilityView` (and lock down the kind enum) or build the second view kind so the polymorphism earns its keep.

### 4.3 Density and visual issues

- `bg-blue-50 dark:bg-blue-900/25` selected-row background (line 211) — replace with `border-strong` per design tokens.
- 12-column grid (`grid-cols-12 gap-4` at line 297) on a page that displays only two regions. Use flex.
- Folder rows include rename and delete icons inline (lines 230–250). Per `design-system.md` §6.2 row actions are hover-revealed, not always-visible.
- The `summarize(v)` function (line 167) emits human-language description strings like `"Requirement • Rows: pinned (3 pinned) • Cols: type (2 pinned) • verified_only"`. A buyer demo will read this and laugh. Use a one-line definition list inline instead.

---

## 5. `RequirementDetailDrawer` (2,748 lines)

### 5.1 Scope

The drawer pulls 23 React Query keys for a single requirement view: requirement, comments, attachments, reviews, links, change requests, version history, lifecycle, status definitions, allowed transitions, transition checklists, allocations, parameter resolutions, glossary entries, definition entries. It also imports its own RichTextField and the lifecycle service and the auth store and several linkage adapters.

This is the most-fetched view in the app. With 23 query keys and no batched loader, opening the drawer fires ~15 concurrent API calls every time a row is clicked.

### 5.2 Specific issues

- **The drawer owns its own data fetches.** Correct per `react-typescript.md` ("the drawer owns its own data fetch (re-fetches when id changes)"). But the parent page already has `allRequirements`, `effectiveLinks`, `traceLinks`, `issues`, `changeRequests` in cache — the drawer re-fetches them via different query keys. React Query's cache is bypassed.
- **`rounded-2xl` violations** (lines 1376, 2621) — fix.
- **Per design-system.md §6.1 the canonical object panel order is** Header → Title → Primary attributes → Description → Evidence → Traceability → History. The drawer renders Title → Description → Properties (collapsible) → Comments (collapsible) → Attachments (collapsible) → Links (collapsible) → Reviews → ImpactAnalysis. Evidence is missing as a section. Reorder.
- **The `VisualLinksGraph` import** (line 33) — a ReactFlow-based graph rendered inside the drawer. Drawing a graph inside a 400px-wide column is the wrong primitive; this should be in a separate full-screen "Trace graph" view.

---

## 6. Cross-component duplication

Three modals exist (`CreateRequirementModal`, `EditRequirementModal`, `RequirementDetailDrawer`) totalling 7,932 lines. They share 70%+ of their UI: the field list, the linkage panels, the parameter-picker, the glossary integration. Today this is three independent copies, which means every new field has to be added in three places and a regression in one is invisible from the others.

**Recommendation.** Extract a `RequirementForm` component that takes `{ mode: 'create' | 'edit' | 'view', value, onChange, projectId }`. Each container becomes a 100-line wrapper. This is a refactor with no behaviour change and high downstream multiplier.

**Comparable competitor pattern.** Jama Document View uses one inline editor for both new and existing items. Polarion LiveDocs likewise has one paragraph-editor instance. Codebeamer's "Work Item Edit" form is the same component on create and edit. The duplication is ours alone.

---

## 7. Proposed component changes

Ranked by impact / effort:

| Change | Effort | Why |
|---|---|---|
| Extract `RequirementForm` (single create/edit/view form) | M | Eliminates 5,000+ lines of duplication; every future field is one edit |
| Move `RequirementsPage` toolbar to its own component with one `openMenu` state | S | Removes 7 booleans + 7 refs + 1 outside-click effect |
| Replace dashboard tiles with objective-completion matrix | L | Demo moment; the single biggest design-doctrine win in the package |
| Build true document-mode spec scroll (paragraph-as-object) | L | Closes the Jama Document View / Polarion LiveDocs parity gap |
| Inline suspect-link badge on each row + drawer header | S | Today suspects are surfaced only in a separate modal |
| Add DAL, MoC, objective-code columns visible by default | S | `design-system.md` §2.3 compliance |
| Replace all `blue-*` Tailwind classes with `accent.*` tokens | M | Brand-system compliance; one find/replace then a small reskin |
| Add focus traps + ARIA roles to all custom dropdowns | M | WCAG 2.1 AA / European Accessibility Act |
| Inline INCOSE/EARS quality check on save (writer panel) | M | Closes Jama Advisor / Polarion Copilot competitive gap |
| Add diff viewer between two baselines | M | Backend already supports `compareVersions`; UI is what is missing |
| Server-persist folder-tree expand state on `TraceabilityViewsPage` | XS | One-line gap that breaks the saved-views story |

---

## 8. Summary

The Requirements frontend is one large page that has accumulated every feature the module has shipped over four years. Its scale (4,848 lines, 57 useStates, 13 query hooks, 10 services) is the single largest source of structural risk in the codebase. The redesign opportunity is exact: every page on this list is a known design pattern from `design-system.md` or a known competitor pattern from `competitor-matrix.md` — the work is largely subtraction (remove duplication, remove design violations) followed by composition (extract `RequirementForm`, extract `Toolbar`, build the objective matrix).

Most surprising finding: the dashboard shows requirement counts where it should show objective satisfaction. That single design-system §8.2 violation is the difference between "another generic ALM tool" and "the certification-native environment the positioning promises." Fixing it is one new component + one new endpoint that joins `CertObjective` × `CertObjectiveRequirementLink` × `Requirement.reviewStatus` × `VerEvidence.count`. Nothing in the schema blocks it; we just have not built it.
