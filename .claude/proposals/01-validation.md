# Proposal — Validation Page (v2, post-critique)

**Status:** v2 — awaiting user approval
**Cycle:** BA scope → Tech survey → v1 draft → PM critique → **v2 (THIS)** → User gate → branch + implement
**Base branch:** `improve-params-page` → new `feature/validation-page`
**Module flag:** `validation` (currently in `complete.json` only — see §15 R4)

> **What changed in v2:** scope cut to a true MVP (5–6 days, not 8–10); 3 tables instead of 5; styling decision pinned to Tailwind (mirror Verification, not `pv-*`); JWT email sign-off deferred to v1.1; permissions matrix, audit trail, security hardening, polymorphic-link gotchas, empty-state, and bulk-from-requirements added.

---

## 1. Purpose

Validation gives Systems Engineers, Validation Engineers, Product Owners and stakeholder representatives a structured place to confirm the delivered system meets actual stakeholder needs ("are we building the right thing"), distinct from Verification ("are we building the thing right"). v1 lets a small team plan validation activities, capture evidence, and obtain logged-in sign-off. v1.1 adds the email sign-off flow, runs/coverage/traceability tabs, DOCX report, Project Landing widget, AI suggestions, and templates.

## 2. Boundary vs Verification

| Validation (NEW) | Verification (existing) |
|---|---|
| Stakeholder needs / use cases | Low-level requirements |
| DEMONSTRATION, OPERATIONAL_TEST, SIMULATION, ANALYSIS, **STAKEHOLDER_ACCEPTANCE** | TEST/ANALYSIS/INSPECTION/REVIEW (regulatory MoC 0–8) |
| "Pilots can complete approach in <2 min" | "Component returns 200 OK in <100 ms" |
| Stakeholder sign-off ledger | Pass/Fail per test case + reviewer sign-off |
| Field-trial evidence, demo videos, simulator logs | HIL/SIL bench logs, automated test reports |

**Rule of thumb:** Validation answers to a stakeholder; Verification answers to a requirement.

> Renamed `STAKEHOLDER_REVIEW` → `STAKEHOLDER_ACCEPTANCE` to avoid collision with `VerMoc.REVIEW`.

### Boundary-clarity UX (must ship in v1)
- **First-visit dismissible banner**: "Validation answers to a stakeholder. Verification answers to a requirement." Stored in `localStorage` key `validation:onboarding-dismissed`.
- **Empty-state CTA** on the Items list links to Verification with copy: _"Looking to verify a low-level requirement? Use Verification."_
- **Method-warning tooltip** when user picks `ANALYSIS`: _"If you're confirming a requirement, consider a Verification test case instead."_

## 3. v1 user journeys (ONLY these — others deferred)

### J1 — Plan validation against a stakeholder need
SE clicks **New Validation Item**. Picks method (DEMO / OPS_TEST / SIM / ANALYSIS / STAKEHOLDER_ACCEPTANCE). Writes acceptance criteria as plain-language bullets (each becomes a `ValidationCheck`). Sets target milestone (PDR / CDR / FAT / SAT / EIS). Optionally links to one or more `Requirement` IDs. Status: **PLANNED**.

### J2 — Bulk-create from requirements (innovation: needed day one to populate the page)
On Requirements page, select N rows → "Create Validation Items". For each requirement: validation item is pre-filled with title, method=DEMONSTRATION, criteria seeded from `acceptanceCriteria` field. User reviews + saves. _The proposal cannot ship without this — empty page on day one is unusable._

### J3 — Capture evidence + outcome
On the item drawer, drag-drop a video / screenshot / sim log. File goes to `/uploads/validation/<itemId>/`. Records a `VerEvidence` row + a `VerEvidenceLink` with `linkedEntityType='ValidationItem'`. User marks each criterion **MET / PARTIAL / NOT_MET** with notes. When all criteria are MET, status moves to **EXECUTED** automatically.

### J4 — Logged-in sign-off (v1)
Project member with `ValidationApprover` engineering role (new) opens an EXECUTED item, clicks **Sign off**, types name + comment + clicks confirm. Row written to `ValidationSignOff` (immutable; updates create new rows marking previous as superseded). Status moves to **VALIDATED**.

> JWT email sign-off → **v1.1**. v1 ships login-only.

### J5 — CSV export
"Export" → CSV of items + criteria + outcomes + sign-offs for a milestone filter. _DOCX report is v1.1._

> Failed-validation → CR raise; Coverage Matrix; Traceability tab; Tree drag-from-stakeholder-need; AI suggestions; templates → **v1.1**.

## 4. Data model — 3 tables (was 5)

```prisma
model ValidationItem {
  id                String   @id @default(uuid())
  projectId         String
  key               String   // VAL-001, atomic allocator per project
  title             String
  description       String?  @db.Text
  methodType        ValidationMethodType  // enum below
  targetMilestone   ValidationMilestone   // enum: PDR|CDR|FAT|SAT|EIS|OTHER
  status            ValidationStatus      // PLANNED|EXECUTED|VALIDATED|BLOCKED|OBSOLETE
  ownerUserId       String?
  // criteria stored INLINE as Json (array of {id, text, outcome, notes, orderIndex})
  // - keeps schema lean; no separate ValidationCheck table for v1
  // - bumped to a real table in v1.1 if/when we need per-criterion runs
  criteria          Json     @default("[]")
  // soft-delete (matches Requirements pattern)
  deletedAt         DateTime?
  deletedById       String?
  deleteReason      String?
  restoredAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdById       String
  // relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  signOffs          ValidationSignOff[]
  // many-to-many to existing Requirement via TraceLink (viewpoint='stakeholder', linkType='validates')
  // many-to-many to evidence via VerEvidenceLink (linkedEntityType='ValidationItem')
  @@index([projectId, status])
  @@index([projectId, deletedAt])
  @@unique([projectId, key])
}

model ValidationSignOff {
  id                String   @id @default(uuid())
  validationItemId  String
  signerUserId      String
  signerRoleLabel   String   // e.g. "Customer Operations Lead"
  signedAt          DateTime @default(now())
  comment           String?  @db.Text
  // immutability — no UPDATE; revocation creates a new row + sets supersededById
  supersededById    String?  @unique
  supersededBy      ValidationSignOff? @relation("SignOffSupersession", fields: [supersededById], references: [id])
  superseded        ValidationSignOff? @relation("SignOffSupersession")
  validationItem    ValidationItem @relation(fields: [validationItemId], references: [id], onDelete: Cascade)
  signer            User     @relation(fields: [signerUserId], references: [id])
  @@index([validationItemId])
}

// AuditLog rows (existing model) record every ValidationItem mutation:
// entityType='ValidationItem', entityId=item.id, action='CREATE|UPDATE|STATUS_CHANGE|DELETE|RESTORE'
```

```prisma
enum ValidationMethodType {
  DEMONSTRATION
  OPERATIONAL_TEST
  SIMULATION
  ANALYSIS
  STAKEHOLDER_ACCEPTANCE
}

enum ValidationMilestone {
  PDR
  CDR
  FAT
  SAT
  EIS
  OTHER
}

enum ValidationStatus {
  PLANNED
  EXECUTED
  VALIDATED
  BLOCKED
  OBSOLETE
}
```

### Decisions
- **No `ValidationFolder`** — v1 groups by `methodType` and `targetMilestone` filters only. Adopt a real folder table in v1.1 if users ask.
- **Criteria as inline JSON** — kills 2 tables (criterion + run-result) for v1. Migration path to a real table in v1.1 is straightforward.
- **No optimistic-lock `version`** — premature; use `updatedAt` for staleness if needed.
- **`VerEvidenceLink.linkedEntityType` confirmed `String`** in `schema.prisma` (not a Prisma `@enum`) — net-zero schema change to add `'ValidationItem'` as a value.
- **Cascade strategy for evidence**: `ValidationItem.onDelete: Cascade` cascades to `ValidationSignOff`. `VerEvidenceLink` rows pointing at a deleted ValidationItem become orphaned strings — handled by a daily GC in `cleanup.service.ts` (extend existing service; no new scheduler).
- **Composite index on `VerEvidenceLink(linkedEntityType, linkedEntityId)`** — added in same migration. _Critical: without it, evidence queries become table scans once we have ~10k rows._
- **Zod enum at controller layer** for `linkedEntityType` to recover compile-time safety.

## 5. Permissions matrix

| Action | Viewer | Validation Engineer | Validation Approver | Project Owner | Admin |
|---|---|---|---|---|---|
| List items / view detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create item / edit / delete | – | ✓ | – | ✓ | ✓ |
| Record outcome on criteria / drop evidence | – | ✓ | – | ✓ | ✓ |
| Sign off (status → VALIDATED) | – | – | ✓ (and ≠ author) | ✓ (and ≠ author) | ✓ |
| Restore soft-deleted item | – | – | – | ✓ | ✓ |
| Export CSV | ✓ | ✓ | ✓ | ✓ | ✓ |

> **CCB-style rule**: signer ≠ author of the item. Backend enforces. UI hides the **Sign off** button for the author.
> New engineering role `ValidationApprover` is seeded in `engineering-roles.seed.ts`.

## 6. Page composition (mirrors **Verification** Tailwind pattern, **not** `pv-*`)

> **Pinned styling decision** (was open): Validation uses Tailwind classes consistent with `VerificationLayoutPage.tsx` (its structural sibling). The Parameters reference taught us the visual language — drawers, frosted headers, action-button density, keyboard shortcuts — but the implementation uses Tailwind, not the `pv-*` design tokens. This keeps Validation visually consistent with Verification on the same lifecycle screen.

```
ValidationLayoutPage              (frontend/src/pages/Validation/)
├── header strip (title + tab strip flex border-b)
├── filter row (search + status + method + milestone + owner pills)
├── main: <Outlet/>
│    └── ValidationPage (default) — items table
└── drawer (slide-over, frosted header bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30)
     └── ValidationItemDetailDrawer — sections: Overview · Criteria · Evidence · Sign-offs · Audit
```

**Tabs (URL `?tab=`):** **Items** (only, in v1). Coverage / Sign-offs / Traceability tabs ship in v1.1.

### Required UX (to match Parameters parity)
- ⌘F focuses search box.
- ⌘K opens command palette (reuses `ParameterCommandPalette` pattern — copy + retarget).
- Unsaved-changes guard on drawer close (existing `useUnsavedChanges` hook).
- Bulk action dock when ≥1 item selected: **Set milestone**, **Delete**, **Export CSV**.
- Empty state: friendly art + "Create your first validation item" CTA + "Looking to verify a requirement? Go to Verification" link.

## 7. Backend surface (v1 only)

### Routes (under `/api/v1/`)
```
GET    /projects/:projectId/validation/items?status=&methodType=&milestone=&ownerId=&search=
POST   /projects/:projectId/validation/items
POST   /projects/:projectId/validation/items/from-requirements   (J2 bulk-from-requirements)
GET    /validation/items/:id
PUT    /validation/items/:id
DELETE /validation/items/:id            (soft delete)
POST   /validation/items/:id/restore

POST   /validation/items/:id/evidence    (multipart — reuses VerEvidence + Link)
GET    /validation/items/:id/evidence
DELETE /validation/items/:id/evidence/:linkId

POST   /validation/items/:id/sign-off    (logged-in user only; requires ValidationApprover or Project Owner; backend enforces signer≠author)
GET    /validation/items/:id/sign-offs
POST   /validation/items/:id/sign-off/:signOffId/revoke

GET    /projects/:projectId/validation/items.csv?...filters
```

### Files to create
```
backend/src/routes/validation.routes.ts
backend/src/controllers/validation.controller.ts
backend/src/services/validation.service.ts
backend/src/services/validationSignOff.service.ts
backend/src/__tests__/validation/validation.test.ts
backend/prisma/migrations/<ts>_add_validation_module/migration.sql
```

### Auth + audit
- All routes go through `authenticateToken`.
- Mutations use `requireProjectMember` middleware.
- Sign-off enforces signer ≠ author + role check in service layer.
- **Every mutation writes an `AuditLog` row** (`entityType='ValidationItem'` or `'ValidationSignOff'`, action, actorUserId, beforeJson, afterJson).

### Deferred to v1.1 (security-sensitive)
- `POST /validation/items/:id/sign-off-requests` (mints email JWT)
- `POST /validation/sign-off-tokens/:token/sign` (PUBLIC route)
- DOCX report generator
- Coverage matrix endpoint

## 8. Frontend surface (v1)

### Files to create
```
frontend/src/pages/Validation/
  ValidationLayoutPage.tsx
  ValidationPage.tsx                       (replaces 30-LOC placeholder)
  ValidationSettingsPage.tsx               (just role assignment for now)
frontend/src/components/validation/
  ValidationTable.tsx
  ValidationItemDetailDrawer.tsx
  CreateValidationItemModal.tsx
  CreateFromRequirementsModal.tsx          (J2)
  ValidationCriteriaEditor.tsx
  ValidationEvidenceList.tsx
  ValidationSignOffSection.tsx
  ValidationFilterBar.tsx
  ValidationOnboardingBanner.tsx
frontend/src/services/validation.service.ts
```

### Routes — replace `App.tsx:163`
```tsx
<Route path="projects/:projectId/validation" element={
  <FeatureGuard moduleId="validation"><ValidationLayoutPage/></FeatureGuard>
}>
  <Route index element={<ValidationPage/>}/>
  <Route path="settings" element={<ValidationSettingsPage/>}/>
</Route>
```

### Feature flag — DECISION REQUESTED
- Currently `validation` is in `complete.json` only.
- **Recommend**: also add to `advanced.json`. V&V is core to medium-team workflows.
- _User to confirm in approval message._

## 9. Integration touchpoints (v1)

- **Requirements** — Requirement detail drawer gets a thin "Validation" section listing linked ValidationItems (read-only).
- **Stakeholder Roles** — `ValidationApprover` engineering role seeded.
- **Verification** — none in v1 (no `linkedVerTestRunId` yet — defer to v1.1).
- **Safety** — `SafetyLinkPanel` reused inside the drawer (DAL/ASIL inherited from linked requirements).
- **ChangeRequests** — none in v1; "Raise CR from failed validation" defers to v1.1.
- **AuditLog** — every item + sign-off mutation logged.
- **MEMORY.md** — index entry added on merge.
- **Help docs** — `docs/user-manual/NN-validation.md` (new, follows `_template.md`).

## 10. v1 acceptance criteria (Definition of Done)

- [ ] Migration applies cleanly; no existing data affected; composite index on `VerEvidenceLink(linkedEntityType, linkedEntityId)` present.
- [ ] CRUD for items + criteria + evidence works through the page.
- [ ] Bulk "Create from selected requirements" works from Requirements page.
- [ ] Logged-in sign-off works; signer ≠ author enforced; revocation works.
- [ ] Filter by status/method/milestone/owner; ⌘F focuses search; bulk dock works.
- [ ] First-visit onboarding banner shows once and dismisses.
- [ ] Empty state renders with CTA + cross-link to Verification.
- [ ] CSV export works.
- [ ] Backend Vitest: 401 + 403 (signer=author) + happy-path CRUD + sign-off + bulk-from-requirements + soft-delete/restore.
- [ ] Frontend Playwright spec `23-validation.spec.ts`: page load, create item, edit criteria, drag-drop evidence, sign-off, bulk-from-requirements, export CSV.
- [ ] `cd frontend && npm run lint && npx tsc --noEmit` clean.
- [ ] Audit log rows verifiable via Admin → Audit tab.
- [ ] `MEMORY.md` index gets one line.
- [ ] User manual page added (`docs/user-manual/NN-validation.md`).

## 11. Out of scope (v1)

- JWT email sign-off (v1.1)
- Validation Runs as separate table (v1.1 — currently inline in `criteria` JSON)
- Coverage Matrix tab (v1.1)
- Traceability tab (v1.1)
- DOCX Validation Report (v1.1)
- Project Landing coverage widget (v1.1)
- AI-suggested criteria (v1.1, after confirming `aiInvocation` reuse)
- Domain templates (v1.1)
- Drag-from-stakeholder-need to tree (needs Stakeholder table — separate effort)
- Field-trial telemetry, surveys, multi-tenant, crypto sign, mobile.

## 12. Innovation hooks — kept vs deferred

| # | Innovation | v1? | Why |
|---|---|---|---|
| 1 | One-click email JWT sign-off | **v1.1** | Security review needed; high risk for week 1 |
| 2 | Drag stakeholder-need → tree | **v1.1** | Needs Stakeholder table |
| 3 | AI-suggested acceptance criteria | **v1.1** | Cheap but unproven `aiInvocation` reuse — verify first |
| 4 | Drag-drop demo evidence | **✓ v1** | `VerEvidence` already supports it |
| 5 | Pre-built domain templates | **v1.1** | Data-only; quick add later |
| 6 | Project Landing coverage chip | **v1.1** | Trivial once endpoint exists |
| 7 | **NEW: Bulk-from-requirements** | **✓ v1** | Only realistic way to populate the page on day one |

## 13. Effort estimate (revised, single dev)

| Phase | Estimate |
|---|---|
| Backend: schema + migration + 2 services + AuditLog wiring + Vitest | 2.5 d |
| Frontend: layout + page + drawer + 3 modals + filter bar + service + onboarding banner | 3 d |
| Bulk-from-requirements flow (FE+BE wiring) | 0.5 d |
| Playwright spec + a11y + lint + manual test | 1 d |
| **Total** | **~7 days** |

> Slacks have been left for unknown-unknowns (DOCX, JWT, AI) by deferring them. v1.1 is its own 5–7 day cycle.

## 14. Risks remaining

| # | Item | Mitigation |
|---|---|---|
| R1 | Polymorphic `VerEvidenceLink` cascade leaves orphans on item delete | Daily GC in existing `cleanup.service.ts`; composite index added |
| R2 | Stakeholder is `String[]` — can't deeply link sign-offs to a "stakeholder entity" | v1 sign-off is by `User`; freetext `signerRoleLabel`. Stakeholder table is its own initiative. |
| R3 | Boundary confusion (Validation vs Verification) | Onboarding banner + empty-state copy + method-warning tooltip |
| R4 | `validation` module in `advanced.json`? | **Decision pending** — recommended yes |
| R5 | GDPR for IP/UA recording (v1.1 sign-off email) | Not in v1; addressed when JWT flow lands |

## 15. Decisions needed from user

1. ✅ Approve scope cut (drop runs/coverage/traceability/DOCX/widget/AI/templates/email-signoff to v1.1)?
2. ✅ Approve adding `validation` to `advanced.json`?
3. ✅ Branch off `improve-params-page` (vs from `master` after merging it back first)?
4. ✅ Single PR with backend+frontend, or split (backend PR first, then frontend PR)?

---

## Cycle log

- 2026-05-10 — BA scope produced (agent a934286c)
- 2026-05-10 — Tech surface produced (agent a3a3c63c)
- 2026-05-10 — Proposal v1 written
- 2026-05-10 — PM/architect critique (agent af322af2) — 15 ranked recommendations
- 2026-05-10 — **Proposal v2** addresses all 15
- _next_: user approval gate → branch + implement → final review → PR
