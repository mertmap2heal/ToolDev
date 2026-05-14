# Requirements — Design Review

This review compares the four Requirements pages against named competitor patterns (Jama Document View, Jama Advanced Filters, Polarion LiveDocs, DOORS Next Links Explorer, Codebeamer Document Mode) and against `improvements/design-system.md`. Every recommendation cites either a concrete competitor behaviour or a `design-system.md` rule.

---

## 1. Information density

### 1.1 The flagship `RequirementsPage` table row

The default-visible row today shows: checkbox · ID · Title · Description · Priority · Status · Owner. Seven columns. Plus a row-actions cluster on the right (edit, comments, lock, change-status, delete).

What is missing per `design-system.md` §2.3 ("show the standard in context, never as a separate module"):

| Field | Visible today | Should be visible | Source |
|---|---|---|---|
| DAL classification | No | Yes (column pill) | `Requirement.requirementType` only — no actual DAL column exists |
| Method of Compliance | No | Yes (column code chip) | `Requirement.linkedMocCode` + `VerMoc.name` |
| Verification method | Hidden by default | Yes | `Requirement.verificationMethod` |
| Verification status | Hidden by default | Yes (status pill) | `Requirement.verificationStatus` |
| Evidence count | No | Yes (count badge) | join `VerEvidence` |
| Objective satisfied | No | Yes (objective code) | join `CertObjectiveRequirementLink` |
| Suspect link indicator | No | Yes (orange triangle) | `TraceLink.isSuspect` |
| Review status | Hidden by default | Yes (pill — uses `ReviewStatusBadge` component) | `Requirement.reviewStatus` |

The competitor benchmark is concrete: Jama's default Document View row shows ID, title, status, priority, owner, AND the DO-178C objective + verification method + DAL. Polarion's Work Item table is configurable but the aerospace template ships with those columns pre-checked. We ship with no DAL column at all.

### 1.2 The dashboard

Per `design-review.md` §6, today's dashboard shows requirement counts. The competitor pattern is the **objective satisfaction matrix**.

Jama's Coverage Report (Live Traceability) ships a DO-178C objective table — rows = objectives, columns = requirement set, cells = coverage state. Polarion's Multilevel Traceability widget renders the same shape per project. DOORS Next's JRS Report Builder produces a printable version. We ship none of these as the home view.

This is `design-system.md` §8.2 directly:

> The default landing for a new project is **the objective completion matrix**, not a list of requirements. The user sees the DO-178C objective table with live completion status against their current artefacts.

Building it does not require new schema — `CertObjective`, `CertObjectiveRequirementLink`, `Requirement.reviewStatus`, `VerEvidence` already exist. The objective table is a join + a render.

### 1.3 The detail drawer

Reasonable density. The issue per `design-system.md` §6.1 is section order. Today's order is Title → Description → Properties (collapsible) → Comments → Attachments → Links → Reviews → ImpactAnalysis. The canonical order is Title → Primary attributes → Description → Evidence → Traceability → History.

Evidence is the entire load-bearing section that is missing. `vision-and-usp.md` §8.2 names "Evidence-at-creation" as a supporting USP — but the detail drawer has no Evidence section at all. Attachments serves as a proxy but `VerEvidence` is a different model and is not surfaced here.

---

## 2. Discoverability — toolbar critique

### 2.1 The eight dropdowns

`RequirementsPage` exposes a toolbar with 8 simultaneously-visible dropdowns (counted from refs 224–231):

- Traceability dropdown
- Data dropdown (import/export)
- View dropdown
- Column selector
- Analysis dropdown (quality, suspects)
- Sort dropdown
- Panel tab dropdown
- Bulk action dropdown

Per `design-system.md` §2.4 ("Progressive disclosure. One decision per screen.") this is the textbook violation:

> A screen that forces three equally-weighted choices is a screen where the product has no opinion.

Eight choices, equally weighted, no obvious primary action. The user has to read every dropdown label to find the action they want. Compare to:

- **Jama Document View** — three primary actions (New, Save Baseline, Export), one "More" dropdown that hides the rest. Power users learn the menu; novices see the primary action.
- **Polarion LiveDocs** — single context menu per Work Item, plus a project-level "Actions" menu. The toolbar reads as a single horizontal strip with primary action emphasised.
- **Codebeamer Document Mode** — similar — primary "New" button, single "Actions" menu.

### 2.2 The recommendation

Two-level hierarchy:

- **Primary toolbar** (single row, three visible actions): `New Requirement` (primary, accent.primary). `Filters` (toggles `isFiltersExpanded`). `Actions ▾` (collapses all 8 dropdowns into one). Plus a `View ▾` toggle (table / document) and density toggle.
- **Inside `Actions ▾`** the eight dropdowns become an ordered list with section headers: Traceability (matrix, suspect links, function-verification coverage), Data (import, export, ReqIF), Analysis (quality panel, baselines, audit log), Bulk (when rows selected).

Power users learn the depth; novices see one obvious next action. This is `design-system.md` §2.4 applied directly.

---

## 3. Keyboard navigation

Tested against `design-system.md` §9 ("every focusable element must have a visible focus ring") and competitor expectation (Jira's keyboard shortcut system is the bar in aerospace teams' current toolchain).

| Action | Today | Jira / Jama benchmark |
|---|---|---|
| Open new requirement | None | `c` for create |
| Open detail drawer | Click only | `enter` on focused row |
| Close drawer | Click X / outside | `esc` |
| Next row | Mouse only | `↓` |
| Previous row | Mouse only | `↑` |
| Expand row | Click chevron | `→` |
| Collapse row | Click chevron | `←` |
| Toggle column | Open dropdown | `c` then column letter |
| Save inline edit | `Enter` | `Enter` |
| Cancel inline edit | `Esc` | `Esc` |
| Bulk select range | Shift-click | `shift+↑/↓` |
| Open quick search | Click search box | `/` |
| Apply filter | Click filter button | `f` |
| Save current view | None | `s` |
| Toggle view (table/document) | Click dropdown | `v` |

Current focus rings are inconsistent — Tailwind's default `focus:ring-1` is used on inline edits (`requirementsFields.tsx:2327`) but not on most action buttons. Add a global `focus-visible:ring-2 focus-visible:ring-accent-strong` rule in `index.css` and remove per-button overrides.

The keyboard shortcuts list above earns the page two full days of engineering and is the cheapest UX win in the package. Today's competitor baseline (Jama is "average", Polarion "power-user-only" per `competitor-matrix.md` §8) is low — beating it does not require a heroic effort.

---

## 4. Bulk-edit surface

### 4.1 What exists

`POST /:projectId/bulk-update` accepts five fields: status, priority, owner, category, tags. Frontend triggers via the "bulk action dropdown" on rows that are selected.

### 4.2 What is missing

The competitor benchmarks (per `competitor-matrix.md` §1 row "Bulk-edit selected items"):

- **Jama List View** — bulk-edit any field. Select rows → click Edit Selected → pick field → enter value → preview affected rows → apply.
- **Polarion** — bulk-edit any field, scriptable via Velocity, exportable as an Excel round-trip.
- **DOORS Next** — same.

Today we cannot bulk-edit: requirementType, requirementLevel, risk, complexity, verificationMethod, verificationStatus, source, rationale, assumptions, linkedMocCode, thresholdValue, objectiveValue, parentId, componentId, lifecycleId, statusId. That is 16 of the 25 editable fields.

### 4.3 The recommendation per `gap-summary.md` #9

A generic bulk-edit drawer that exposes every editable field. Per `design-system.md` §6.3 ("the canonical wizard"):

- Step 1: select rows (already done before opening drawer)
- Step 2: pick field(s) to change
- Step 3: enter new value(s)
- Step 4: review affected rows; surface conflicts (locked rows, lifecycle gate failures, validation errors)
- Step 5: confirm; apply atomically

Backend: one generic `POST /:projectId/bulk-update` that accepts `{ requirementIds, updates }` where `updates` is a partial `UpdateRequirementDto`. Today's 5-field whitelist becomes a runtime field-permission check (some fields require `requireProjectOwnerOrAdmin`).

---

## 5. Empty / loading / error states

Per `design-system.md` §5.4 ("Empty states address the reader as an engineer").

### 5.1 Empty states audit

| Surface | Today | Per §5.4 |
|---|---|---|
| Requirements table (no project requirements) | Generic "No requirements found" with `<Inbox>` icon | "No requirements yet. Start with a system-level requirement to anchor the project, or import a ReqIF export from your previous tool." |
| Requirements table (filters return zero) | Same generic message | "No requirements match these filters. [Clear filters] or [Save filter as view]." |
| Dashboard (no requirements yet) | Six zero-count tiles | A first-run state with a single "Create your first requirement" CTA + a Read More link to "Five things to do first in a DO-178C programme" in `/help`. |
| Suspect links modal (no suspect links) | "No suspect links" | "No suspect links. Trace links are flagged suspect when an upstream requirement is meaningfully edited. The next edit on a parent requirement will surface here." |
| Saved views list (no views) | Empty list | "No saved views in this folder. A view captures column visibility, sort, filter, and group state. Save the current view from the main Requirements table." |
| Baseline manager (no baselines) | Generic | "No baselines yet. Baselines snapshot every requirement, link, and approval state. Create one before your first design review (SRR, PDR, CDR)." |
| Reviews tab on detail drawer (no reviews) | "No reviews yet" | "No reviews yet. Initiate a review when this requirement is ready for design-review stakeholders to approve." |
| Versions tab (one version only) | List with single entry | "This requirement has not been edited since creation. Every save creates a new version with author identity." |

Each empty-state line names the action plus a regulator-shaped reason. The reader is presumed to be an aerospace engineer, not a generic SaaS user.

### 5.2 Error states audit

Per `design-system.md` §5.4 ("Errors quote the exact error and offer a named action"):

| Error | Today | Per §5.4 |
|---|---|---|
| Optimistic-lock conflict | "Requirement was modified by another user. Please refresh and try again." | OK as-is. |
| Lock-held | "Requirement is locked. Please unlock to edit." | "REQ-0142 is locked by Alice Liu. [Unlock] (you'll override their session) or [Edit on a copy]." |
| Lifecycle-gate failure | "Lifecycle gates not met: ${blockers}" | Already shows the blockers — good. Add a "Show me" link to the specific failing field. |
| ID conflict on rename | "Requirement ID \"X\" already exists in this project" | "REQ-0142 conflicts with an existing requirement: \"Cabin temperature control\". [Use REQ-0143 instead] or [Rename the other one]." |
| Circular parent reference | "Cannot set parent: would create circular reference" | "REQ-0142 is already an ancestor of the requirement you're trying to make its parent. Pick a different parent, or use a 'derives from' trace link instead." |
| ReqIF parse failure | Generic | "Parser found 3 issues in your ReqIF file: [list with line numbers]. [Re-upload after fixing] or [Skip these rows and import the rest]." |

### 5.3 Loading states audit

Per `design-system.md` §5.4 ("Loading states name the object being loaded") and §7 ("shimmer skeleton that matches the final content shape").

Today: `<div className="animate-pulse">` placeholder rectangles. Generic.

Per §7 + §5.4: skeleton rows that match the actual table layout, plus a top-of-page caption "Loading 423 requirements..." (with the count served by an unblocked count query that returns in <100ms).

For the dashboard: "Computing coverage..." → "Coverage: 73%". For baseline diff: "Comparing baseline B-2026-03 and B-2026-04...". For ReqIF import: "Parsing 1,247 requirements..." then "Importing..." with progress.

---

## 6. Design-token compliance

Audited against `design-system.md` §3.1 (no `blue-500`, accent is `#1B4332` deep forest), §3.5 (no `rounded-2xl`), §3.4 (8px grid), §3.3 (15px body default).

Counted per file:

| File | `blue-*` | `rounded-2xl/3xl` | `text-sm` (13px default) | Total density-tells |
|---|---:|---:|---:|---:|
| `RequirementsPage.tsx` | 83 | 0 | ~250 | High |
| `RequirementDetailDrawer.tsx` | 40 | 2 | ~120 | High |
| `RequirementsDashboardPage.tsx` | 7 | 0 (uses `rounded-xl`) | ~20 | Medium |
| `TraceabilityViewsPage.tsx` | 6 | 0 | ~25 | Medium |
| `RequirementsSettingsPage.tsx` | 0 | 0 | ~5 | Low |

Total `blue-*` token usages across the package: 136. Per `design-system.md` §3.1:

> No `blue-500`. No `indigo-600`. No `purple-700`. The accent is deep forest and nothing else.

The package will need a token migration pass. The shape of the work is one file at a time, search `blue-` → replace with `accent-` (the new Tailwind extension), audit the resulting visual diff per page. This is a precondition for any marketing-visible screenshot.

`tailwind.config.js` today is:

```js
theme: {
  extend: {
    colors: {
      sidebar: { DEFAULT: '#2D2D2D', dark: '#1E1E1E' },
      main: { DEFAULT: '#F5F5F5', light: '#FAFAFA' },
    },
  },
},
```

It does not extend `accent.*`, `ink.*`, `surface.*`, `border.*`, or `status.*` per `design-system.md` §3.1. The token system is not wired. Step zero is to extend `tailwind.config.js` with the full token map before any per-page migration.

Same for typography (§3.2): neither Fraunces nor Geist is referenced anywhere in `index.css` or `tailwind.config.js`. The body font is Tailwind default (`-apple-system, BlinkMacSystemFont, ...`). The cert-native aesthetic does not exist yet — at all.

---

## 7. Document-mode spec view

The single biggest competitor parity gap.

### 7.1 What competitors ship

**Jama Document View.** A scrollable spec where each paragraph is a Work Item. Reorder via drag. Inline edit. Heading numbering. Print preview. The user reads it as a Word document and the audit graph is built underneath.

**Polarion LiveDocs.** Same shape, plus paragraph-level baselines and paragraph-level review comments. Each paragraph carries an embedded `<work-item>` element.

**Codebeamer Document Mode.** Same shape, plus `.docx` round-trip via merge fields. Edits in Word write back to tracker items.

**DOORS Next.** "Module view" — same general pattern, slightly more dated UI.

### 7.2 What we ship today

`RequirementsPage` has a `listViewStyle: 'table' | 'document'` switch that toggles between an HTML `<table>` and a stack of `RequirementDocumentCard`s. The cards are visually a document but they:

- Do not number sections (1.1, 1.1.1, 1.1.2).
- Do not support paragraph drag-and-drop reorder.
- Do not support full-text inline edit (only the title and description fields).
- Do not have a "print preview" or "export as PDF" that renders the spec as a single document.
- Do not handle the case where one requirement spans multiple paragraphs.

This is a partial implementation. The aerospace migrator coming from DOORS will scroll the page, find that they cannot organise their requirements into a Word-style spec, and conclude the product does not yet do what they need.

### 7.3 What to build

Per `gap-summary.md` honourable-mention #13 (and `competitor-matrix.md` §8 row "Document-style spec view"), build a true document-mode at the SRS / ICD / VVP scope. The scope is a multi-month effort. Sketch:

- **Schema:** A `SpecDocument` model owning an ordered list of `SpecParagraph` rows. Each `SpecParagraph` is either text (free prose) or a reference to a `Requirement.id` (paragraph-as-object). Heading levels are recorded as `level: Int`.
- **Backend:** CRUD on `SpecDocument`, reorder endpoint, paragraph-add endpoint that creates the referenced `Requirement` atomically.
- **Frontend:** A new page `/projects/:projectId/requirements/spec/:specId`. Single-column reading layout. Inline-edit on every field. Drag to reorder. Section numbering computed client-side.
- **Export:** The spec as a docx via the existing `CorporateDocxTemplate` pipeline. Round-trip is fast-follow.

This is the demo moment the package owes to the aerospace migrator audience. Recommended after the four cross-cutting refactors land.

---

## 8. Visual diff between baselines

Per `gap-summary.md` #7 and `competitor-matrix.md` §2 row "Baseline diff / compare view".

### 8.1 What competitors ship

- **Jama** — item-, set-, and project-level diff between two baselines with side-by-side colour-coded changes.
- **Polarion** — paragraph-level diff inside LiveDocs.
- **Codebeamer** — work-item diff with field-change history.
- **DOORS Next** — streams diff with object-level changes.

### 8.2 What we ship today

`GET /api/v1/versions/:projectId/requirements/:requirementId/compare?versionA=N&versionB=M` returns a per-field changed boolean. Frontend has no diff viewer. The Baseline Manager lists baselines; clicking one applies it as a filter via `?baselineId=X`.

### 8.3 What to build

Backend already has the data — `RequirementVersion` carries `snapshot: String` (JSON of the full requirement state). A `/diff` endpoint returns line-and-word level diffs of every text field. Use `diff-match-patch` (industry standard, MIT-licensed, ~50KB) — do not roll a custom diff.

Frontend: a `BaselineDiff` page with a left/right column showing two baselines side-by-side. Each requirement card shows additions in green and deletions in red, per `design-system.md` §3.1 (`status.success` and `status.danger`). Filter chips at the top: "Show only changed" / "Show only added" / "Show only removed".

This is a one-week ticket. The fact that it has not shipped despite `RequirementVersion` having existed for years is one of the more surprising findings of the review.

---

## 9. Reviews — focus mode

Per `design-system.md` §8.4 ("Reviews are first-class, not email threads"):

> The reviewer's UI is a focus mode: one requirement at a time, keyboard-navigable, with the diff from the prior baseline shown inline. The reviewer approves, comments, or requests changes. No email. No spreadsheet.

What exists today: `RequirementReviewPanel` (component imported in `RequirementDetailDrawer.tsx:31`). It is embedded inside the drawer. The drawer is shared with edit and view modes; the reviewer sees all the other panels (Properties, Comments, Attachments, Links, Versions, ImpactAnalysis) alongside the review controls.

What is missing:

- A dedicated `/projects/:projectId/reviews/:reviewId/focus` route with a single-requirement reading view.
- Keyboard navigation: `j` next pending, `k` previous pending, `a` approve, `r` reject, `c` comment.
- Inline diff from the prior baseline (when the requirement was baselined and a new version exists).
- A queue indicator: "Reviewing 3 of 14 requirements in REVIEW-2026-04-17."
- A close-when-done flow: "All requirements reviewed. [Submit your signature]."

Build this after the signature primitive lands (gap-summary #1) and after the diff view (#7).

---

## 10. The DER read-only view

Per `design-system.md` §8.5:

> A dedicated read-only view that presents the project the way a Designated Engineering Representative needs to see it for findings-of-compliance: objective-indexed, artefact-linked, sign-off-visible. No edit controls. No distractions. One export button that produces the DER's report template.

What exists today: nothing. The DER would log in as a regular project member and see the same `RequirementsPage` with edit controls greyed-out (or, if they have engineering-role write access, with edit controls live). There is no objective-indexed read-only surface.

What to build:

- A `/projects/:projectId/der` route guarded by a `requireDerRole` middleware (where `DER` is a new admin role).
- The view is the objective-completion matrix (§6 / `design-system.md` §8.2) plus an objective-drilldown table showing every artefact that satisfies each objective, with the sign-off chain inline.
- An "Export DER findings draft" button that emits a structured docx with every objective, every requirement, every verification, every evidence, every signature.

This is a Phase 9.3 item per `vision-and-usp.md` §9.3 ("Automated DER pre-check") and is the load-bearing screen for the cert-native demo. Build last in this package — it depends on every other item.

---

## 11. Summary

Five themes run through every page of this package:

1. **Toolbar density.** Eight dropdowns where there should be one primary action plus an "Actions" menu. `design-system.md` §2.4.
2. **Standards-in-context absent.** Rows do not show DAL, MoC, objective code, evidence count, suspect indicator. `design-system.md` §2.3.
3. **Brand tokens unwired.** 136 `blue-*` violations; design-system §3 not landed at any level (Tailwind config not extended; fonts not loaded). `design-system.md` §3.
4. **Document mode partial.** A document-view toggle exists but does not match Jama Document View / Polarion LiveDocs / Codebeamer Document Mode. `competitor-matrix.md` §8.
5. **Empty/error/loading copy generic.** Generic Tailwind "No requirements found" instead of engineer-shaped, regulator-aware copy. `design-system.md` §5.4.

The most surprising design finding: the package has more `blue-*` instances than the Parameters page (the cleanest module) has total color references. Migrating to the brand tokens is a single search-and-replace per file plus a per-page visual diff review — bounded effort, total demo-impact. Recommended as a near-term win.

The most consequential design finding: the dashboard is the wrong view. Today's dashboard tells the user how many requirements they have. The certification-native dashboard tells the user how many DO-178C objectives they have closed. The schema supports building the latter today; the cost is one new page and one new endpoint that joins `CertObjective × CertObjectiveRequirementLink × Requirement × VerEvidence`. This is the demo moment for every aerospace chief engineer prospect.
