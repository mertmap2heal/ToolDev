# Verification — Design Review

UX critique of `/projects/:projectId/verification/*` measured against `design-system.md` north-star ("every screen must directly advance the certification package"), the `.claude/kb/react-typescript.md` drawer pattern, and competitor reference patterns (Jama Coverage Browser / Polarion Multilevel Traceability widget / Codebeamer Coverage Browser / Xray Test Execution / Xray test types).

## 1. North-star test (`design-system.md` §1)

> Every screen must directly advance the certification package. If a user action does not produce certification evidence, question why it exists.

| Screen | Evidence it produces | Verdict |
|---|---|---|
| `/verification` Overview tab | Coverage metrics card (test cases linked / objectives satisfied) | **Underweight** — produces a summary but not the regulator-facing artefact. Should be the objective-completion matrix per `design-system.md` §8.2. See §2. |
| `/verification` Plans tab (`TestPlanDocumentCard`) | Test Plan document → DOCX/PDF export → DO-178C SVP evidence | **Strong** — card view directly maps to the deliverable. |
| `/verification` Cases tab | Test case → trace link → Test Run Result | Strong. |
| `/verification` Setups tab | Setup record → linked to Plan/Case → captured in `VerTestRunResult.setupVersionSnapshot` | Strong — and ahead of competitors. |
| `/verification` Runs tab + `TestRunExecutionView` | Run record with timer + ingested results | Strong. |
| `/verification` Results tab | Result records with file evidence | Strong. |
| `/verification` Traceability tab | Live matrix → exportable matrix → DO-178C tabular evidence | Strong but UX-thin — see §3. |
| `/verification/settings` | Project rules → governs what test cases & plans look like | **Underweight** — JSON columns are not editable in UI. See `frontend.md` §3.2. |
| `/verification/templates` + editor | Reusable structures → seeded into new cases / plans → consistency across project | Strong (the only test-case template engine that ships with rich-text custom sections per `frontend.md` §3.3). |
| `/verification/report/...` | Single-entity printable report | Strong. |

Two screens fail the north-star test: **Overview** and **Settings**. Both need redesign per `tickets.md`.

## 2. Coverage / Overview redesign — competitor patterns

### Jama Coverage Report
Top half: a multi-band stacked-bar showing requirements-with-test-cases / requirements-with-passing-results / requirements-with-blocking-defects / unverified. Bottom half: drillable list of unverified items, click to navigate.

### Polarion Multilevel Traceability widget
Pivot-table-style matrix: rows are requirement levels, columns are verification levels, cells are counts with red/yellow/green tint. Click → drill into the underlying items. Filter by MoC, by DAL, by stream.

### Codebeamer Coverage Browser
Tree-mode view of requirements with inline test-case + result counts. "Show only uncovered" toggle. Click → opens the requirement's verification panel.

### Xray Coverage Report
Backlog with one row per requirement; status pills per linked test set / test execution. Coloured donut per coverage state.

### Where we are today
A generic metric card per `inventory-frontend.md`. **No matrix. No drill. No filter.** Closest is `TraceabilityMatrixView` (separate tab).

### Recommendation
Replace the Overview tab's current content with an **"Objective Satisfaction Matrix"** keyed on `CertObjective` × `VerMoc` × `Requirement` count. Each cell:

- Number of requirements claiming this MoC for this objective.
- Pass-rate dial (from `VerTestRunResult.resultStatus`).
- Suspect-link count (`TraceLink.isSuspect`).
- "Missing evidence" badge when a requirement claims the objective but has no linked `VerEvidence`.

This is the **only competitor pattern not yet shipped by Jama / Polarion / Codebeamer / Xray** — they all matrix on requirements vs tests, never on requirements vs DO-178C objectives. It is therefore both a parity item (we get a coverage matrix) and a differentiator (we get the cert-native matrix). Direct map to `design-system.md` §8.2 promise.

## 3. Traceability matrix — current vs target

`TraceabilityMatrixView.tsx` exists and is reachable via the Traceability tab + deep-link params. The current view appears to be a flat table; competitor parity needs:

| Feature | Jama | Polarion | Codebeamer | Xray | Us |
|---|---|---|---|---|---|
| Live filtering | Yes | Yes | Yes | Yes | Partial (`matrixReqId` / `matrixCaseId` deep-link only) |
| Group by DAL / MoC / phase | Yes | Yes | Yes | Yes | None |
| Show suspect links inline | Yes | Yes | Yes | Add-on | None |
| Drill into requirement / case / run from cell | Yes | Yes | Yes | Yes | Partial |
| Export matrix as DOCX / Excel | Native | Native | Native | Native | Via report routes |
| Coverage gaps panel | Yes | Yes | Yes | Yes | Backend exists (`/traceability-matrix/:projectId/gaps`); UI? |
| "Run all uncovered" CTA | Manual | Manual | Manual | Manual | None — opportunity |

Recommendation: a single redesign pass over the matrix view that adds grouping, filter pills, and inline suspect indication. Backend `/traceability-matrix/:projectId/gaps` endpoint is already wired — the gap is purely frontend.

## 4. Drawer pattern compliance

All five drawers pass the `kb/react-typescript.md` checklist:

- `rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full` outer.
- Tinted-header bar.
- Scrollable body.
- Sticky-footer action bar.
- `role="dialog"`.

Visual quality varies (the test-run drawer is the most polished; test-setup is fast but inventories diagram data in a plain JSON viewer). Action consistency varies — close button styling and "Save / Approve / Deprecate" button order differ between drawers. **Recommendation:** a `<DrawerActionsFooter>` shared component with strict ordering: `[Cancel] [Save] [Approve/Deprecate]` right-aligned, with primary-action right-most. Currently each drawer rolls its own.

## 5. Bulk operations — universally missing

`design-system.md` §2.4 (progressive disclosure) tolerates the absence of bulk ops on a default view, but engineers running 200+ test cases will hit a wall. Today every list view is "select one, act on one." Competitor parity:

| Operation | Jama | Polarion | Codebeamer | Xray | Us |
|---|---|---|---|---|---|
| Bulk approve N test cases | Yes | Yes | Yes | Yes | None |
| Bulk run N test cases against one plan | Yes (Test Cycle) | Yes | Yes | Yes (Test Execution) | None |
| Bulk update MoC across N cases | Yes | Yes | Yes | Yes | None |
| Bulk assign owner | Yes | Yes | Yes | Yes | None |
| Bulk import test cases from CSV | Yes | Yes | Yes | Yes | None |
| Bulk archive plans | Yes | Yes | Yes | Yes | None |

Add a shared "Bulk action bar" that appears when ≥2 rows are selected — Parameters page already does this for its bulk-jobs UI; reuse that pattern. Tickets in `tickets.md`.

## 6. Empty / loading / error states

`design-system.md` §2.4 ("opinionated empty / loading / error per design-system.md") expects each list view to ship a meaningful empty state. Today:

- Plans empty state — generic "No test plans yet" + button (acceptable).
- Cases empty state — generic.
- Setups empty state — generic.
- Runs empty state — generic.
- Results empty state — generic.
- Traceability matrix when no `TraceLink(verifies)` exists — empty grid (likely confusing).

Recommend per-tab opinionated copy: "Test plans frame DO-178C SVP evidence. Start with one per programme phase: SRR, PDR, CDR, TRR." with a one-click "Create from DO-178C template" button when no plans exist. Same pattern in Cases ("A test case is the atomic unit of MoC..."), Setups ("A setup is the immutable configuration..."). Direct application of `design-system.md` §2.1 (opinionated defaults) and §2.3 (show the standard in context).

## 7. Settings page

Today: `VerCustomOption` dropdowns + `VerBaseline` create/list per `inventory-frontend.md`.

Should be:

1. **MoC rules per DAL** — `VerSettings.mocRulesByCriticality Json` → table editor: rows are DAL (A/B/C/D), columns are MoC codes 0-8, cells are "required / forbidden / optional". Today: untouchable JSON column.
2. **Naming rules** — `VerSettings.namingRules Json` → templated key format ("TC-{project}-{seq:003}", etc.). Today: untouchable.
3. **Allowed MoC codes** — `VerSettings.allowedMocCodes Json` → checkboxes 0-8 for the project's certification basis. Today: untouchable.
4. **Lifecycle rules** — `VerSettings.lifecycleRules Json` → state-machine editor for DRAFT→REVIEWED→APPROVED transitions. Today: untouchable.
5. **Per-role permissions map** — `VerSettings.permissionsMap Json` → CCB role matrix. Today: untouchable.
6. **Baseline list** — keep current.

Implementing these UIs is the difference between "settings page" and "audit-passing-out-of-the-box configuration" per `design-system.md` §2.1.

## 8. Templates editor

Current: section-based rich text + version history + preview. Acceptable. Three issues:

1. **No seeded templates.** Per `frontend.md` §3.3, no DO-178C / DO-254 / ARP4754A starter templates ship. New projects start with a blank list. Buyer demos suffer.
2. **No scope tier** — `VerTemplate.projectId NOT NULL` means templates cannot be shared across projects or be company-global. `kb/documentation-model.md` already defines the Personal/Project/Company scope; mirror it.
3. **Editing a Published template overwrites silently.** `VerTemplateVersion` history exists, but the UI lets a user edit a published template directly; this is a footgun if downstream cases were created from the prior version. Convention should be: editing a Published template auto-forks to a new Draft version that supersedes on publish.

## 9. Report page

`VerificationReportPage` covers `test-case`, `test-plan`, `test-run`. Misses `test-result`, `test-setup`, `nonconformity`, `review`. Backend report endpoints exist for `test-result` and `test-setup` (`backend.md` §7). Add them to `ENTITY_TYPE_MAP`.

## 10. Drawer interaction matrix

A specific UX bug class to watch: **stale locators after React removes a conditional attribute** (`kb/react-typescript.md`). Test cells in the Cases tab that switch between view/edit mode are at risk. Spot-check pass: no inline-edit cells in the current Cases tab table (text-only). No issue today. Note for future inline-edit additions.

## 11. Recommendation block

Top three UX changes, in order:

1. **Replace Overview tab with the Objective Satisfaction Matrix** (`design-system.md` §8.2). Single biggest demo moment unlocked.
2. **Wire the four `VerSettings` JSON columns to UI editors** — settings page goes from underweight to opinionated.
3. **Add bulk action bar to all five list tabs** — competitive parity.

Lower priority but tracked:

4. Per-tab opinionated empty states.
5. Templates scope tiers + seeded DO-178C / DO-254 templates.
6. Fork-on-edit for Published templates.
7. Add `test-result` and `test-setup` to `VerificationReportPage` entity map.
8. Shared `<DrawerActionsFooter>` component for consistent action order.
