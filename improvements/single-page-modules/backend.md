# Single-Page Modules — Backend Review

Per-page backend assessment. Route files + Prisma models + gaps. The cluster covers 14 route files totalling roughly 100 endpoints — much smaller than Verification (131 endpoints) or Requirements (48 endpoints across 5 files) but distributed across 13 surface areas.

---

## 1. Issues — `issues.routes.ts` (63 lines, 18 endpoints)

**Routes file.** Six logical groups: labels (2), issue CRUD (5), activity (1), comments (3), subscriptions (2), links (2), attachments (3). The file correctly mounts `/labels` before `/:id` (the inline comment notes the Express path-matching trap). Auth middleware (`authenticateToken`) is applied at the router level; **no `requireProjectMember` middleware** — meaning any authenticated user can issue requests to any project's issues. This is the same authorization gap flagged in the Tasks `AutomationRule` cross-cut entry, but for a less catastrophic surface.

**Controller.** `issue.controller.ts` is **1003 lines** — second-largest controller in this cluster. It mixes CRUD with attachment upload, subscription handling, link creation, label management, and system-note generation. The `IssueSystemNote` model gets written from inside the controller's update handlers — this is the right pattern (every status change becomes an audit row), but the writes are inline rather than via a `writeIssueSystemNote` helper. The Validation module's `writeAudit` helper (per the cross-cutting entry on validation + AuditLog) is the better pattern.

**Models.** Seven (`Issue`, `IssueComment`, `IssueSystemNote`, `IssueSubscription`, `IssueAttachment`, `IssueLabel`, `IssueLink`). The `Issue` table carries a DO-178C `issueType` enum-as-string (specification_error / design_error / coding_error / documentation_error / interface_error / other) — this is the cleanest classification in the codebase outside Parameters' authorType lattice. No provenance fields (`authorType`, `authorAiModel`, etc.) per cross-cutting refactor #1.

**Gaps.** (a) Add `requireProjectMember` middleware. (b) Promote the inline system-note writes to a helper. (c) Add provenance lattice (cross-cutting #1). (d) `IssueLink` is polymorphic (`sourceType`, `sourceId`, `targetType`, `targetId`) but has no FK integrity — same pattern as `TraceLink`.

---

## 2. Change Requests — `changeRequests.routes.ts` (33 lines, 8 endpoints)

**Routes file.** Clean: CRUD (5) + attachments (3). Correctly applies `requireProjectMember` middleware at line 20. `projectIdParam` resolver at line 19. The route file references `requireProjectMember` — Issues should follow this pattern (see entry above).

**Controller.** `changeRequest.controller.ts` is 535 lines. Notable: line 76 uses `prisma.$transaction` with `allocateChangeRequestId(tx, projectId)` and `pg_advisory_xact_lock` to serialize CR ID allocation per project (per the inline comment, issue #162). This is the right pattern for any human-readable ID that must be unique per project — should be documented in `kb/backend-patterns.md` as the canonical sequence allocator.

**Models.** Three (`ChangeRequest`, `ChangeRequestAttachment`, `RequirementChangeRequestLink`). `ChangeRequest.status` is a free string — no Prisma enum. The status transitions (`pending → approved | rejected | in-review`) have no state machine — any patch can set status to anything. `safetyImpact` field does not exist; `kb/configuration-management.md` mandates a SafetyEngineer sign-off when `safetyImpact=true`.

**Gaps.** (a) Add `safetyImpact: Boolean` plus the `kb/configuration-management.md` §"Change requests" workflow. (b) Add `SignatureEvent` link (per cross-cutting refactor #3 / V-L1). (c) Add provenance lattice. (d) Add `impactRadius` precomputed field or compute-on-demand endpoint — the frontend column "this CR affects N requirements" reads from `requirementLinks.length` only; nothing computes test / function / parameter impact.

---

## 3. System Functions — `functions.routes.ts` (27 lines, 7 endpoints)

**Routes file.** CRUD (5) + move (1) + component re-assign (1). `authenticateToken` + `projectIdParam`; **no `requireProjectMember`**. Tiny surface.

**Controller.** 689 lines despite 7 endpoints — the `function.controller.ts` handles tree assembly, move-validation, descendant counting, and component re-allocation logic that should live in a service. Per `kb/backend-patterns.md` "Controller → Service Layer Boundary", queries belong in a service; the controller is supposed to be thin.

**Models.** Two: `SystemFunction` (recursive via `parentId`) and `UseCase` / `Actor` / `UseCaseActor` (separate route file). `SystemFunction.criticality` is free string. No FDAL primitive. The verification linkage uses `SystemFunction.verificationMethod` as a free string — this duplicates `VerMoc` (which is a typed primitive).

**Gaps.** (a) Add FDAL fields (`fdal: String?` valid A/B/C/D/E plus a propagation rule on parent change). (b) Extract a `functions.service.ts`. (c) Add `requireProjectMember`. (d) Use `VerMoc` FK instead of free-string `verificationMethod`.

---

## 4. Risk Management — no routes, no models

**No route file.** No `risk.routes.ts`. Inventory.md row 59 confirms.

**No models.** No `Risk` or `RiskArtifactLink` Prisma table — inventory-models.md confirms. The frontend `types.ts` defines a `Risk` interface that the UI uses with `MOCK_RISKS`.

**Path forward.** Three options from `gap-summary.md` strategic call-out B (Safety):
1. **Reuse `Hazard`.** The Safety module's `Hazard` model (when built) covers the same data shape (severity + likelihood + impact + mitigation + acceptance). The `RiskType` enum (Program / Technical / Safety / Compliance / Supplier) is broader than Hazard. Either widen `Hazard` to accept a `riskCategory` discriminator or add a `Risk` table that extends `Hazard` via composition.
2. **Build a `Risk` table.** Standalone model with the fields from `RiskManagement/types.ts` plus a polymorphic link table (`RiskArtifactLink` with `linkedEntityType` / `linkedEntityId`). Simpler to ship; reinforces the "two parallel risk models" anti-pattern.
3. **Cut Risk Management.** Per `gap-summary.md` strategic call-out B, this is what Safety should do until ARP4761A becomes a top-3 ICP driver. The argument is weaker for Risk Management because risk-tracking appears in every certification standard's QA module (AS9100, ISO 9001, ISO 26262, IEC 62304).

Recommendation: **Option 1** — extend Safety's `Hazard` model. RM-1 in `tickets.md` scopes this.

---

## 5. Interface Management — no routes, no models

**No route file.** No `interfaces.routes.ts`.

**No models.** No `Interface`, `Port`, `Connector`, `Signal` Prisma tables.

**Path forward.** `kb/interface-management.md` provides a full schema specification:

```
Interface { ifKey, kind, sourceId+sourceKind, targetId+targetKind, status, constraints[], technical Json, signals[] }
Signal    { id, interfaceId, name, payload Json, direction, rate }
Port      { id, blockId, name, direction, type (FlowPort|StandardPort|ProxyPort) }
Connector { id, sourcePortId, targetPortId, projectId }
```

Plus per-kind validation: `Data` → protocol, baudRate, latency, direction, errorDetection; `Electrical` → voltage, current, impedance, connectorType, pinout; `Physical` → dimensions, material, fitTolerance, torqueSpec; `Software` → apiType (REST/gRPC/IPC), auth, rateLimit, schema; `HMI` → displayStandard (ARINC 661), refreshRate, inputDevice.

The ICD generation pipeline per the KB:
```
GET /api/v1/projects/:projectId/interfaces/:id/icd?format=json|csv|docx
```
Reuses the existing `corporate-docx-templates` + `export-jobs` infrastructure — no new export pipeline needed; the same `ExportJob` row carries the `Interface.id` as the source artefact.

Scope: 4-6 Prisma models + 1 routes file (~10 endpoints) + 1 service (~400 lines for parsing + ICD generation) + frontend wiring (`InterfaceManagementPage` replaces `MOCK_INTERFACES` with a real `useQuery`). Estimated 2-3 sprints. See IM-1 / IM-2 / IM-3 in `tickets.md`.

---

## 6. Compliance — `compliance.routes.ts` (37 lines, 13 endpoints)

**Routes file.** Three resource groups: regulation folders (4), rules (5), runs (3 — `run`, `runs`, `runs/:id`), findings (1). Authorisation is well-considered (inline comment): **read endpoints are open to project members; mutating endpoints require `requireProjectOwnerOrAdmin`.** This mirrors the CCB-style gate from `kb/configuration-management.md` and is the right pattern.

**Controller.** `compliance.controller.ts` 346 lines — reasonable size. Uses a `ctrl.*` namespace pattern (line 5).

**Models.** Two (`ComplianceRule`, `ComplianceFinding`) plus `ComplianceRegulationFolder` and `ComplianceCheckRun`. `ComplianceRule.checkType` is a free string (e.g. `requirement_has_acceptance_criteria`); there is no registry of supported check types — the frontend's `CHECK_TYPES` constant is the only source of truth.

**Gaps.** (a) The INCOSE / EARS rule library from `gap-summary.md` #3 should ship as **seeded `ComplianceRule` rows** on every new DO-178C project, not as a separate rule engine. The page's rule library is the natural host. (b) `ComplianceFinding` has no link to a created `Issue` or `ChangeRequest` — auto-issue-creation per failing finding is missing. (c) Findings have no `acknowledgedById` / `waivedById` — every finding is permanent until the rule is fixed or the row is deleted.

---

## 7. Lifecycle — `lifecycle.routes.ts` (258 lines, 4+ control-tower endpoints) + `transitionChecklist.routes.ts` (34 lines, 16 endpoints)

**lifecycle.routes.ts** is structured as two sub-routers: stub endpoints for the legacy "Lifecycle Status" page (returning empty data — lines 11-35) plus a real `ctProject` sub-router gated by `requireProjectMember` that serves 9 control-tower endpoints (`/overview`, `/trends`, `/heatmap`, `/function-health`, `/health/functions`, `/pbs-health`, `/health/pbs`, `/traceability`, `/sla-breaches`, plus anomalies/integrity/readiness/approvals/audit). The duplicate paths (`/function-health` AND `/health/functions`) cover legacy + frontend-matching alias; the cleanup is overdue.

**transitionChecklist.routes.ts** carries the 16 endpoints listed in inventory.md: checklist CRUD (5), for-transition lookup (1), assignments (2), completions (3), evaluate (1), checklist-item-issue (2), checklist-comment (3). All gated by `authenticateToken` + `projectIdParam`; no `requireProjectMember`.

**Models.** **Lifecycle phases and transitions do NOT exist as Prisma models.** Grep for `model.*Lifecycle` returns zero results. The lifecycle definitions live in `frontend/src/store/lifecycleStatusesStore.ts` (Zustand). The control-tower endpoints compute over `Project`, `Requirement`, `SystemFunction`, `Component`, `TraceLink` — none of those carry a phase column. The `LifecyclePhase`, `LifecycleTransition` models named in inventory.md row 62 are **inventory.md inaccuracies** — they describe an intended state, not a current one. `TransitionChecklist`, `ChecklistVersion`, `TransitionChecklistItem`, `ChecklistAssignment`, `ChecklistCompletion`, `TransitionChecklistItemResponse` do exist.

**Gaps.** (a) Lift lifecycle definitions from Zustand into Prisma. (b) Add `Project.currentPhaseId` + `phaseEnteredAt` columns. (c) Wire `TransitionChecklist` evaluations to the new phase column. (d) Delete the legacy stub endpoints in `lifecycle.routes.ts` lines 11-35. (e) Update inventory.md row 62 to reflect actual model state.

---

## 8. Archive — reuses requirements + baselines

**No dedicated route file.** The Archive page reads from `requirementService.getRecentlyDeletedRequirements` (an endpoint in `requirements.routes.ts`), `baselineService` (`baselines.routes.ts`), and `definitionEntries.routes.ts` (Glossary).

**Models.** Reads soft-deleted `Requirement` (where `deletedAt IS NOT NULL`), all `Baseline` (filtered by `status = 'archived'` or similar), and `DefinitionEntry` rows.

**Gaps.** (a) The 7-day retention is implemented in `cleanup.service.ts` for `Requirement` only — `gap-summary.md` honourable mention #14 calls out the soft-delete coverage gap (6 of 178 models). Archive page can only show requirements; deleted CRs, Issues, Parameters, Functions, etc. are hard-deleted and not visible here. (b) The retention text panel is hard-coded; should read project-level retention settings from a (not-yet-existing) `ProjectRetentionPolicy` table. (c) `DefinitionEntry` is project-scoped; cross-project glossary reuse (a Polarion / Codebeamer feature) is not supported.

---

## 9. Documentation — 6 route files, 34 endpoints, but only the Document table is real

**Six route files** per inventory.md row 60: `documentation.routes.ts` (6), `templates.routes.ts` (8), `corporateDocxTemplates.routes.ts` (4), `excelColumnMappings.routes.ts` (5), `exportJobs.routes.ts` (6), `scheduledExports.routes.ts` (5). All exist as small files (16-85 lines each). The Documentation page bypasses 5 of them (everything except documentation.routes.ts).

**Models.** Per inventory.md: `Document`, `EvidencePack`, `EvidencePackItem`, `ExportJob`, `ScheduledExport`, `CorporateDocxTemplate`, `ExcelColumnMapping`. **`Document` exists at `schema.prisma:672-684` and is 6 columns** (`id, projectId, name, type, content, sections`). `EvidencePack` and `EvidencePackItem` **do not exist** as Prisma models — grep confirms no such models. `ExportJob`, `ScheduledExport`, `CorporateDocxTemplate`, `ExcelColumnMapping` exist at lines 306, 363, 328, 346 respectively.

**Gaps.** This is where `gap-summary.md` #2 and the evidence-pack-as-snapshot pattern land.

- (a) Add the `Document` columns per `kb/documentation-model.md`: `status`, `version`, `owner`, `lastUpdated`, `source`, `tags[]`, `linkedArtifacts Json?`. Migration is purely additive.
- (b) Add `EvidencePack` and `EvidencePackItem` per the KB: the **pack stores a snapshot of the document's current version**, not a live FK. When a doc is added to a pack, the pack copies the doc's content at that moment. This is the evidence-pack-as-snapshot pattern called out in the prompt cross-cutting list. Concretely: `EvidencePackItem { id, packId, documentId, versionAtAdd, contentSnapshot Json, addedAt }`.
- (c) Add the **opinionated PSAC / SDP / SVP / SAS / SCI / SECI generator** per `gap-summary.md` #2. Templates ship as seed data. The composer walks `Requirement → TraceLink → VerTestResult → VerEvidence → CertObjective` per evidence row. Signing chain on the artefact. Same DOCX pipeline that already exists.
- (d) Promote `Document.status` to a Prisma enum (`Draft | InReview | Approved | Released`) and enforce the lifecycle in the service layer. Per `kb/documentation-model.md`, "A `Released` document can only be amended via a new version — enforced under `project.strictMode`."

---

## 10. Audit — reuses platformAdmin audit, but UI reads mock

**No dedicated route file** for the project-scoped `/audit` page. The endpoint that backs it should be `GET /api/v1/projects/:projectId/audit-log` reading from the central `AuditLog` table (`schema.prisma:1614-1627`). Today the page reads `MOCK_AUDIT_LOG` from a frontend constants file — no backend call fires.

**Models.** Per inventory.md row 67: `AuditLog` plus 10 module-private audit tables (`VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`, `AiInvocation`, plus `VerTestRunResultStatusHistory`). The central `AuditLog` is consumed by Validation, Stakeholders, and the project layer per the cross-cutting entries; that's 4 modules of 13.

**Gaps.** (a) Add a `GET /api/v1/projects/:projectId/audit-log` endpoint that pages the central `AuditLog` table with filters by action, actor, time range, and entity. (b) Promote `AuditLog.details String?` to `Json` for indexable filtering (per the cross-cutting Validation entry). (c) Sequence the migration of the 10 private audit tables into the central `AuditLog` over multiple sprints — this is `gap-summary.md` cross-cutting refactor #6 and is what makes the Audit page show audits from all modules, not just the four that use the central table today. (d) When the migration lands, every controller in every module writes `writeAudit(projectId, userId, '<module>:<kebab-action>', detailsJson)` per the documented pattern.

---

## 11. MBSE Models — uses diagrams + AI + components

**No dedicated route file.** The page reads from `diagrams.routes.ts` (7 endpoints), `ai.routes.ts` (1 endpoint), `components.routes.ts` (7 endpoints). All exist.

**Models.** `Diagram` (`schema.prisma:1327`). Inventory.md row 55 mentions "`MbseModel` (if present)" — grep confirms no such model. The page renders 10 diagram types but persists each as a `Diagram` row with a `type` discriminator and JSON `data` payload.

**Gaps.** (a) The 10 SysML viewpoint types are serialised opaquely into `Diagram.data Json`. The schema does not enforce viewpoint-specific validation. (b) The 5 modal "tools" (ImpactAnalysisView, EnhancedTraceabilityMatrix, VerificationCoverageDashboard, ModelValidationEngine, StandardExporter) compute over multiple modules; they should read precomputed views, not run live joins on every open. (c) Per `vision-and-usp.md` §11 Phase 5+, this module is anti-roadmap for the first 18 months — recommend freezing backend work here.

---

## 12. PBS — `components.routes.ts` (47 lines, 7 endpoints)

**Routes file.** Clean: tree (1) + root (1) + CRUD (5) + sync-pbs (1). All gated by `authenticateToken` + `projectIdParam`; **no `requireProjectMember`**.

**Controller.** `component.controller.ts` 683 lines — large for 7 endpoints, mostly because of the tree-assembly + cascade-on-delete + sync-pbs migration helper.

**Models.** `Component` (recursive via `parentId`). Inventory.md row 56 mentions `PbsNode` — grep confirms no such model. PBS and Component are the same table; "PBS" is the frontend module name, "Component" is the Prisma model name.

**Gaps.** (a) `Component.allocatedTo` (referenced by `SystemFunction`) is a free string; should FK to either `User` or an organisation primitive. (b) No bulk-move endpoint — frontend has to issue N PATCH calls. (c) No CSV import endpoint — `gap-summary.md` #9 (Excel round-trip) would cover this if generalised. (d) Add `requireProjectMember`.

---

## 13. Use Cases — `usecases.routes.ts` (26 lines, 9 endpoints)

**Routes file.** Clean: actors (4) + use cases (5). The actors-before-`:useCaseId` ordering is correctly noted in the inline comment. `authenticateToken` + `projectIdParam`; **no `requireProjectMember`**.

**Controller.** `usecase.controller.ts` 363 lines.

**Models.** Three (`UseCase`, `Actor`, `UseCaseActor`). `UseCase.relatedRequirementIds: String[]` is the **wrong pattern** for cross-model linkage — should use `TraceLink` (sourceType='UseCase', targetType='Requirement') for parity with the rest of the codebase's polymorphic-link approach.

**Gaps.** (a) **The biggest gap is the absence of a frontend page** — see frontend.md §13 and UC-1. (b) Migrate `UseCase.relatedRequirementIds` to `TraceLink` rows. (c) Add `requireProjectMember`. (d) `UseCase.alternativeFlows` and `UseCase.extensions` are free strings claimed to hold JSON — promote to `Json` columns with validation.

---

## Cross-page backend findings

**`requireProjectMember` middleware coverage is patchy.** Applied to: changeRequests, lifecycle (control-tower sub-router only). **Not applied** to: issues, functions, usecases, components, transitionChecklist, compliance (read only — write paths use `requireProjectOwnerOrAdmin`), documentation. The Tasks cross-cut entry ("AutomationRule has no projectId — cross-tenant leak primitive") names this as a `kb/backend-patterns.md`-level rule: *every model that holds tenant-relevant data must carry a `projectId` (or `companyKey`) column; every route that reads such a model must apply a project-membership middleware. No exceptions.* These 6 route files violate that rule.

**Polymorphic link tables proliferate without FK integrity.** `IssueLink`, `RequirementChangeRequestLink`, `TraceLink`, `UseCase.relatedRequirementIds`, mock `RiskArtifactLink`, mock `InterfaceLink`. Per inventory-models.md gap #5, known and accepted — but every new module adds another. The right answer is **one polymorphic `EntityLink` table** with typed `linkKind` enum (satisfies, implements, verifies, derives, refines, traces-to, blocked-by, etc.) consumed by all modules. This is a Phase B cross-cutting refactor candidate.

**Controller line counts.** Issues (1003), Functions (689), Components (683), Change Requests (535), Use Cases (363), Compliance (346), TransitionChecklist (295). Per the Verification cross-cut entry ("Verification routes file at 131 endpoints / 338 lines / 19 imports"), the convention should be: any controller >500 lines must be split into a `controllers/<module>/` directory with one file per resource. Issues + Functions + Components qualify today.

**Audit-write pattern inconsistency.** Issues writes `IssueSystemNote`. Tasks writes `TaskAuditLog`. Validation + Stakeholders + projects write `AuditLog`. Change Requests write **nothing** — there is no `ChangeRequestSystemNote` table. The Change Requests controller's status-change handler at line 309 mutates `status / reviewedBy / reviewComments` without recording an audit event. This is a fix-the-bug-while-migrating opportunity — CR-N1 in `tickets.md`.
