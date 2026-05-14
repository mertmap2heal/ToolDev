# Data Model Inventory

Source: `backend/prisma/schema.prisma` (4,110 lines).

## Overview

- **Total models:** 178 (the project-doc estimate of "~157" is an undercount of one year of growth — inventory, tasks, verification, certification and AI-readiness modules have each added rows since the docs were last refreshed).
- **Domains:** 19 (see grouping below).
- **Models with soft delete (`deletedAt`):** 6
  - `RequirementExportTemplate`
  - `Requirement`
  - `VerTestRun`
  - `VerTemplate`
  - `ValidationItem`
  - `ValidationComment`
- **Models with explicit versioning (a `*Version` companion or in-row `version Int`):**
  - Dedicated version tables: `RequirementVersion`, `ParameterVersion`, `VerTemplateVersion`, `ChecklistVersion`, `SavedViewRevision`, `VerTestPlanRevision`
  - In-row `version` counter (optimistic-lock or major/minor): `Requirement.version`, `Parameter.lockVersion`, `Parameter.version` (string), `VerMethod` / `VerTestCase` / `VerTestSetup.version`, `TransitionChecklist.version`, `VerTemplate.version`, `CertPlan.version`
  - Baseline snapshots: `Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`/`ParameterBaselineItem`, `ValidationBaseline`
- **Models with audit-trail linkage:**
  - Generic project-wide: `AuditLog` (cascade off `Project`+`User`)
  - Module-scoped: `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `VerTestRunResultStatusHistory`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`
  - Universal AI-call ledger: `AiInvocation`

## Models by domain

### Auth & Users (8)

| Model | Purpose | Notes |
|---|---|---|
| `User` | Root identity (email, password hash, last-login, must-change-password flag) | Relations into nearly every module |
| `AdminRole` | Permission-template role (Viewer, Editor, Admin) — `defaultPermissions Json` map; company-scoped via `companyKey` | |
| `UserAdminRole` | M:N junction `User <-> AdminRole` (admin permission assignment) | |
| `EngineeringRole` | Discipline-role catalog (Systems Eng, Test Eng, …); `isSystem` distinguishes seeded vs custom | |
| `UserEngineeringRole` | M:N `User <-> EngineeringRole` (global discipline membership) | |
| `ProjectUserEngineeringRole` | Project-scoped engineering-role assignment (the canonical source for lifecycle "allowed roles") | Tracks `assignedByUserId` |
| `CompanyLimit` | Per-company max-user quota | Single row per `companyKey` |
| `Organization` | Enterprise profile (display name, contact email) keyed by `companyKey` | |

### Projects & Project-scoped configuration (12)

| Model | Purpose | Notes |
|---|---|---|
| `Project` | Top-level project (domain, slug, deadline, strictLifecycleGates, AI feature flag + self-hosted URL) | Hub: ~75 outbound relations |
| `ProjectMember` | Membership join (`role`, `status pending|accepted`) | |
| `ProjectAnalytics` | Cached task counts per project | 1:1 with `Project` |
| `SavedView` | User/project/org-scoped saved table/matrix views (filters, columns, viewpoint per ISO 42010) | |
| `SavedViewFolder` | Tree of saved-view folders | |
| `SavedViewRevision` | Versioned snapshots of `SavedView` definition | Versioning |
| `SavedViewAuditEvent` | Per-action audit row for `SavedView` | Audit trail |
| `CustomRequirementType` | Per-project custom requirement-type strings | |
| `DefinitionEntry` | Glossary + abbreviations per project | |
| `ProjectUnit` | Per-project unit registry (symbol, category) | |
| `ParameterType` | Per-project custom parameter-type catalog with translations + value format | |
| `Notification` | Per-user notification queue (read flag); only `project_invitation` type seen | |

### Requirements (12)

| Model | Purpose | Notes |
|---|---|---|
| `Requirement` | Core requirement (priority, status, stage, lifecycle status, custom attrs, locking, soft-delete) | **Soft-delete**; in-row `version` optimistic lock |
| `RequirementVersion` | Append-only version history snapshot | Versioning |
| `RequirementComment` | Threaded comments on a requirement | |
| `RequirementAttachment` | File attachments | |
| `RequirementSubscription` | Per-user follow flag + last-notified timestamp | |
| `RequirementReview` | Formal review session (review type, initiator, started/completed) | |
| `RequirementReviewer` | Reviewer + decision row on a `RequirementReview` | |
| `RequirementTemplate` | Per-project pre-filled requirement scaffolds | |
| `RequirementExportTemplate` | ExportBuilder presets (CSV/Excel/PDF/Word/ReqIF payload) | **Soft-delete** |
| `RequirementChangeRequestLink` | Bridge `Requirement <-> ChangeRequest` (`originates_from`/`relates_to`) | |
| `Component` | PBS/component tree node a requirement attaches to | Recursive |
| `TraceLink` | Polymorphic source/target tracing (satisfies, implements, verifies, derives, …) with denormalised display cache | |

### System Functions & Architecture (5)

| Model | Purpose | Notes |
|---|---|---|
| `SystemFunction` | Functional hierarchy (criticality, allocatedTo, pbsComponentId) | Recursive |
| `Architecture` | Lightweight named architecture container | |
| `VerificationPlan` | Top-level named verification plan (legacy / placeholder) | Largely subsumed by `VerTestPlan` |
| `UseCase` | Use case (actors, flows, preconditions, related reqs) | |
| `Actor` | Actor (primary / secondary / system) | M:N with `UseCase` via `UseCaseActor` |
| `UseCaseActor` | M:N junction | |
| `Diagram` | ReactFlow-style diagrams (req/bdd/ibd/par/act/seq/stm/uc/pkg/par-req) | |

### Parameters (10)

| Model | Purpose | Notes |
|---|---|---|
| `Parameter` | Engineering parameter (dataType, default, unit, tolerance, min/max, formula, enum/dimensions/platforms) with **AI provenance + classification + optimistic lock** | Versioning (`version` String); `lockVersion`; `authorType`/`authorAiModel`/`authorAiVersion`/`authorAiPromptId`/`authorAiContextHash`/`reviewStatus`/`reviewerUserId`/`reviewTimestamp`/`classification` |
| `ParameterVersion` | Snapshot (major + minor) of `Parameter` on every write/approval | Versioning |
| `ParameterFolder` | Recursive folder tree for parameters | |
| `ParameterBaseline` | Named point-in-time snapshot collection | Snapshot baseline |
| `ParameterBaselineItem` | Per-parameter Json snapshot inside a baseline | |
| `ParameterScenario` | Named what-if overlay set | |
| `ParameterScenarioOverride` | One `parameterId -> overrideValue` pair in a scenario | |
| `ParameterBulkJob` | Async bulk operation job (bulk-status / bulk-delete / bulk-ai-draft) | |
| `CommBus` | Named comm bus/channel (CAN, ROS, DDS, MAVLink, AUTOSAR, MQTT, custom) | Holds `config Json` |
| `CommMessage` | Frame/topic on a `CommBus` | |
| `CommField` | Signal/field in a `CommMessage`, optionally linked to a `Parameter` | |

### Issues (7)

| Model | Purpose | Notes |
|---|---|---|
| `Issue` | Problem report (issueType taxonomy, assignee, dates, GIN index on related-function array) | |
| `IssueComment` | Threaded comments | |
| `IssueSystemNote` | Audit-style action log (status_changed, closed, assignee_changed, …) | Audit |
| `IssueSubscription` | Follow flag | |
| `IssueAttachment` | File attachments | |
| `IssueLabel` | Per-project label library | |
| `IssueLink` | Polymorphic cross-link (issue ↔ issue/requirement/function/parameter) | |

### Change Requests (3)

| Model | Purpose | Notes |
|---|---|---|
| `ChangeRequest` | CR record (source entity polymorphism, risk, effort, justification, review comments) | |
| `ChangeRequestAttachment` | File attachments | |
| `RequirementChangeRequestLink` | Bridge already listed in Requirements | |

### Tasks (20)

| Model | Purpose | Notes |
|---|---|---|
| `Task` | Core task (status/priority enums-as-strings, blocked flag, parent task) | |
| `TaskTag` / `TaskTagLink` | Global tag library + join | |
| `Checklist` / `ChecklistItem` | Embedded checklists | (Distinct from transition checklists below) |
| `TaskComment` / `CommentMention` | Comments with @-mentions | |
| `TaskAttachment` / `TaskLink` | File / URL attachments | |
| `TaskRelation` | Cross-task relations (BLOCKS, BLOCKED_BY, RELATES, DUPLICATES, PARENT, CHILD) | |
| `RecurrenceRule` / `RecurrenceInstance` | RRULE-based recurrence | |
| `TaskSavedView` | Per-user LIST/BOARD/CALENDAR/TIMELINE saved views | |
| `BoardColumn` | Kanban column config per project | |
| `AutomationRule` / `AutomationRun` | Trigger/condition/action automation + run history | Audit-like |
| `TaskAuditLog` | Append-only audit | Audit |
| `ActivityFeed` | Event feed (task_created, status_changed, …) | Audit-like |
| `TaskNotification` | Internal notification queue | |
| `TimeLog` | Time-tracking entries | |
| `TaskTemplate` | Reusable task scaffolds (global or project) | |

### Inventory (28)

#### Master data
| Model | Purpose | Notes |
|---|---|---|
| `ItemCategory` | Recursive category tree | |
| `Uom` | Unit-of-measure dictionary | Global |
| `Item` | SKU (trackingPolicy NONE / LOT / SERIAL, optional `projectId`) | |
| `Supplier` | Supplier directory | |
| `Customer` | Customer directory | |
| `Warehouse` | Warehouse + `negativeStockPolicy` | |
| `Location` | Recursive location tree (BIN/ZONE/AISLE/RACK/SHELF) inside a warehouse | |
| `ItemLocationSetting` | Per item+location: reorder point, min/max, safety stock, lead time | |
| `BarcodeDefinition` | Per-item barcode (CODE128/EAN13/QR/GS1) | |

#### State & ledger
| Model | Purpose | Notes |
|---|---|---|
| `SerialNumber` | Per-serial state + current location | |
| `InventoryBalance` | Snapshot of qty on hand/reserved/available per item+location | |
| `InventoryCostLayer` | FIFO cost layers for valuation | |
| `InventoryLedger` | Append-only ledger of all postings (idempotency key) | Audit-like |
| `Reservation` / `ReservationAllocation` | Soft reservations + per-serial allocations | |

#### Documents
| Model | Purpose | Notes |
|---|---|---|
| `PurchaseOrder` / `PurchaseOrderLine` | Purchasing | |
| `GoodsReceipt` / `GoodsReceiptLine` | Receiving | |
| `SalesOrder` / `SalesOrderLine` | Sales | |
| `Shipment` / `ShipmentLine` | Outbound | |
| `TransferOrder` / `TransferLine` | Inter-warehouse | |
| `StockAdjustment` / `AdjustmentLine` | Manual delta | |
| `CycleCount` / `CycleCountLine` | Physical count | |

#### Support tables
| Model | Purpose | Notes |
|---|---|---|
| `InventoryAttachment` | Polymorphic file attachments | |
| `InventoryComment` | Polymorphic comments | |
| `InventoryApproval` | Polymorphic approval-status record (Pending/Approved/Rejected) | Approval state |
| `InventoryAuditLog` | Append-only audit | Audit |

### Verification (28)

| Model | Purpose | Notes |
|---|---|---|
| `VerMoc` | Means-of-Compliance catalog (codes 0–8) | |
| `VerMethod` | Project-scoped verification method (TEST/ANALYSIS/INSPECTION/REVIEW/SIMULATION/DEMONSTRATION) | In-row version metadata |
| `VerTestSetup` | Reusable test setup (environment, components, interfaces, diagram, photos) | In-row `version` string |
| `VerTestProcedure` | Automation script attached 1:1 to a test case | |
| `VerTestEnvironment` | HIL bench / SW build context | |
| `VerTestLog` | Raw stdout / Json for a test run | |
| `VerTestCase` | Test case (steps Json, pass/fail criteria, isSuspect, invalidatedAt) | |
| `VerTestCaseSetup` | M:N `TestCase <-> Setup` | |
| `VerTestPlan` | Test plan container with deep document-export metadata (`docNumber`, `docConfidentiality`, sign-off names, conformity, appendices) | |
| `VerTestPlanRevision` | Revision/change-control entries for an export | Versioning |
| `VerTestPlanSetup` | M:N `TestPlan <-> Setup` | |
| `VerTestPlanCase` | M:N `TestPlan <-> TestCase` with `orderIndex` + `isMandatory` | |
| `VerTestRun` | Execution instance (`pausedAt`, `actualDurationSeconds`) | **Soft-delete** |
| `VerTestRunResult` | Per-case result inside a run with `testCaseVersionSnapshot Json` + `setupVersionSnapshot Json` + `isOutOfSync` | Snapshotting |
| `VerTestRunResultActualResult` | Append-only TEXT_RICH / IMAGE blocks attached to a result | |
| `VerTestRunExecutionTimer` | Pause/resume timer segments | |
| `VerTestRunResultStatusHistory` | Status-change audit (per 21 CFR Part 11) | Audit |
| `VerEvidence` | Evidence file (checksum) | |
| `VerEvidenceLink` | Polymorphic evidence link (TEST_RUN, TEST_RUN_RESULT, …) | |
| `VerTestResult` | Exported result blob (file + status) — separate from `VerTestRunResult`, used for archived/external imports | |
| `VerTestResultLink` | M:N to test cases / plans | |
| `VerReview` | Formal review (TRR/QSR/CERT_REVIEW) | |
| `VerReviewItem` | Per-artifact finding row | |
| `VerNonconformity` | NCR (severity, status) attached to a `VerTestRunResult` | |
| `VerReverifyTask` | Re-verification task generated from an NCR | |
| `VerBaseline` | MILESTONE/CERTIFICATION/INTERNAL snapshot of verification artefact IDs+versions | Snapshot baseline |
| `VerSettings` | Per-project MoC allow-list, lifecycle rules, naming rules, permissions map (1:1 with `Project`) | |
| `VerCustomOption` | Dropdown values for ENVIRONMENT_TYPE/COMPONENT_TYPE/INTERFACE_TYPE | |
| `VerTemplate` | Reusable test case / test plan template | **Soft-delete**, versioned via `VerTemplateVersion` |
| `VerTemplateVersion` | Snapshot history | Versioning |
| `VerAuditEvent` | Module-wide append-only audit (CREATE/UPDATE/DELETE/STATUS_CHANGE/LINK_EVIDENCE/APPROVE/DEPRECATE/CLOSE) | Audit |
| `VerTestCaseCustomSection` | Rich-text section attached to a test case | |
| `VerTestCaseSectionImage` | Image inside a custom section | |

### Compliance Check (4)

| Model | Purpose | Notes |
|---|---|---|
| `ComplianceRegulationFolder` | Recursive regulation folders (DO-178C, DO-254, …) | |
| `ComplianceRule` | One rule under a folder (checkType taxonomy + standard) | |
| `ComplianceCheckRun` | Recorded run with included rule IDs | |
| `ComplianceFinding` | pass/fail row per rule × entity | |

### Certification (21)

| Model | Purpose | Notes |
|---|---|---|
| `CertContext` | Per-project authority + cert-basis + standards selection | 1:1 with `Project` |
| `CertBaseline` | Cert baseline reference (BL-yyyy-mm-XXX) | Snapshot baseline |
| `CertRelease` | Release tag | |
| `CertObjective` | Regulatory objective row (MoC, criticality, evidence/CI counts, safety ref) | |
| `CertObjectiveRequirementLink` | M:N to `Requirement` | |
| `CertComplianceMatrixRow` | Aggregated matrix row per `regRef` | |
| `CertFinding` | Audit-style finding with safety flag | |
| `CertReviewLogEntry` | Authority/internal/customer review log | Audit-like |
| `CertActivityLogEntry` | Free-form action log | Audit |
| `CertReadinessGate` | Pass/fail gate at named milestone | |
| `CertPackage` | Submission package (`includedRegulations`, baseline+release scope) | |
| `CertCorrespondence` | Letter/Email/Meeting log to authority | |
| `CertMeeting` / `CertActionItem` | Meeting + open/closed action items | |
| `CertPlan` | Single per-project compliance strategy document | 1:1 |
| `CertMilestone` | PDR/CDR/TRR milestones | |
| `CertChecklist` / `CertChecklistItem` | Phase-tied checklists | |
| `CertSignOff` | Signature record (`signerId`, `signedAt`, IP, user-agent — server-derived per #163) | Approval state |

### Configuration Management (2 in schema today)

| Model | Purpose | Notes |
|---|---|---|
| `Baseline` | Requirements-snapshot baseline (functional/allocated/product/milestone/custom, fdAL, approval fields, supersession) | Approval state; in-row approval |
| `BaselineItem` | Per-requirement Json snapshot inside a baseline | |

> Note: the wider CM workflows (CIs, deviations, waivers, CCB) described in `.claude/kb/configuration-management.md` are **not yet** modelled — only the `Baseline`/`BaselineItem` pair and a generic `AuditLog` exist. See observations.

### Documentation & Export (5)

| Model | Purpose | Notes |
|---|---|---|
| `Document` | Free-form document container (`sections Json`, `fileUrl`) | Minimal — no template / evidence-pack split modelled |
| `ExportJob` | Background export run state (pending/running/done/failed, progress %) | |
| `CorporateDocxTemplate` | Uploaded branded .docx (base64) with placeholder list | |
| `ExcelColumnMapping` | Column-mapping preset for branded spreadsheets | |
| `ScheduledExport` | Schedule-expression config (no executor yet) | |

### Lifecycle / Transition Checklists (7)

| Model | Purpose | Notes |
|---|---|---|
| `TransitionChecklist` | Mandatory checklist template for a lifecycle transition | Versioned via `ChecklistVersion` |
| `TransitionChecklistItem` | One item (BOOLEAN/FIELD_VALIDATION/RULE_BASED/CONFIRMATION) | |
| `ChecklistAssignment` | Binds a checklist to (lifecycleId, fromStatusId, toStatusId, entityType) | |
| `ChecklistCompletion` | Per-entity completion record | |
| `TransitionChecklistItemResponse` | Response value + passed flag per item per completion | |
| `ChecklistVersion` | Snapshot of full checklist Json | Versioning |
| `ChecklistItemComment` | Comments on a response | |
| `ChecklistItemIssue` | Bridge from a failing response to an `Issue` | |

### Validation (6) — distinct from Verification

| Model | Purpose | Notes |
|---|---|---|
| `ValidationItem` | Stakeholder-needs validation activity (DEMONSTRATION/OPERATIONAL_TEST/SIMULATION/ANALYSIS/STAKEHOLDER_ACCEPTANCE; inline criteria Json with MET/PARTIAL/NOT_MET/PENDING) | **Soft-delete** |
| `ValidationSettings` | Per-project prefixes, tags, criterion templates | 1:1 |
| `ValidationItemStar` | Per-user favourite | |
| `ValidationBaseline` | Frozen Json snapshot of all validation items | Snapshot baseline |
| `ValidationComment` | Threaded comments | **Soft-delete (tombstone)** |
| `ValidationSignOff` | Immutable approval; revocation creates a superseding row via `supersededById` | Append-only approval |

### AI-readiness (4)

| Model | Purpose | Notes |
|---|---|---|
| `ParameterMcpKey` | Project-scoped MCP API key (hashed) with scope subset and ITAR scope flag | Revocable |
| `AiInvocation` | Append-only ledger of every REST `/ai/*`, MCP call, server AI job step — tier, model, prompt id, context hash, input/output hash, tokens, duration | Audit / provenance |
| `ParameterBulkJob` | (already listed under Parameters — drives bulk-ai-draft) | |
| `UserAiCredential` | Per-user BYOK API key (AES-256-GCM ciphertext + masked tail) | Encrypted |

## Cross-cutting models

Models that span multiple domains or back the platform itself:

| Model | Cross-cutting role |
|---|---|
| `AuditLog` | Project + user-scoped append-only event log; the generic audit trail |
| `Notification` | Per-user delivery queue for any module (only `project_invitation` populated today) |
| `ExportJob` | Background export run state used by Requirements, Verification, Compliance, Certification |
| `CorporateDocxTemplate`, `ExcelColumnMapping`, `ScheduledExport` | Reusable document-export artefacts |
| `TraceLink` | Polymorphic relation between **any** source/target entity types |
| `Diagram` | Re-used as the canonical diagram store across req/bdd/ibd/par/act/seq/stm/uc/pkg/par-req |
| `SavedView` / `SavedViewFolder` / `SavedViewRevision` / `SavedViewAuditEvent` | Re-used by Requirements, Tasks, etc. |
| `BoardColumn` | Kanban columns (Tasks today; potentially Requirements/Issues later) |
| `AiInvocation` | Universal AI call ledger (project + user + key) |
| `ParameterMcpKey` | Currently parameters-only but named generically — likely first of N MCP key tables |
| `ProjectAnalytics` | Cached task analytics; one-per-project rollup row |

## Provenance & AI-readiness assessment

### Models that currently carry AI-provenance fields

Only **one** model has first-class AI provenance columns today:

- **`Parameter`** — `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification` (ITAR/internal/etc.), plus optimistic-lock `lockVersion`.
- **`AiInvocation`** (and the per-call hashing on Parameter) gives the project-wide ledger, but no other row-level model (Requirement, Issue, ValidationItem, VerTestCase, CertObjective, …) has the `authorType`/`authorAiModel` columns yet.

Other models carry related but lighter signal:

- `TraceLink.confidence Float?` + `TraceLink.isAuto Boolean` + `TraceLink.isSuspect Boolean` (so AI-suggested trace links can be flagged, but there is no model/version/prompt linkage).
- `VerTestCase.isSuspect`, `VerTestRunResult.isSuspect` / `isOutOfSync` (suspect tracking, not AI provenance).

### Models that carry approval / sign-off state

Explicit signature / approval rows:

- `CertSignOff` — full signature trail (`signerId`, `signedAt`, `ipAddress`, `userAgent`, `assignedToUserId`). Server-derived signer (#163).
- `ValidationSignOff` — append-only; revocation creates a new row with `supersededById`.
- `InventoryApproval` — generic Pending/Approved/Rejected approval bound to (entityType, entityId).

Approval / decision state embedded in primary rows:

- `Baseline` — `approvedBy`, `approvedByName`, `approvedAt`, `approvalNotes`, `lockedAt`, `supersedesBaselineId`.
- `RequirementReview` + `RequirementReviewer` — review status (`draft|in_review|approved|rejected|cancelled`) with reviewer decisions.
- `Requirement.reviewStatus`, `Requirement.isLocked`, `Requirement.lockedByUserId`, `Requirement.lockedAt`.
- `Parameter.status` (`draft|approved|obsolete`) + `Parameter.reviewStatus` + `Parameter.reviewerUserId` + `Parameter.reviewTimestamp`.
- `ChangeRequest.status` (`pending|approved|rejected|in-review`), with `reviewedBy` / `reviewComments`.
- `VerTestPlan.docApprovedByName` + `docApprovedAt`; `VerTestPlanRevision.approvedByName` + `approvedAt`.
- `CertObjective.reviewed`, `CertReadinessGate.passed`, `CertFinding.status`, `CertChecklistItem.status`.

## Notable observations

1. **AI provenance is parameters-only.** The `authorType`/`authorAiModel`/`authorAiPromptId` lattice exists on `Parameter` (and is fully indexed) but no other domain artefact — Requirements, ValidationItems, VerTestCases, Issues, CertObjectives, Tasks — has equivalent columns. `AiInvocation` records the *call*, but the *artefact* it produced cannot be traced back without joining through hashes manually. Extending the eight provenance columns to other primary entities is the obvious next sweep.

2. **Configuration Management is under-modelled vs the KB.** `.claude/kb/configuration-management.md` describes CIs, deviations, waivers, CCB-driven change control, FCA/PCA audits, and four baseline types. The schema today has only `Baseline` + `BaselineItem` (requirements-centric) and a generic `AuditLog`. There is no `ConfigItem`, `Deviation`, `Waiver`, or CCB role table. The Cert and Parameter baseline siblings (`CertBaseline`, `ParameterBaseline`, `ValidationBaseline`, `VerBaseline`) hint that the team builds per-module baselines rather than a unified CI registry — expect tension when the Documentation evidence-pack work lands.

3. **Audit-trail strategy is fragmented.** Six different append-only audit tables exist (`AuditLog`, `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `VerTestRunResultStatusHistory`, plus `IssueSystemNote` / `ActivityFeed` / `AutomationRun` / `CertActivityLogEntry` / `CertReviewLogEntry`). Each module rolled its own. A unified provenance model (think `AiInvocation` but for human edits too) would eliminate duplicate audit code in services.

4. **Soft-delete is inconsistently applied.** Only six tables (`Requirement`, `RequirementExportTemplate`, `VerTestRun`, `VerTemplate`, `ValidationItem`, `ValidationComment`) carry `deletedAt`, despite many sibling tables holding equivalent regulatory significance (`VerTestCase`, `VerEvidence`, `CertObjective`, `Parameter`). The KB rule "soft-delete is mandatory for any record under change-control" is not enforced at the schema level.

5. **Versioning conventions diverge wildly.** Five different patterns coexist: dedicated `*Version` tables (`Parameter`, `Requirement`, `VerTemplate`, `Checklist`), revision tables (`SavedView`, `VerTestPlan`), in-row integer (`Requirement.version`, `TransitionChecklist.version`, `Parameter.lockVersion`), in-row string ("1.0" on `Parameter`, `VerMethod`, `VerTestCase`, `VerTestSetup`), and Json `snapshot` baselines (`Baseline`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`). Optimistic-lock vs change-history vs baseline-snapshot are three separate concepts wearing the same `version` name.

6. **Cross-module polymorphism is everywhere but unindexed type-safety.** `TraceLink` (sourceType/sourceId × targetType/targetId), `VerEvidenceLink`, `VerReviewItem`, `IssueLink`, `InventoryAttachment`, `InventoryApproval`, `InventoryComment`, `InventoryAuditLog`, `VerTestResultLink`, `CertObjectiveRequirementLink` all use string-tagged polymorphism rather than Prisma relations. This is a deliberate trade-off (avoids 18 separate join tables) but means referential integrity is purely application-enforced — a known migration risk if entity IDs ever change shape.
