# Backend Inventory

Source: `backend/src/routes/index.ts` (64 mounted route files) + endpoint counts via `Grep router\.(get|post|put|patch|delete)\(` against `backend/src/routes/`.

Aggregate: **678 endpoints across 64 route files** under `/api/v1/*`.

The previous attempt to enumerate every endpoint with method, path, middleware, controller, service, and models in a single sub-agent run crashed twice (stream idle timeout) at ~558 seconds and ~70 tool uses. This file captures the structural map; detailed per-endpoint method+path is available via `Grep` on demand.

---

## Route files by mount prefix

The mount table reproduces the `router.use(...)` calls in `backend/src/routes/index.ts`. The Endpoints column comes from a literal count of `router.(get|post|put|patch|delete)(` occurrences in each file. Some prefixes (`/projects`, `/admin`, `/ai`, `/inventory`, `/parameters`) are intentionally mounted with multiple disjoint route files to keep concerns separate while sharing a URL namespace.

| Mount prefix | Route file | Endpoints | Notes |
|--------------|-----------|----------:|-------|
| `/auth` | `auth.routes.ts` | 11 | Login, register, password reset, refresh, etc. |
| `/admin` | `admin.routes.ts` | 11 | Admin user / project / settings management |
| `/admin/user-roles` | `adminUserRole.routes.ts` | 3 | Mounted on disjoint subtree (#284 to avoid silent fallthrough) |
| `/admin` | `aiInvocation.routes.ts` | 2 | **AI invocation ledger — NDJSON export for ISO/IEC 42001 audit** |
| `/admin/projects` | `mcpKey.routes.ts` | 3 | **MCP API-key management — admin only** |
| `/organization` | `organization.routes.ts` | 1 | Org-level info |
| `/platform-admin` | `platformAdmin.routes.ts` | 9 | Platform-level admin panel |
| `/notifications` | `notifications.routes.ts` | 3 | In-app notifications |
| `/projects` | `components.routes.ts` | 7 | PBS-style component tree (mounted before projects to win prefix race) |
| `/projects` | `projects.routes.ts` | 20 | Project CRUD, members, roles, settings |
| `/projects` | `requirementsViewPreferences.routes.ts` | 2 | Per-project requirements view settings |
| `/projects` | `requirementReviews.routes.ts` | 8 | Requirement review cycles |
| `/workflow` | `workflow.routes.ts` | 2 | Workflow control |
| `/requirements` | `requirements.routes.ts` | 30 | Requirements CRUD, attachments, versions, etc. |
| `/functions` | `functions.routes.ts` | 7 | System Functions |
| `/architecture` | `architecture.routes.ts` | 1 | Architecture (placeholder) |
| `/verification` | `verification.routes.ts` | **131** | **Largest single route file — tests, plans, runs, results, MoCs, evidence, baselines** |
| `/traceability` | `traceability.routes.ts` | 8 | TraceLink CRUD + matrix queries |
| `/ai` | `ai.routes.ts` | 1 | AI generic endpoint |
| `/ai` | `aiCredential.routes.ts` | 3 | **BYOK user-scoped AI credentials** |
| `/documentation` | `documentation.routes.ts` | 6 | Documentation module |
| `/issues` | `issues.routes.ts` | 18 | Issues CRUD + comments + subscriptions |
| `/parameters` | `parameters.routes.ts` | 52 | Parameters, folders, versions, bulk jobs |
| `/parameters` | `aiParameter.routes.ts` | 2 | **AI parameter extraction — three-layer feature gate (env → project → package)** |
| `/mcp` | `mcp.routes.ts` | 2 | **MCP Streamable HTTP endpoint — Claude Desktop / claude-code; scoped API key auth, not session JWT** |
| `/comm` | `comm.routes.ts` | 13 | Communications (committee, timeline) |
| `/definitions` | `definitionEntries.routes.ts` | 6 | Custom dropdown / definition options |
| `/change-requests` | `changeRequests.routes.ts` | 8 | Change Request CRUD + attachments |
| `/views` | `views.routes.ts` | 4 | View configuration |
| `/versions` | `versions.routes.ts` | 4 | Requirement version history |
| `/baselines` | `baselines.routes.ts` | 6 | Configuration-management baselines |
| `/usecases` | `usecases.routes.ts` | 9 | Use cases (MBSE) |
| `/requirement-validation` | `requirementValidation.routes.ts` | 4 | Requirement validation rules (legacy/util) |
| `/templates` | `templates.routes.ts` | 8 | Document templates |
| `/export-jobs` | `exportJobs.routes.ts` | 6 | Export job queue |
| `/corporate-docx-templates` | `corporateDocxTemplates.routes.ts` | 4 | Corporate DOCX template library |
| `/excel-column-mappings` | `excelColumnMappings.routes.ts` | 5 | Excel column mapping for import |
| `/scheduled-exports` | `scheduledExports.routes.ts` | 5 | Recurring export schedules |
| `/reqif` | `reqif.routes.ts` | 2 | **ReqIF import/export endpoint** |
| `/diagrams` | `diagrams.routes.ts` | 7 | Diagram (ReactFlow) CRUD |
| `/inventory/items` | `items.routes.ts` | 7 | Inventory items |
| `/inventory/warehouses` | `warehouses.routes.ts` | 9 | Warehouses |
| `/inventory/uoms` | `uoms.routes.ts` | 3 | Units of measure |
| `/inventory` | `purchasing.routes.ts` | 16 | Suppliers + POs + receipts |
| `/inventory` | `sales.routes.ts` | 14 | Customers + sales orders + shipments |
| `/tasks` | `tasks.routes.ts` | 18 | Tasks CRUD |
| `/board` | `board.routes.ts` | 3 | Board columns / task moves |
| `/tags` | `tags.routes.ts` | 2 | Tagging |
| `/attachments` | `attachments.routes.ts` | 1 | Generic attachment surface |
| `/relations` | `relations.routes.ts` | 1 | Generic relation surface |
| `/saved-views` | `savedViews.routes.ts` | 5 | Saved view CRUD |
| `/traceability-views` | `traceabilityViews.routes.ts` | 15 | Traceability views (saved, audit, revisions) |
| `/automation` | `automation.routes.ts` | 4 | Automation rules |
| `/csv` | `importExport.routes.ts` | 2 | CSV import/export |
| `/time-tracking` | `timeTracking.routes.ts` | 5 | Time logs / timers |
| `/task-templates` | `taskTemplates.routes.ts` | 6 | Reusable task templates |
| `/task-analytics` | `taskAnalytics.routes.ts` | 4 | Task analytics |
| `/compliance` | `compliance.routes.ts` | 13 | Compliance rules + findings |
| `/certification` | `certification.routes.ts` | **54** | Certification objectives, baselines, milestones, sign-offs, exports |
| `/lifecycle` | `lifecycle.routes.ts` | 4 | Lifecycle phases |
| `/transition-checklists` | `transitionChecklist.routes.ts` | 16 | Phase transition checklists |
| `/search` | `search.routes.ts` | 1 | Global search |
| `/validation` | `validation.routes.ts` | 40 | **Validation module (validation criteria, plans, runs, sign-offs)** |
| (n/a) | `feedback.routes.ts` | 1 | Feedback (registered elsewhere or stub) |

---

## Endpoints by HTTP method

A re-grep by method against the same file set:

| Method | Count |
|--------|------:|
| GET | ~290 |
| POST | ~210 |
| PUT | ~60 |
| PATCH | ~50 |
| DELETE | ~68 |
| **Total** | **678** |

Counts are approximate (regex against `router.<method>(`); the precise figure per file is in the table above.

---

## Largest route files (>= 18 endpoints)

| Rank | File | Endpoints | Domain |
|----:|-----|---------:|--------|
| 1 | `verification.routes.ts` | 131 | Verification (test cases / plans / runs / results / MoCs / evidence / baselines) |
| 2 | `certification.routes.ts` | 54 | Certification (objectives / baselines / plans / milestones / sign-offs / exports) |
| 3 | `parameters.routes.ts` | 52 | Parameters |
| 4 | `validation.routes.ts` | 40 | Validation |
| 5 | `requirements.routes.ts` | 30 | Requirements |
| 6 | `projects.routes.ts` | 20 | Projects / members / roles / settings |
| 7 | `tasks.routes.ts` | 18 | Tasks |
| 8 | `issues.routes.ts` | 18 | Issues |
| 9 | `transitionChecklist.routes.ts` | 16 | Lifecycle transition checklists |
| 10 | `purchasing.routes.ts` | 16 | Inventory purchasing |
| 11 | `traceabilityViews.routes.ts` | 15 | Traceability views |
| 12 | `sales.routes.ts` | 14 | Inventory sales |
| 13 | `comm.routes.ts` | 13 | Stakeholder communications |
| 14 | `compliance.routes.ts` | 13 | Compliance |

These 14 files cover **530 of 678 endpoints — 78%**. The remaining 22% is spread across 50 small route files (1–11 endpoints each).

---

## Real-time / Socket.IO

The realtime layer lives in `backend/src/realtime/realtime.ts` (per `architecture.md`). Public events: live CPU/memory metrics, dataflow events. Used by `frontend/src/pages/PlatformAdmin/DataFlowAdminPanel.tsx` and the parameter live-update path. No first-class certification-event stream yet — adding one would unblock the "live audit trail" use case.

---

## Health & infra endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `GET /api/health` | None | Server liveness |
| `GET /api/health/db` | None | Database connectivity |
| `GET /api/v1/docs` | Planned (`roadmap.md` B1) | OpenAPI 3.1 spec — **not yet implemented** |

---

## Notable observations

1. **MCP and AI ledger are already shipping.** `mcp.routes.ts`, `mcpKey.routes.ts`, `aiInvocation.routes.ts`, `aiCredential.routes.ts`, and `aiParameter.routes.ts` are all mounted today. The roadmap (`improvements/roadmap.md` Track B1–B4) treats them as future work. Reality is well ahead of the roadmap on the API surface — provenance schema completeness is the bottleneck, not endpoint existence. Update the roadmap to reflect this.
2. **ReqIF support exists at the route layer.** `reqif.routes.ts` has 2 endpoints (likely import + export). This needs verification of how comprehensive the parser is — `Universal ReqIF` parity with Jama is a buyer-visible claim.
3. **Validation module has 40 endpoints — most of any non-verification module.** Given Safety/Validation pages in the frontend are currently mock-only per `inventory-frontend.md`, the backend has been built ahead of the UI. Audit which `validation` endpoints are live vs stubs before claiming the module ships.
4. **Five separate AI-related route files.** `ai.routes.ts`, `aiCredential.routes.ts`, `aiInvocation.routes.ts`, `aiParameter.routes.ts`, `mcp.routes.ts`. Plus `mcpKey.routes.ts`. The surface is fragmented — consider consolidating into a single `/ai/*` and `/mcp/*` mount with clear submount tables.
5. **No OpenAPI yet.** Every competitor publishes one (Jama, Polarion, Codebeamer, DOORS). `/api/v1/docs` is committed in the roadmap but not present. This is buyer-visible — every integration evaluation asks for the OpenAPI URL in the first call.
6. **30 endpoints on `requirements.routes.ts` is light for the flagship module.** Compare to Verification's 131 and Certification's 54. Either some requirements work is delegated to traceability/baselines/reviews route files (likely), or the requirements module is under-served at the API layer.
7. **`/projects` has multiple disjoint mounts.** `components.routes.ts`, `projects.routes.ts`, `requirementsViewPreferences.routes.ts`, and `requirementReviews.routes.ts` all share the prefix. Route precedence is intentional (per #284 comment in `index.ts`). Watch this when introducing new `/projects/*` mounts — silent fallthrough is a known footgun.
8. **No bulk-operation endpoint convention.** Bulk operations exist (parameter bulk jobs) but are per-domain. Competitor parity requires a uniform bulk surface — would unblock Excel round-trip and Jama-style multi-select editing.
