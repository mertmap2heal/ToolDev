# Requirements — Backend Review

Scope: 9 route files / ~71 endpoints / 16 Prisma models / 11 service files.

| Route file | Endpoints | Mount path | Primary controller |
|---|---:|---|---|
| `requirements.routes.ts` | 30 | `/api/v1/requirements/...` | `requirement.controller.ts` (3,643 lines) |
| `requirementReviews.routes.ts` | 8 | `/api/v1/projects/...` | `requirementReview.controller.ts` |
| `versions.routes.ts` | 4 | `/api/v1/versions/...` | `version.controller.ts` |
| `requirementsViewPreferences.routes.ts` | 2 | `/api/v1/projects/...` | `requirementsViewPreferences.controller.ts` |
| `requirementValidation.routes.ts` | 4 | `/api/v1/requirement-validation/...` | `requirementValidation.controller.ts` |
| `traceability.routes.ts` | 8 | `/api/v1/traceability/...` | inline in route file |
| `traceabilityViews.routes.ts` | 15 | `/api/v1/traceability-views/...` | `traceabilityViews.controller.ts` |
| `reqif.routes.ts` | 2 | `/api/v1/reqif/...` | `reqif.controller.ts` |
| `savedViews.routes.ts` | 5 | `/api/v1/saved-views` (root scoped) | `savedView.controller.ts` |
| Total | **78** | | |

The inventory document quotes ~71 endpoints for this package; the actual on-disk count is closer to 78 after `requirementsViewPreferencesService` and `savedViews` are included. Not material — the order of magnitude is right.

---

## 1. Architectural issues

### 1.1 No service layer for the core controller

Per `.claude/architecture.md` ("services must not import from controllers"; "Prisma queries in services only — never in controllers or routes directly"), the Requirements module breaks the rule visibly: there is **no** `requirement.service.ts`. The 3,643-line `requirement.controller.ts` contains every Prisma query, every transaction, every validation. The other modules (`parameters.service.ts`, `verification.service.ts`, `certification.service.ts`) all follow the documented pattern.

Consequences:

- Cannot test business logic without spinning Express up — every test goes through `supertest`. The Vitest suite under `backend/src/__tests__/` is sparse for this module because of it.
- Cannot reuse the create/update logic from another caller (e.g. ReqIF importer at `controllers/requirement.controller.ts:3414` re-implements requirement-creation directly with `prisma.requirement.create`, bypassing the audit log, the version snapshot, the parameter-link sync, and the lifecycle gate validation).
- The controller has 30 exported functions averaging 121 lines each. The longest is `updateRequirement` (lines 1501–2046, 545 lines).

**Recommendation.** Extract `requirement.service.ts`. Group: `service.create`, `service.update`, `service.delete`, `service.list`, `service.get`, `service.bulkUpdate`, `service.bulkImport`, `service.transitionStatus`, `service.lock`, `service.unlock`. The controller layer collapses to 10–15-line try/catch wrappers per endpoint. Tests move to direct service calls.

### 1.2 Two link APIs live in parallel — `traceability.routes` vs `linkage`

`backend/src/routes/traceability.routes.ts` exposes 8 endpoints for `TraceLink` directly. The frontend has `LINKAGE_V1` flag that, when on, routes to a different `link.service.ts` calling a different `relations.routes.ts` endpoint set. The flag is permanently on in the current `RequirementsPage` (`LINKAGE_V1` defaulted true). Yet the legacy `traceabilityService` is still re-fetched separately in the frontend (line 965).

This is partly cleanup deferred from a migration. Pick one. Per `inventory.md` orphan candidates list, `relations.routes.ts` should be deleted if `LINKAGE_V1` has fully shipped; alternatively, retire `traceability.routes.ts` for the new API.

### 1.3 Validation routes are partly orphan

`requirementValidation.routes.ts` exposes 4 endpoints. The frontend consumes exactly **one** of them (`/requirement-validation/:projectId` — used by `RequirementQualityPanel.tsx:33`). The other three (`/requirement/:requirementId`, `/circular-dependencies`, `/duplicate-ids`) have no callers in `frontend/src/`. They are dead routes — either delete them or wire them into the UI.

---

## 2. Data model gaps

### 2.1 `Requirement` does not carry AI provenance

The `Parameter` model carries the full lattice (schema lines 858–874):

```
authorType           String   default("human")    // human | ai_suggestion | ai_accepted | ai_applied
authorAiModel        String?
authorAiVersion      String?
authorAiPromptId     String?
authorAiContextHash  String?
reviewStatus         String   default("reviewed") // drafted | reviewed | approved | signed_off
reviewerUserId       String?
reviewTimestamp      DateTime?
classification       String   default("internal")
lockVersion          Int      default(0)
```

`Requirement` carries:

```
reviewStatus  String?  default("draft")
version       Int      default(1)
isLocked      Boolean  default(false)
```

Five fields versus eleven. The single most certification-relevant model in the schema has the weakest provenance footprint. This is gap-summary #5 and the largest architectural blocker to the AI-native claim in `vision-and-usp.md` §7. Every paragraph that touches `vision-and-usp.md` §10 ("a testable promise, born with an owner, a verification method...") and `ai-ready-vision.md` §6.1 (the provenance record) presumes this schema is the source of truth.

Apply the Parameter lattice to:

- `Requirement` (foundation)
- `RequirementVersion` (audit chain — historical author identity)
- `RequirementComment` (so AI-summarised comment threads are auditable)
- `TraceLink` (already has `isAuto: Boolean` + `confidence: Float?` + `createdBy: String?` — replace these with the full lattice)
- `RequirementReview` (so the audit log knows which AI suggested the review status)
- `RequirementReviewer` (same)
- `RequirementChangeRequestLink` (already has `createdBy: String?` — extend)
- `RequirementSubscription` (low priority — humans subscribe to things)
- `RequirementAttachment` (high priority — evidence files attached via AI extraction per `ai-ready-vision.md` §7.4)

Five high-priority, three medium-priority migrations. Cross-cutting refactor; appended to `improvements/_shared/cross-cutting.md`.

### 2.2 `RequirementReview` lacks signature primitive

The current model (schema lines 1357–1377):

```
reviewStatus    String    default("draft")   // draft | in_review | approved | rejected | cancelled
initiatedBy     String?
initiatedByName String?
startedAt       DateTime?
completedAt     DateTime?
reviewNotes     String?
```

Missing per gap-summary #1 (CFR 21 Part 11 / DO-178C signature):

- Reauthentication marker (timestamp of password re-entry separate from `completedAt`)
- Signature meaning string (what the signer is attesting to — "I approve this requirement for inclusion in baseline B-2026-04")
- Signature hash / digest (so a signature row cannot be silently mutated)
- Binding to an immutable baseline (today review approval does not freeze anything; the requirement can be edited the next day)
- Locked-after-signature flag (writes refused once signed off)

Compare to `CertSignOff` and `ValidationSignOff` — both exist in the schema but with no shared abstraction. This is cross-cutting refactor #3.

### 2.3 `TraceLink` lacks FK integrity

The polymorphic design — `sourceType: String, sourceId: String, targetType: String, targetId: String` (schema lines 645–648) — is fast to extend but breaks Postgres's FK integrity:

- A `TraceLink` to a deleted `Function` is a dangling row. The DB cannot detect it.
- The denormalised display cache columns (`cachedSourceDisplayId`, `cachedSourceTitle`, `cachedTargetDisplayId`, `cachedTargetTitle`) drift the instant a source/target renames. There is no trigger to keep them in sync.
- Cross-project link bleed is prevented only by `projectId` indexing on the link itself; nothing in the schema prevents a `sourceId` from referring to a row in a different project.

`inventory.md` flags this as known and accepted (gap #5 in `inventory-models.md`). The mitigation in the code is `clearSuspectLink`, `markDownstreamLinksSuspect`, and the denormalised cache + repair jobs. Acceptable for now; needs a periodic integrity-scan job before any auditor demo.

### 2.4 `SavedView` versioning quirks

The triplet `SavedView` / `SavedViewRevision` / `SavedViewAuditEvent` is well-designed but has three issues:

- `SavedView.viewKind` is a `String?` enum, but the page only handles one value (`'traceability_matrix'`). A future kind (`'compliance_matrix'`, `'coverage_dashboard'`) needs end-to-end work — the schema flexibility is unrealised.
- The unique constraint `@@unique([projectId, parentId, name])` on `SavedViewFolder` does not extend to `SavedView` itself — two views can have the same name in the same folder. Add `@@unique([projectId, folderId, name])`.
- `SavedView` does not soft-delete. A user deleting a view loses the revision history too (cascade delete on `SavedViewRevision`). Either soft-delete views or stop cascading the revisions.

### 2.5 Versioning patterns are inconsistent

Per `inventory-models.md` gap #4, the codebase uses five different versioning patterns. `Requirement` uses three of them at once:

- In-row counter: `Requirement.version Int @default(1)` (optimistic locking)
- Dedicated table: `RequirementVersion` (full snapshot)
- Snapshot inside another table: `BaselineItem.snapshot String` (JSON-stringified requirement state)

The duplication is real:

- A change to `Requirement.title` increments `Requirement.version` AND inserts a `RequirementVersion` row AND modifies any `BaselineItem.snapshot` that holds that requirement.
- The `BaselineItem.snapshot` JSON has no schema validation; it is whatever the controller wrote at baseline-creation time, which means a schema migration that adds a column does not retroactively populate the snapshot.

Cross-cutting refactor #2 — unify the Baseline primitive. Once unified, requirement versioning can lean on the existing `RequirementVersion` table and stop writing JSON blobs into `BaselineItem`.

---

## 3. Endpoint-by-endpoint review

### 3.1 `requirements.routes.ts` (30 endpoints)

| Endpoint | Issue |
|---|---|
| `GET /:projectId/custom-types` | Fine. Per-project custom types (`CustomRequirementType`) live here; cross-cuts with `vision-and-usp.md` §9 ban on custom fields. |
| `POST /:projectId/custom-types`, `DELETE /:projectId/custom-types/:typeId` | Same. |
| `POST /:projectId/migrate-category-to-type` | One-off migration; should not be a public endpoint. Move to a migration script. |
| `GET /:projectId/dashboard` | Coverage aggregate is a 25-line `$queryRaw` that normalises `test_case`/`testcase` — correct, but slow without an index on `TraceLink (projectId, sourceType, targetType, isSuspect)`. Add the index. |
| `POST /:projectId/import/reqif` | Body limit 5MB; OK. Parser is shallow (see §4 below). |
| `GET /:projectId` | The 200-line filter builder (lines 397–613) — see §5. |
| `GET /:projectId/all` | Returns every requirement with children + comments + attachments + `_count.changeRequestLinks`. For a 5k-requirement project this is 50MB+ JSON. Either paginate or move the non-essential includes (comments, attachments) behind a query flag. |
| `GET /:projectId/audit`, `GET /:projectId/audit/project` | Two audit endpoints for one resource. `audit` lists project audit events; `audit/project` does too. Pick one. |
| `POST /:projectId/:requirementId/lifecycle-transition-reminder` | Sends an email reminder via the notification service. OK. |
| `GET /:projectId/:requirementId` | Includes change-request links + comments + attachments. No include flag — every read is heavy. |
| `GET /:projectId/:requirementId/children` | Returns direct children only, not full subtree. OK. |
| `GET /:projectId/:requirementId/subscription`, subscribe, unsubscribe | OK. |
| `POST /:projectId`, `PUT /:projectId/:requirementId`, `DELETE /:projectId/:requirementId` | The 545-line `updateRequirement` does it all: optimistic-lock check, parent-circular-ref check, ID-rename, lifecycle gate validation, strict-mode role check, transition checklist enforcement, parameter-link sync, suspect-link mark, version snapshot, notification. Splits cleanly into 8 service functions. |
| `PUT /:projectId/:requirementId/parent` | Reparent-only — sets `parentId`. Why is this not part of `updateRequirement`? Use one. |
| `POST /:projectId/:requirementId/lock`, `unlock` | OK. The lock model is "owner sees lock, anyone can unlock" — `checkLock` returns `!!requirement.isLocked` (line 121), ignoring `userId`. Confirm intent: today any project member can unlock anyone's lock. |
| `POST /:projectId/bulk-update` | Handles 5 fields only (status, priority, owner, category, tags). Audit row says `"Updated N requirement(s)"` without per-row before/after. Gap-summary #9 — make this generic. |
| `POST /:projectId/bulk-import` | The proper bulk-import path (lines 2801–3294). Three phases: pre-validate, $transaction-write, audit. Good. |
| `POST /:projectId/:requirementId/comments`, delete-comment | OK. |
| `PATCH /:projectId/:requirementId/component` | Drag-and-drop component assignment. OK. |
| `POST /:projectId/:requirementId/restore` | Restores soft-deleted requirement. OK. |
| `DELETE /:projectId/:requirementId/permanent` | Guarded by `requireProjectOwnerOrAdmin`. OK. |
| `GET /:projectId/archive/recently-deleted` | Lists soft-deleted from last 30 days. OK. |

### 3.2 `requirementReviews.routes.ts` (8 endpoints)

| Endpoint | Issue |
|---|---|
| `POST .../reviews` | No reauthentication on create — anyone can spawn a review on any requirement. |
| `GET .../reviews`, `/:projectId/reviews`, `/my-reviews` | OK. |
| `POST .../reviews/:reviewId/start` | OK. |
| `POST .../reviews/:reviewId/cancel` | OK. Cancel is recorded as an event but does not lock further state changes — the review can be re-started. |
| `PUT .../reviewers/:reviewerId` | The reviewer's response endpoint. **Critical:** the request body's `status` is accepted without verifying that `req.user.id === reviewer.reviewerId`. A user can submit any other user's review response. This is a finding the security review will hit; fix today. |
| `GET .../reviews/:reviewId` | OK. |

**Missing endpoints for the Part 11 signature primitive:**

- `POST .../reviews/:reviewId/sign` — accepts password reauth + signature meaning string. Returns an immutable signature event row.
- `GET .../reviews/:reviewId/signatures` — lists all signatures on the review with their reauth timestamps.
- `POST .../reviews/:reviewId/baseline` — auto-baseline the affected requirements at sign-off time (per `competitor-matrix.md` §3 Jama Review Center pattern).

### 3.3 `versions.routes.ts` (4 endpoints)

| Endpoint | Issue |
|---|---|
| `GET .../requirements/:requirementId` | Returns versions + audit events (joined with users). Heavy join — OK for now. |
| `GET .../requirements/:requirementId/version/:versionNumber` | Single version snapshot. OK. |
| `POST .../requirements/:requirementId` | Manual snapshot creation. Should normally be automatic on update — verify if any caller actually uses this. |
| `GET .../requirements/:requirementId/compare?versionA=N&versionB=M` | Returns a per-field changed boolean — not the actual diff. Frontend has no way to render the text-level changes. Gap-summary #7. |

**Missing.**

- `GET .../requirements/:requirementId/diff?versionA=N&versionB=M` — returns structured field-level diffs with line/word breakdowns. Backend should use a battle-tested diff library; `diff-match-patch` is the standard.
- `GET .../requirements/baselines/:baselineA/diff/:baselineB` — diff between two baseline snapshots.

### 3.4 `traceability.routes.ts` (8 endpoints)

| Endpoint | Issue |
|---|---|
| `GET /:projectId` | Returns all trace links, optionally filtered by `sourceId`/`targetId`/`sourceType`/`targetType`. No pagination — for a 5k-link project, full payload. |
| `GET /:projectId/graph` | Returns nodes + edges for visualisation. No pagination — same risk. |
| `GET /:projectId/export/matrix?format=excel\|pdf\|docx` | Builds the matrix server-side but returns it as JSON — the client renders the export. Today no actual file is produced. |
| `GET /:projectId/suspect` | Suspect links only. OK. |
| `POST /:projectId` | Create link. OK. |
| `PUT /:projectId/links/:linkId/clear-suspect` | Clears suspect flag with optional comment. OK. |
| `POST /:projectId/mark-suspect/:sourceId` | Marks ALL downstream links (any link with `sourceId = X`) as suspect. **Not transitive** — does not walk further downstream. If REQ-A has link X to REQ-B, and REQ-B has link Y to REQ-C, marking REQ-A suspect flags X but not Y. The competitor Jama Live Traceability propagates transitively. |
| `DELETE /:projectId/links/:linkId` | OK. |

### 3.5 `traceabilityViews.routes.ts` (15 endpoints)

Folders (4) + Views (5) + Revisions/audit (4) + Baseline run/compare (2). The cleanest route file in the package — strong audit semantics, clean separation. Recommended as the template pattern for other modules.

One concern: `runTraceabilityViewAtBaseline` and `compareTraceabilityViewToCurrent` re-execute the view definition at a baseline state. The execution is heavy (loads baseline `linksSnapshot`, applies filter rules, builds matrix). No cache, no pagination — for a 5k-requirement baseline this is slow.

### 3.6 `reqif.routes.ts` (2 endpoints)

- `GET /:projectId/export` — exports project requirements to ReqIF. Implementation in `reqif.service.ts` (598 lines).
- `POST /:projectId/import` — imports ReqIF. Uses `reqifParser.ts` (149 lines).

The parser is shallow (see §4 below). The export needs a round-trip test pair to validate fidelity. Gap-summary #6.

### 3.7 `savedViews.routes.ts` (5 endpoints)

A separate set of CRUD endpoints scoped at root, not per-project. Confusingly overlaps with `traceabilityViews.routes.ts`. Per §2.4 above, decide which is the canonical surface.

---

## 4. ReqIF parser fidelity

The parser at `backend/src/services/reqifParser.ts` is 149 lines. It extracts:

- `SPEC-OBJECT` → `{ identifier, title, description }` plus any `ATTRIBUTE-VALUE` whose definition contains "longname" / "description" / "name" / "desc"
- `SPEC-RELATION` → `{ sourceRef, targetRef, type? }` (type ignored)

It does NOT extract:

- `SPEC-HIERARCHY` — the tree structure that DOORS uses for parent/child requirements. A flat list of `SPEC-OBJECT`s is imported with no hierarchy.
- `SPECIFICATION` — the document grouping. All requirements end up in one bucket.
- `SPEC-OBJECT-TYPE` / `SPEC-RELATION-TYPE` — the type definitions. So no distinction between "satisfies", "verifies", "derives", "trace" — every link becomes `'trace'` by default (controller line 3492 uses `rel.type || 'trace'`, but parser does not populate `rel.type`).
- `DATATYPE-DEFINITION-*` — datatypes (boolean, integer, enumeration, real). Imported requirements lose attribute typing.
- `xhtml`-embedded payload — the parser does `stripXhtml(html)` (line 55) which is a `<[^>]*>` regex. This drops every inline image, table, formula, and crucially every embedded link to other ReqIF identifiers.
- `DEFAULT-VALUE` / `IS-EDITABLE` / `MULTI-VALUED` on attribute definitions.

**For a buyer demo against DOORS Next or Polarion to land, this parser needs a complete rewrite.** ReqIF Academy publishes canonical samples (e.g. the "ReqIF Reference Implementation Conformance Test Suite") that a real implementation must pass.

Recommendation: build round-trip tests against three samples — a DOORS Next export, a Polarion export, and a Jama Universal ReqIF export. Verify object count, attribute fidelity, hierarchy fidelity, link fidelity. Today the parser would silently lose 80% of the input.

---

## 5. Performance — `getRequirements` filter builder

Lines 397–613 of `requirement.controller.ts`. Five issues:

### 5.1 Multi-pass scope intersection

When a user filters by "verification tab → test plan T" the code:

1. Loads test cases for plan T (`getTestCaseIdsForPlan`, one query).
2. Loads requirements verified by those cases (`getRequirementIdsLinkedToTestCasesVerifies`, two queries — forward and reverse).
3. Expands those requirements to their root IDs (`expandRequirementIdsToRootIds`, iterative — up to 200 iterations, one query per iteration).
4. If multiple scopes are active (function + test plan), intersects the root sets in memory.
5. Applies `where.id = { in: merged }` against the count + findMany queries.

For a 5k-requirement project with 5-level deep hierarchy, this fires ~10 queries per page load. The 200-iteration loop on `expandRequirementIdsToRootIds` is bounded but every iteration is sequential — no batching. Replace with a recursive CTE in raw SQL:

```sql
WITH RECURSIVE root_walk AS (
  SELECT id, "parentId" FROM "Requirement"
  WHERE id = ANY($1::uuid[])
  UNION ALL
  SELECT r.id, r."parentId" FROM "Requirement" r
  JOIN root_walk rw ON r.id = rw."parentId"
)
SELECT id FROM root_walk WHERE "parentId" IS NULL;
```

One round-trip instead of up to 200.

### 5.2 No covering indexes for the dashboard aggregate

The `$queryRaw` block at lines 3340–3358 normalises `test_case`/`testcase` with `lower(replace(...))`. Indexes do not help unless they are expression indexes:

```sql
CREATE INDEX "TraceLink_normalised_source_target_idx"
  ON "TraceLink" ("projectId", LOWER(REPLACE("sourceType", '-', '_')), LOWER(REPLACE("targetType", '-', '_')));
```

Add this migration before launching with a 100k-link project.

### 5.3 Suspect-flag propagation is O(N) per update

`markDownstreamLinksSuspect` (traceability.service.ts:1198) does a single `updateMany` against all links with `sourceId = changedId`. It does not walk transitively. The frontend works around this by re-fetching all links after every save — burning network for a CPU-cheap walk.

Replace with a CTE-driven recursive flag propagation:

```sql
WITH RECURSIVE suspect_walk AS (
  SELECT id, "targetId" FROM "TraceLink"
  WHERE "projectId" = $1 AND "sourceId" = $2
  UNION
  SELECT tl.id, tl."targetId" FROM "TraceLink" tl
  JOIN suspect_walk sw ON tl."sourceId" = sw."targetId"
  WHERE tl."projectId" = $1 AND tl."linkType" = ANY($3)
)
UPDATE "TraceLink" SET "isSuspect" = TRUE WHERE id IN (SELECT id FROM suspect_walk);
```

One query, transitive, server-evaluated.

### 5.4 `getAllRequirements` returns too much

The `all` endpoint includes parent + children + comments + attachments + counts. Comments and attachments are rarely needed by the callers (PBS tree, traceability matrix, exports). Add an `?include=` parameter, default to lean.

### 5.5 No streaming for large exports

The `traceability.routes.ts:60` matrix-export endpoint builds the entire matrix in memory before returning. Express body limit is 50MB; a 10k-row × 100-column matrix exceeds that. Either stream via NDJSON or implement a job-based export with `ExportJob` (already in schema).

---

## 6. Auth and permissions

### 6.1 Project membership

Every route uses `requireProjectMember` middleware. OK.

### 6.2 Owner / admin actions

Permanent delete (`DELETE /:projectId/:requirementId/permanent`) requires `requireProjectOwnerOrAdmin`. OK.

### 6.3 Engineering role gates

Lifecycle transitions check `ProjectUserEngineeringRole` when `strictLifecycleGates = true` (lines 1726–1742). Engineering roles per `project.md` "Discipline / engineering roles" — this is correct. Verify the same check applies to:

- Review approval (currently any reviewer can approve, regardless of project engineering role)
- Baseline creation (currently any project member can baseline)

### 6.4 Reviewer-response endpoint security flaw

`PUT /:projectId/reviews/:reviewId/reviewers/:reviewerId` (line 30 of `requirementReviews.routes.ts`) accepts a `status` body — the reviewer's response. The controller (lines 76–115 of `requirementReview.controller.ts`) does not verify that `req.user.id === reviewer.reviewerId`. Any project member can submit any other reviewer's response. This is a Part-11 audit failure plus a straight authorization bug.

Fix: load the `RequirementReviewer` row first, compare `reviewerId` to `req.user.id` (or `reviewerEmail` to `req.user.email`), reject with 403 if mismatch.

---

## 7. Comparison vs Jama Live Traceability + auto-baseline-on-review

Per `competitor-matrix.md` §1 and §3:

**Jama Live Traceability** computes the full impact graph on every requirement edit. Today our `markDownstreamLinksSuspect` does one-hop only. To match:

- Make suspect-flag propagation transitive (§5.3).
- Add an `impact_score` field on `TraceLink` that decays with hop count.
- Surface "downstream review queue" — every artefact whose link to an upstream-changed requirement turned suspect.

**Jama auto-baseline-on-review** — when a review approves, the affected requirements are snapshotted into an immutable baseline as an atomic transaction with the signature event. Today we have:

- `RequirementReview` ends with `reviewStatus = 'approved'` and `completedAt` timestamp.
- `Baseline` is created manually via the `Baselines` UI.
- No link between the two.

To match:

- On review approval, the service creates a `Baseline` with `baselineType = 'review'`, snapshots every requirement in the review scope, attaches the signature event, and returns the baseline ID.
- The requirement record's `version` Int is captured as the baseline version. Future edits create a new version chain.
- The baseline is immutable; trying to edit a requirement that is in a frozen baseline (without creating a new draft branch) refuses with 423.

This is the load-bearing piece of the "audit package is a by-product" claim in `vision-and-usp.md` §6.

---

## 8. Summary

The backend for Requirements is functional but architecturally inconsistent with the codebase's stated patterns. The 3,643-line controller, the absent service layer, the dual link APIs, the orphan validation routes, the shallow ReqIF parser, and the missing signature primitive all point in the same direction: this module was built early, accumulated feature requests faster than refactors, and is now the most expensive surface in the codebase to extend safely.

The most surprising backend finding: the `PUT .../reviewers/:reviewerId` endpoint allows any project member to submit any other user's review response. This is a Part 11 audit failure and a straight authorization bug; the security review will catch it, but it should be fixed today before any pilot customer sees the workflow.

The most consequential backend finding: applying the Parameter provenance lattice to `Requirement` + `RequirementVersion` + `TraceLink` is the unblock for everything in `ai-ready-vision.md` §6. The pattern works (Parameter ships with it); the work is mechanical migration plus middleware on every write. After that lands, the signature primitive, the INCOSE/EARS refusal, and the AI tier matrix all have a coherent data spine to build on.
