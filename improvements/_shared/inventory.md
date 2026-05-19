# Codebase Inventory

Consolidated map of every page, endpoint, and data model in the application, organised by domain. Source files for the detail listings are:

- **Frontend routes:** `inventory-frontend.md` (75 routes, 66 page components)
- **Backend endpoints:** `inventory-backend.md` (678 endpoints, 64 route files)
- **Data models:** `inventory-models.md` (178 Prisma models, 19 domains)

This file is the rollup. Per-row detail (every route, every endpoint, every model) lives in the three files above. Read this file first; drill down only when a domain needs deeper investigation.

---

## Aggregate stats

| Layer | Count |
|---|---:|
| Frontend route declarations in `App.tsx` | 75 |
| Frontend page components | 66 |
| Routes behind `<FeatureGuard>` | 35 |
| Backend route files | 64 |
| Backend HTTP endpoints | 678 |
| Prisma models | 178 |
| Prisma domains | 19 |
| Models with soft delete (`deletedAt`) | 6 |
| Models with AI provenance fields | 1 (`Parameter`) |
| Models with explicit version chain | 13 (5 dedicated `*Version` / `*Revision` tables; 8 in-row `version` counters) |
| Audit-trail tables | 11 |
| HTTP body limit (Express) | 50 MB |

---

## Domain map — pages, endpoints, models

The table below is the single source-of-truth cross-map for "where in the codebase does the Requirements module live." For each domain it lists the project-scoped frontend pages, the backend route file(s) and endpoint count, and the primary Prisma models. Use it to scope per-page review agents in Phase 2.

**Legend.** "Pages" omits the `/projects/:projectId/` prefix. Settings sub-pages are listed only when they have a separate route. Some domains span multiple route files (`/projects`, `/admin`, `/ai`, `/inventory`, `/parameters` are intentionally split per `inventory-backend.md`).

| Domain | Pages | Backend route files (endpoint count) | Primary Prisma models | Notes |
|---|---|---|---|---|
| **Authentication & Session** | `/login` (public), `/settings` (auth) | `auth.routes.ts` (11) | `User`, `AdminRole`, `UserAdminRole` | Login, password reset, refresh; uses JWT in `localStorage` |
| **Organisation & Platform Admin** | `/organization`, `/platform-admin/*` (6 pages) | `organization.routes.ts` (1), `platformAdmin.routes.ts` (9) | `Organization`, `CompanyLimit` | Platform admin uses its own layout (no MainLayout) |
| **Admin (project / module)** | `/admin`, `/admin/ai-invocations` | `admin.routes.ts` (11), `adminUserRole.routes.ts` (3), `aiInvocation.routes.ts` (2), `mcpKey.routes.ts` (3) | `User`, `AdminRole`, `UserAdminRole`, `AiInvocation` | `/admin` mounted twice for disjoint surfaces; AI invocations NDJSON export for ISO/IEC 42001 audits |
| **Projects** | `/` (dashboard), `/projects/:projectId` (landing) | `projects.routes.ts` (20), `components.routes.ts` (7) | `Project`, `ProjectMember`, `ProjectAnalytics`, `Component` | Component PBS routes share `/projects` prefix |
| **Requirements** | `/requirements`, `/requirements/settings`, `/requirements/dashboard`, `/requirements/traceability-views` | `requirements.routes.ts` (30), `requirementReviews.routes.ts` (8), `versions.routes.ts` (4), `requirementsViewPreferences.routes.ts` (2), `requirementValidation.routes.ts` (4) | `Requirement`, `RequirementVersion`, `RequirementComment`, `RequirementAttachment`, `RequirementReview`, `RequirementReviewer`, `RequirementTemplate`, `RequirementExportTemplate`, `RequirementSubscription`, `Component`, `TraceLink`, `RequirementChangeRequestLink` | Flagship page imports **10 services**; routes split across 5 files |
| **Traceability** | (sub-feature of Requirements) | `traceability.routes.ts` (8), `traceabilityViews.routes.ts` (15) | `TraceLink` (polymorphic), `Dependency` (if present) | Saved views with folder tree, audit, revisions |
| **Parameters** | `/parameters`, `/parameters/settings` | `parameters.routes.ts` (52), `aiParameter.routes.ts` (2) | `Parameter`, `ParameterVersion`, `ParameterFolder`, `ParameterBaseline`, `ParameterBaselineItem`, `ParameterScenario`, `ParameterScenarioOverride`, `ParameterBulkJob`, `ParameterType`, `ProjectUnit`, `CommBus`, `CommMessage`, `CommField` | **Only domain with full AI provenance schema** (`authorType` / `authorAiModel` / `authorAiPromptId` / `classification` / `reviewStatus`) |
| **Verification** | `/verification`, `/verification/settings`, `/verification/templates`, `/verification/templates/:id`, `/verification/report/:type/:id` | `verification.routes.ts` (**131 — largest**) | 28 `Ver*` models incl. `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerMethod`, `VerMoc`, `VerBaseline`, `VerEvidence`, `VerTemplate`, `VerTemplateVersion`, `VerTestRunResultStatusHistory`, `VerAuditEvent` | Deepest module in the codebase by endpoint and model count |
| **Validation** | `/validation`, `/validation/der`, `/validation/baselines`, `/validation/activity`, `/validation/settings` | `validation.routes.ts` (40) | 6 `Validation*` models incl. `ValidationItem`, `ValidationComment`, `ValidationBaseline`, `ValidationSignOff` | Backend ships ahead of UI maturity; verify which endpoints are live |
| **Change Requests** | `/change-requests` | `changeRequests.routes.ts` (8) | `ChangeRequest`, `ChangeRequestAttachment`, `RequirementChangeRequestLink` | Polymorphic source-entity, risk, effort fields |
| **Issues** | `/issues`, `/issues/:issueId` | `issues.routes.ts` (18) | 7 `Issue*` models incl. `Issue`, `IssueComment`, `IssueSystemNote`, `IssueSubscription`, `IssueAttachment`, `IssueLabel`, `IssueLink` | Polymorphic cross-links to req / function / parameter |
| **Tasks** | Cross-project: `/tasks/*` (11 sub-pages). Project-scoped: `/projects/:projectId/tasks` (same component) | `tasks.routes.ts` (18), `board.routes.ts` (3), `taskTemplates.routes.ts` (6), `taskAnalytics.routes.ts` (4), `timeTracking.routes.ts` (5), `automation.routes.ts` (4), `tags.routes.ts` (2) | `Task`, `TaskTemplate`, `BoardColumn`, `TaskAnalytics`, `TaskAuditLog`, `AutomationRule`, `AutomationRun`, `TimeLog` | 20 task-domain models per `inventory-models.md` |
| **System Functions** | `/functions` | `functions.routes.ts` (7) | `SystemFunction` (recursive) | |
| **Use Cases** | (no dedicated page — embedded) | `usecases.routes.ts` (9) | `UseCase`, `Actor`, `UseCaseActor` | |
| **Architecture** | `/architecture` ("Coming soon" — unguarded) | `architecture.routes.ts` (1) | `Architecture` | Page is a placeholder; route lacks FeatureGuard |
| **MBSE Models** | `/mbse-models` (full-page, outside MainLayout) | (uses ai, diagrams, components) | `Diagram`, `MbseModel` (if present) | Diagram editor with SysML viewpoints |
| **PBS (Product Breakdown Structure)** | `/product-breakdown-structure` | `components.routes.ts` (7) | `Component` (PBS recursive), `PbsNode` | Lives under `frontend/src/modules/pbs/` |
| **Stakeholders** | `/stakeholder` | `comm.routes.ts` (13) | Stakeholder / Committee / ApprovalRule under `modules/stakeholders/` | RACI matrix, communication timeline |
| **Interface Management** | `/interface-management` | (no dedicated routes — uses generic) | `Interface`, `Signal` (when implemented) | **Page uses mock data only** |
| **Risk Management** | `/risk-management` | (no dedicated routes — uses generic) | `Risk`, `RiskArtifactLink` | **Page uses mock data only** |
| **Documentation** | `/documentation` | `documentation.routes.ts` (6), `templates.routes.ts` (8), `corporateDocxTemplates.routes.ts` (4), `excelColumnMappings.routes.ts` (5), `exportJobs.routes.ts` (6), `scheduledExports.routes.ts` (5) | `Document`, `EvidencePack`, `EvidencePackItem`, `ExportJob`, `ScheduledExport`, `CorporateDocxTemplate`, `ExcelColumnMapping`, `ExportProfile` | Service-rich domain; UI shows mock data in places |
| **Certification** | `/certification` | `certification.routes.ts` (54) | 21 `Cert*` models incl. `CertContext`, `CertObjective`, `CertBaseline`, `CertPlan`, `CertMilestone`, `CertSignOff`, `CertActivityLogEntry`, `CertReviewLogEntry` | Second-largest module by endpoint count |
| **Lifecycle / Transition** | `/lifecycle-status` | `lifecycle.routes.ts` (25 — 1 benchmarks + 18 Control Tower + 6 lifecycle-definition), `transitionChecklist.routes.ts` (16) | `LifecyclePhase`, `LifecycleTransition`, `TransitionChecklist`, `ChecklistVersion` | `LifecyclePhase` + `LifecycleTransition` are real Prisma models as of NX-11 (#474); `lifecycle.routes.ts` is no longer placeholder stubs — the 6 lifecycle-definition endpoints (`/library`, `/applicable`, `/transitions`, `POST/PUT/DELETE /definitions`) are model-backed and project-scoped, alongside the Control Tower section |
| **Configuration Management** | `/configuration-management` | `baselines.routes.ts` (6) | `Baseline`, `BaselineItem` (only — no `ConfigItem`, `Deviation`, `Waiver` tables yet — see `inventory-models.md` gap #1) | Frontend module richer than backend |
| **Compliance** | `/compliance-check` | `compliance.routes.ts` (13) | `ComplianceRule`, `ComplianceFinding` | |
| **Safety Analysis** | `/safety-analysis/*` (17 sub-pages) | (no dedicated routes — all UI mock) | `Hazard`, FMEA/FTA/Markov (if present) | **Entire module is mock-data with persistent demo banner** |
| **Archive** | `/archive` | (uses requirements, baselines) | `Requirement` (soft-deleted), `Baseline`, `DefinitionEntry` | Trash + glossary + retention |
| **Audit Log** | `/audit`, `/safety-analysis/audit-log` (shared component) | (uses platformAdmin audit) | `AuditLog`, `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`, `AiInvocation` | **11 separate audit tables — no unified provenance log** (gap #2 in `inventory-models.md`) |
| **Reports** | `/reports` ("Coming soon" — unguarded) | (uses platformAdmin) | n/a | Placeholder |
| **AI / MCP / Credentials** | `/admin/ai-invocations`, `/settings` (AI access tab) | `ai.routes.ts` (1), `aiCredential.routes.ts` (3), `aiInvocation.routes.ts` (2), `aiParameter.routes.ts` (2), `mcp.routes.ts` (2), `mcpKey.routes.ts` (3) | `AiInvocation` (universal ledger), `AiCredential` (BYOK), `McpKey` | **MCP Streamable HTTP endpoint already live** — scoped API key auth, ahead of roadmap B2 |
| **Search** | (no dedicated page — header search) | `search.routes.ts` (1) | (joins many tables) | |
| **Diagrams** | (used inside MBSE, PBS, requirements) | `diagrams.routes.ts` (7) | `Diagram` | |
| **Inventory** | `/inventory/*` (8 sub-pages) | `items.routes.ts` (7), `warehouses.routes.ts` (9), `uoms.routes.ts` (3), `purchasing.routes.ts` (16), `sales.routes.ts` (14), `importExport.routes.ts` (2) | 28 inventory models (catalog, suppliers/customers, POs, sales, lots, valuation) | Largest cross-project module by model count, outside the cert-native scope per `vision-and-usp.md` §11 |
| **ReqIF (interchange)** | (no dedicated page) | `reqif.routes.ts` (2) | (operates on `Requirement` + `TraceLink`) | **Already mounted — ahead of roadmap; verify parser completeness** |
| **Saved Views / Filters** | (used across modules) | `savedViews.routes.ts` (5), `views.routes.ts` (4), `traceabilityViews.routes.ts` (15) | `SavedView`, `SavedViewFolder`, `SavedViewRevision`, `SavedViewAuditEvent` | Versioned, audited |
| **Attachments / Relations / Tags / Definitions** | (used across modules) | `attachments.routes.ts` (1), `relations.routes.ts` (1), `tags.routes.ts` (2), `definitionEntries.routes.ts` (6) | `Attachment` polymorphic, `Tag`, `DefinitionEntry` | |
| **Help / Legal / Marketing** | `/help`, `/help/:slug`, `/privacy`, `/terms`, `/`, `/preview/landing` | (static) | n/a | Marketing + in-app docs |

---

## Pages with no service imports (mock data or placeholder)

These pages render UI but read no backend services. Either feature-flagged as not-yet-implemented or stubbed for demo. Important for Phase 2 — these are the pages where "the backend doesn't exist yet" is the dominant finding.

| Path | Status | Notes |
|---|---|---|
| `/projects/:projectId/architecture` | Placeholder ("Coming soon") | **Unguarded** (no FeatureGuard) |
| `/projects/:projectId/reports` | Placeholder ("Coming soon") | **Unguarded** |
| `/projects/:projectId/risk-management` | Mock data | UI complete, no backend |
| `/projects/:projectId/interface-management` | Mock data | UI complete, no backend |
| `/projects/:projectId/safety-analysis/*` (17 routes) | Mock data + demo banner | UI complete; FMEA/FTA/Markov canvas built; no DB persistence |
| `/projects/:projectId/audit` (Safety AuditLogPage reused) | Mock data | |
| `/projects/:projectId/documentation` (and sub-views) | Partly mock | Backend routes exist; some UI on mock |

---

## Backend endpoints with no frontend consumer (orphans candidate list)

Approximate — needs verification by grep in `frontend/src/services/*`:

- `requirementValidation.routes.ts` (4 endpoints) — unclear if still consumed; legacy/util.
- `architecture.routes.ts` (1 endpoint) — placeholder.
- `relations.routes.ts` (1 endpoint) — generic surface; may be unused after polymorphic-link migration.
- `attachments.routes.ts` (1 endpoint) — may be subsumed by per-module attachment endpoints.

These should be confirmed dead and removed before "API surface = product surface" claim survives a buyer audit.

---

## Cross-cutting characteristics

### Authentication
JWT in `localStorage` (`token` key). Every protected route goes through `authenticateToken` middleware. Admin routes additionally use `requireAdmin`. MCP endpoint uses a **scoped API key**, not the session JWT — see comment in `routes/index.ts:103`.

### Real-time
Single Socket.IO instance, configured in `backend/src/realtime/realtime.ts`. Used today for: live system metrics dashboard, parameter live updates, dataflow admin panel. No certification-event stream.

### Provenance
Today only `Parameter` carries the full AI provenance lattice. Other tables carry weaker signals (`TraceLink.confidence`/`isAuto`/`isSuspect`, `VerTestCase.isSuspect`). `AiInvocation` is a universal call ledger but is not natively joined back to artefacts — see `inventory-models.md` AI-readiness section. This is the **single biggest schema gap** between current state and `ai-ready-vision.md` §6.1.

### Audit trail
**11 separate audit tables.** No universal provenance log. Listed: `AuditLog`, `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `VerTestRunResultStatusHistory`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`. Plus `AiInvocation`. Auditors will accept this; engineers will not maintain it. Unify before adding the 12th.

### Soft delete
Only 6 of 178 models. Inconsistent with the regulatory promise of "never lose audit-relevant data." See `inventory-models.md` gap #3.

### Versioning
Five inconsistent patterns: dedicated `*Version`, `*Revision`, in-row `Int`, in-row `String` (Parameter.version), and `Baseline` JSON snapshots. See `inventory-models.md` gap #4. Unifying this is the precondition for the "universal baseline" promise in the competitor matrix.

### Polymorphic cross-module relations
`TraceLink`, `VerEvidenceLink`, `IssueLink`, `InventoryAttachment`, etc. use tagged strings (`sourceKind`, `targetKind`) rather than Prisma relations. Fast to extend, no FK integrity. Per `inventory-models.md` gap #5 — known and accepted, but a buyer of an audit-grade tool will notice.

---

## Phase 2 scoping suggestion

Spawning one sub-agent per **page** (per the user's brief) is the right grain for design-review.md and tickets.md output. But for `frontend.md` and `backend.md` the natural axis is **per domain**, because most domains span 2–6 pages that share state and services. Group accordingly:

| Phase 2 group | Pages | Why grouped |
|---|---|---|
| Requirements | `/requirements`, `/requirements/settings`, `/requirements/dashboard`, `/requirements/traceability-views` | Same flagship module, 10 imported services |
| Verification | `/verification`, `/verification/settings`, `/verification/templates`, `/verification/templates/:id`, `/verification/report/...` | 131 endpoints, all share `verification.service.ts` |
| Validation | `/validation`, `/validation/der`, `/validation/baselines`, `/validation/activity`, `/validation/settings` | All under same store |
| Parameters | `/parameters`, `/parameters/settings` | 52 endpoints, AI provenance pilot |
| Certification | `/certification` | 21 models, 54 endpoints |
| Tasks | All `/tasks/*` cross-project and project-scoped variants | Single `TasksPage` component reused |
| Inventory | All `/inventory/*` | Outside cert-native scope, treat as separate sub-product |
| Safety | All `/safety-analysis/*` | All mock — single "build vs cut" decision |
| Stakeholders | `/stakeholder` | Self-contained module |
| Configuration Management | `/configuration-management` | Self-contained module |
| Single-page modules | `/issues`, `/issues/:id`, `/change-requests`, `/functions`, `/risk-management`, `/interface-management`, `/compliance-check`, `/lifecycle-status`, `/archive`, `/documentation`, `/audit`, `/mbse-models`, `/product-breakdown-structure` | One review per page |
| Admin / Platform | `/admin`, `/admin/ai-invocations`, `/platform-admin/*`, `/organization`, `/settings` | Cross-cutting |
| Placeholder | `/architecture`, `/reports` | Single "decide what to do" review |
| Marketing & legal | `/`, `/login`, `/preview/landing`, `/privacy`, `/terms`, `/help`, `/help/:slug` | Out of scope for engineering review |

That collapses 75 routes to ~14 review packages — appropriate for one Phase 2 sub-agent per package, with the flagship modules (Requirements, Verification) getting deeper attention.
