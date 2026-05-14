# Single-Page Modules — Frontend Review

Per-page frontend assessment. Each page gets a short subsection covering UX, design-system compliance, completeness, and the one or two surfaces that most need work.

The cluster's general frontend characteristics:

- **964-line pages are common.** Issues (964), Compliance Check (1082), Risk Management (758), Interface Management (722), Archive (646), Change Requests (570), Functions (478) — seven of thirteen pages weigh in at 400+ lines. None is split into a `Page → views/ → modals/` structure (the way Documentation is structured), so feature surfaces are buried inside one mega-component each.
- **`bg-blue-600` / `text-blue-600` / `focus:ring-blue-500` saturate the cluster.** The `design-system.md` §3.1 token map (deep forest `#1B4332` as accent) lands on zero pages. A regex scan finds blue tokens on every page reviewed below — minimum 5 per page, peak 80+ on Issues and Compliance Check.
- **No keyboard-first navigation.** None of the 13 pages registers a `keydown` listener for `Cmd-K` palette, `C` create, `F` focus search, `Esc` close. Cross-cutting append from tasks ("Keyboard-first shortcuts absent across all task pages") repeats here at full strength.
- **Modal text colors are inconsistent.** Create modals on different pages use different blues (`blue-500`, `blue-600`, `indigo-600`) for the primary action; status pills use red/orange/yellow/green/gray without referencing `status.success` / `status.warning` / `status.danger` tokens from `design-system.md` §3.1.

---

## 1. Issues (`/issues` + `/issues/:id`)

**File:** `frontend/src/pages/Issues/IssuesPage.tsx` (964 lines) + `IssueDetailPage.tsx` (460 lines).

The Issues page is functionally the strongest of the cluster: real backend, label management, bulk-action toolbar, URL-synced filters (`q`, `status`, `priority`, `owner`, `assignee`, `type`, `label`), and a separate detail page with sidebar + activity feed + comments. The implementation pattern (URL params drive state, mutations invalidate `['issues', projectId]`) is the right pattern for this codebase.

Three specific gaps. **First**, the page reimplements its own `getPriorityColor` and `getStatusColor` switch statements (lines 120-148) using `bg-red-100 dark:bg-red-900/20` patterns — these should consume the `status.success/warning/danger` tokens from `design-system.md` §3.1. **Second**, the DO-178C `issueType` classification (specification_error, design_error, coding_error, documentation_error, interface_error, other) is shipped but never surfaced as a default chart — the page's primary view is the row table; a DO-178C-shaped grouping ("issues by life-cycle phase per Table A-7") is the certification-native view per `design-system.md` §2.3, but the issueType is just a filter dropdown. **Third**, the bulk-action toolbar only supports status / assignee / label — no bulk-relabel by issueType, no bulk-link-to-CR.

Detail page is essentially complete (sidebar with labels + subscriptions + linked items, description editor, activity feed). It would benefit from an explicit "convert to Change Request" button — today the path is: open detail → MoreMenu → no such option. The IssuesPage has it (`CreateChangeRequestModal` opens with `sourceId=issue.id`); the detail page does not. ISS-2 covers this.

---

## 2. Change Requests (`/change-requests`)

**File:** `frontend/src/pages/ChangeRequests/ChangeRequestsPage.tsx` (570 lines).

Working CRUD with detail drawer (`ChangeRequestDetailDrawer`), polymorphic source type (`function | issue | parameter | requirement`), and inline rendering of `requirementLinks` as clickable chips that open `RequirementDetailDrawer`. This is one of the few places where the deep-link adapter pattern from `architecture.md` is exercised correctly.

The buyer-visible gap is the **workflow**. The status field is a free string (`pending | approved | rejected | in-review`). There is no Change Control Board (CCB) workflow per `kb/configuration-management.md` §"CCB" — no impact analysis preview, no SafetyEngineer required-when-`safetyImpact=true`, no two-approver requirement, no audit trail of who voted. The detail drawer shows `reviewedBy` + `reviewComments` as free fields. The status transition is a single mutation with no role gating.

The list view is also missing the "impact radius" preview that every competitor ships. Codebeamer and Polarion both show "this CR affects N requirements + M tests + P signed-off baselines" when you hover the CR row. Today the only impact preview is the count of `requirementLinks` shown in the Source column. Suspect-link propagation on CR approval is not surfaced.

Smaller gaps: priority colors hard-coded (`getPriorityColor` returns Tailwind 4-tone via switch); export button in the title bar (`Download` icon) doesn't appear to wire to anything; no keyboard support; `bg-blue-600` create button.

---

## 3. System Functions (`/functions`)

**File:** `frontend/src/pages/SystemFunctions/SystemFunctionsPage.tsx` (478 lines).

The best UX of the cluster. Three integrated views: left panel toggles between tree (FunctionTreePanel) and graph (RelationshipGraphView); main panel shows FunctionDetailPanel; an optional FunctionVerificationCoverageMatrix overlays as a modal. The panel widths are persisted to localStorage. The view-mode toggle is persisted to sessionStorage. Deep links work (`?functionId=...`). Safety linking via `SafetyLinkPanel` is present.

The certification gap is **FDAL** (Functional Design Assurance Level per ARP4754A). The `SystemFunction.criticality` field exists with a default of `medium` but accepts a free string — there is no enforcement that an aerospace-system function carries FDAL A/B/C/D/E. `vision-and-usp.md` §10 explicitly names "a system function decomposes into software requirements, the link is created by the decomposition action, not by a separate Add Trace button." Today this decomposition pattern works (parent/child via `parentId`), but the FDAL propagation rule from `kb/safety-standards.md` ("Hazard severity maps to DAL") is not enforced — a child function can carry FDAL=D under a parent FDAL=A without warning.

UX polish gaps: the graph view ("RelationshipGraphView") opens but the layout occasionally collapses on first paint; the verification coverage matrix opens as a full-page modal (fine) but uses its own color scheme not consonant with the rest of the design system.

---

## 4. Risk Management (`/risk-management`)

**File:** `frontend/src/pages/RiskManagement/RiskManagementPage.tsx` (758 lines).

A complete UI on top of `MOCK_RISKS`. The page has a 5×5 likelihood × impact matrix view (`matrixView` boolean state, clickable cells filter), a list view with `exposureToClassification` colors, type / status / owner / exposure-threshold / "high risks only" filters, sort by 10 columns, and a `RiskDetailDrawer` with mitigation actions + acceptance rationale. The data model in `types.ts` is ARP4761-shaped — `RiskType` includes `Safety` and `Compliance`, `mitigationActions: string[]`, `residualRiskRating`, `accepted`, `acceptanceRationale`. The `linkedCounts` field hints at cross-module linkage that never materialises.

Two large UX gaps even before backend persistence. **First**, there is no link from a risk to a hazard, a requirement, a test result, or a CR. The schema in `types.ts:24` declares `linkedCounts?: Record<string, number>` and the drawer renders a "Linked Artifacts" panel, but the actual link picker opens a "PlannedFeatureModal" that says "Coming soon." Every risk is a leaf node in the data graph. **Second**, the matrix view uses a custom 5×5 grid where each cell is a Tailwind div with hard-coded color — the `kb/safety-standards.md` §"ASIL determination" table is the standard for this view (S/E/C → ASIL), and the current matrix bears no resemblance to that or to ARP4761A severity classes.

Design-system non-compliance is at its worst here: the matrix uses `bg-green-100 / bg-yellow-100 / bg-orange-100 / bg-red-100` for the four classifications — these collide with the `status.warning` (`#B8860B`) and `status.danger` (`#8B0000`) tokens.

---

## 5. Interface Management (`/interface-management`)

**File:** `frontend/src/pages/InterfaceManagement/InterfaceManagementPage.tsx` (722 lines).

Better-defined than Risk Management because `kb/interface-management.md` provides the SysML 1.6 vocabulary (Port, Connector, Signal) and the ICD blackbox / whitebox export shape. Today the page renders `MOCK_INTERFACES` with type filter (Physical / Electrical / Data / Software / HMI), status filter (Draft / Frozen / Released), column-preferences persistence (`interfaces-columns` localStorage), and an `InterfaceDetailDrawer` with technical-characteristics fields (`protocol`, `rate`, `latency`, `voltage`, `current`, `dimensions`) — which align with `kb/interface-management.md` §"Per-kind technical fields".

The mock data shape (`mockInterfaces.ts`) is already closer to the KB schema than most pages: `id`, `type`, `sourceElement`, `targetElement`, `status`, `owner`, `constraints[]`, `technicalCharacteristics`, `timeline[]`. The KB schema additions needed to ship: signals child rows, SourceKind / TargetKind fields (today the source / target are free strings, not typed FKs), and Port/Connector graph nodes.

UX gap: no ICD export. The KB §"Generation pipeline" specifies `GET /:id/icd?format=json|csv|docx` — the page has no button for this. The `Download` icon in the toolbar opens `PlaceholderModal`. Until ICD generation lands, the page is "a typed list of interfaces" rather than "the ICD-generation surface" that `kb/interface-management.md` §"ICD" promises.

---

## 6. Compliance Check (`/compliance-check`)

**File:** `frontend/src/pages/ComplianceCheck/ComplianceCheckPage.tsx` (**1082 lines** — the largest single-page in the cluster).

Three tabs (Rules / Runs / Findings) + a regulation folder tree + per-rule create-modal + per-folder create-modal — all in one component. The folder tree (`buildFolderTree`, `flattenFolderOptions`) is well-implemented and uses indented options on the move dropdown. The runs tab and findings tab both reuse the rule filtering pattern, which keeps the page coherent despite size.

The certification gap: **the rule library is empty by default**. `kb/configuration-management.md` §"strictMode rules" and `vision-and-usp.md` §10 imply opinionated seeded rules — "the editor refuses to save a malformed requirement" is precisely a compliance check that should ship as a seeded rule on every new DO-178C project. The page lets the user write their own `checkType` strings (`requirement_has_acceptance_criteria`, `requirement_has_owner`) but ships **no INCOSE rule library** out of the box. Per `gap-summary.md` #3, the INCOSE / EARS rule library is a top-3 closure — this page is the natural seeder.

The findings tab is also missing the "auto-create issue for each failing finding" affordance that every competitor has — a failing finding without an Issue or CR attached is paperwork.

Code-quality: 1082 lines is too much for one file. The `FolderTreeRows`, `FolderFormModal`, and the three tab views are all in the same file. Split into `views/RulesTab.tsx`, `views/RunsTab.tsx`, `views/FindingsTab.tsx`, `components/FolderTree.tsx` is overdue.

---

## 7. Lifecycle Status (`/lifecycle-status`)

**File:** `frontend/src/pages/LifecycleStatus/LifecycleStatusPage.tsx` (203 lines, mostly tab plumbing).

This page is a three-tab wrapper. The default tab is `control-tower` (correctly defaulted per the inline comment at line 42 — the legacy `status` tab is an empty placeholder with hardcoded selects). The control-tower tab is the real product: `LifecycleControlTowerPage.tsx` renders 9 panels (KPI bar, status distribution, entity × status heatmap, function health cards, PBS health cards, traceability table, governance panel, anomaly panel, readiness panel, audit trail panel). It is the most ambitious dashboard in the codebase.

The Control Tower is data-driven: 11 hooks (`useControlTowerOverview`, `useControlTowerHeatmap`, `useFunctionHealth`, `usePBSHealth`, `useTraceabilityTable`, `useSlaBreaches`, `useAnomalies`, `useIntegrityViolations`, `useReadinessScore`, `usePendingApprovals`, `useAuditTrail`) all backed by real `lifecycle.routes.ts` endpoints. The `isMock` detection at line 81 flags when any query falls back to mock — this is the right pattern.

The "Lifecycle Settings" tab lazy-loads `LifecycleManagementPage` from a sibling directory. The legacy "Status" tab (lines 107-201) is a 90-line placeholder with three select dropdowns and a "No Lifecycle Status Data" empty state. Either delete this tab or finish it.

Design-system note: the active tab uses `bg-blue-50 text-blue-600` (line 67) — should be deep forest tint.

---

## 8. Archive (`/archive`)

**File:** `frontend/src/pages/Archive/ArchivePage.tsx` (646 lines).

Four panels crammed into one page: Trash (soft-deleted requirements) + Glossary & Abbreviations + Record Retention & Audit + Archived Baselines. The trash panel lists deleted requirements with a "days left" countdown (7-day retention before purge per `cleanup.service.ts`), restore button, and permanent-delete confirmation. The baselines panel renders archived `Baseline` rows with view / export / compare modal triggers.

The page reads from at least three services: `requirementService.getRecentlyDeletedRequirements`, `baselineService` (for archived), and presumably `definitionEntries.routes.ts` (via `GlossaryAbbreviationsSection`). This is the only page in the cluster that aggregates across three data domains.

UX issues: (a) the four panels don't all need to be on one page — Glossary is a reference resource, Trash is an admin tool, Baselines are an audit artefact; they read differently. (b) The "Record Retention & Audit" panel is text-only ("Records older than X are purged...") and links to nothing actionable. (c) The Baselines panel reuses `BaselineViewModal`, `BaselineExportModal`, `BaselineComparisonModal` from the Requirements module — these should consume the unified `Baseline` primitive that cross-cutting refactor #2 will introduce.

Per `vision-and-usp.md` §10, the Archive is also where Tier 4 AI ("Automated maintenance — link updates when an upstream ID changes") would surface its actions. Today nothing AI-driven appears here.

---

## 9. Documentation (`/documentation`)

**File:** `frontend/src/pages/Documentation/DocumentationPage.tsx` (671 lines) + 9 views + 6 modals.

The cluster's most architecturally-decomposed page (`views/` + `modals/` + a `components/` directory). The page has six tabs (Documents / Templates / Evidence Packs / Import-Export / Export History / Settings) and three nested "open" states (`openDocumentId`, `openPackId`, `openTemplateId`) that switch the page into a full-screen editor.

The visible problem is the yellow `role="alert"` banner at lines 484-497: **"Demo data only — nothing is saved"** — explicitly warning users that templates, evidence packs, export profiles, and export history are session-state mock. The Documents tab does persist (the `documentationService.listDocuments` / `createDocument` / `updateDocument` calls fire), but the other five tabs do not.

The schema gap is `Document` itself, which is six columns wide (`id, projectId, name, type, content, sections`). `kb/documentation-model.md` specifies a much richer model: `status`, `version`, `owner`, `lastUpdated`, `source`, `tags[]`, plus the lifecycle (`Draft → InReview → Approved → Released`) and DO-178C § 11 type mapping (SRS / ICD / VVP / Test Report / Safety Plan / Compliance Matrix / Release Notes / ConOps). The frontend already renders these via `mapPrismaToFrontend` defaulting (`row.status ?? 'Draft'`, `row.version ?? 'v0.1'`), so the schema migration is additive.

The Templates / Evidence Packs / Export Profiles tabs all need real backend wiring. The `templates.routes.ts` / `corporateDocxTemplates.routes.ts` / `exportJobs.routes.ts` / `scheduledExports.routes.ts` route files exist and serve real endpoints, but the page bypasses them and reads `MOCK_TEMPLATES`, `MOCK_EVIDENCE_PACKS`, `MOCK_EXPORT_PROFILES`, `MOCK_EXPORT_HISTORY`. This is the wiring that closes `gap-summary.md` #2.

---

## 10. Audit Log (`/audit`)

**File:** `frontend/src/pages/Safety/AuditLogPage.tsx` (76 lines).

This is the worst frontend in the cluster on a "buyer-visible per line of code" basis. It is a 76-line component that renders `MOCK_AUDIT_LOG` from `frontend/src/data/mockSafety.ts` as a five-column table (Action / Entity / ID / Timestamp / User) with a side panel showing "Before (mock)" and "After (mock)" `<pre>` blocks with literal "Previous value" / "New value" placeholders.

It is bound to **two** routes: `/projects/:projectId/audit` (FeatureGuard `audit`) and `/projects/:projectId/safety-analysis/audit-log`. Cutting Safety per `gap-summary.md` §B will remove the second binding but leave the first unbroken because the file lives at `pages/Safety/AuditLogPage.tsx`.

The replacement is straightforward: a real `AuditLogPage` that reads from `AuditLog` (`schema.prisma:1614-1627`) — the same table Validation, Stakeholders, and the project layer already write to. The cross-cutting refactor #6 work (collapsing the eleven private audit tables into the central `AuditLog`) is sequenced afterwards; the page reads the central table from day one.

---

## 11. MBSE Models (`/mbse-models`)

**File:** `frontend/src/pages/MBSEModels/MBSEModelsPage.tsx` (399 lines).

A full-page modeling environment outside `MainLayout` (the page declares its own three-pane layout: Model Browser + Tabbed Diagram Workspace + Properties Panel). Ten diagram types are wired: RequirementsDiagram, UseCaseDiagram, BlockDefinitionDiagram, InternalBlockDiagram, ParametricDiagram, ParameterRequirementDiagram, ActivityDiagram, SequenceDiagram, StateMachineDiagram, PackageDiagram. Five modal tools: ModelValidationEngine, ImpactAnalysisView, VerificationCoverageDashboard, EnhancedTraceabilityMatrix, StandardExporter, DiagramEditor.

Per `vision-and-usp.md` §11 expansion roadmap, "Mature MBSE round-trip with Cameo / Rhapsody / Capella" is **Phase 5+** — meaning this page is significantly ahead of the roadmap. Per `gap-summary.md` deliberate omission #6, this is anti-ICP work. The cost-benefit question is whether the page earns its build budget. Recommendation: keep it as a Beta-tagged feature (the small-team A&D ICP from `vision-and-usp.md` §4 will want MBSE eventually) but **freeze new investment** until first paying customer; spend the engineering capacity on Risk + Interface backend per RM-1 and IM-1.

Frontend-quality note: the page uses its own `useMBSEStore` (Zustand) and a separate properties-panel context. Persistence today is partial: panel widths persist to the Zustand store; diagram contents go through `diagrams.routes.ts` (7 endpoints) which back the `Diagram` Prisma model.

---

## 12. Product Breakdown Structure (`/product-breakdown-structure`)

**Files:** `PBSLayoutPage.tsx` (15 lines — shell only) + `PBSMainPage.tsx` (166 lines).

The cleanest small page in the cluster. The shell layout is provided by `ProjectLayout` (which renders the tree sidebar via `useComponentContext`); the main page handles the selected-component detail panel with an inline edit form. Empty state is on-brand ("Select a component in the tree to view or edit its details, or use the sidebar to add new components"); loading + error states are correct; the mutation invalidates both `['component', projectId, componentId]` and `['component-tree', projectId]`.

The page is short because the tree is in a sidebar component (under `frontend/src/modules/pbs/`). The Prisma model `Component` is recursive (`parentId`) with seven backend endpoints — solid coverage. The only gaps are convenience: no bulk-move, no CSV-import for initial PBS bootstrap, no rolling-up of allocation counts ("12 functions, 8 requirements allocated to this assembly"). These are PBS-1 and PBS-2 in `tickets.md`.

Design-system: the edit button uses `text-blue-600 hover:underline` and the save button uses `bg-blue-600` — same blue-token noise as the rest.

---

## 13. Use Cases (embedded, no dedicated page)

There is **no page** for Use Cases despite a `usecases.routes.ts` with 9 endpoints and three Prisma models (`UseCase`, `Actor`, `UseCaseActor`). The frontend reaches Use Cases through the MBSE Models page (the `UseCaseDiagram` component) and through the Architecture diagrams. There is no `/projects/:projectId/use-cases` route in `App.tsx`.

This is an inconsistency: an endpoint cluster with no entry point is an orphaned API surface. The Phase 2 reading of `inventory.md` row 53 ("(no dedicated page — embedded)") is correct as a fact but wrong as a product position. Per `vision-and-usp.md` §10, system requirements derive from use cases — the use-case-to-requirement trace is part of the certification-native model. UC-1 in `tickets.md` proposes a decision: either build the page or remove the routes.

---

## Cross-page frontend findings

Three observations that span the cluster:

**Color-token violation density is the cluster's single biggest visual debt.** Grep counts approximate violations per file (blue/indigo/purple/sparkle iconography):

| File | Approx. count |
|---|---:|
| `IssuesPage.tsx` | ~80 |
| `ComplianceCheckPage.tsx` | ~70 |
| `RiskManagementPage.tsx` | ~55 |
| `InterfaceManagementPage.tsx` | ~45 |
| `ArchivePage.tsx` | ~25 |
| `LifecycleControlTowerPage.tsx` (control tower) | ~30 |

Per the Requirements package cross-cutting entry "Brand-token migration is a cross-package, not a per-page, refactor," this is a Phase A precondition (extend `tailwind.config.js`) before any per-page migration can succeed. Linked tickets reference REQ-L-style migration tasks.

**Two patterns that should be promoted to design-system primitives.** (1) The "click row → open detail drawer" pattern used by Issues, CRs, Risk, Interface, and Archive is reimplemented per page. (2) The "URL-synced filter bar" pattern is on Issues, partially on CRs, missing on Risk/Interface/Compliance. These should be `<EntityListWithDrawer>` and `<UrlSyncedFilterBar>` shared components.

**Empty / loading / error states are inconsistent.** Per `design-system.md` §5.4, every empty state must address the engineer ("No requirements. Start with a system-level requirement, or import from an existing baseline.") and errors must quote the exact error. Today: PBSMainPage shows a generic FolderTree icon empty state; Risk shows "No risks match your filters"; Archive shows "No deleted requirements"; Issues shows nothing on empty list. None match the §5.4 voice exactly.
