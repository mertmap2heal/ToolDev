# Configuration Management — Tickets

Tickets are grouped by urgency and dependency. Each ticket cites a competitor capability or a measurable problem. None propose source-code edits — implementation belongs in commits.

Effort scale: **S** ≤1 day, **M** 1-5 days, **L** 1-2 weeks, **XL** 2+ weeks.
Priority: **P0** load-bearing for aerospace buyer credibility, **P1** competitive table-stakes, **P2** opinionated-default polish, **P3** nice-to-have.

---

## Section A — Quick wins (≤1 sprint, low schema impact)

### CM-Q1 · Wire the Compare tab to the live `compareBaselines` endpoint
**Priority:** P1 · **Effort:** S

**Problem.** The Compare tab (`frontend/src/modules/configuration-management/CompareTab.tsx`, 312 lines) runs an in-memory diff over mock baselines, while the backend's `compareBaselines` controller (`backend/src/controllers/baseline.controller.ts:572-784`, 212 lines) ships a rich field-level + link-level diff payload (`added[]`/`removed[]`/`modified[]`/`linksAdded[]`/`linksRemoved[]`/`linksSuspectChanged[]` with full requirement fields and a `previous` slot). Nobody calls it.

**Cited evidence.** `frontend.md` §11; Jama (item/set/project diff), Polarion (paragraph-level history), Codebeamer (Coverage Browser), DOORS Next (streams baseline diff) — every named competitor renders this UX.

**Acceptance.**
- The tab calls `GET /api/v1/baselines/:projectId/compare?baselineAId=...&baselineBId=...`.
- The dropdowns are populated from `GET /api/v1/baselines/:projectId`.
- The diff table renders the `added`/`removed`/`modified` arrays. The `modified` row shows side-by-side cell deltas using the existing `previous` payload.
- A new "Trace links" summary panel renders link counts (added/removed/suspect changed).
- The "CI vs CI" mode is left as a placeholder until `ConfigItem` versioning lands (see CM-N3) — disable the mode toggle with a `Pending ConfigItem schema` tooltip.

---

### CM-Q2 · Add `Project.strictMode` boolean and surface as project setting
**Priority:** P1 · **Effort:** S

**Problem.** `kb/configuration-management.md` repeatedly cites `Project.strictMode` as the regulated-customer enforcement switch. The column does not exist. Today the CM page stores the toggle in module-local reducer state with zero enforcement.

**Cited evidence.** `kb/configuration-management.md` §"strictMode rules"; `backend.md` §7; gap-summary.md cross-cutting refactor #5 (CCB roles + strictMode).

**Acceptance.**
- Prisma migration adds `Project.strictMode Boolean @default(false)`.
- New endpoint `PATCH /api/v1/projects/:projectId/strict-mode { strictMode: boolean }`, admin-only, audit-logged.
- Project settings page surfaces the toggle with a confirmation modal listing what enabling enforces.
- Configuration Management page's Access & Roles tab reads the project's actual `strictMode` (replace local state).
- Banner across CM screens: "Strict mode active — baseline approvals require two signers; CI mutations on locked baselines are rejected."

---

### CM-Q3 · Drop the Audit mode toggle until it has a defined behaviour
**Priority:** P3 · **Effort:** S

**Problem.** `AccessRolesTab.tsx:40-42` renders "Audit mode — extra confirmations" with no specification of what an "extra confirmation" is. The toggle has no backend effect and no documented UX.

**Cited evidence.** `design-system.md` §1 ("any team member can cite a screen and ask 'what evidence does this produce?' — if the answer is hand-wavy, the screen is wrong").

**Acceptance.**
- Remove the toggle from the Access & Roles tab.
- Remove `SET_AUDIT_MODE` from the reducer.
- Remove `auditMode` from `CMState`.
- If a behaviour is later defined (e.g. "reauth required on every CR approval, not just baseline approval"), reintroduce as a specific named flag.

---

### CM-Q4 · Replace fake actor names with real user IDs in mockData (interim)
**Priority:** P3 · **Effort:** S

**Problem.** `mockData.ts` uses two-letter actor names ("J. Smith", "A. Lee") and the reducer stores those in `state.auditLog[].actor` and `Baseline.createdBy`. When the schema lands and the page writes to the backend, the audit log gets meaningless strings instead of user IDs.

**Cited evidence.** `kb/backend-patterns.md` §"Authentication Middleware" — every protected route derives identity from `req.user!.userId`; never from a body field.

**Acceptance.**
- `mockData.ts` is removed once any tab is wired to live data (CM-Q1 already removes one consumer).
- The reducer's `addAudit` helper takes a `userId` not a `currentRole` enum.
- The role enum is preserved for permissions checks; the audit log records the resolved user ID.

---

### CM-Q5 · Remove or fix the placeholder export dialog on the Audit Trail tab
**Priority:** P2 · **Effort:** S

**Problem.** `AuditTrailTab.tsx:133-141` renders an "Export Audit Log" button that opens a placeholder modal saying "Export placeholder; no file generated." This is dead UX and a buyer-visible mock.

**Cited evidence.** `gap-summary.md` #2 ("one-command audit-package export"); design-system.md §1.

**Acceptance.**
- Either: wire the button to `POST /api/v1/export-jobs` with a CM-specific template (uses the existing export pipeline per `kb/documentation-model.md`).
- Or: remove the button until CM-L2 ships.

---

## Section B — Near-term schema additions (1-3 sprints, additive migrations)

### CM-N1 · Schema migration — `ConfigItem` table with provenance
**Priority:** P0 · **Effort:** L
**Status:** Shipped — NX-3 / Issue #443 / PR #444 / merge commit `d261330` (code commit `513aa69`)

**Problem.** The Configuration Item is the foundational primitive of IEEE 828-2012 §6.2 (Configuration identification). The frontend models 11 typed kinds (`types.ts:2-14`) with full schema design (`status`, `lockState`, `safetyCritical`, `dal`, `version`, `revision`, `tags`, polymorphic `linkedArtifacts`). The Prisma schema has zero of it. The Configuration Items tab (448 lines, the most polished tab) is 100% mock.

**Cited evidence.** `backend.md` §4 (schema sketch); `gap-summary.md` #8 (ConfigItem/Deviation/Waiver tables); `kb/configuration-management.md` §"CI lifecycle"; `ai-ready-vision.md` §6.1 (provenance lattice).

**Acceptance.**
- Prisma migration adds `ConfigItem` per `backend.md` §4 — columns: `id`, `projectId`, `ciKey`, `name`, `type`, `status`, `lockState`, `version`, `revision`, `ownerUserId`, `ownerName`, `safetyCritical`, `dal`, `tags`, `refType`, `refId`, eight provenance columns, `deletedAt`, `deletedById`, `createdAt`, `updatedAt`.
- Unique index `(projectId, ciKey)`. Indexes on `(projectId, type)`, `(projectId, status)`, `(projectId, deletedAt)`.
- New route file `backend/src/routes/configItems.routes.ts` with 9 endpoints: list, get, create, update, soft-delete, lock, unlock, link-source, search.
- New service `backend/src/services/configItem.service.ts` for the business logic (per `kb/backend-patterns.md` controller/service boundary).
- New frontend service `frontend/src/services/configItem.service.ts` consumed by `ConfigurationItemsTab` + `CIDetailDrawer` + `CreateCIModal`.
- Remove the `MOCK_CONFIGURATION_ITEMS` seed from `mockData.ts`.
- Backend integration tests: auth (401), happy path (200/201), missing-field (400), not-found (404), soft-delete-then-restore.
- Frontend e2e test added to a new `frontend/e2e/18-configuration-management.spec.ts` covering create / edit / soft-delete / lock-state-change.

---

### CM-N2 · Schema migration — `Deviation` and `Waiver` tables
**Priority:** P0 · **Effort:** M
**Status:** Shipped — NX-3 / Issue #443 / PR #444 / merge commit `d261330` (code commit `513aa69`)

**Problem.** Deviations and Waivers are first-class CM authorisations (per IEEE 828 + EIA-649-C §7.5 + ARP4754A §5.3) and have zero backend persistence. Approving a deviation against a safety-critical CI is currently a one-click affordance with no signer, no expiry, no audit trail beyond a session-local log entry.

**Cited evidence.** `backend.md` §4 (schema sketch); `kb/configuration-management.md` §"Deviations and waivers"; `design-review.md` §4 (review workflow); Polarion deviation workflow, Codebeamer deviation tracker.

**Acceptance.**
- Single `Deviation` table per `backend.md` §4 — column `type String` discriminates Deviation vs Waiver (avoid table-per-class; the columns are identical).
- Polymorphic `linkedConfigItemIds Json` (array of `{ itemType, itemId }`). When the universal polymorphic link table lands (cross-cutting), migrate to that.
- Route file `deviationsWaivers.routes.ts` with 6 endpoints (list, get, create, update, sign, close).
- Service + controller pair.
- `validUntil` field; daily scheduled job (extends `cleanup.service.ts`) generates an Issue tagged `cm:deviation-expiring` when `validUntil` is within 14 days.
- Frontend tab wired to the live endpoints; remove `MOCK_DEVIATIONS_WAIVERS` from `mockData.ts`.
- Integration tests covering create / approve / reject / expiry-job.

---

### CM-N3 · Schema migration — `CcbDecision` table joined to existing `ChangeRequest`
**Priority:** P0 · **Effort:** M
**Status:** Shipped — NX-3 / Issue #443 / PR #444 / merge commit `d261330` (code commit `513aa69`)

**Problem.** The frontend Changes tab models a CCB-aware change request (`safetyImpact`, `ccbLevel`, `impactedCIs[]`, `decisionBy`, `decisionAt`). The Prisma `ChangeRequest` model — designed for the Requirements module's CR flow — has none of those columns. Today the CM tab maintains a parallel mock CR concept.

**Cited evidence.** `frontend.md` §6; `backend.md` §3 (the Path B / `CcbDecision` proposal); `design-review.md` §1 (the eight-click workflow that should be one ceremony).

**Acceptance.**
- New `CcbDecision` table joined to `ChangeRequest` via `changeRequestId`. Columns: `id`, `projectId`, `changeRequestId`, `ccbLevel`, `safetyImpact`, `decision`, `decisionRationale`, `signedById`, `signedAt`, `meaningCode`, `impactedConfigItemIds Json`.
- Route file `ccbDecisions.routes.ts` with 5 endpoints (list-by-project, list-by-cr, create, sign, reject).
- CCB approval is now a transactional ceremony per `design-review.md` §1.3: one click in the drawer → reauth modal → on success, write `CcbDecision` + bump every impacted `ConfigItem` version + write a single audit log entry. No separate "Apply Version Updates" affordance — remove that button.
- The reducer's `APPLY_CR_VERSIONS` action becomes redundant; remove.
- Backward compatibility: the existing Requirements-module CR flow continues to operate without writing `CcbDecision` rows — only the CM-page-originated approvals create them.

---

### CM-N4 · Schema migration — `Release` and `ReleaseApproval` tables
**Priority:** P1 · **Effort:** M

**Problem.** The Releases tab (238 lines) renders the entire release manifest UX against a session-local store with no schema, no routes, no persistence.

**Cited evidence.** `frontend.md` §7; `backend.md` §4 (schema sketch); `kb/configuration-management.md` §"Baseline types" (Release row); EIA-649-C "Interchangeability" rules; competitor Codebeamer Release Workflow.

**Acceptance.**
- `Release` table per `backend.md` §4 — columns: `id`, `projectId`, `releaseKey`, `name`, `target`, `status`, `baselineId` (FK), `releaseNotes`, `createdAt`.
- `ReleaseApproval` join table — columns: `id`, `releaseId`, `roleLabel`, `signerUserId`, `signerName`, `signedAt`, `signatureEventId`.
- Route file `releases.routes.ts` with 6 endpoints (list, get, create, update, approve, deliver).
- Approval flow uses the universal `/auth/reauth` primitive (validation V-N1 dependency) and writes to `SignatureEvent` (cross-cutting refactor #3).
- Release notes accept Markdown rendered server-side with DOMPurify per `kb/documentation-model.md`.
- Remove `MOCK_RELEASES` from `mockData.ts`.

---

### CM-N5 · Seed CCB roles into `AdminRole` on first boot
**Priority:** P0 · **Effort:** S
**Status:** Closed — superseded by R-7 (`requireEngineeringRole` + the `CCB Member` engineering role). R-7 confirmed `AdminRole` is the wrong primitive for CCB-role gating: five of the six roles already exist in the `EngineeringRole` discipline catalogue, R-7 added the one missing `CCB Member` role and shipped the `seed-engineering-roles.ts` script + the `requireEngineeringRole(roleNames)` discipline gate (`AuditLog` 2026-05-16 closure). NX-3's CM sign-off ceremonies consume `requireEngineeringRole(['Configuration Manager', 'CCB Member', 'Safety Engineer'])` directly — there is no `seedCcbAdminRoles.ts`. `AdminRole` continues to gate API-call capability; `EngineeringRole` gates sign-off authorisation.

**Problem.** `kb/configuration-management.md` mandates six CCB roles (ConfigManager, SystemEngineer, VerificationEngineer, SafetyEngineer, CCBMember, Auditor). Today the frontend has a string-union enum (`CMRole` in `types.ts:174-180`) and a client-side permissions matrix (`constants.ts:179-195`). Neither is enforced.

**Cited evidence.** `kb/configuration-management.md` §"CCB"; `backend.md` §5; gap-summary.md cross-cutting refactor #5.

**Acceptance.**
- Seed script `backend/src/scripts/seedCcbAdminRoles.ts` creates six `AdminRole` rows with `companyKey='__default__'`.
- Each role's `defaultPermissions Json` payload encodes the 15-action matrix from `constants.ts:179-195` translated to the `PermissionMap` shape.
- The script is idempotent (skip if rows exist for that companyKey).
- The script is invoked from `start.ps1` after `prisma db push` and from any `setup.ps1` flow.
- CM controllers gate write actions via `requireAdminRole(['ConfigManager', 'CCBMember'])` (or the appropriate role set per action).
- Critical authorization rule: every endpoint that records a signer derives that signer from `req.user`, never from the request body (per the requirements cross-cut entry on the reviewer-response authorization gap).

---

### CM-N6 · Extend `BaselineItem` to polymorphic CI snapshot
**Priority:** P0 · **Effort:** M
**Status:** Shipped — NX-3 / Issue #443 / PR #444 (fix round, commit `ceea937`). The NX-3 Architecture review reshaped this ticket: the legacy `BaselineItem` is NOT extended. CM consumes R-4's already-polymorphic `BaselineRoot` / `BaselineRootItem` (`kind='CM'`, `linkedEntityType='ConfigItem'`), which delivers the polymorphic-CI-snapshot intent with zero migration and avoids a second competing baseline path. The code path ships as `backend/src/services/cmBaseline.service.ts` + `cmBaseline.controller.ts` (consuming `baseline.service.ts` — `createBaselineRoot` / `addBaselineItem` / `freezeBaselineRoot` / `getBaselineRoot` / `listBaselineRoots` / `compareBaselineRoots`, the legacy `BaselineItem` untouched) wired into the `config-items` route group (`POST/GET /:projectId/baselines`, `/:baselineId`, `/:baselineId/items`, `/:baselineId/freeze`, `/baselines/compare`). A ConfigItem can now be entered into a CM-kind baseline. The legacy `Baseline`/`BaselineItem` → `BaselineRoot` migration stays deferred to V-L2 / CM-L3.

**Problem.** `BaselineItem` snapshots only `requirementId`. The CM baseline concept must snapshot any `ConfigItem` (Software, Document, Parameter, Model, etc., not just Requirement).

**Cited evidence.** `frontend.md` §5; `backend.md` §2.

**Acceptance.**
- Migration adds `BaselineItem.itemType String` and `BaselineItem.itemId String`; backfills existing rows with `itemType='requirement'` and `itemId=requirementId`.
- `BaselineItem.requirementId` is preserved for one migration cycle as a computed alias for backward compatibility; eventually deprecated.
- `createBaseline` extends to accept `configItemIds[]` alongside the existing `requirementIds[]` / `componentIds[]` / `functionIds[]`.
- The compare endpoint renders the diff per-itemType.

---

### CM-N7 · Wire the Baselines tab to live `baselines.routes.ts`
**Priority:** P1 · **Effort:** M

**Problem.** The Baselines tab (300 lines) ignores the existing `Baseline` Prisma model and the 6 live endpoints, maintaining a parallel mock baseline concept with a structurally different type. Per `frontend.md` §5, the tab's `Baseline` type differs from the schema — `type` enum (`Functional|Allocated|Product`) vs `baselineType` String, `phase` enum (`SRR|PDR|CDR|QR|Certification`) vs `reviewType` String, etc.

**Cited evidence.** `frontend.md` §5; `design-review.md` §3 (baseline freeze ceremony).

**Acceptance.**
- Tab consumes `GET /api/v1/baselines/:projectId` (already exists).
- `BaselineWizard` writes via `POST /api/v1/baselines/:projectId` (already exists), passing `baselineType` / `reviewType` / `fdAL` / `configurationAuthority`.
- Approval and freeze actions are replaced by the ceremony from `design-review.md` §3 — reauth + signature + transactional state change (depends on CM-L1 universal signature primitive).
- Until CM-L1 lands, approve/freeze writes a basic record with `approvedBy = req.user.userId` and `approvedAt = NOW()` via the existing controller.
- Remove `MOCK_BASELINES` from `mockData.ts` once the tab is wired.

---

## Section C — Long-term consolidation (cross-cutting, 2+ sprints)

### CM-L1 · Universal `SignatureEvent` primitive (CCB sign-off, baseline freeze, release approve)
**Priority:** P0 · **Effort:** XL

**Problem.** Every CM signature path needs the same primitive: reauthenticate, record meaning, bind to immutable artefact, append-only audit. Today: `Baseline.approvedBy` is a free-text user ID, `CcbDecision.signedById` is the same, `ReleaseApproval` adds yet another. Each is a row not an event. None reauthenticates. None ships a controlled meaning vocabulary. None binds to an immutable content hash.

**Cited evidence.** `gap-summary.md` #1 (score 8.33 — top of the list); validation cross-cut entries on universal `SignatureEvent` (V-L1) and universal `/auth/reauth` (V-N1); verification cross-cut entry on `VerBaseline` mutability; `design-review.md` §3 (baseline ceremony) and §4 (deviation workflow).

**Acceptance.**
- Cross-cutting platform primitive — coordinate with Validation, Verification, Certification, Requirements review.
- Single polymorphic `SignatureEvent { id, projectId, linkedEntityType, linkedEntityId, signerUserId, meaningCode, reauthAt, signedAt, contentHash, supersededById }` table.
- Append-only enforced (Prisma middleware rejects raw deletes; supersession creates a new row with `supersededById`).
- Universal `POST /auth/reauth { password } → { reauthToken, expiresAt }` endpoint (60-second TTL). Modules requiring a signature pass `X-Reauth-Token` header.
- Three CM consumers wire through it: baseline approve (linkedEntityType='Baseline'), CcbDecision sign (linkedEntityType='CcbDecision'), release approve (linkedEntityType='Release'). Plus DW approve when risk≥Medium.
- Controlled-vocabulary meaning strings per linkedEntityType, surfaced as dropdowns in the UI.
- Migrate existing `Baseline.approvedBy`/`approvedAt`/`approvalNotes` columns to projected reads from `SignatureEvent`.

---

### CM-L2 · One-command CM audit-package export
**Priority:** P1 · **Effort:** L

**Problem.** The Audit Trail tab's "Export Audit Log" button is a placeholder. The CM module has no equivalent of the certification PSAC/SAS export. A configuration audit (IEEE 828 §6.5) is the regulator's evidence that the as-built matches the as-designed — today the tool cannot produce this artefact.

**Cited evidence.** `gap-summary.md` #2 (score 8.33 — one-command audit-package export); `vision-and-usp.md` §8.3 (audit package as a command); `kb/documentation-model.md` (existing export pipeline).

**Acceptance.**
- New export-job template: "Configuration Audit Package."
- Composer walks: every released `ConfigItem` → its baseline membership → the CCB decisions that approved its version chain → the signers per signature event → the deviations/waivers active at the chosen as-of date.
- Output: a single PDF + Word + JSON bundle indexed by CI, with the signature ledger and IEEE 828 §6.5 audit findings template.
- Uses the existing `ExportJob` pipeline (`backend/src/routes/exportJobs.routes.ts`).
- Available from the Audit Trail tab and from the Releases tab (where the release-target = Authority).

---

### CM-L3 · Unified baseline primitive across modules
**Priority:** P1 · **Effort:** XL

**Problem.** Five module-local baseline implementations (`Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`). Cross-cutting refactor #2. The CM module is the natural home (IEEE 828 §6.4 defines baselines as a CM activity).

**Cited evidence.** `gap-summary.md` cross-cutting refactor #2; verification cross-cut entry "Unified baseline primitive — five patterns today"; validation cross-cut entry on `ValidationBaseline`; `design-review.md` §7.

**Acceptance.**
- New `BaselineRoot { id, projectId, kind, name, description?, status, createdAt, createdByUserId, lockedAt, supersedesBaselineRootId? }` table.
- Each existing baseline kind (`Baseline`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`) references `BaselineRoot.id` via a new FK column. The kind-specific table retains the kind-specific snapshot payload.
- `BaselineSignature` (= `SignatureEvent` with `linkedEntityType='BaselineRoot'`) handles approval across all kinds.
- The CM Baselines tab becomes the unified list (scoped by kind), with module-specific create wizards still rendered on the originating module's page.
- Compare service becomes kind-agnostic, parameterised by `kind`.
- Migration of existing rows preserves IDs and history.
- The "first-class baseline diff" capability claim in `competitor-matrix.md` §2 becomes truthful.

---

### CM-L4 · Universal provenance lattice on CM artefacts
**Priority:** P0 · **Effort:** L

**Problem.** Cross-cutting seed finding #1: only `Parameter` carries the provenance lattice. Every CM artefact (`ConfigItem`, `CcbDecision`, `Deviation`, `Release`) must record `authorType` / `authorUserId` / `authorAiModel` / `authorAiPromptId` / `authorAiContextHash` / `classification` / `reviewStatus` / `reviewerUserId` / `reviewTimestamp` before any AI feature ships against them.

**Cited evidence.** `ai-ready-vision.md` §6.1; `gap-summary.md` #5 + cross-cutting refactor #1; verification + validation cross-cut entries on the same gap.

**Acceptance.**
- Coordinate with the cross-cutting provenance migration. CM schema additions in CM-N1, CM-N2, CM-N3, CM-N4 include the eight provenance columns from day one.
- Controllers populate provenance from `req.user` (human) or AI agent identity (when a CM operation is AI-driven via MCP).
- Drawer UI adds an "Authored by … reviewed by …" attribution row to each detail view.
- `AiInvocation ↔ CmArtefact` polymorphic link (cross-cutting seed finding #4) allows audit queries to reconstruct: which prompt produced which CI / CR / DW / Release.

---

### CM-L5 · Deep-link adapters for CM entities
**Priority:** P1 · **Effort:** S

**Problem.** `frontend/src/linkage/` has 18 adapters per `architecture.md`. The CM module needs four more: `configurationItem.ts`, `ccbDecision.ts`, `deviation.ts`, `release.ts`. Today cross-module references would hard-code URLs — the same anti-pattern flagged in validation cross-cut entry "Deep-link adapter for ValidationItem missing."

**Cited evidence.** `architecture.md` §"Deep-link system"; the validation V-Q5 precedent.

**Acceptance.**
- Four new adapter files following the existing 18 patterns.
- `buildDeepLink({ type: 'configurationItem', id, projectId })` returns a canonical URL.
- The CI detail drawer's "Linked artifacts" section uses `buildDeepLink` for cross-module navigation instead of opening the placeholder modal.
- Existing modules (Requirements / Verification / Safety) gain "Configuration Items" pickers that consume the adapter when referencing a CI.

---

### CM-L6 · Audit log unification — migrate to central `AuditLog`
**Priority:** P1 · **Effort:** M

**Problem.** Cross-cutting seed finding #6 — 11 audit tables. The CM module must adopt the central `AuditLog` table (which the existing `baseline.controller.ts:7-21` already writes to). Every CM action emits a single `cm:<action>` row (e.g. `cm:ci-create`, `cm:baseline-freeze`, `cm:cr-approve`, `cm:dw-approve`, `cm:release-deliver`).

**Cited evidence.** Validation cross-cut entry "Validation uses central AuditLog, not a private audit table"; gap-summary.md cross-cutting refactor #6.

**Acceptance.**
- All CM controllers use the validation-pattern helper `writeAudit(projectId, userId, 'cm:<action>', detailsJson)`.
- The Audit Trail tab queries `GET /api/v1/projects/:projectId/audit-log?modulePrefix=cm:` (extend the existing audit endpoint with filter).
- The CM-specific `AuditAction` string union in `types.ts:148-162` is preserved as a display-mapping layer (kebab → readable label), but the storage is the central table.
- Promote `AuditLog.details` from `String?` to `Json` (cross-cutting follow-up from validation entry) — gates server-side filtering by audit detail.

---

## Section D — Deliberate omissions (do not chase)

These are flagged so the next reviewer does not surface them.

| # | Item | Source | Reason |
|---|---|---|---|
| 1 | Pure Variants integration / feature-model PLE | `vision-and-usp.md` §11; gap-summary deliberate omission #1 | Out of scope first 18 months; ICP is single-product programmes. |
| 2 | Codebeamer-style Stream Baselines (cross-project) | `vision-and-usp.md` §11 | Variant management deferred. Branch-and-baseline variant management is acceptable for ICP. |
| 3 | OSLC linked-data API for CM artefacts | `vision-and-usp.md` §9; gap-summary deliberate omission #5 | Anti-ICP — only matters for prime-displacement. ReqIF + REST cover most exchange needs. |
| 4 | ReqIF round-trip for `ConfigItem` | `vision-and-usp.md` §9 | ReqIF is for requirements interchange only. CIs are internal artefacts; no industry standard exists for ReqIF-of-CI. |
| 5 | Custom-configurable CCB workflow state machine (Jira-style) | `vision-and-usp.md` §9; gap-summary deliberate omission #2 | Replaced by opinionated workflow per certification standard. Customers do not configure their own CCB workflow. |
| 6 | Mobile-grade CM UX | `vision-and-usp.md` §9; gap-summary deliberate omission #4 | Out of scope first 18 months. |
| 7 | AI-signed CCB decisions | `vision-and-usp.md` §8.5 | Anti-proof: AI cannot sign baseline approvals or CCB decisions. Human signer enforced. |

---

## Section E — Cross-cutting handoff

Three findings to append to `_shared/cross-cutting.md` for the Phase 3 synthesis:

1. **CCB role seeding affects Auth + AdminRole.** The six CCB roles (`ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor`) must seed as `AdminRole` rows. This refines seed finding #5 with the concrete column-level proposal for `defaultPermissions Json` payload.
2. **`Project.strictMode` flag is a regulated-mode platform primitive.** Affects every module enforcing audit-grade behaviour (CM, Verification, Validation, Certification, Requirements review). The flag does not exist today. The CM module is the first consumer; subsequent modules inherit.
3. **Audit log unification — the CM module is the 12th-table candidate.** Before CM ships its first endpoint, decide whether to add a `CmAuditLog` (anti-pattern) or use the central `AuditLog` (the validation precedent). Recommend the latter; the validation cross-cut entry documents the helper pattern.

See `improvements/_shared/cross-cutting.md` for the appended entries.
