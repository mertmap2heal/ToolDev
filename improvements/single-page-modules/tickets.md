# Single-Page Modules — Tickets

Each ticket is per-page. Numbering convention: `<PAGE>-N` where PAGE is the page prefix (ISS, CR, FN, RM, IM, CMP, LF, ARC, DOC, AUD, MBSE, PBS, UC). Tickets carry effort tier:

- **Q** — quick win (≤ 1 day)
- **N** — normal (≤ 1 week)
- **L** — large (≤ 2 sprints)
- **XL** — multi-sprint

Tickets reference `gap-summary.md` items and `cross-cutting.md` refactors by name.

---

## Issues (ISS)

### ISS-1 (N) — Add `requireProjectMember` to issues.routes.ts
Today `authenticateToken` is the only middleware. Any authenticated user can issue requests against any project's issues. Same gap fixed in `changeRequests.routes.ts:20`. Mirror the pattern.
**Acceptance:** A user who is not a member of project X receives 403 on `GET /api/v1/issues/X`. Existing test suite still passes.
**Status: Shipped — 5d75f76 (N-3, Issue #434)**

### ISS-2 (Q) — "Convert to Change Request" button on IssueDetailPage
The IssuesPage list view has the action (`CreateChangeRequestModal` with `sourceType=issue`); the detail page does not. Add the action to the detail page's `MoreMenu`. Same modal opens; passing the current issue's `id`.
**Acceptance:** Opening an issue detail → MoreMenu → "Convert to CR" opens `CreateChangeRequestModal` with sourceId pre-filled.

### ISS-3 (N) — Re-rank list view to default-group by `issueType`
Per `design-review.md` §1. Today the list is a flat table sorted by createdAt. The certification-shaped default is "Group by DO-178C issueType" with status as secondary. Add a view-mode toggle (`Group: Type | Status | None`) persisted to URL `?group=type`.
**Acceptance:** Default view shows expandable groups (specification_error / design_error / coding_error / documentation_error / interface_error / other) with counts. Toggle persists in URL.

### ISS-4 (Q) — Status pills consume `status.*` tokens
Today `getStatusColor` / `getPriorityColor` switch over Tailwind raw classes. Replace with `status.success / warning / danger / info` tokens after `tailwind.config.js` Phase A lands.
**Acceptance:** No more `bg-red-100 / bg-orange-100 / bg-yellow-100 / bg-blue-100` literals in IssuesPage. Visual diff passes.

### ISS-5 (L) — Provenance lattice on Issue + IssueComment (cross-cutting #1)
Per the cross-cutting append "Provenance lattice missing on Verification artefacts" pattern — apply to Issues. Eight columns: `authorType`, `authorHumanId`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerHumanId`. Backfill `authorType='human'`.
**Acceptance:** Schema migration applies cleanly. All existing rows have `authorType='human'`. New issue + comment writes populate from `req.user`.

---

## Change Requests (CR)

### CR-1 (N) — Add CCB workflow primitive
Today `ChangeRequest.status` is a free string and any patch sets it to anything. Per `kb/configuration-management.md` §"Change requests", a CR moves through Draft → InReview → CCB → Approved (or Rejected) with role-gated transitions. Promote status to a Prisma enum; gate transitions via `requireAdminRole(['CCBMember', 'ConfigManager'])`. Use the existing `EngineeringRole` primitive per the Stakeholders cross-cut entry rather than introducing a parallel CCBRole.
**Acceptance:** Status transitions enforced server-side. Non-CCBMember user gets 403 on transition. Audit row written per transition.

### CR-2 (N) — `safetyImpact` flag + SafetyEngineer sign-off
Add `safetyImpact: Boolean @default(false)` to `ChangeRequest`. When `safetyImpact=true`, the approve transition requires a `SignatureEvent` row signed by a user holding the `Safety Engineer` engineering role. Tie into V-L1 / V-N1 (universal SignatureEvent + /auth/reauth).
**Acceptance:** Approving a `safetyImpact=true` CR without a SafetyEngineer signature returns 400 with a named error. With one, the CR transitions and the signature is stored.

### CR-3 (Q) — Impact-radius preview on CR row hover
Per `frontend.md` §2 and `design-review.md` competitor reference. Hovering a CR row shows a tooltip "Affects N requirements, M tests, P signed-off baselines." Compute lazily from `requirementLinks` plus `TraceLink` walk.
**Acceptance:** Tooltip renders within 200ms on hover; values accurate for a 50-requirement project.

### CR-4 (Q) — Write audit row on status change
The CR controller's status-change handler at line 309 mutates without recording an audit event. Add `writeAudit(projectId, userId, 'cr:status-change', { from, to, crId })` per the canonical pattern from the Validation cross-cut entry.
**Acceptance:** Every CR status mutation writes one `AuditLog` row.

### CR-5 (L) — Provenance lattice on ChangeRequest (cross-cutting #1)
Same pattern as ISS-5.

---

## Functions (FN)

### FN-1 (N) — Add FDAL primitive to SystemFunction
Per `frontend.md` §3 and `kb/safety-standards.md` §"DAL mapping". Add `fdal: String?` (validated as A/B/C/D/E in service layer) plus a propagation rule: when a parent function's FDAL changes, child functions must satisfy `child.fdal ≤ parent.fdal` (less-strict). Reject the update if a child violates.
**Acceptance:** Setting parent FDAL=B with a child at FDAL=A returns 400 with the offending child IDs.

### FN-2 (N) — Extract `functions.service.ts`
Per `kb/backend-patterns.md` "Controller → Service Layer Boundary". The 689-line `function.controller.ts` does tree assembly, move-validation, descendant counting, and re-allocation inline. Move queries to a service.
**Acceptance:** Controller below 250 lines; service holds the Prisma calls; existing tests pass.

### FN-3 (Q) — Replace `verificationMethod` free-string with `VerMoc` FK
Today `SystemFunction.verificationMethod: String?` overlaps `VerMoc` (a typed MoC primitive). Migrate to `mocId: String? @relation`. Drop the string column.
**Acceptance:** A function's verification method is a typed FK; UI dropdowns read from `VerMoc.findMany`.

### FN-4 (Q) — Add `requireProjectMember` to functions.routes.ts
Same authorization hardening as ISS-1.
**Status: Shipped — 5d75f76 (N-3, Issue #434)**

---

## Risk Management (RM)

### RM-1 (XL) — Backend persistence via Hazard model reuse
Per `backend.md` §4 Option 1 and `gap-summary.md` §B context. Widen the planned `Hazard` model (from the Safety module) with a `riskCategory: RiskCategory` discriminator (Program | Technical | Safety | Compliance | Supplier). Add the residual-risk + acceptance fields from `RiskManagement/types.ts` (`mitigationActions[]`, `mitigationTargetDate`, `residualRiskRating`, `accepted`, `acceptanceRationale`, `acceptedBy`). Build `risks.routes.ts` (~10 endpoints: CRUD + accept / unaccept + linking). Rewire frontend `RiskManagementPage` to consume `risks.service.ts` instead of `MOCK_RISKS`. Add a polymorphic `RiskArtifactLink` table (`riskId, linkedEntityType, linkedEntityId`).
**Acceptance:** Risks persist across refresh. `MOCK_RISKS` import deleted. Link panel in `RiskDetailDrawer` shows real cross-module links.

### RM-2 (L) — Standard-driven matrix rendering
Per `design-review.md` §2. Today the 5×5 matrix is hard-coded numeric. Render the matrix per project standard: aerospace projects render ARP4761A severity classes (Catastrophic / Hazardous / Major / Minor / NoSafetyEffect) on the Y axis; ISO 26262 projects render S/E/C; medical projects render ISO 14971 severity × probability with ALARP zones. Read the project's standards from `CertContext.standards`.
**Acceptance:** Opening a DO-178C project shows the ARP4761A matrix; opening an ISO 26262 project shows the ASIL matrix; matrix swap on standard change re-classifies existing risks.

### RM-3 (Q) — Replace matrix colors with `status.*` tokens
Per `design-review.md` §2. The current `bg-green-100 / bg-yellow-100 / bg-orange-100 / bg-red-100` palette violates `design-system.md` §3.1.
**Acceptance:** Matrix uses `status.success / warning / danger` tints; visual review.

### RM-4 (N) — Cross-module linkage UI
Per `frontend.md` §4. The `RiskDetailDrawer` "Linked Artifacts" panel opens `PlannedFeatureModal`. Replace with a real artifact picker (reuses `ArtifactPickerModal` from Documentation). Linked rows persist via `RiskArtifactLink`.
**Acceptance:** A user can link a risk to a requirement, hazard, test, or CR. Refresh persists the link. Click follows the link.

---

## Interface Management (IM)

### IM-1 (XL) — Backend per `kb/interface-management.md`
Build the schema (Interface + Signal + Port + Connector) per the KB. Per-kind technical-characteristics validation (Data / Electrical / Physical / Software / HMI). Build `interfaces.routes.ts` (~10 endpoints). Rewire `InterfaceManagementPage` to read from `interfaces.service.ts`.
**Acceptance:** Interfaces persist. Mock data import deleted. Type-specific fields are typed (`Data.protocol` is a string-with-enum, not free text).

### IM-2 (L) — ICD generation endpoint + UI
Per `kb/interface-management.md` §"Generation pipeline". `GET /api/v1/projects/:projectId/interfaces/:id/icd?format=json|csv|docx` reuses the existing `corporate-docx-templates` + `export-jobs` pipeline. The DOCX render is opinionated (Blackbox = external ports only; Whitebox = internal parts too). Add two buttons to the page header: `Export ICD (Blackbox)` / `Export ICD (Whitebox)`.
**Acceptance:** Exporting a Blackbox ICD produces a DOCX with name + direction + type + rate + min/max/error behaviour table. Whitebox adds internal parts. Roundtrip stable.

### IM-3 (L) — Replace list with split graph + table view
Per `design-review.md` §3. Add an `<InterfaceGraph>` component using ReactFlow that shows source / target blocks connected by labeled edges. List view persists as a secondary tab.
**Acceptance:** Graph view renders 50 interfaces in < 500ms; layout stable; clicking an edge opens the drawer.

### IM-4 (Q) — Add `requireProjectMember` to interfaces.routes.ts (when built)
Routes-level authorization hardening, applied at IM-1 time.

---

## Compliance Check (CMP)

### CMP-1 (N) — Re-rank tabs: Findings (default) → Runs → Rules
Per `design-review.md` §4. Findings is the audit-relevant deliverable; Rules is administrative configuration. Switch the default.
**Acceptance:** Opening `/compliance-check` lands on the Findings tab. URL `?tab=rules` still works.

### CMP-2 (L) — Audit-Ready Matrix view
Per `design-review.md` §4 and the Requirements cross-cut entry on `<ObjectiveCompletionMatrix>`. Build the matrix component once; consume here, in Verification dashboard, in Certification.
**Acceptance:** A DO-178C DAL-A project shows the Table A-3 grid; cells show pass / fail per rule × objective.

### CMP-3 (N) — Auto-create Issue per failing finding
When a run produces a failing finding, the page offers a "Create issues for all failures" bulk action. Each Issue carries the finding's rule name as title prefix, `issueType` matched to the rule's check type, and a back-link to the finding row.
**Acceptance:** Run with 5 failures → click "Create issues" → 5 Issues created with correct issueType and back-link.

### CMP-4 (XL) — Seed INCOSE / EARS rule library (gap-summary #3)
Ship ~40 INCOSE rules + 6 EARS patterns as seeded `ComplianceRule` rows on every new DO-178C project. Rules apply via the existing check-type system. Add a registry `kb/compliance-rules.md` listing every shipped rule.
**Acceptance:** Creating a new project produces 46 active rules. Running them on an empty requirements set produces a known baseline of failures (e.g. "No requirements have acceptance criteria"). Test suite verifies rule output for known inputs.

### CMP-5 (N) — Split `ComplianceCheckPage` into per-tab files
1082 lines in one file. Split: `views/RulesTab.tsx`, `views/RunsTab.tsx`, `views/FindingsTab.tsx`, `components/FolderTree.tsx`, `modals/FolderFormModal.tsx`.
**Acceptance:** Main page < 250 lines. Each view < 400 lines. Same behavior.

---

## Lifecycle Status (LF)

### LF-1 (Q) — Delete the empty "Status" tab
Per `frontend.md` §7 and the inline comment at line 42 of `LifecycleStatusPage.tsx`. The legacy "Status" tab is a 90-line placeholder with three hardcoded select dropdowns and a "No Lifecycle Status Data" empty state. Delete it.
**Acceptance:** Three tabs become two (Control Tower + Lifecycle Settings). URL `?tab=status` redirects to Control Tower.

### LF-2 (L) — Promote lifecycle phases from Zustand to Prisma
Per `backend.md` §7. Today lifecycle definitions live in `frontend/src/store/lifecycleStatusesStore.ts`. Add `LifecyclePhase` + `LifecycleTransition` Prisma models. Add `Project.currentPhaseId` + `Project.phaseEnteredAt` columns. Migrate the store to a thin React Query wrapper around the new endpoints.
**Acceptance:** Lifecycle definitions persist server-side. The Zustand store becomes a memoised wrapper.

### LF-3 (Q) — Delete stub endpoints `/library`, `/applicable`, `/transitions`
Per `backend.md` §7. The three stubs at `lifecycle.routes.ts:11-35` return empty data and only exist to prevent 404s in the frontend. The frontend should not call these once LF-2 lands.
**Acceptance:** Routes removed; frontend never calls them; no 404s.

### LF-4 (N) — Wire `TransitionChecklist` evaluation to `Project.currentPhaseId`
After LF-2 lands, a phase transition is gated by `evaluateChecklist` producing PASS. Today this is partly wired but reads from `ChecklistAssignment` join — fragile. Tighten the join.
**Acceptance:** Attempting to enter a new phase with a failing checklist returns 400 with the failing items.

---

## Archive (ARC)

### ARC-1 (N) — Extend soft-delete coverage to CRs, Issues, Functions, Parameters
Per `gap-summary.md` honourable mention #14. Today only `Requirement` and `RequirementExportTemplate` have `deletedAt`. Extend to CR, Issue, Function, Parameter (the four cert-relevant artefacts most likely to be deleted). Add to `cleanup.service.ts` scheduled purge.
**Acceptance:** Deleted CRs / Issues / Functions / Parameters appear in Archive Trash with 7-day countdown.

### ARC-2 (Q) — Split panels into separate routes
Today four panels (Trash / Glossary / Retention / Baselines) crammed into one page per `frontend.md` §8. Split into `/archive/trash`, `/archive/glossary`, `/archive/baselines`, with the retention panel folded into Trash. Glossary and Baselines may eventually warrant standalone modules.
**Acceptance:** Three sub-routes; each loads faster than the current monolith.

### ARC-3 (N) — Project-level retention policy
Per `backend.md` §8. The retention text panel is hard-coded ("Records older than 7 days are purged"). Add `ProjectRetentionPolicy { projectId, retentionDays, purgePolicy }`. UI in project settings to configure.
**Acceptance:** A project with 30-day retention preserves deleted requirements for 30 days; settings page exposes the slider.

---

## Documentation (DOC)

### DOC-1 (N) — Promote `Document` schema per `kb/documentation-model.md`
Add columns: `status: DocumentStatus enum` (Draft | InReview | Approved | Released), `version: String`, `owner: String`, `lastUpdated`, `source: String`, `tags: String[]`, `linkedArtifacts: Json?`. Migration is additive.
**Acceptance:** Existing documents default to status=Draft, version=v0.1. New writes use the typed enum.

### DOC-2 (L) — `EvidencePack` + `EvidencePackItem` schema + service + endpoints
The biggest of the Documentation gaps. Build `EvidencePack { id, projectId, title, purpose, status, lastUpdated, ownerUserId }`. Build `EvidencePackItem { id, packId, documentId, versionAtAdd, contentSnapshot Json, addedAt }`. **The pack stores a snapshot of the document's current version, not a live FK** — this is the evidence-pack-as-snapshot pattern from the prompt cross-cutting note. Add `packs.routes.ts` (~8 endpoints).
**Acceptance:** Adding a document to a pack records the doc's current `contentSnapshot`. Editing the source doc afterwards does not leak into the pack. Pack exports use the snapshot.

### DOC-3 (XL) — Opinionated PSAC / SAS / SCI / SECI generator (gap-summary #2)
Per `gap-summary.md` #2 and `design-review.md` §5. Ship the certification-package composer that walks `Requirement → TraceLink → VerTestResult → VerEvidence → CertObjective` and produces a regulator-ready DOCX. Templates as seed data per certification standard × artefact type. Reuses existing `ExportJob` pipeline. Signature chain on the exported artefact.
**Acceptance:** "Export PSAC" button on a DO-178C DAL-A project produces a Word + PDF + JSON package within 30s for 1000 requirements. Includes objectives, evidence, signatures, manifest.

### DOC-4 (N) — Seed Templates library per DO-178C § 11
Per `kb/documentation-model.md` §"Doc-type column". Ship one template per lifecycle data item (SRS / ICD / VVP / Test Report / Safety Plan / Compliance Matrix / Release Notes / ConOps). Templates ship as `Template` rows; the page reads from `templates.routes.ts` (which already exists with 8 endpoints).
**Acceptance:** Fresh project has 8 active templates; "Use Template" button instantiates a Document with the right `sectionBlueprint`.

### DOC-5 (N) — Wire Export Profiles + Export History to backend
The Import/Export Center and Export History tabs read from `MOCK_EXPORT_PROFILES` and `MOCK_EXPORT_HISTORY` per `frontend.md` §9. Routes exist (`exportJobs.routes.ts`, `scheduledExports.routes.ts`). Replace mock state with `useQuery` reads + mutations.
**Acceptance:** Demo banner stops mentioning "export profiles and export history."

### DOC-6 (Q) — Remove the `Demo data only` banner once DOC-1 + DOC-2 + DOC-5 land
Banner currently warns "Templates, evidence packs, export profiles and export history… live in session state only." Reads false once the four tickets above land.

### DOC-7 (N) — Document.status state machine + Released-document immutability
Per `kb/documentation-model.md` "A Released document can only be amended via a new version — enforced under `project.strictMode`." Implements the state machine; rejects mutations on Released documents in strict mode; allows creating a new version.
**Acceptance:** Attempting to edit a Released document in strict mode returns 409. Creating a new version succeeds.

### DOC-8 (L) — Provenance lattice on Document + EvidencePack (cross-cutting #1)
Same pattern as ISS-5; cert-relevant rows.

---

## Audit (AUD)

### AUD-1 (N) — Build real AuditLogPage
Replace the 76-line mock `pages/Safety/AuditLogPage.tsx` with a `pages/AuditLog/AuditLogPage.tsx` that reads from `AuditLog` (`schema.prisma:1614-1627`). Filters: action prefix (`module:`), actor user, time range, entity. Paginated. Reuses standard list components.
**Acceptance:** Page lands on the project's real audit feed. Validation, Stakeholders, and project-layer events appear immediately. Mock import deleted.

### AUD-2 (Q) — Promote `AuditLog.details` from `String?` to `Json`
Per the Validation cross-cutting entry. Enables server-side filtering (e.g. "all CRs touching requirement REQ-0042") via Prisma JSON path queries.
**Acceptance:** Schema migration applies; existing rows parse correctly; index works.

### AUD-3 (XL) — Migrate the 10 module-private audit tables into the central AuditLog (cross-cutting #6)
Per `gap-summary.md` cross-cutting refactor #6. Sequence: VerAuditEvent → TaskAuditLog → CertActivityLogEntry → CertReviewLogEntry → InventoryAuditLog → SavedViewAuditEvent → IssueSystemNote (this last is borderline — system-notes are user-visible activity, not audit). Each migration writes new rows to `AuditLog` while preserving the legacy table read-only until consumers migrate.
**Acceptance:** Auditors can answer "every change touching artefact X" with one `AuditLog` query. Per-table read paths gradually fall back to the central feed.

### AUD-4 (N) — Diff view rendering in the Audit detail pane
After AUD-2 lands, the detail pane renders a side-by-side diff of before / after for row-level changes. Reuses the diff component from `gap-summary.md` #7.
**Acceptance:** Clicking a "requirement.update" audit row shows what fields changed and how.

---

## MBSE (MBSE)

### MBSE-1 (Q) — Tag the page as Beta
Per `frontend.md` §11 and `vision-and-usp.md` §11 expansion roadmap. The page is Phase 5+ in the official roadmap; today it ships without a Beta tag, implying parity with the rest of the product. Add a header banner: "Beta — MBSE modeling tools available preview-only; data persists but interoperability with Cameo / Rhapsody / Capella is not guaranteed for the first 18 months."
**Acceptance:** Banner renders; user-tested copy.

### MBSE-2 (N) — Freeze new investment until ARP4754A demand
Per `gap-summary.md` deliberate omission #6. Document a decision in `roadmap.md` that no new MBSE feature work lands until ARP4754A becomes a top-3 ICP driver. Existing functionality maintained but no expansion.
**Acceptance:** Roadmap doc updated; PRs touching `pages/MBSEModels/` require explicit roadmap exception.

---

## PBS (PBS)

### PBS-1 (Q) — Bulk-move endpoint
Per `backend.md` §12. Today moving N components requires N PATCH calls. Add `POST /projects/:projectId/components/bulk-move { items: [{id, parentId, sortOrder}] }`.
**Acceptance:** Single API call moves 25 components atomically; failure rolls back all.

### PBS-2 (N) — CSV import for initial PBS bootstrap
Customer scenarios: a 200-row Excel sheet listing the planned breakdown. Add `POST /projects/:projectId/components/import-csv` accepting parentCode + code + name + description columns.
**Acceptance:** Importing a 200-row CSV creates the tree in < 5s; existing PBS unaffected; idempotent on re-import.

### PBS-3 (Q) — `requireProjectMember` on components.routes.ts
Same auth hardening as ISS-1.
**Status: Shipped — 5d75f76 (N-3, Issue #434)**

### PBS-4 (N) — Allocation rollups in tree view
For each component, compute "N functions, M requirements, P parameters allocated to or below this node." Useful in demos. Compute lazily or via materialised view.
**Acceptance:** Hovering a tree node shows allocation counts; expanding the node displays per-child rollup.

---

## Use Cases (UC)

### UC-1 (N) — Decision: build the page, or remove the routes
Per `frontend.md` §13 and `backend.md` §13. Today `usecases.routes.ts` has 9 endpoints, three Prisma models, and no frontend page. Either:
- **Build the page** as `/projects/:projectId/use-cases` (recommend — `vision-and-usp.md` §10 implies use cases as the source for system requirements).
- **Remove the routes + models** if use cases are owned by the MBSE module's `UseCaseDiagram` component.
**Acceptance:** Decision recorded in `roadmap.md`. Code reflects the decision.

### UC-2 (Q) — Migrate `UseCase.relatedRequirementIds: String[]` to `TraceLink`
Per `backend.md` §13. String-array linkage is the wrong pattern; the project already has `TraceLink` for polymorphic cross-model links. Migrate the field; backfill `TraceLink` rows from existing arrays; drop the column.
**Acceptance:** Cross-references between use cases and requirements visible in the standard Traceability page; UseCase no longer carries the array.

### UC-3 (Q) — `requireProjectMember` on usecases.routes.ts
Same auth hardening.
**Status: Shipped — 5d75f76 (N-3, Issue #434)**

---

## Cross-cutting appendix — findings to append to `cross-cutting.md`

The bullet items below should be appended verbatim to `improvements/_shared/cross-cutting.md` per the file's append-only convention.

### CC-1 (from single-page-modules) — Audit Log page is the visible consumer of refactor #6

**Affects:** Audit Log page (`/projects/:projectId/audit`), plus every module that writes its own audit table (Verification `VerAuditEvent`, Tasks `TaskAuditLog`, Certification `CertActivityLogEntry` + `CertReviewLogEntry`, Inventory `InventoryAuditLog`, Saved Views `SavedViewAuditEvent`, Issues `IssueSystemNote`, Test Run `VerTestRunResultStatusHistory`, plus `ActivityFeed`, `AutomationRun`, `AiInvocation`). The user-facing surface for the eleven-audit-tables-to-one refactor lives at one route — and that route currently renders a 76-line mock viewer (`frontend/src/pages/Safety/AuditLogPage.tsx`). Until the page reads from the central `AuditLog`, the cross-cutting refactor #6 has no buyer-visible payoff. The page is also the prerequisite for the diff view (`gap-summary.md` #7) to surface anywhere in the product — the audit detail pane is its natural home.
**Suggested resolution:** Ship AUD-1 (build real page) in parallel with AUD-2 (promote details to Json). Sequence AUD-3 (migrate the ten private tables) over multiple sprints. The page evolves from "Validation + Stakeholders + Project" (current AuditLog writers, 4 modules) to "all 11 modules" as each migrates.
**Sources:** `frontend/src/pages/Safety/AuditLogPage.tsx`; `App.tsx:176`; `gap-summary.md` cross-cutting refactor #6; `improvements/single-page-modules/tickets.md` AUD-1/2/3.

### CC-2 (from single-page-modules) — Evidence-pack-as-snapshot pattern needs first-class doctrine entry

**Affects:** Documentation module primarily (`EvidencePack`, `EvidencePackItem`); architecturally Certification (the natural consumer for cert-package evidence), Verification (test result snapshots), Configuration Management (release content snapshots). When a Document is added to an EvidencePack, the Pack must **snapshot the document's current version** — not store a live FK. Otherwise an edit to the source after the pack is built leaks into the pack. Today no EvidencePack model exists; the page renders mock packs that snapshot nothing.
**Suggested resolution:** Build `EvidencePackItem { id, packId, documentId, versionAtAdd, contentSnapshot Json, addedAt }`. Codify in `kb/documentation-model.md` (already specified there but not implemented) and `kb/backend-patterns.md`: *"When attaching a version-able artefact to a baseline, release, or evidence pack, store a JSON snapshot of the artefact at attach-time. Live FKs are used only for navigation, never for retrieval of the attached version."* Applies to: EvidencePackItem, BaselineItem (already partially), CertSignOff (when artefact-binding lands), VerEvidenceLink (already partially via the `relation` token).
**Sources:** `kb/documentation-model.md` §"Evidence Packs"; `improvements/single-page-modules/tickets.md` DOC-2; `frontend/src/pages/Documentation/DocumentationPage.tsx:484-497`.

### CC-3 (from single-page-modules) — Risk Management overlap with Safety: extend Hazard, do not parallel-build

**Affects:** Risk Management page; Safety Analysis module (`Hazard` model when built). The Risk page defines a Risk shape (likelihood × impact × mitigation × acceptance × residual rating) that overlaps the Safety module's Hazard primitive. Building a parallel `Risk` table duplicates the schema and forces customers to reconcile two risk-tracking surfaces. The right pattern is to widen `Hazard` with a `riskCategory: enum (Program | Technical | Safety | Compliance | Supplier)` discriminator and let the same row serve both views — Safety filters to `riskCategory='Safety'`, Risk Management shows all categories. Per `kb/safety-standards.md`, the safety taxonomy already covers severity / likelihood / mitigation / residual rating; non-safety risks need only a few extra fields.
**Suggested resolution:** Per the gap-summary.md §B Safety strategic call-out, when Safety lands its backend, build `Hazard` once with the `riskCategory` discriminator. The Risk Management page becomes a filtered view over `Hazard`. Cost: one extra column on the new model. Saves: one parallel CRUD module, one parallel set of forms, one parallel set of audit rows.
**Sources:** `kb/safety-standards.md` §"ARP4761A"; `improvements/single-page-modules/backend.md` §4; `improvements/single-page-modules/tickets.md` RM-1.

### CC-4 (from single-page-modules) — Interface Management overlap with Architecture: SysML primitives are shared

**Affects:** Interface Management page; Architecture module; MBSE Models page (uses InternalBlockDiagram + BlockDefinitionDiagram). All three modules read or write a SysML-shaped graph of blocks + ports + connectors + signals. Today: Architecture is a placeholder; MBSE persists diagrams as opaque JSON in `Diagram.data`; Interface Management is mock-only. Each module is positioned to redefine the same primitives. Per `kb/interface-management.md` §"SysML primitives for interfaces", the shared vocabulary is Port (FlowPort | StandardPort | ProxyPort) + Connector + Signal. Building Interface Management on these primitives, and then making MBSE Models read the same tables, prevents three competing "interface graph" implementations.
**Suggested resolution:** When IM-1 ships, the `Port` / `Connector` / `Signal` Prisma models are usable by the Architecture and MBSE modules. The MBSE `InternalBlockDiagram` should render directly from these tables rather than from `Diagram.data`. Architecture's eventual schema reuses `Component` (already PBS-shaped) plus the new Port / Connector primitives. Codify in `kb/interface-management.md` and a future `kb/architecture-model.md`.
**Sources:** `kb/interface-management.md` §"SysML primitives"; `improvements/single-page-modules/backend.md` §5; `improvements/single-page-modules/tickets.md` IM-1.

### CC-5 (from single-page-modules) — Polymorphic link tables: one `EntityLink` to rule them all

**Affects:** Every cross-module reference. Per `backend.md` cross-page findings: `IssueLink`, `RequirementChangeRequestLink`, `TraceLink`, `UseCase.relatedRequirementIds`, planned `RiskArtifactLink`, planned `InterfaceLink` (when IM-1 lands), `VerEvidenceLink`. Each table represents the same primitive — a typed directional link between two entities. Today every new module that needs cross-references introduces a new table. The pattern proliferates without FK integrity (inventory-models.md gap #5).
**Suggested resolution:** Build one polymorphic `EntityLink { id, projectId, sourceType, sourceId, targetType, targetId, linkKind (enum: satisfies | implements | verifies | derives | refines | traces-to | blocked-by | related-to | impacts), rationale, isAuto, isSuspect, createdBy, createdAt }`. Consumed by all modules. Migrate `TraceLink` first (it is already polymorphic and has the most consumers). Then sunset `IssueLink`, `RequirementChangeRequestLink`. New modules (Risk, Interface, etc.) consume `EntityLink` from day one.
**Sources:** `improvements/single-page-modules/backend.md` Cross-page findings; `inventory-models.md` gap #5.

### CC-6 (from single-page-modules) — `requireProjectMember` middleware coverage gap

**Affects:** Issues, Functions, Use Cases, Components/PBS, TransitionChecklist, Documentation (partial — only Documents reads have it). All 6 route files apply `authenticateToken` only — any authenticated user can mutate any project's data they know the projectId for. Same pattern as the Tasks cross-cut entry "AutomationRule has no projectId" but at the routes-level rather than the schema-level. The cross-cut entry's recommendation already names the rule; this is the per-module enforcement issue.
**Suggested resolution:** Codify in `kb/backend-patterns.md`: *"Every route file mounting under `/projects/:projectId/...` must apply `requireProjectMember` middleware after `authenticateToken` and `projectIdParam`."* Audit the 6 violating route files and add the middleware. Add a smoke test that issues an `authenticateToken`-only request to each project-scoped endpoint and asserts 403 when the user is not a member.
**Sources:** `improvements/single-page-modules/backend.md` Cross-page findings; `improvements/tasks/tickets.md` T-4.
