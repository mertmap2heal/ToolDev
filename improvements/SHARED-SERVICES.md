# Shared Services — Reuse, Never Reinvent

Canonical doctrine for cross-cutting services that every module consumes: comments, attachments, activity feeds, audit log, subscriptions, signatures, baselines, traceability, deep-links, notifications, tags, saved views, and the cert-relevant primitives that R-Wave introduces (provenance, signature event, baseline root, AI invocation link).

This document is paired with `AGENTIC-WORKFLOW.md` §2.2 (Architect) and §2.5 (Reviewer). Both roles enforce it.

## 1. The rule

> **When adding a feature to module M, search for an existing service S that already performs that function for another module N. If S exists, reuse it via M's `entityType`. If S does not exist and the function is cross-module by nature (comments, audit, attachments, sign-off, baseline, evidence, subscription, traceability), build it as a polymorphic shared service first, then consume from M.**

Module-private duplicates of any cross-module concern are forbidden. A new `MComment`, `MAttachment`, `MAuditLog`, `MSubscription`, `MSignOff`, `MBaseline` table is a code-review reject.

## 2. Why this exists

Per Phase 2 reviews and `_shared/cross-cutting.md`:

- **11 separate audit tables** today (gap-summary #6). Auditors accept the state; engineers will not maintain it. Future module #15 must not add the 12th.
- **5 inconsistent baseline patterns** (`Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`). The "first-class baseline diff" promise in `competitor-matrix.md` §2 is incoherent until one primitive snapshots all kinds.
- **3 sign-off stories** (`CertSignOff`, `ValidationSignOff`, implicit `RequirementReview`). Customers see three different sign-off UX on day one.
- **Parallel comment tables** (`IssueComment`, `RequirementComment`, `TaskComment`, `ValidationComment`). Four copies of the same CRUD. Four copies of mention parsing. Four copies of edit history. Four copies of @-mention notification.
- **Parallel subscription tables** (`IssueSubscription`, `RequirementSubscription`). Two copies of follow + last-notified.
- **Parallel attachment tables** (`RequirementAttachment`, `IssueAttachment`, `TaskAttachment`, `ChangeRequestAttachment`, `InventoryAttachment`). Five copies of upload + presign + size limit.

Every duplicate is a maintenance tax + drift surface + buyer-visible inconsistency. The Architect's first job is to refuse new duplicates and the Reviewer's first job is to catch the ones that slip through.

## 3. Canonical service catalogue

### 3.1 Backend — Prisma models

| Concern | Canonical model | Polymorphism | Status |
|---|---|---|---|
| Generic event audit | `AuditLog` | `entity` (string) + `entityId` + `action` (`<module>:<kebab-verb>`) + `details Json` | **Reference impl: Validation (20 typed actions), Stakeholders (2). 9 outliers to migrate per R-8.** |
| AI-participation provenance | Provenance mixin (R-1) on every cert-relevant table | Inline columns — not a separate table | **Reference impl: Parameter. 23 tables pending migration per R-1.** |
| Signature event | `SignatureEvent` (R-3, future) | `linkedEntityType` / `linkedEntityId` / `linkedBaselineId` | **Reference impl pattern: `ValidationSignOff` (cleanest, `supersededById` chain). R-3 generalises.** |
| Baseline | `BaselineRoot` + kind-specific snapshot (R-4, future) | `kind ∈ {VER, CERT, PARAM, VALIDATION, CM}` | **Future R-4.** |
| AI invocation ↔ artefact join | `AiInvocationLink` (R-5, future) | `invocationId` × (`artefactType`, `artefactId`) | **Future R-5.** |
| Evidence link | `VerEvidence` + `VerEvidenceLink` | `linkedEntityType ∈ {TEST_RUN, TEST_CASE, ..., VALIDATION_ITEM, CERT_OBJECTIVE, ...}` | **Reference impl: Validation reuses via `linkedEntityType = 'ValidationItem'` (no parallel `ValidationEvidence` table). Pattern is right. Caveat: garbage-collect-on-detach is wrong for regulated artefacts — fix per validation cross-cut.** |
| Trace link | `TraceLink` | `sourceKind` + `sourceId` × `targetKind` + `targetId` (polymorphic strings, no FK) | **Reference impl. Polymorphic-strings trade-off accepted per inventory-models.md gap #5.** |
| Issue / cross-link | `IssueLink` | `linkedEntityType` × `linkedEntityId` | **Reference impl.** |
| Comments | (PROPOSED) `Comment` | `entityType` × `entityId` + `authorUserId` + `body` (TipTap JSON) + `editedAt` + `mentions String[]` | **Today: `IssueComment`, `RequirementComment`, `TaskComment`, `ValidationComment` — four duplicates. Migration ticket: SHR-1.** |
| Attachments | `Attachment` (top-level exists but unused) + per-module duplicates | `entityType` × `entityId` + `fileKey` + `size` + `mimeType` + `uploadedByUserId` | **Today: 5 duplicates. Migration ticket: SHR-2.** |
| Subscriptions | (PROPOSED) `Subscription` | `entityType` × `entityId` + `userId` + `lastNotifiedAt` | **Today: `IssueSubscription`, `RequirementSubscription`. Migration ticket: SHR-3.** |
| Tags / labels | `Tag` (global) | `projectId` × `name` + assigned via polymorphic join | **Today: `Tag` (good) + `IssueLabel` + `TaskTag` (duplicates). Migration ticket: SHR-4.** |
| Saved views / filters | `SavedView` + `SavedViewFolder` + `SavedViewRevision` + `SavedViewAuditEvent` | `scope` (user / project / org) × `viewpoint` | **Reference impl. Reuse for every list page.** |
| Notifications | `Notification` | `userId` × `type` + `payload Json` | **Today: one type (`project_invitation`). Expand to 8-12 types per AGENTIC-WORKFLOW + AP-N6.** |
| Activity feed (real-time) | `ActivityFeed` + Socket.IO | Reads central `AuditLog`; emits per project | **Partial: lives in `realtime/realtime.ts`. Cert-event stream pending.** |
| Engineering role | `EngineeringRole` + `ProjectUserEngineeringRole` | seeded global catalogue + per-project assignment | **Reference impl. R-7 promotes the seed + adds `requireEngineeringRole` middleware.** |
| Definitions / glossary | `DefinitionEntry` | per-project | **Reference impl. Reuse for term-list in any module.** |

### 3.2 Frontend — components, hooks, services

| Concern | Canonical component / hook / service | Path | Status |
|---|---|---|---|
| Comments on entity | `<EntityComments entityType entityId />` | (PROPOSED) `frontend/src/components/common/EntityComments.tsx` | **Today: per-module `*CommentList.tsx`. Migration follows SHR-1.** |
| Activity feed for entity | `<EntityActivity entityType entityId />` | (PROPOSED) `frontend/src/components/common/EntityActivity.tsx` | **Reads `AuditLog` filtered by `entity`+`entityId`. Validation `ActivityPage` is reference impl for project-wide variant.** |
| Attachments list | `<AttachmentList entityType entityId />` | (PROPOSED) `frontend/src/components/common/AttachmentList.tsx` | **Migration follows SHR-2.** |
| Subscribe button | `<SubscribeButton entityType entityId />` | (PROPOSED) `frontend/src/components/common/SubscribeButton.tsx` | **Migration follows SHR-3.** |
| Mention input | `<MentionInput />` (TipTap @-mention extension) | (PROPOSED) `frontend/src/components/common/MentionInput.tsx` | **Today: `ParameterRefNode` already exists for `[[param_name]]` syntax in TipTap. Extend pattern.** |
| Detail drawer | `<DetailDrawer>` primitive | (PROPOSED) `frontend/src/components/ui/Drawer.tsx` (roadmap.md Phase 3) | **Today: ad-hoc per module. Pattern in `kb/react-typescript.md` "Drawer Styling Conventions".** |
| Canonical object panel | `<CanonicalObjectPanel>` (header + body + sections + history) | (PROPOSED) `frontend/src/components/ui/CanonicalObjectPanel.tsx` | **Spec: `design-system.md` §6.1.** |
| List table | `<EntityTable>` | (PROPOSED) `frontend/src/components/ui/Table.tsx` | **Spec: `design-system.md` §6.2.** |
| Empty state | `<EmptyState>` opinionated | `frontend/src/components/ui/EmptyState.tsx` (roadmap.md Phase 3) | |
| Loading skeleton | `<Skeleton>` content-shape, not spinner | `frontend/src/components/ui/Skeleton.tsx` | |
| Owner picker | `<OwnerPicker requiredRoleNames={[...]} />` | (PROPOSED) `frontend/src/components/common/OwnerPicker.tsx` | **Cross-cut `Owner-on-every-artefact requires shared <OwnerPicker>`. Fed by `ProjectUserEngineeringRole`.** |
| Sign-off button | `<SignOffButton entityType entityId meaningCode />` | (PROPOSED) `frontend/src/components/common/SignOffButton.tsx` | **Calls `/auth/reauth` (R-2) → `SignatureEvent` write (R-3).** |
| Version diff view | `<VersionDiff aVersionId bVersionId />` | (PROPOSED) `frontend/src/components/common/VersionDiff.tsx` | **Closes gap-summary #7. Reuse across Param / Req / Cert baselines.** |
| Objective completion matrix | `<ObjectiveCompletionMatrix standard dalFilter />` | `frontend/src/components/common/ObjectiveCompletionMatrix.tsx` (exists) | **Reference impl: Requirements dashboard (NX-7 / PR #461). Fed by `GET /certification/:projectId/objective-matrix`. Reused across 5 module dashboards — the other 4 (Verification / Certification / Validation / project landing) consume it per NX-7-followup-A..D; do not reinvent.** |
| Bulk-edit wizard | `<BulkEditDrawer>` polymorphic 3-step (Fields → Values → Review) wizard | `frontend/src/components/common/BulkEditDrawer.tsx` | **Reference impl: Requirements (NX-4 / PR #448). Polymorphic over the noun; pairs with the generic `/<noun-plural>/:projectId/bulk-update` convention. Other nouns consume it — do not reinvent.** |
| Keyboard shortcut hook | `useKeyboardShortcuts(scope, bindings)` + `<KeyboardShortcutsProvider>` | (PROPOSED) `frontend/src/hooks/useKeyboardShortcuts.ts` | **Cross-cut `Keyboard-first shortcuts are absent`. Tasks pilot.** |
| Deep-link adapter | `buildDeepLink({ type, id, projectId })` | `frontend/src/linkage/buildDeepLink.ts` (exists) | **Reference impl. 18 adapters today. Add `validation.ts` per V-Q5.** |
| Saved view picker | `<SavedViewPicker entityType />` | (PROPOSED — exists scattered) | **Reference impl: Validation. Consolidate.** |
| Toast / notification UI | `<Toast>` + `useToast()` | (PROPOSED) `frontend/src/components/ui/Toast.tsx` (roadmap.md Phase 7) | |

### 3.3 Backend services

| Service | File | Contract |
|---|---|---|
| Comments | `backend/src/services/comment.service.ts` (PROPOSED) | `listComments(entityType, entityId)`, `createComment(...)`, `editComment(...)`, `deleteComment(...)`. Writes to `Comment` table + audit. |
| Attachments | `backend/src/services/attachment.service.ts` (PROPOSED) | `listAttachments`, `uploadAttachment`, `deleteAttachment`, presign. |
| Audit | `backend/src/services/audit.service.ts` (writeAudit helper exists in `validation.service.ts:188-197`) | `writeAudit(projectId, userId, '<module>:<kebab-verb>', detailsJson)` — central pattern documented in cross-cut. |
| Provenance middleware | `backend/src/middleware/provenance.middleware.ts` (PROPOSED, R-1) | Attaches `authorType`/`authorAiModel`/etc to every write. |
| Signature | `backend/src/services/signature.service.ts` (PROPOSED, R-3) | `signEntity(...)` — reauth → write `SignatureEvent` → audit. |
| Reauth | `backend/src/services/auth.service.ts` `+ POST /auth/reauth` (R-2) | Returns 60-second `X-Reauth-Token`. |
| Subscription | `backend/src/services/subscription.service.ts` (PROPOSED) | `subscribe(userId, entityType, entityId)` etc. |
| Notification | `backend/src/services/notification.service.ts` (PROPOSED) | Multi-type emit + dispatch. |
| Traceability | `backend/src/services/traceability.service.ts` (exists) | Polymorphic `TraceLink` CRUD + suspect propagation. |
| Baseline | `backend/src/services/baseline.service.ts` (PROPOSED, R-4) | Kind-agnostic create/freeze/compare. |
| Evidence | `backend/src/services/evidence.service.ts` (PROPOSED) | Polymorphic via `VerEvidenceLink`. Wraps the upload + parser pipeline per ai-ready-vision.md §7.4. |
| Search | `backend/src/services/search.service.ts` (via `search.routes.ts`) | Cross-module text + filter search. |
| Export | `backend/src/services/exportJob.service.ts` + format-specific (`exportXlsx`, `exportPdf`, `exportDocx`, `exportReqif`) | Single export job queue per project. |

## 4. The reuse decision tree

When a ticket introduces a feature, the Architect walks this tree:

```
Q1. Is the feature already-built in another module?
     yes → Q2.   no → Q3.

Q2. Is the existing service polymorphic by entityType?
     yes → reuse with this module's entityType. STOP.
     no  → schedule a SHR-N migration ticket to make it polymorphic, then reuse. Ticket blocks this one if cert-relevant.

Q3. Is the feature cross-module by nature (comments, audit, attachments, sign-off, baseline, evidence, subscription, traceability, deep-link, search, export)?
     yes → build polymorphic from day one. Tag as SHR-N.
     no  → build module-private; document the boundary that makes it module-specific.
```

The Architect writes the answer into the architecture.md comment per `AGENTIC-WORKFLOW.md` §2.2 under a new required section **"Reuse audit"** (see §6 below).

## 5. Open SHR (Shared) migration tickets

These ride alongside R-Wave. They are scored, sequenced, and ticketed exactly like the per-package work in `improvements/<package>/tickets.md`. Listed in priority order.

| ID | Title | Touches | Effort | R-Wave dep |
|---|---|---|---|---|
| **SHR-1** | Unify comments into `Comment` polymorphic + `<EntityComments>` | `Issue`/`Requirement`/`Task`/`Validation` comment tables, all 4 list components | M | None |
| **SHR-2** | Unify attachments into `Attachment` polymorphic + `<AttachmentList>` | `Requirement`/`Issue`/`Task`/`ChangeRequest`/`Inventory` attachment tables | M | None |
| **SHR-3** | Unify subscriptions into `Subscription` polymorphic + `<SubscribeButton>` | `Issue`/`Requirement` subscription tables | S | None |
| **SHR-4** | Unify labels/tags into `Tag` polymorphic | `Tag`/`IssueLabel`/`TaskTag` | S | None |
| **SHR-5** | Extract `<EntityActivity>` reader for central `AuditLog` | Any module with an "activity" tab | S | Depends on R-8 first move (action-string convention) |
| **SHR-6** | Extract `<OwnerPicker requiredRoleNames>` | Requirements / Verification / Validation / Hazards / CRs | S | Depends on R-7 (EngineeringRole seed) |
| **SHR-7** | Extract `<SignOffButton>` calling `/auth/reauth` → `SignatureEvent` | Verification / Certification / Validation / CM | M | Depends on R-2 + R-3 |
| **SHR-8** | Extract `<VersionDiff>` | Parameter / Requirement / Baseline detail drawers | S | None (closes gap-summary #7) |
| **SHR-9** | Extract `<ObjectiveCompletionMatrix>` | Requirements / Verification / Certification / Validation dashboards + project landing | M | Depends on R-1 (provenance) — light enough that it can ship in parallel |
| **SHR-10** | Generic `useKeyboardShortcuts` + `<KeyboardShortcutsProvider>` | Every list page | S | None |
| **SHR-11** | Generic `<MentionInput />` extension | `<EntityComments>` consumer | S | Depends on SHR-1 |
| **SHR-12** | Expand `Notification` model + `<NotificationCenter>` | Currently only `project_invitation` type | M | None |

Each SHR ticket follows the AGENTIC-WORKFLOW pipeline like any other ticket — opens a GH issue, gets an Architect review, lands a PR. Cross-package: the Architect explicitly enumerates every consumer module + sequences the migration.

## 6. Enforcement in AGENTIC-WORKFLOW

The Architect and Reviewer roles in `AGENTIC-WORKFLOW.md` add specific reuse checks:

### 6.1 Architect — new required section "Reuse audit"

Added to §2.2 of AGENTIC-WORKFLOW.md as a mandatory part of `architecture.md`:

```
## Reuse audit

For each cross-module concern the ticket touches (comments, attachments,
audit, sign-off, baseline, evidence, subscription, traceability,
deep-link, search, export, owner, version-diff, objective-matrix,
keyboard shortcuts, mentions, notifications):

  - <Concern>: <reuse | extract-then-reuse | build-polymorphic-from-day-one>
    Canonical service: <path or "(PROPOSED)" with SHR-N ticket ref>
    Why this answer: <one sentence>

If any concern answers "build-polymorphic-from-day-one", surface the
SHR-N ticket as a blocker or co-ticket.
```

The PM rejects the ticket if any cross-module concern has no entry. The Reviewer rejects the PR if the Architect's decision is not honoured.

### 6.2 Reviewer — added rule-conformance bullet

Added to §2.5 of AGENTIC-WORKFLOW.md under "Rule conformance":

```
- Shared-service reuse (per improvements/SHARED-SERVICES.md):
  - No module-private duplicate of a canonical concern was introduced.
  - If a duplicate was unavoidable, the Architect's reuse audit
    explicitly documented why and the SHR-N migration ticket exists.
```

Verdict-level concern: a PR that reinvents a shared service is `Request changes`, not a warning.

### 6.3 Dev — pre-flight checklist

Added to §2.4 of AGENTIC-WORKFLOW.md under "Constraints":

```
- Before introducing a new `*.service.ts` or `*Comment` / `*Attachment`
  / `*Subscription` / `*AuditLog` / `*SignOff` / `*Baseline` Prisma
  model, search SHARED-SERVICES.md §3 for the canonical equivalent.
  If found, consume it. If absent and the concern is cross-module by
  nature, open a SHR-N ticket and block this ticket on it.
```

## 7. Anti-patterns the doctrine refuses

- **`MComment` / `MAttachment` / `MAuditLog` / `MSubscription` / `MSignOff` / `MBaseline`** for any new module M. The 12th audit table is rejected. The 5th attachment table is rejected. The 4th subscription table is rejected.
- **Per-module comment list component** that duplicates rendering, mention parsing, edit history. Use `<EntityComments entityType entityId />`.
- **Per-module activity tab** that reads a private audit table. Use `<EntityActivity>` reading central `AuditLog`.
- **Hard-coded `/projects/:id/<entity>?open=<id>` URLs**. Use `buildDeepLink`. New entity types add an adapter to `frontend/src/linkage/`.
- **Re-implementing TipTap mentions** per module. One `<MentionInput>`.
- **Per-module keyboard handler** registered ad hoc. One `useKeyboardShortcuts` provider.
- **Custom sign-off ceremony** per module. One `<SignOffButton>` → `/auth/reauth` → `SignatureEvent`. No exceptions.
- **Bespoke "export to PDF/DOCX/Excel" implementations.** Use the central `ExportJob` queue + format services.

## 8. Migration cadence

The SHR backlog is sequenced alongside R-Wave per `ROADMAP-phase3.md`:

- SHR-1 + SHR-2 + SHR-3 + SHR-4 can ship independently of R-Wave. They are unblock-friendly.
- SHR-5 waits for R-8 first move.
- SHR-6 waits for R-7.
- SHR-7 waits for R-2 + R-3.
- SHR-8 + SHR-10 + SHR-12 are independent.

A package taking on its first significant SHR consumer (e.g., Validation already consumes central `AuditLog`) becomes the **reference implementation** for that concern. Subsequent module migrations follow the reference impl literally.

## 9. References

- `improvements/AGENTIC-WORKFLOW.md` — role enforcement points
- `improvements/_shared/cross-cutting.md` — observed duplicates with file:line citations
- `improvements/_shared/gap-summary.md` — cross-cutting refactors that touch this doctrine (#6 audit log, R-1..R-8)
- `improvements/ROADMAP-phase3.md` — R-Wave + SHR sequencing
- `improvements/design-system.md` §6 — canonical UI patterns (object panel, list, wizard)
- `.claude/kb/react-typescript.md` "Drawer Styling Conventions" — drawer pattern reference
- `.claude/kb/backend-patterns.md` — services + middleware + response shape
- `.claude/architecture.md` "Frontend patterns" — deep-link system + state management split
