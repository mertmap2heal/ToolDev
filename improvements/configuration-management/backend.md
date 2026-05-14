# Configuration Management — Backend

Six endpoints, two Prisma models, no service file. This document audits what ships, specifies the four schema additions needed to back the existing UI, cites the IEEE 828-2012 / `kb/configuration-management.md` role model, and compares against Codebeamer's CM kit (the canonical depth bar in the industry).

---

## 1. Endpoint accounting — every live route

`backend/src/routes/baselines.routes.ts` is 37 lines:

| Method | Path | Controller | LoC | Description | Consumers |
|---|---|---|---:|---|---|
| GET | `/baselines/:projectId` | `getBaselines` | 58 | List baselines with `_count.items`, `linksCount`, `suspectLinksCount` | Requirements baseline manager, Archive page, `BaselinesPage` (requirements) |
| GET | `/baselines/:projectId/:baselineId` | `getBaseline` | 82 | Single baseline + items (formatted) | Baseline detail in Requirements |
| POST | `/baselines/:projectId` | `createBaseline` | 282 | Snapshot requirements (optional scope: requirementIds, componentIds, functionIds), seed `RequirementVersion` rows, create `BaselineItem` rows in a transaction | Requirements baseline manager |
| PUT | `/baselines/:projectId/:baselineId/lock` | `lockBaseline` | 54 | Set `status='locked'`, set `lockedAt` | Requirements baseline manager |
| DELETE | `/baselines/:projectId/:baselineId` | `deleteBaseline` | 44 | Hard-delete (rejected if `status='locked'`) | Requirements baseline manager |
| GET | `/baselines/:projectId/compare` | `compareBaselines` | 212 | Field-level + link-level diff of two baselines | **Nobody yet** — see `frontend.md` §11 |

Total: **732 lines of controller logic, zero lines of service** — the controller is doing service-layer work (transactions, multi-table writes, version-row backfill). Per `kb/backend-patterns.md` §"Controller → Service Layer Boundary," services throw and controllers catch; services do queries and controllers do HTTP. The `createBaseline` handler at 282 lines violates this with embedded `prisma.$transaction(async (tx) => { … })` orchestration. Refactoring is one of the cheapest near-term wins.

The six endpoints are all consumed by the **Requirements module's baseline manager** (per `frontend/src/services/baselines.service.ts`) and the **Archive page** (`/projects/:projectId/archive`). None are consumed by the Configuration Management page. This was an architecturally honest choice when the CM page was a UX prototype, but it must reverse when CM becomes the audit primitive.

---

## 2. Prisma model accounting — what exists

Two models in `backend/prisma/schema.prisma`:

### `Baseline` (lines 1211-1238) — rich, aerospace-shaped

```
id, projectId, name, description?, status (active | locked | etc),
baselineType? (functional | allocated | product | milestone | custom),
reviewType? (SRR | PDR | CDR), milestoneId?,
approvedBy?, approvedByName?, approvedAt?, approvalNotes?,
supersedesBaselineId?, configurationAuthority? (government | contractor),
fdAL? (A | B | C | D | E),
createdBy?, createdByName?, lockedAt?,
linksSnapshot Json?, createdAt, updatedAt
```

15 columns. Models the IEEE 828 §6.4 baseline primitive plus a real approval chain (`approvedBy`/`approvedAt`/`approvalNotes`) and aerospace context (`fdAL`, `configurationAuthority`). The `linksSnapshot` payload is structured (per `controller.ts:302-329`: `{ links: [{ id, sourceType, sourceId, targetType, targetId, linkType, rationale, isSuspect }] }`) and re-rendered by the compare endpoint into `linksAdded[]` / `linksRemoved[]` / `linksSuspectChanged[]`. This is the strongest schema asset in the package.

### `BaselineItem` (lines 1240-1251) — requirement-only

```
id, baselineId, requirementId, snapshot (String JSON), createdAt
```

Four columns. **Snapshots only requirements** — `requirementId` is unindexed-as-FK, the `snapshot` is a serialised JSON string of the requirement at baseline time. This is the wrong shape if the CM module ships its CI primitive: a baseline must snapshot any `ConfigItem`, not only requirements. Extending `BaselineItem.requirementId` to a polymorphic `(itemId, itemType)` pair, or introducing a parallel `BaselineCi` join, is the schema migration that lets the CM page reuse the existing baseline plumbing.

### Models that should exist and do not

Per the frontend type catalogue (`types.ts`) and `kb/configuration-management.md`:

1. **`ConfigItem`** — 11 typed kinds (matching the existing `CIType` enum), `lockState` (Unlocked / FrozenByBaseline / LockedForRelease), `safetyCritical`, `dal`, `version`, `revision`, `ownerUserId`, `status`. The foundational identification primitive.
2. **`Deviation`** — short-lived authorisation; `validUntil` ISO date, `riskLevel`, `linkedCIs[]` (polymorphic), `authorityInvolved`, `decisionNotes`, signer chain.
3. **`Waiver`** — permanent relaxation per delivery; same shape as `Deviation` with `validUntil` nullable for permanent.
4. **`CcbDecision`** — vote record per change request, with `ccbLevel` (SystemCCB / SafetyCCB / SoftwareCCB), `safetyImpact`, `impactedConfigItemIds[]` (polymorphic), `decision` (Approved / Rejected / Deferred), `decisionRationale`, `signerChain` (link to `SignatureEvent`).
5. **`Release`** + **`ReleaseApproval`** — delivery package + signer ledger; `releaseTarget` (Internal / Customer / Authority), `baselineId` (FK to Baseline), `includedItems[]` snapshot, `approvals[]`.

The frontend already specifies the column-level detail for each (`types.ts:28-189`). Schema cost: four to six new tables, additive migration, no destructive operation. See `tickets.md` for the migration plan.

---

## 3. The `ChangeRequest` collision

The `ChangeRequest` Prisma model (`schema.prisma:1021-1056`) exists but was designed for the **Requirements module's** change-request flow, not the CCB CR flow. Its `sourceType` enum (`'function' | 'issue' | 'parameter' | 'requirement'`) describes the entity *that originated* the change request, not the entities *the change request impacts*. Its `status` enum (`'pending' | 'approved' | 'rejected' | 'in-review'`) is at the row level, not the CCB-decision level.

The CCB CR concept needs additional first-class columns:

- `safetyImpact Boolean @default(false)` — required gate per `kb/configuration-management.md` "strictMode rules" (when true, must collect SafetyEngineer sign-off).
- `ccbLevel String` (SystemCCB / SafetyCCB / SoftwareCCB) — routes the CR to the correct board.
- `impactedConfigItemIds String[]` or polymorphic `(itemType, itemId)[]` join — what CIs does this CR change?

Two architecturally distinct paths:

**Path A — extend `ChangeRequest`.** Add `safetyImpact`, `ccbLevel`, `impactedConfigItemIds[]` as columns. Add a polymorphic `ChangeRequestImpact { changeRequestId, itemType, itemId }` join. The single CR table serves both Requirements-originated change tracking and CCB decisions.

**Path B — separate `CcbDecision`.** Keep `ChangeRequest` as-is. New `CcbDecision` table records the *vote*. A CR can have many CCB decisions (referred, voted, signed). Joins to `ChangeRequest` via `changeRequestId`.

Recommend **Path B**. The conceptual mismatch is too large to fuse: a CR row is "what was asked for"; a CCB decision is "what was decided by which board at what date with what signers." They are 1:N. Separating preserves audit clarity. Cost: one new table (`CcbDecision`), one new join table for impacted-items, one new route file.

---

## 4. Proposed schema specification

Concrete Prisma snippets (illustrative, not for direct paste — types subject to migration review):

```prisma
model ConfigItem {
  id                String   @id @default(uuid())
  projectId         String
  ciKey             String   // Display key, atomic per project (e.g. CI-REQ-014)
  name              String
  type              String   // Requirement | Architecture | Interface | Parameter | Software | Hardware | Document | Model | TestCase | TestResult | SafetyArtifact
  status            String   @default("Draft")   // Draft | InReview | Released | Obsolete
  lockState         String   @default("Unlocked") // Unlocked | FrozenByBaseline | LockedForRelease
  version           String   @default("0.1.0")
  revision          String   @default("Rev 0")
  ownerUserId       String?
  ownerName         String?  // display fallback
  safetyCritical    Boolean  @default(false)
  dal               String?  // A | B | C | D | E
  tags              String[]
  // polymorphic backref to the source artefact this CI describes:
  // (e.g. a CI of type=Requirement may reference Requirement.id)
  refType           String?  // 'requirement' | 'parameter' | ...
  refId             String?
  // provenance (see ai-ready-vision.md §6.1)
  authorType        String   @default("human") // 'human' | 'ai'
  authorUserId      String?
  authorAiModel     String?
  authorAiPromptId  String?
  classification    String?
  reviewStatus      String   @default("unreviewed")
  reviewerUserId    String?
  reviewTimestamp   DateTime?
  deletedAt         DateTime?
  deletedById       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([projectId, ciKey])
  @@index([projectId, type])
  @@index([projectId, status])
  @@index([projectId, deletedAt])
}

model Deviation {
  id                  String   @id @default(uuid())
  projectId           String
  dwKey               String   // DW-NNN
  type                String   // 'Deviation' | 'Waiver'
  title               String
  description         String
  riskLevel           String   // Low | Medium | High
  validUntil          DateTime?    // null = permanent (Waiver)
  status              String   @default("Draft")  // Draft | Submitted | Approved | Closed | Rejected
  authorityInvolved   Boolean  @default(false)
  decisionNotes       String?
  // polymorphic linked items
  linkedConfigItemIds Json     // [{ itemType, itemId }, ...]
  createdById         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([projectId, dwKey])
  @@index([projectId, type, status])
}

model CcbDecision {
  id                String   @id @default(uuid())
  projectId         String
  changeRequestId   String
  ccbLevel          String   // SystemCCB | SafetyCCB | SoftwareCCB
  safetyImpact      Boolean  @default(false)
  decision          String   // Approved | Rejected | Deferred
  decisionRationale String
  signedById        String?
  signedAt          DateTime?
  meaningCode       String?  // controlled vocabulary ('Approve for implementation', etc.)
  impactedConfigItemIds Json // [{ itemType, itemId }, ...]
  createdAt         DateTime @default(now())
  changeRequest     ChangeRequest @relation(fields: [changeRequestId], references: [id], onDelete: Cascade)
  @@index([projectId, ccbLevel])
  @@index([changeRequestId])
}

model Release {
  id              String   @id @default(uuid())
  projectId       String
  releaseKey      String   // REL-YYYY.MM
  name            String
  target          String   // Internal | Customer | Authority
  status          String   @default("Draft")  // Draft | Review | Approved | Delivered
  baselineId      String   // FK to Baseline (the snapshot this release ships)
  releaseNotes    String?
  createdAt       DateTime @default(now())
  baseline        Baseline @relation(fields: [baselineId], references: [id])
  approvals       ReleaseApproval[]
  @@unique([projectId, releaseKey])
}

model ReleaseApproval {
  id          String   @id @default(uuid())
  releaseId   String
  roleLabel   String   // 'Config Manager', 'CCB Chair', 'Customer Acceptance', 'Authority'
  signerUserId String?
  signerName  String   // display fallback
  signedAt    DateTime @default(now())
  signatureEventId String? // FK to the universal SignatureEvent (when that lands)
  release     Release @relation(fields: [releaseId], references: [id], onDelete: Cascade)
}
```

The `BaselineItem` migration to a polymorphic CI snapshot (not just requirement):

```prisma
model BaselineItem {
  id           String   @id @default(uuid())
  baselineId   String
  configItemId String?  // forward reference once ConfigItem exists
  itemType     String   // 'requirement' | 'configItem' | 'parameter' | etc.
  itemId       String
  snapshot     String   // unchanged: JSON of the item at baseline time
  createdAt    DateTime @default(now())
  baseline     Baseline @relation(fields: [baselineId], references: [id], onDelete: Cascade)
  @@index([baselineId, itemType])
  @@index([itemType, itemId])
}
```

---

## 5. CCB role seeding — six AdminRole rows on first boot

`kb/configuration-management.md` mandates these six roles for any CM-active project:

| Role | Responsibility |
|---|---|
| `ConfigManager` | Chairs the CCB; owns the CM plan; can edit any CI; can freeze any baseline. |
| `SystemEngineer` | Impact analysis on requirements + architecture; can create CIs and CRs. |
| `VerificationEngineer` | Impact on V&V artefacts; can edit test-case CIs. |
| `SafetyEngineer` | Safety/hazard impact; required signer when `safetyImpact=true`. |
| `CCBMember` | Voting member of a CCB; can approve baselines, CRs, releases. |
| `Auditor` | Read-only access to full audit trail. |

These should seed as `AdminRole` rows with `companyKey='__default__'` so they exist on first boot of every fresh install. The `defaultPermissions Json` payload encodes the action matrix from `frontend/src/modules/configuration-management/constants.ts:179-195` (15 actions × allowed-roles list). Today that constant is client-side only and decorative; once seeded as AdminRoles, the backend middleware `requireAdminRole(['ConfigManager','CCBMember'])` is the enforcement primitive (compare to `requireAdmin` in `auth.middleware.ts` and the role-gate pattern in Requirements review).

**Critical authorization rule.** Every CM action that records a signer must derive that signer from `req.user` — never from `req.body.signerId`. This is the same authorization-gap pattern flagged in the requirements cross-cut entry (`_shared/cross-cutting.md` "Reviewer-response endpoint has cross-module authorization gap"). When the backend exists, the CM controllers must reject any body field that asserts user identity.

---

## 6. Audit log — use the central `AuditLog`, not a parallel table

Per the validation cross-cut entry ("Validation uses central AuditLog, not a private audit table"), the right pattern is a single audit table shared across modules. The CM module's `AuditEvent` type (`types.ts:148-171`) defines 14 action codes (`CREATE_CI`, `UPDATE_CI`, `FREEZE_BASELINE`, `APPROVE_BASELINE`, etc.) that map cleanly onto `AuditLog.action` strings (kebab/colon namespaced: `cm:ci-create`, `cm:baseline-freeze`, `cm:baseline-approve`, `cm:cr-submit`, `cm:cr-approve`, `cm:cr-reject`, `cm:cr-apply-versions`, `cm:release-create`, `cm:release-approve`, `cm:dw-create`, `cm:dw-approve`, `cm:dw-reject`).

Adopt the `writeAudit(projectId, userId, action, detailsJson)` helper pattern documented in the validation cross-cut entry. Do **not** create a new `CmAuditLog` or `BaselineAuditLog` table — that would be the 12th audit table in a codebase that already has 11.

The existing `logBaselineAudit` helper in `baseline.controller.ts:7-21` writes to `AuditLog` correctly. CM controllers must adopt the same pattern.

---

## 7. `strictMode` — flag must live on `Project`

`kb/configuration-management.md` repeatedly references `Project.strictMode` as the project-wide enforcement switch:

> When `Project.strictMode = true`, the CM module must enforce: CIs locked by a baseline are immutable — any mutation returns 409. Baseline approval requires ≥2 distinct approvers. Release approval requires a signed set of roles matching the release target (Customer / Authority / Internal). Deviation / Waiver status transitions are append-only in the audit log. Change request approval requires an explicit `safetyImpact` flag and, when true, a SafetyEngineer sign-off.

**The flag does not exist on `Project`.** The CM page stores `state.strictMode` in module-local reducer state only. Either:

- Add `strictMode Boolean @default(false)` to the `Project` Prisma model, plus a controller/route to toggle it (admin-only).
- Or remove the term from the KB.

Recommend the schema add. It is one line of migration and unlocks the regulated-customer story without forcing every customer into the constraint.

The validation cross-cut entry on universal `/auth/reauth` (V-N1 in validation tickets) is the natural companion: strict-mode-on means baseline approval and release sign-off must call `/auth/reauth` before the signature event lands. This is the CFR 21 Part 11 §11.200(a)(1) requirement (two distinct identification components on each continuous-session signing) the entire Phase-1 audit gap-summary #1 is about.

---

## 8. Comparison to Codebeamer's CM kit

Per `competitor-codebeamer.md`, Codebeamer's CM is "one of the deepest in the industry" and is the canonical depth bar:

| Capability | Codebeamer | Us (current) | Us (target) |
|---|---|---|---|
| Tracker baselines (snapshot per tracker) | Native | Partial (`Baseline` exists, `BaselineItem` requirements-only) | Native (polymorphic `BaselineItem`) |
| Stream baselines (cross-project / variant snapshot, Codebeamer 3.1+) | Native | None | Deferred — variants are out of scope for first 18 months per `vision-and-usp.md` §11 |
| Configuration item with typed kinds | Native (tracker item types) | None | Native (`ConfigItem` with 11 types) |
| Change request workflow with CCB-level routing | Native | Partial (Requirements-only CR; no `ccbLevel`/`safetyImpact`) | Native (`CcbDecision`) |
| Deviation / waiver workflow | Native | None | Native (`Deviation`) |
| Signed release approval with audit log | Native | None | Native (`Release` + `ReleaseApproval` + central audit) |
| Variant-merging (Delta Merge β) | Native | None | **Deferred** per omissions list |
| Pure Variants feature-model integration | Native (PV 7.2 connector) | None | **Deferred** per omissions list |
| CCB role catalogue | Custom-configurable | None | Native (six seed `AdminRole` rows from KB) |
| Strict-mode enforcement (regulated vs unregulated) | Per-tracker workflow gates | None | Native (`Project.strictMode`) |

Closes ~70% of Codebeamer's CM surface for an aerospace small-team buyer. The remaining 30% (Stream Baselines, Pure Variants, Delta Merge) is the variant-management story explicitly deferred for the first 18 months per `vision-and-usp.md` §11 and `gap-summary.md` deliberate omission #1. **This is the correct deliberate omission to cite** when a buyer asks "can you match Codebeamer on variants?" — the honest answer is "we ship Codebeamer-grade CCB and baseline workflow; we do not ship Codebeamer's variant management because our ICP is single-product programmes."

---

## 9. Provenance, deep-link adapter, ReqIF — apply the cross-cutting refactors

Three platform primitives land here:

1. **Provenance lattice.** Every CM artefact (`ConfigItem`, `CcbDecision`, `Deviation`, `Waiver`, `Release`) needs the eight provenance columns from `ai-ready-vision.md` §6.1 (`authorType`, `authorUserId` / `authorAiModel` / `authorAiPromptId` / `authorAiContextHash`, `classification`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`). This is cross-cutting seed finding #1; the CM module just inherits it.
2. **Deep-link adapter.** `frontend/src/linkage/` has 18 adapters (per `architecture.md`). There is no `configurationItem.ts` (and no `deviation.ts`, `release.ts`, `ccbDecision.ts`). Add them when the schema lands — see the validation cross-cut entry "Deep-link adapter for ValidationItem missing" for the precedent.
3. **ReqIF / OSLC.** **Deliberate omission per `vision-and-usp.md` §9 + `gap-summary.md` omissions #5.** OSLC is anti-ICP. ReqIF is in scope for Requirements (gap-summary #6) but not for CM-specific entities. Do not propose either for this package.

---

## 10. Endpoint roadmap — minimum to ship

Per the schema additions in §4 and §5, the CM backend route surface needs to grow from 6 endpoints to ~35:

| Route file | Endpoints | Description |
|---|---:|---|
| `configItems.routes.ts` | 9 | list, get, create, update, delete (soft), lock, unlock, link-source-artifact, search |
| `ccbDecisions.routes.ts` | 5 | list (per project, per CR), create (vote record), sign, approve, reject |
| `deviationsWaivers.routes.ts` | 6 | list, get, create, update, sign, close |
| `releases.routes.ts` | 6 | list, get, create, update, approve (with signature), deliver |
| `cmAccessRoles.routes.ts` | 2 | list-role-assignments-per-project, assign-user-to-role |
| `baselines.routes.ts` | 6 (existing) | unchanged; `createBaseline` extends to accept `configItemIds[]` |
| `cm.routes.ts` (settings) | 2 | toggle `Project.strictMode`, toggle `Project.auditMode` (or both — depending on whether `auditMode` becomes real) |

Each route file owns its controller + service per `kb/backend-patterns.md`. The pattern is the same as the existing `validation.controller.ts` + `validation.service.ts` split — see the validation review for the precedent and 2,064-line `validation.service.ts` as the depth target.

**Total schema migration:** 4-6 additive tables + 1 boolean column on `Project` + 1 polymorphic extension on `BaselineItem`. **Total route count:** +29 endpoints. **Total estimated effort:** 3-5 sprints to functional parity with the existing UI; another 1-2 sprints for the unified baseline primitive consolidation that is cross-cutting refactor #2.
