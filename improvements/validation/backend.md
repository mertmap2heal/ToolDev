# Validation — Backend Review

`backend/src/routes/validation.routes.ts` mounts 40 endpoints under `/api/v1/validation`. The route file is 150 lines; the controller (`backend/src/controllers/validation.controller.ts`) is 619 lines; the service (`backend/src/services/validation.service.ts`) is **2,064 lines** — the largest single service file in the backend after `verification.service.ts`. The full surface ships behind `authenticateToken` + `requireProjectMember` middleware, with `requireProjectOwnerOrAdmin` gating settings writes.

---

## 1. Endpoint audit — every endpoint mapped to a live consumer

The `inventory.md` Phase-1 prediction was that backend-validates ships ahead of UI maturity and the audit should "verify which endpoints are live". The findings, after walking every endpoint and grep'ing for callers:

**All 40 endpoints are wired through controller → service → Prisma. None are stubs. None throw `NotImplementedError`. None return mock data.** Every endpoint has at least one consumer in `frontend/src/services/validation.service.ts` or in the 590-line integration test at `backend/src/__tests__/validation/validation.test.ts`. The prediction was wrong for this module.

| # | Method | Path | Controller | Live UI consumer | Tested |
|---:|---|---|---|---|---|
| 1 | GET | `/projects/:projectId/settings` | `getSettings` | `ValidationPage` (preferences), `ValidationSettingsPage`, `ValidationItemDetailDrawer` | yes |
| 2 | PUT | `/projects/:projectId/settings` | `updateSettings` | `ValidationSettingsPage`, drawer (criterion-template-save) | yes |
| 3 | GET | `/projects/:projectId/coverage` | `getCoverage` | `ValidationPage`, `DERView` | yes |
| 4 | GET | `/projects/:projectId/trend` | `getTrend` | `ValidationPage` (ValidationTrendChart) | indirect |
| 5 | GET | `/projects/:projectId/saved-views` | `listSavedViews` | `ValidationPage` | indirect |
| 6 | POST | `/projects/:projectId/saved-views` | `createSavedView` | `ValidationPage` (save view dialog) | indirect |
| 7 | DELETE | `/projects/:projectId/saved-views/:viewId` | `deleteSavedView` | `ValidationPage` | indirect |
| 8 | GET | `/projects/:projectId/uncovered-requirements` | `listUncoveredRequirements` | `UncoveredRequirementsLauncher` modal | yes |
| 9 | GET | `/projects/:projectId/baselines` | `listBaselines` | `BaselinesPage` | yes |
| 10 | POST | `/projects/:projectId/baselines` | `createBaseline` | `ValidationPage` (More → Baseline this state) | yes |
| 11 | GET | `/projects/:projectId/baselines/:id` | `getBaseline` | `BaselinesPage` (drawer) | yes |
| 12 | DELETE | `/projects/:projectId/baselines/:id` | `deleteBaseline` | `BaselinesPage` | yes |
| 13 | GET | `/projects/:projectId/items` | `listItems` | `ValidationPage`, `DERView`, `BaselinesPage` (diff source) | yes |
| 14 | GET | `/projects/:projectId/items.csv` | `exportItemsCsv` | `ValidationPage` (Export → CSV) | yes |
| 15 | GET | `/projects/:projectId/report.md` | `exportItemsMarkdown` | `DERView` (Export → MD), `ValidationPage` (Export → MD) | indirect |
| 16 | GET | `/projects/:projectId/report.pdf` | `exportItemsPdf` | `DERView` (Export → PDF) | indirect |
| 17 | POST | `/projects/:projectId/items` | `createItem` | `CreateValidationItemModal` | yes |
| 18 | POST | `/projects/:projectId/items/from-requirements` | `createFromRequirements` | `CreateFromRequirementsModal` | yes |
| 19 | POST | `/projects/:projectId/items/bulk` | `bulkUpdate` | `ValidationPage` (bulk action bar) | yes |
| 20 | GET | `/projects/:projectId/items/:id` | `getItem` | `ValidationItemDetailDrawer` | yes |
| 21 | PUT | `/projects/:projectId/items/:id` | `updateItem` | drawer, inline-edit | yes |
| 22 | DELETE | `/projects/:projectId/items/:id` | `deleteItem` (soft) | drawer | yes |
| 23 | POST | `/projects/:projectId/items/:id/restore` | `restoreItem` | drawer | indirect |
| 24 | POST | `/projects/:projectId/items/:id/duplicate` | `duplicateItem` | drawer | indirect |
| 25 | POST | `/projects/:projectId/items/:id/star` | `star` | row star button | indirect |
| 26 | DELETE | `/projects/:projectId/items/:id/star` | `unstar` | row star button | indirect |
| 27 | POST | `/projects/:projectId/items/:id/acknowledge-suspect` | `acknowledgeSuspect` | drawer (suspect chip) | indirect |
| 28 | GET | `/projects/:projectId/activity` | `listProjectActivity` | `ActivityPage` | indirect |
| 29 | GET | `/projects/:projectId/items/:id/activity` | `listActivity` | drawer (Recent activity section) | indirect |
| 30 | GET | `/projects/:projectId/items/:id/comments` | `listComments` | `ValidationCommentsSection` | indirect |
| 31 | POST | `/projects/:projectId/items/:id/comments` | `createComment` | comments section | indirect |
| 32 | PUT | `/projects/:projectId/items/:id/comments/:commentId` | `updateComment` | comments section | indirect |
| 33 | DELETE | `/projects/:projectId/items/:id/comments/:commentId` | `deleteComment` | comments section | indirect |
| 34 | GET | `/projects/:projectId/items/:id/linked-requirements` | `listLinkedRequirements` | drawer (Linked requirements section) | yes |
| 35 | POST | `/projects/:projectId/items/:id/linked-requirements` | `linkRequirement` | drawer (LinkRequirementPicker) | yes |
| 36 | DELETE | `/projects/:projectId/items/:id/linked-requirements/:traceLinkId` | `unlinkRequirement` | drawer | yes |
| 37 | GET | `/projects/:projectId/items/:id/sign-offs` | `listSignOffs` | drawer | yes |
| 38 | POST | `/projects/:projectId/items/:id/sign-off` | `signOffItem` | drawer (Sign off button) | yes |
| 39 | POST | `/projects/:projectId/items/:id/sign-off/:signOffId/revoke` | `revokeSignOff` | drawer (revoke icon) | yes |
| 40 | GET | `/projects/:projectId/items/:id/evidence` | `listEvidence` | drawer (Evidence section) | yes |
| 41 | POST | `/projects/:projectId/items/:id/evidence` | `attachEvidence` | drawer (attach existing) | yes |
| 42 | POST | `/projects/:projectId/items/:id/evidence/upload` | `uploadEvidenceFile` | drawer (EvidenceDropzone) | indirect |
| 43 | DELETE | `/projects/:projectId/items/:id/evidence/:linkId` | `detachEvidence` | drawer | yes |

(The `inventory.md` "40" count is the raw `router.<method>(...)` count; this enumeration shows 43 lines because some compound endpoints — `items.csv`, `report.md`, `report.pdf`, `items/from-requirements`, `items/bulk` — were collapsed in the inventory tally. The substantive endpoint count is **43**, none stub.)

The single most striking artefact is the **bootstrap line** at `validation.routes.ts:56`:

```ts
ensureValidationApproverRole().catch((e) => {
  console.error('[validation] ensureValidationApproverRole failed:', (e as Error).message)
})
```

This idempotent upsert seeds an `EngineeringRole(name: 'Validation Approver', isSystem: true)` on first module import. The role is referenced in the drawer copy ("`Validation Approver` role-holders are the intended signers") but is **not currently enforced** by the sign-off endpoint — any project member who is not the item creator can sign off. The role is a marker for future enforcement and an artefact in the engineering-role catalogue. Pattern is correct (centralised role registry); enforcement is the next ticket (`tickets.md` near-term).

---

## 2. State machine — the only enforced rule chain in the module

`backend/src/services/validation.service.ts:30` declares:

```ts
export const STATUS_TRANSITIONS: Record<ValidationStatus, ValidationStatus[]> = {
  PLANNED: ['EXECUTED', 'BLOCKED', 'OBSOLETE'],
  EXECUTED: ['VALIDATED', 'BLOCKED', 'PLANNED', 'OBSOLETE'],
  VALIDATED: ['EXECUTED', 'OBSOLETE'],
  BLOCKED: ['PLANNED', 'EXECUTED', 'OBSOLETE'],
  OBSOLETE: ['PLANNED'],
}
```

This is the only enforced state machine in the validation backend. Illegal transitions throw the typed `IllegalStatusTransition` error, which the controller maps to HTTP 409 with `code: 'ILLEGAL_STATUS_TRANSITION'` and `allowedNext`. Bulk update applies the same check to every selected item before writing — if any row would violate, the whole batch fails atomically.

**Status auto-advancement on criteria change** (`updateItem`, line 668):

- All criteria `MET` AND item was `PLANNED` ⇒ promote to `EXECUTED`.
- Any criterion `NOT_MET` AND item was `EXECUTED` ⇒ demote to `BLOCKED`.

The state machine is closed by the sign-off endpoint promoting `EXECUTED → VALIDATED` (line 1226) and the revoke endpoint demoting back to `EXECUTED` when there are no remaining active sign-offs (line 1269). This is a closed loop, exactly the kind of opinionated state per `design-system.md` §2.1 and `vision-and-usp.md` §9 ("we ship one correct state machine per certification standard"). Compare to Jira's configurable workflow engine — Validation is the right inversion of that, and the right place for the module to claim certification-native.

**Gap:** the state machine is hand-coded as a constant. There is no schema-level enforcement (Postgres CHECK constraint or trigger). A direct `prisma.validationItem.update({ data: { status: 'VALIDATED' } })` from another service or a migration script would skip the check. Cross-cutting concern; flagged in `tickets.md`.

---

## 3. `ValidationSignOff` — cross-cuts with the universal signature primitive

Schema (`schema.prisma:4089`):

```prisma
model ValidationSignOff {
  id               String  @id @default(uuid())
  validationItemId String
  signerUserId     String
  signerRoleLabel  String                              // free-text role, e.g. "Customer Operations Lead"
  comment          String? @db.Text
  supersededById   String?            @unique          // null = active; non-null = revoked
  supersededBy     ValidationSignOff? @relation("SignOffSupersession", fields: [supersededById], references: [id], onDelete: SetNull)
  superseded       ValidationSignOff? @relation("SignOffSupersession")
  signedAt         DateTime @default(now())
  createdAt        DateTime @default(now())
}
```

Service rules (`validation.service.ts:1199`):

- `signerRoleLabel` is required free-text.
- Item must not be deleted.
- **Signer must not be the item creator** (the only enforced authority rule).
- Item must be `EXECUTED` — cannot sign a `PLANNED` item.
- A new sign-off promotes the item to `VALIDATED`.
- Revocation creates a NEW row (`signerRoleLabel: 'Revocation'`) and sets `supersededById` on the prior row. The original is never updated — immutability via append-only.

This is **the same conceptual model as `CertSignOff` (in `certification.routes.ts`) and the implicit signature in `RequirementReview` (in `requirementReviews.routes.ts`) — but with three different schemas, three different controllers, three different state machines, and three different audit-log conventions.** The cross-cutting refactor is to consolidate into one signature primitive bound to an artefact and a baseline.

**What is missing relative to `gap-summary.md` #1 (Part-11 e-signature):**

- **No reauthentication.** A user who is logged in can sign without re-entering their password. Per `competitor-matrix.md` §3 ("CFR 21 Part 11 e-signature (reauthenticated)") Jama / Polarion / Codebeamer / DOORS all reauthenticate. This is the table-stakes aerospace gap.
- **No signed meaning string.** The `comment` field is free-text optional. Part 11 requires the signature record to contain "the printed name of the signer; the date and time when the signature was executed; **and the meaning** (such as review, approval, responsibility, or authorship) associated with the signature." Jama's meaning string is a system setting defaulting to "I approve this review" and is non-modifiable per audit policy.
- **No binding to an immutable baseline.** A sign-off attaches to `ValidationItem.id`. The item can be edited after sign-off (the state machine permits `VALIDATED → EXECUTED` via certain paths, see `STATUS_TRANSITIONS`). Auditors expect the signature to lock the snapshot it was signed against.
- **No cryptographic chain-of-custody.** No hash of the signed artefact, no SHA-256 fingerprint, no Merkle-tree append-only.

The immediate ticket is **not** to retrofit all of this into `ValidationSignOff` — the right move is to extract a `SignatureEvent` primitive and have all three modules (`Validation`, `Certification`, `Requirements/Review`) use it. See `cross-cutting.md` append for the full statement of this refactor.

---

## 4. `ValidationBaseline` — one of the five inconsistent baseline patterns

Schema (`schema.prisma:4044`):

```prisma
model ValidationBaseline {
  id           String   @id @default(uuid())
  projectId    String
  label        String
  description  String?
  snapshot     Json                                 // frozen array of item summaries
  itemCount    Int
  createdById  String
  createdAt    DateTime @default(now())
}
```

This is one of **five baseline patterns** in the codebase (per `inventory-models.md` gap #5 and `gap-summary.md` cross-cutting #2):

1. `Baseline` + `BaselineItem` — requirements-centric, the "original" baseline. Used by Configuration Management.
2. `VerBaseline` — verification snapshot.
3. `CertBaseline` — certification snapshot.
4. `ParameterBaseline` + `ParameterBaselineItem` — parameters snapshot.
5. `ValidationBaseline` — this one. Snapshot is a single JSON blob; no per-item table.

The five patterns share **no base, no interface, no service**. Each module's "baseline" endpoint family is hand-rolled. Two of them use a separate `BaselineItem` join (1, 4); three of them inline the snapshot as JSON (2, 3, 5).

`ValidationBaseline` is the simplest and the most fragile. Today the snapshot stores:

```ts
{ id, key, title, description, methodType, targetMilestone,
  status, priority, criteria, tags, ownerName, signOffCount }
```

It does NOT store:
- The `ownerUserId` (only `ownerName`) — so a baseline cannot survive an owner being renamed.
- The full sign-off records (only the count) — so the baseline cannot be re-rendered with the signed-by attribution.
- Linked requirements / evidence — gone.
- The author identity for each criterion notes.
- A signature (gap #1).

For a **certification anchor** a baseline that loses linked-requirement IDs is not regulator-grade. Today the baselines page falls back to comparing snapshot keys against the live database — which means a deleted-then-restored item with the same key shows as "unchanged" even if it was rewritten entirely.

The right resolution is to unify against a `BaselineEvent` primitive (consistent with the `SignatureEvent` consolidation above) that stores a content-addressed hash of every snapshotted artefact plus a JSON manifest. Detailed in `tickets.md` long-term.

---

## 5. Soft-delete coverage — mostly correct, one gap

Per `gap-summary.md` honourable mention #14, only 6 of 178 models carry `deletedAt`. Validation contributes 2 of those 6: `ValidationItem` (full soft-delete with `deletedAt` / `deletedById` / `deleteReason` / `restoredAt`) and `ValidationComment` (tombstone soft-delete with `deletedAt`).

**Gap:** `ValidationSignOff` is **append-only** (immutability via `supersededById`) but does **not** carry `deletedAt`. This is by design — a Part-11 signature should never be deletable — and is documented inline. However, the `validation.service.ts` `revokeSignOff` flow does NOT prevent a project admin from issuing a raw Prisma delete bypass via a future script. The append-only invariant is enforced at the service layer but not at the schema layer. This is the same gap that `RequirementReview` has and the same fix.

**Gap:** `ValidationBaseline` is also not soft-deletable. Today `deleteBaseline` is a hard `prisma.validationBaseline.delete({ where: { id } })`. For a snapshot intended to be the immutable certification anchor, this is wrong. The baselines page (`BaselinesPage.tsx`) renders a `<Trash2>` icon on every row, gated only by `confirmDialog`. Either:

- Add `deletedAt` to `ValidationBaseline` and require admin role to delete, OR
- Remove the delete affordance entirely and provide an "archive" workflow instead.

Cross-cutting refactor: every baseline primitive across all five patterns should soft-delete consistently.

---

## 6. Evidence reuse — exemplary cross-module pattern

The Validation module does NOT have its own evidence table. It **reuses `VerEvidence` + `VerEvidenceLink`** via the polymorphic `linkedEntityType = 'ValidationItem'`:

```ts
// validation.service.ts:1342
await prisma.verEvidenceLink.create({
  data: {
    userId,
    evidenceId: evidence.id,
    linkedEntityType: 'ValidationItem',
    linkedEntityId: itemId,
    relation: criterionId ? `criterion:${criterionId}` : 'PRIMARY',
  },
})
```

This is the **correct** polymorphic-reuse pattern for the codebase. `VerEvidenceLink` is the polymorphic store flagged in `inventory-models.md` gap #5 ("polymorphic cross-module relations"). The Validation module is one of the cleanest consumers of it. The relation token (`PRIMARY` or `criterion:<id>`) lets the module distinguish item-level evidence from criterion-level evidence without a parallel join table. Other modules considering evidence attachments should follow this pattern.

**Side effects worth noting:**

- **Garbage collection on detach** (`detachEvidence`, line 1444): after removing the `VerEvidenceLink`, the service counts remaining links to the same `evidenceId` and deletes the `VerEvidence` row if zero. Correct for storage hygiene but means **deleting the last evidence link irretrievably deletes the underlying evidence file** — including the file in `/uploads/validation/<itemId>/`. For a regulated artefact this is the wrong policy. A regulator's expectation is that evidence outlives its links.

- **File uploads land under `/uploads/validation/<itemId>/<sha-prefix>-<safe-name>`** with sha256 dedup. Pattern is good. The route bumps the multer cap to 25 MB per file vs the Express 50 MB body limit — sensible because the cap excludes multipart overhead and matches typical PDF / DOCX / image evidence sizes.

---

## 7. Suspect detection — derived, correct, somewhat expensive

`suspectItemIds(projectId)` and the `isSuspect` flag on every item summary (`listItems`):

```ts
// validation.service.ts:1811
const items = await prisma.validationItem.findMany({ ... })
const links = await prisma.traceLink.findMany({
  where: { projectId, sourceType: 'ValidationItem',
           targetType: 'Requirement', linkType: 'validates' },
  select: { sourceId: true, targetId: true },
})
const reqIds = Array.from(new Set(links.map((l) => l.targetId)))
const reqs = await prisma.requirement.findMany({ ... })
// item is suspect when its linked requirement.updatedAt > item.updatedAt
```

This is the **right pattern** — derivation from data rather than a stored boolean — and it matches Jama's "Live Traceability" model. The list endpoint runs the full suspect derivation on every call (`listItems` → `suspectItemIds`). For a project with N items and M trace links, the query cost is O(N+M+R) per list call. For small teams (3-50 engineers, ≤2k items) this is fine. At 10k+ items the cost grows; consider memoising per project.

The `acknowledgeSuspect` endpoint resolves the flag by bumping the item's `updatedAt`. This is a pragmatic hack — the right model is a separate `suspectAcknowledgements` table that records the reviewer's accept-without-rework decision per (item, requirement) pair. The current pattern means re-running suspect detection after acknowledge will always clear the flag, even if the linked requirement was further updated. Cross-cutting concern flagged in `tickets.md`.

---

## 8. Audit log usage — consistent, exemplary, but contributes to the 11-table problem

Every meaningful action calls `writeAudit(projectId, userId, action, details)`:

- `validation:create` / `update` / `delete` / `restore` / `duplicate`
- `validation:bulk-update` / `validation:bulk-from-requirements`
- `validation:sign-off` / `validation:sign-off-revoke`
- `validation:evidence-attach` / `validation:evidence-upload` / `validation:evidence-detach`
- `validation:link-requirement` / `validation:unlink-requirement`
- `validation:comment-create` / `validation:comment-update` / `validation:comment-delete`
- `validation:baseline-create` / `validation:baseline-delete`
- `validation:settings-update`
- `validation:suspect-ack`

This is the **richest single-module audit coverage** in the backend. Twenty distinct action types, all writing to the central `AuditLog` table (not a per-module audit table). Cross-cutting refactor #6 in `gap-summary.md` ("eleven audit tables → one universal provenance log") would point at this module as the prototype to emulate — the Validation module already uses the universal `AuditLog`. Other modules that ship their own audit tables (`VerAuditEvent`, `TaskAuditLog`, `CertActivityLogEntry`, `CertReviewLogEntry`, `InventoryAuditLog`, `SavedViewAuditEvent`, etc.) are the outliers.

**One nit:** the `details` field is `String?` (raw JSON-encoded) rather than `Json`. This is a schema-wide choice (`AuditLog.details` is shared) and the Activity page already accepts the cost — but a typed `Json` column would let `listActivity` index/query the details server-side instead of doing a string `JSON.parse` loop per row.

---

## 9. Provenance schema — entirely absent

Per `ai-ready-vision.md` §6.1 and `gap-summary.md` #5, `Parameter` is the only model carrying the provenance lattice (`authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification`).

`ValidationItem` has **none of these columns**. `ValidationSignOff` has none. `ValidationComment` has none. `ValidationBaseline` has none.

Today the module has zero AI feature points exposed — there is no "Draft validation criteria from a requirement" action over MCP, no auto-suggest of acceptance criteria from acceptanceCriteria text (other than the local-only `suggestCriteria.ts` utility used inside the drawer), no AI-extracted evidence parsing on uploaded PDFs.

When AI features land — and they must, per `vision-and-usp.md` §7 and `ai-ready-vision.md` §9.1 — the schema needs the provenance lattice in place first. **The pattern from `Parameter` should be lifted into a Prisma mixin or extension table and applied to `ValidationItem` and `ValidationSignOff` before any AI-touch endpoint is added.** Cross-cutting refactor #1, mandatory before any AI feature ships.

---

## 10. Authority and access control

- `authenticateToken` (JWT) — applied at router-level.
- `requireProjectMember` — applied to every `/projects/:projectId/*` route.
- `requireProjectOwnerOrAdmin` — applied to `PUT /projects/:projectId/settings` only.
- `signerUserId !== createdById` — service-level enforcement in `signOff` (line 1209).

**Gap:** the sign-off endpoint does not check that the signer holds the `Validation Approver` engineering role on the project. The role is upserted at boot and referenced in copy but has no runtime enforcement. Any project member who is not the creator can sign.

**Gap:** `unlinkRequirement` / `detachEvidence` / `deleteBaseline` are open to any project member. A regulator would expect deletion of evidence on a signed-off item to be restricted to the project owner or an Auditor role with explicit authority. Same surface as the CCB role gap flagged in `gap-summary.md` cross-cutting #5.

---

## 11. Critical-path observations for the cross-cutting append

Three findings rise to package-spanning relevance and should be appended to `cross-cutting.md`:

1. **The append-only-with-supersession pattern in `ValidationSignOff` is the correct primitive for the universal `SignatureEvent`.** Lift this schema (supersededBy chain, append-only invariant, free-text role label promoted to a controlled vocabulary) into the platform.
2. **The Validation module's polymorphic reuse of `VerEvidenceLink` is the correct pattern for cross-module evidence attachment.** Document and propagate.
3. **The Validation module's exclusive use of the central `AuditLog` table — not a private audit table — is the correct pattern for the universal provenance log.** Document and propagate.
