# Verification — Frontend Review

Scope: `frontend/src/pages/Verification/*` (8 files), all 5 detail drawers under `frontend/src/components/verification/*`, the templates editor, and the report page. The package has 5 routes under `/projects/:projectId/verification/*` (`inventory-frontend.md` lines 102–112).

## 1. Layout pattern — close to Requirements, deliberately

`VerificationLayoutPage` (734 lines) is the parent layout for every sub-route. It mirrors the **left-tree + right-content** pattern of the Requirements module:

| Region | Component | Notes |
|---|---|---|
| Left tree panel | `VerificationTreePanel` | Plans → Cases (per-plan), Cases → Setups, Cases → Requirements (`verifies` links), Plans → Runs. Resizable 200–500px. Hidden by default, persisted to `localStorage`. |
| Header strip | inline div | Title, panel-toggle button, `SafetyLinkPanel variant="evidence"`. |
| Main tab strip | `VERIFICATION_MAIN_TABS` | `overview / plans / cases / setups / runs / results / traceability` + Settings + Templates side-links. Counts injected per tab. |
| Outlet | `<Outlet />` | `VerificationPage` (index) renders the active tab content. |
| Drawers | 5 portal-mounted drawers via `VerificationDrawerProvider` | Opens by `focusType` + `focusId` URL params (`plan`/`case`/`setup`/`result`/`run`). |

URL-as-state is genuine (search params own the active tab + drawer). Breadcrumb context is wired (`useBreadcrumb`). Tree-panel state is persisted per project. Drawer state lives in the React context so cross-tab drawers (e.g. clicking a test case from a plan card) survive tab switches.

The pattern is the **canonical Requirements-class layout** for any cert-relevant module — the same conventions reappear in Validation, Certification, and arguably should be lifted into a shared `<CertModuleLayout>` primitive (see `cross-cutting.md` append).

## 2. Drawers — five out of five compliant

All five live in `frontend/src/components/verification/`:

| Drawer | Models read | Pattern compliance |
|---|---|---|
| `TestPlanDetailDrawer` | `VerTestPlan` + cases, setups, runs, doc metadata, revisions | Floating-card pattern per `kb/react-typescript.md` |
| `TestCaseDetailDrawer` | `VerTestCase` + procedure, setups, plans, run results, sections | Same |
| `TestSetupDetailDrawer` | `VerTestSetup` + components, interfaces, diagram | Same |
| `TestResultDetailDrawer` | `VerTestResult` + result-links + download | Same |
| `TestRunDetailDrawer` | `VerTestRun` + run results, timer segments, environment | Same |

All five obey the **rounded-2xl + tinted-header + scrollable-body + sticky-footer** convention. The `VerificationDrawerContext` is shared state — one drawer-at-a-time semantics are encoded by `closePlan/closeCase/...`. This is right.

**Findings inside the drawers:**

1. **Provenance fields are absent on the test-case schema** (`VerTestCase` has only `isSuspect`, `invalidatedAt`, `ownerUserId`). When AI generates a test case (gap #3 — Codebeamer AI 1.0 Test Case Assistant), there is nowhere to record `authorType`, `authorAiModel`, `authorAiPromptId`. Drawer cannot display "Drafted by Claude Sonnet 4.6 on 2026-04-12, reviewed by C. Mandle 2026-04-13." Cross-cutting append covers the schema fix.
2. **No diff view** between `VerTestCaseVersion` (no version table exists — `VerTestCase.version` is an in-row String). Gap #7 in `gap-summary.md` lives here too.
3. **Custom sections** (`VerTestCaseCustomSection` + `VerTestCaseSectionImage`) are richer than any competitor's test-case object — the model already supports rich-text sections with embedded images. Jama, Polarion, Codebeamer test cases are flat. **Underused asset.**

## 3. Page-by-page

### 3.1 `VerificationPage` (index) — the tab content

Reads from `VerificationLayoutPage`'s queries (test plans, cases, setups, runs), renders cards or tables per active tab. Imports 13+ child components: `CreateTestPlanModal`, `CreateTestCaseModal`, `CreateTestSetupModal`, `CreateTestResultModal`, `ListExporter`, `TestRunList`, `TestRunExecutionView`, `TraceabilityMatrixView`, `ExportWithTemplateModal`, `CreateChangeRequestModal`, and five `*DocumentCard` components (plan / case / setup / result / review).

| Tab | Render mode | Competitor parity |
|---|---|---|
| Overview | summary metrics | Jama "Coverage Report", Codebeamer "Coverage Browser" landing — **our overview lacks the matrix-style "objective satisfaction grid" demanded by `design-system.md` §8.2**. Today it is a flat metrics card. |
| Plans | document cards via `TestPlanDocumentCard` | Polarion paragraph-as-object pattern; Xray test-plan list — **competitive**. Card view is unusual; Polarion + Codebeamer are tables. Bold choice; works because plans are heavy documents (docNumber, docConfidentiality, docPlanDate, etc. in schema). |
| Cases | configurable columns (`TEST_CASE_COLUMNS`) | Jama / Polarion / Codebeamer / Xray all native — **parity**. |
| Setups | document cards (`TestSetupDocumentCard`) | Codebeamer is the only competitor with a first-class test-setup primitive (most use "Configuration" custom fields) — **ahead**. |
| Runs | `TestRunList` + `TestRunExecutionView` | Xray "Test Execution" is the parity reference. Our `TestRunExecutionView` has timer segments (start / pause / resume / stop) — **richer than Xray manual mode**. |
| Results | columns | Jama / Polarion native; Xray plugin — **parity**. |
| Traceability | `TraceabilityMatrixView` | Jama "Live Traceability Coverage Report", Polarion "Multilevel Traceability widget", Codebeamer "Traceability Matrix plugin" — see §5 for gap analysis. |

### 3.2 `VerificationSettingsPage`

Per `inventory-frontend.md`: "Custom dropdown options manager + baseline create/list." Backed by `VerCustomOption` (ENVIRONMENT_TYPE / COMPONENT_TYPE / INTERFACE_TYPE) and `VerBaseline`. Acceptable. Missing: MoC-rule editor (the `VerSettings.mocRulesByCriticality` JSON column has no UI), naming-rules editor (`VerSettings.namingRules`), allowed-MoC-codes editor. These are the levers that make settings actually opinionated per `design-system.md` §2.1.

### 3.3 `TemplatesLandingPage` + `TemplateEditorPage` + `VerificationTemplateBuilder`

Template library for test-case and test-plan templates backed by `VerTemplate` + `VerTemplateVersion`. Section-based editor with `TemplateEditor` rich-text + `VerificationTemplateBuilder` for structured sections.

**Competitive context:** Codebeamer ships an aerospace template kit, Polarion ships LiveDocs templates, Jama Airborne Systems kit. **Our template engine is project-scoped** (`VerTemplate.projectId`). To match the "seed data, audit-passing out of the box" promise in `vision-and-usp.md` §8.1, we need:

- **System / Company / Project scope** (consistent with `kb/documentation-model.md`).
- **DO-178C / DO-254 / ARP4754A seeded templates** (none today — there is no seed script for `VerTemplate`).
- **Per-DAL preset** so a DAL-A test case template differs from DAL-D.
- A "Published" template should fork on edit, never silently overwrite (the editor today writes `contentJson` then runs `publishTemplate` — `VerTemplateVersion` history exists, but the fork-on-edit guardrail does not).

### 3.4 `VerificationReportPage`

Read-only report renderer for `test-case`, `test-plan`, `test-run`. Backed by `verificationService.getTestCaseReport / getTestPlanReport / getTestRunReport` which hit `/reports/{test-case|test-plan|test-run}/:projectId/:id`. Renders via `VerificationReportView` and offers a `ReportExporter` (DOCX/PDF). Good.

Missing entity types: **test-result, test-setup, nonconformity, review** are not in the entity type map. Backend has `/reports/test-result/:projectId/:id`, `/reports/test-setup/:projectId/:id`, `/reports/compliance-matrix/:projectId` — so the backend is ahead of the URL routing. Add `result` and `setup` to `ENTITY_TYPE_MAP`.

### 3.5 `TraceabilityMatrixView`

Renders the cross-table for `Requirement → VerTestCase → VerTestRunResult → VerEvidence`. This is the **only screen that comes close to Jama's Live Traceability or Polarion's Multilevel Traceability widget**. Today it's reachable via the Traceability tab and via deep-link query strings `?matrixReqId=...` / `?matrixCaseId=...`. Gap details in `design-review.md` §3.

## 4. Critical-path comparison table — drawers / templates / matrix

| Capability | Jama | Polarion QA | Codebeamer | Xray | Us today | Gap |
|---|---|---|---|---|---|---|
| Test case as first-class entity with version chain | Yes | Yes (`Work Item` with history) | Yes | Yes | Partial — `VerTestCase.version` is in-row String, no `VerTestCaseVersion` table | Add version table for diff view |
| Test plan as document with revisions | Yes (Test Cycle) | Yes (Test Spec) | Yes (Plan) | Yes (Test Plan) | Yes (`VerTestPlanRevision`) — schema is **richer** than competitors (`docNumber`, `docConfidentiality`, `docProjectCode`, etc.) | None — **we lead here** |
| Test setup library | Custom field | Custom field | First-class (Equipment) | Custom field | Yes (`VerTestSetup` + components / interfaces / diagram) | None — **we lead** |
| Method of Compliance primitive | Custom field | Custom field | Custom field | Custom field | Yes (`VerMoc`) | None — **we lead** |
| Run execution timer | Plugin | Plugin | Native | Manual | Native (`VerTestRunExecutionTimer`) | None — **we lead** |
| Multi-status result history | Manual | Yes | Yes | Yes | Yes (`VerTestRunResultStatusHistory`) | None |
| Nonconformity → reverify flow | Manual via defect | Manual via defect | Native (NCR module) | Add-on | Yes (`VerNonconformity` + `VerReverifyTask`) | None — **we lead** |
| Live traceability matrix | Live + drillable | Multilevel widget | Coverage Browser | Coverage Report | `TraceabilityMatrixView` exists | UX depth lags — see `design-review.md` |
| Bulk run-many | Yes | Yes | Yes | Yes | None | **Gap** |
| Bulk plan-many | Yes | Yes | Yes | Yes | None | **Gap** |
| Provenance on AI-generated test case | None (none has it) | None | None | None | None | **Architecture moat opportunity** — see cross-cutting |
| Diff view between test-case versions | Yes | Yes (paragraph) | Yes | Add-on | None | **Gap** |
| AI test-case generator from requirement | unknown | unknown | Native (AI 1.0) | Native (Xray Standard) | None | **Gap** — see `tickets.md` |
| Document-export with corporate template | Velocity / DOCX | Wiki / LiveReport | DOCX merge fields | Add-on | Yes (`ExportWithTemplateModal` + `exportTemplate.service`) | None |

## 5. Drawer compliance per `.claude/kb/react-typescript.md`

All five drawers conform to:

- `rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full` outer.
- Tinted-header bar with `backdrop-blur-sm`.
- Scrollable body.
- Sticky-footer action bar.
- `role="dialog"` on the dialog container.

No deviations to flag.

## 6. Open frontend bets

1. **The cards-vs-tables choice for Plans / Setups is right today but will not survive 200 plans / 500 setups.** Both list views need a virtualised list mode (as in `ParametersPage`) at some scale threshold. Today the document-card pattern is a competitive strength against Codebeamer's text-grid; do not regress it. Add virtualisation, not abandon cards.
2. **Coverage / overview tab is generic.** Replace with the objective-completion matrix per `design-system.md` §8.2 — see `design-review.md` §2.
3. **No bulk operations.** Add "run all cases in this plan", "approve N plans", "duplicate setup to N plans" — see `tickets.md`.
4. **Settings is thin.** Wire the `VerSettings` JSON columns to actual UI editors.
5. **No AI surface in the editor.** No "Generate test case from requirement", no INCOSE checks on pass/fail criteria. Codebeamer AI 1.0 ships this; Xray Standard ships this. Tickets covered in `tickets.md`.
