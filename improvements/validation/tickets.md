# Validation — Tickets

Tickets are grouped by urgency and dependency. Each ticket cites either a competitor capability that exists today or a measurable problem in the current codebase, per the constraint. None propose source-code edits in this file — implementation belongs in commits, not in this review.

Effort scale: **S** ≤1 day, **M** 1-5 days, **L** 1-2 weeks, **XL** 2+ weeks.
Priority: **P0** load-bearing for aerospace buyer credibility, **P1** competitive table-stakes, **P2** opinionated-default polish, **P3** nice-to-have.

---

## Section A — Quick wins (≤1 sprint, low coupling)

### V-Q1 · Remove baseline delete affordance for non-admins
**Priority:** P0 · **Effort:** S

**Problem.** `BaselinesPage.tsx:222` renders a `<Trash2>` icon on every baseline row. The handler calls `validationService.deleteBaseline(projectId, id)` which hits `DELETE /baselines/:id`. The endpoint is gated by `requireProjectMember` only — any project member can hard-delete the certification anchor for any baseline. The schema (`ValidationBaseline`) has no `deletedAt`; deletion is irreversible.

**Cited evidence.** Jama Review Center auto-baselines are locked by admin; Polarion Document Baselines require admin authority to delete; Codebeamer Stream Baselines are workflow-gated. This is `gap-summary.md` honourable mention #14 instantiated.

**Acceptance.**
- `DELETE /validation/projects/:projectId/baselines/:id` requires `requireProjectOwnerOrAdmin`.
- `BaselinesPage` hides the delete icon for non-admins (use the existing auth-store `user.role` check pattern).
- Schema migration: `ValidationBaseline.deletedAt` + `deletedById` columns added; the delete handler soft-deletes; the list filters `deletedAt: null` by default.

---

### V-Q2 · Stop the cosmetic divergence on Settings page
**Priority:** P2 · **Effort:** S

**Problem.** `ValidationSettingsPage.tsx` mixes Tailwind dark-mode classes (`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900`) with the validation-v2 CSS variable pattern used by the other four pages. "Add prefix / Add tag / Add template" affordances use `text-blue-600 hover:text-blue-700` — blue is on the `design-system.md` §3.1 kill-list outside the rare `status.info` slot.

**Cited evidence.** `design-system.md` §3.1: "*The accent is deep forest and nothing else. Blue appears only in the rare `status.info` slot.*" `design-system.md` §3 token list. The other four pages in the same module already conform.

**Acceptance.**
- Page uses the `pv-` CSS variables consistently with `ValidationPage`, `DERView`, `BaselinesPage`, `ActivityPage`.
- "Add …" links use `accent.primary` (deep forest, `#1B4332`).
- No `text-blue-*` / `text-indigo-*` / `text-purple-*` classes remain.

---

### V-Q3 · Replace raw JSON in Activity feed with one-line action summaries
**Priority:** P2 · **Effort:** S

**Problem.** `ActivityPage.tsx:214` renders `r.details ?? ''` as text — so users see `{"validationItemId":"abc-123","key":"VAL-014","reason":"superseded by VAL-014"}` raw. Twenty action types share this rendering path.

**Cited evidence.** `design-system.md` §5 voice: "*engineer-to-engineer, direct.*" Raw JSON is neither. Jama Activity Stream, Polarion History View, Codebeamer Audit Trail all render summaries.

**Acceptance.**
- One summary template per action type. Examples:
  - `validation:create` → `Created VAL-014 — "Pilots can complete approach within 2 minutes" (DEMONSTRATION → FAT)`
  - `validation:sign-off` → `Signed off VAL-014 as Customer Operations Lead`
  - `validation:baseline-create` → `Baselined 14 items as "PDR snapshot 2026-05-15"`
  - `validation:suspect-ack` → `Acknowledged suspect on VAL-014`
- Raw JSON is preserved under a `title` attribute for power-user inspection (hover reveals the full payload).
- Templates live in a shared `validation/activityLabels.ts` module beside `validationLabels.ts`.

---

### V-Q4 · Add date-range filter to Activity feed
**Priority:** P3 · **Effort:** S

**Problem.** `ActivityPage` filters only by action and user. For long-running projects the 300-row default is dense; a DER reviewing a quarterly milestone needs to scope to a date range.

**Cited evidence.** Jama Activity Stream, Polarion History View, Codebeamer Audit Trail all ship date filters.

**Acceptance.**
- Three date-range presets ("Today", "Last 7 days", "Last 30 days") plus a custom range picker.
- Server side: `GET /projects/:projectId/activity` accepts `from` and `to` ISO date params; filters `auditLog.createdAt` accordingly.

---

### V-Q5 · Build a deep-link adapter for ValidationItem
**Priority:** P1 · **Effort:** S

**Problem.** `frontend/src/linkage/` has 18 entity adapters (per `architecture.md`). **There is no `validation.ts` adapter.** Other modules (change requests, issues, etc.) cannot build a cross-module deep-link to a validation item via `buildDeepLink({ type: 'validation', id, projectId })`.

**Cited evidence.** `architecture.md` §"Deep-link system": "*18 entity adapters for cross-module navigation. Entry point: `buildDeepLink.ts`.*" Currently the codebase navigates via `/projects/:projectId/validation?open=<itemId>` directly.

**Acceptance.**
- New file `frontend/src/linkage/validation.ts` modeled on the existing 18 adapters.
- `buildDeepLink({ type: 'validation', id, projectId })` returns the canonical URL.
- Cross-module references (CR → validation, issue → validation, requirement → validation) use the adapter, not hard-coded URLs.

---

### V-Q6 · Enforce the `Validation Approver` role at sign-off time
**Priority:** P1 · **Effort:** S

**Problem.** `validation.service.ts:201` auto-upserts a system `EngineeringRole(name: 'Validation Approver', isSystem: true)` at module boot. The drawer copy at `ValidationItemDetailDrawer.tsx:1316` reads "`Validation Approver` role-holders are the intended signers". But the sign-off endpoint **does not check** that the signer holds the role on the project. Any project member who is not the creator can sign.

**Cited evidence.** The runtime divergence between copy and behaviour misleads users. Jama Review Center enforces participant roles, Polarion workflow enforces per-transition signer rules, Codebeamer Review Hub enforces e-signature collection roles.

**Acceptance.**
- `signOff()` checks `prisma.projectUserEngineeringRole.findFirst({ projectId, userId, engineeringRole: { name: 'Validation Approver' } })`. Returns 403 with a named error message when missing.
- The drawer's `canSignOff` check also pre-checks the role (so the UI affordance hides for non-approvers).
- The Settings page surfaces a "Validation Approver members" list with assignment affordance (links to the existing Stakeholders → Roles & assignments page where role assignment already lives — do not build a parallel UI).

---

### V-Q7 · Remove the dead `MILESTONE_LABEL` reference in BaselinesPage
**Priority:** P3 · **Effort:** S

**Problem.** `BaselinesPage.tsx:400` reads:

```tsx
<span style={{ display: 'none' }}>{Object.keys(MILESTONE_LABEL).length}</span>
```

with comment: *"MILESTONE_LABEL referenced in tests of the column above (kept here to avoid unused import noise)"*. This is a code-smell pattern that should either be removed or the label genuinely used in the column.

**Cited evidence.** Code quality. The comment admits it.

**Acceptance.**
- Replace `it.targetMilestone` in the milestone cell of the snapshot table with `MILESTONE_LABEL[it.targetMilestone] ?? it.targetMilestone` (consistent with the method column at line 384 which uses `METHOD_LABEL`). Remove the dead span.

---

## Section B — Near-term tickets (this quarter)

### V-N1 · Add reauthentication to sign-off
**Priority:** P0 · **Effort:** M

**Problem.** Today's sign-off is one POST with no password confirmation. CFR 21 Part 11 §11.200(a)(1) requires the signature to be **executed using two distinct identification components** — typically user ID + password — with the password component re-entered for each signing event in a continuous session. Aerospace authorities (FAA, EASA) accept Part 11 e-signature as the de-facto standard.

**Cited evidence.** Jama Review Center, Polarion workflow signing, Codebeamer Review Hub e-signature — all four named competitors reauthenticate. `competitor-matrix.md` §3 row "CFR 21 Part 11 e-signature (reauthenticated)" — they all ship Native; we ship None. `gap-summary.md` #1, score 8.33 — top of the list.

**Acceptance.**
- New endpoint `POST /auth/reauth` accepts `{ password }`, validates against the user's hash, returns `{ reauthToken, expiresAt }` valid for 60 seconds.
- `POST /validation/.../sign-off` requires `X-Reauth-Token` header; service-side validates it matches the signer's user id and is not expired.
- UI: the existing inline sign-off form gains a "Confirm password" step before "Confirm sign-off" enables. Password input is not stored, not autofilled, not browser-saveable.
- Audit: the reauth event is logged separately (`auth:reauth-success` / `auth:reauth-fail`) so a failed reauth is auditable.

**Cross-cutting.** This endpoint is also needed for the Verification, Certification, and Requirements review sign-off flows. Build it in `auth.routes.ts`, not in `validation.routes.ts`. See `cross-cutting.md` append.

---

### V-N2 · Replace free-text `signerRoleLabel` with controlled vocabulary
**Priority:** P1 · **Effort:** M

**Problem.** Today `ValidationSignOff.signerRoleLabel` is unbounded free text. The Activity feed shows the verbatim string. There is no protection against typos (`Approver` vs `Aprover`), against fabricated authority claims, or against "creative" role labels.

**Cited evidence.** Part 11 §11.200(a)(2) requires the meaning of the signature ("review, approval, responsibility, or authorship"). Jama's meaning string is an immutable system setting. Polarion's per-transition signers come from a defined list. Codebeamer's signer roles come from the project's role catalogue.

**Acceptance.**
- `ValidationSettings.signerRoleVocabulary` JSON array of `{ value, label, description, requiresEngineeringRole? }`. Seeded with: Validation Approver, Customer Operations Lead, Test Witness, DER Reviewer, Quality Assurance.
- Sign-off endpoint validates that `signerRoleLabel` is present in the vocabulary.
- Settings page exposes the vocabulary editor (one new tab).
- Existing rows with free-text labels remain (`signerRoleLabel` is the existing column); new sign-offs are constrained.

---

### V-N3 · Bind sign-off to a baseline
**Priority:** P0 · **Effort:** M

**Problem.** A `ValidationSignOff` references `validationItemId` but not the **state** of the item at sign-time. The item can be edited after sign-off (the state machine permits `VALIDATED → EXECUTED` via certain paths). Auditors expect the signature to lock the snapshot it was signed against.

**Cited evidence.** Jama Review Center auto-baseline-on-review-start. Polarion workflow signatures bind to the document revision. Codebeamer Review Hub diff-vs-baseline. `gap-summary.md` cross-cutting refactor #3 (signature primitive consolidation).

**Acceptance.**
- New column: `ValidationSignOff.signedBaselineId String?` (nullable for backwards compat).
- Sign-off endpoint: before creating the row, snapshot the item into a `ValidationBaseline` row with label `Auto: pre-signoff <userId> @ <ISO>` and link via `signedBaselineId`.
- The sign-off detail in the drawer shows a "View signed baseline" link that opens the BaselinesPage drawer scoped to that baseline.
- Subsequent edits to the item between auto-baseline and final sign-off chain completion are rejected (item is locked until the chain completes or is cancelled).

**Cross-cutting.** This requires the unified-baseline refactor below to be done well. Two-step path: (a) add `signedBaselineId` referencing `ValidationBaseline`; (b) migrate to the unified primitive later.

---

### V-N4 · Add objective code to ValidationItem and pivot DERView to objective-indexed
**Priority:** P1 · **Effort:** L

**Problem.** Today `DERView` groups by milestone (PDR, CDR, FAT, SAT, EIS, OTHER). A DER pre-check walks **objectives** (DO-178C Table A-1 through A-10, ARP4754A §5.4.x), not milestones. The pivot is the load-bearing transformation per `vision-and-usp.md` §8.5.

**Cited evidence.** `vision-and-usp.md` §8.5 — "*objective-indexed, artefact-linked, sign-off-visible.*" §9.3 — "*Automated DER pre-check: every unsigned objective, every broken trace, every evidence gap.*" `design-system.md` §8.2 — "*objective view is the home view.*" No competitor ships an objective-indexed DER view today; this is the differentiator.

**Acceptance.**
- Schema: `ValidationItem.objectiveCodes String[]` (multi-valued). OR a new polymorphic `ValidationObjectiveLink` table mirroring `TraceLink` for many-to-many. Choose based on whether objectives need attributes (rationale, evidence-MoC, etc.) — if yes, the link table is the right pattern.
- Auto-population: when creating a validation from a requirement (`createFromRequirements`), inherit the requirement's objective code if present.
- DERView gains a "Group by" toggle: Milestone (current) vs Objective (new).
- Objective-indexed view shows: objective code, objective text, satisfied? (yes/no/partial), contributing artefacts (requirement → validation → evidence → sign-off), DAL annotation.

---

### V-N5 · Add provenance lattice to ValidationItem and ValidationSignOff
**Priority:** P0 · **Effort:** L

**Problem.** Per `inventory-models.md` AI-readiness section and `ai-ready-vision.md` §6.1, only `Parameter` carries the provenance columns (`authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification`). Validation has none. When AI features land (draft criteria from a requirement, suggest acceptance via MCP, parse uploaded evidence, etc.), the schema must already carry provenance.

**Cited evidence.** `gap-summary.md` #5 score 6.67. `vision-and-usp.md` §7 ("AI-native"). `ai-ready-vision.md` §6.1 (the provenance record schema). No competitor has provenance in the data model — this is the durable architectural moat.

**Acceptance.**
- Schema additions on `ValidationItem` and `ValidationSignOff`:
  - `authorType` ('human' | 'ai_suggestion' | 'ai_accepted' | 'ai_applied')
  - `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash` (all nullable)
  - `reviewStatus` ('drafted' | 'reviewed' | 'approved' | 'signed_off')
  - `reviewerUserId`, `reviewTimestamp` (nullable)
- All existing write paths populate `authorType: 'human'`, `reviewStatus: 'drafted'` by default.
- The `AiInvocation` table already exists project-wide — link via `authorAiPromptId` so the AI call ledger joins back to the artefact it produced.
- Migration is additive — no existing data risk.

**Cross-cutting.** This pattern applies to every cert-relevant artefact (Requirement, TraceLink, ChangeRequest, RequirementReview, VerTestCase, VerTestPlan, VerTestRun, VerTestResult, VerEvidence, VerMoc, CertObjective, CertSignOff, Document, EvidencePack, Issue, Hazard). Lift it from `Parameter` into a Prisma mixin / extension; apply universally. See `cross-cutting.md` append.

---

### V-N6 · Baseline-vs-baseline diff
**Priority:** P1 · **Effort:** S-M

**Problem.** `BaselinesPage` drawer compares baseline N vs current state only. Comparing baseline N to baseline M (the "between PDR and CDR" question) is what Jama, Polarion, and Codebeamer all offer.

**Cited evidence.** `competitor-matrix.md` §2 row "Baseline diff / compare view": Jama Native (item, set, project diff), Polarion Native (paragraph-level history), Codebeamer Native, DOORS Next Native. We ship None at the baseline level.

**Acceptance.**
- Drawer adds a "Compare with…" select listing other baselines on the project.
- When a second baseline is selected, the diff section switches to baseline-vs-baseline mode.
- The diff algorithm is the same one already running for baseline-vs-current (`BaselinesPage.tsx:95-142`) — only the comparison target changes.

---

### V-N7 · Print stylesheet improvements for DERView
**Priority:** P1 · **Effort:** S-M

**Problem.** Today's print stylesheet hides toolbar controls and resets background colours but does not add page headers, footers, watermarks, or proper A4 sizing. (Detailed in `design-review.md` §1.4.)

**Cited evidence.** `vision-and-usp.md` §8.5 — "*One export button that produces the DER's report template. This alone removes a week from most aerospace programmes' final certification prep.*" Jama Coverage Report, Polarion LiveReport, Codebeamer Coverage Browser all ship configurable headers/footers/watermarks; we ship none.

**Acceptance.**
- `@page { size: A4; margin: 22mm 16mm; }` print directive.
- Running header on every printed page: programme name · project ID · baseline ID (or "Live state") · ISO date.
- Running footer with `Page X of Y` (CSS `counter-increment` + `counter()`).
- Watermark when project has any `BLOCKED`, `suspect`, or unsigned items at the printout's milestone: "DRAFT — N SUSPECT / M BLOCKED / K UNSIGNED" diagonal.
- Sign-off chain rendered inline per row (signer name + role + timestamp), not just a count.

---

### V-N8 · "Build validation evidence pack" one-click bundle
**Priority:** P1 · **Effort:** M

**Problem.** Today the export buttons are CSV / MD / PDF, each a single artefact. A regulator-grade evidence pack is a zip containing: the baseline JSON manifest, the Markdown report, the PDF report, the activity log subset, the sign-off chain, and a content-hash manifest. Today the user must download four artefacts and zip them by hand.

**Cited evidence.** `design-system.md` §8.3 — "*Two buttons on every project: Baseline this state and Build certification package.*" Today's `Baseline this state` exists; the bundle button does not. `vision-and-usp.md` §8.3 — "*one command produces a regulator-ready export of the current state.*" No competitor ships an opinionated one-click bundle.

**Acceptance.**
- New endpoint `POST /projects/:projectId/baselines/:id/evidence-pack` returns a zip stream.
- Zip contents: `manifest.json` (baseline metadata + content hash), `validation-report.md`, `validation-report.pdf`, `activity-log.json` (audit rows in baseline window), `signoffs.json`, `evidence/<filename>` for each evidence attachment that was current at baseline time.
- UI: button next to the baseline row in `BaselinesPage` and on the "More" dropdown on `ValidationPage`.

---

### V-N9 · Soft-delete `ValidationBaseline` (replace `deleteBaseline` with archive)
**Priority:** P0 · **Effort:** S-M

**Problem.** Tied to V-Q1. `ValidationBaseline` has no `deletedAt`. Hard-deletion of a certification anchor is wrong. Today the `Trash2` icon on every row makes irreversible deletion a single click.

**Cited evidence.** `gap-summary.md` honourable mention #14, `competitor-matrix.md` §2 row "Permanent purge protection on signed artefacts": Jama implicit, Polarion SVN, Codebeamer implicit, DOORS Jazz — all four have it; we have soft-delete on only 6 models and `ValidationBaseline` is not one of them.

**Acceptance.**
- Schema: `ValidationBaseline.deletedAt DateTime?`, `deletedById String?`, `deleteReason String?`.
- Endpoint: `DELETE /baselines/:id` becomes `archiveBaseline()` — sets `deletedAt` to now, does not remove the row.
- UI: list filters `deletedAt: null` by default; "Show archived" toggle reveals archived ones with a "Restore" affordance.
- Server: archive requires `requireProjectOwnerOrAdmin`; restore likewise.

---

## Section C · Long-term tickets (cross-cutting, multi-quarter)

### V-L1 · Universal Signature primitive (extract from `ValidationSignOff`)
**Priority:** P0 · **Effort:** XL · **Cross-cutting**

**Problem.** Three modules need sign-off (Validation, Certification, Requirements/Review). Each ships its own primitive: `ValidationSignOff`, `CertSignOff`, implicit signature in `RequirementReview`. Three schemas, three audit conventions, three state machines, three Part-11 gaps. Per `gap-summary.md` cross-cutting refactor #3.

**Cited evidence.** Every competitor has one signature primitive across the platform. Three implementations is engineering debt and a customer-visible inconsistency.

**Acceptance (sketch — full design belongs in a separate proposal doc).**
- New table `SignatureEvent` polymorphic via `linkedEntityType` / `linkedEntityId` (consistent with `TraceLink`, `VerEvidenceLink`).
- Columns: `id`, `linkedEntityType`, `linkedEntityId`, `linkedBaselineId`, `signerUserId`, `meaningCode` (controlled vocabulary), `reauthAt`, `signedAt`, `contentHash`, `supersededById`, plus the provenance lattice.
- Append-only invariant enforced at schema level (DB trigger or Prisma middleware that rejects raw deletes).
- Migration: existing `ValidationSignOff` / `CertSignOff` / `RequirementReview.signature` rows are projected into `SignatureEvent` rows; the old tables remain as read-only views via Prisma views until callers migrate.

**Append to `cross-cutting.md` — see file for the full statement.**

---

### V-L2 · Universal Baseline primitive (consolidate the five patterns)
**Priority:** P1 · **Effort:** XL · **Cross-cutting**

**Problem.** `Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`/`ParameterBaselineItem`, `ValidationBaseline` — five inconsistent patterns. Per `gap-summary.md` cross-cutting refactor #2.

**Cited evidence.** `inventory-models.md` gap #5 explicit. Competitor matrix §2 — every named competitor has one baseline primitive across the platform.

**Acceptance (sketch).**
- Base table `BaselineEvent` with `linkedEntityType`/`linkedEntityId` per item; snapshot via per-item rows (like `BaselineItem`) rather than JSON blob (like `ValidationBaseline`); content hash on every entry.
- Per-module baseline tables become thin views with a `kind` discriminator.
- Migration is multi-quarter; deliver per module behind a feature flag.

---

### V-L3 · Replace `ValidationItem.updatedAt`-bump suspect-acknowledge hack
**Priority:** P2 · **Effort:** M

**Problem.** `acknowledgeSuspect` (`validation.service.ts:1791`) sets `updatedAt` to now to clear the derived suspect flag. The right model is a separate `SuspectAcknowledgement` table recording the reviewer's accept-without-rework decision per (item, linkedRequirement) pair.

**Cited evidence.** The current pattern means **the next requirement update after acknowledge will silently re-mark the item suspect with no record that the reviewer already accepted the previous suspect-trigger**. Audit gap.

**Acceptance.**
- New table `SuspectAcknowledgement(id, projectId, validationItemId, traceLinkId, requirementVersionAtAck, acknowledgedById, acknowledgedAt, rationale)`.
- Suspect detection checks for an acknowledgement keyed on the current requirement version. An acknowledgement on requirement v3 does not clear suspect on requirement v4.
- Audit log gains `validation:suspect-ack` rows that reference the acknowledgement id.

---

### V-L4 · Multi-stage signer chain (configurable per project)
**Priority:** P2 · **Effort:** L · **Cross-cutting with Certification**

**Problem.** Today a sign-off is single-actor. Aerospace teams routinely require peer review → lead approval → DER countersign. Each stage requires a different signer role. Per `competitor-matrix.md` §3 row "Multi-stage signer chain": all four competitors have it; we have a single-signer chain.

**Cited evidence.** Polarion ships configurable per-transition signer rules; Jama ships configurable participant roles per Review; Codebeamer Review Hub supports staged approval.

**Acceptance.**
- `ValidationSignOffPolicy(id, projectId, milestoneKey?, stages: Json)` declares an ordered list of `{ stageIndex, requiredRoleLabel, minSigners }`.
- State machine extends: `EXECUTED` → `PENDING_STAGE_1` → ... → `PENDING_STAGE_N` → `VALIDATED`.
- Sign-off UI shows the chain progress (Stage 1: ✓ Alice (Customer Lead) · Stage 2: pending DER).
- Settings page exposes the policy editor.

---

### V-L5 · Auto-baseline on first sign-off in a chain
**Priority:** P1 · **Effort:** M · **Depends on V-N3 (sign-off → baseline binding) and V-L1 (signature primitive)**

**Problem.** Today the item can be edited after the first sign-off but before later signers complete the chain (when V-L4 lands). A regulator expects the signed-against state to be frozen at chain start.

**Cited evidence.** Jama Review Center auto-baselines when a review starts. Polarion workflow signatures auto-baseline on transition.

**Acceptance.**
- When a sign-off chain reaches its first signature, a `ValidationBaseline` is automatically created with label `Auto: pre-signoff start @ <ISO>`.
- The item is locked against edits until the chain completes (or is cancelled).
- The activity feed surfaces both the auto-baseline event and the lock event.

---

### V-L6 · Verify soft-delete coverage parity with `Requirement`
**Priority:** P2 · **Effort:** S-M · **Cross-cutting**

**Problem.** `Requirement` carries the full soft-delete lattice (`deletedAt`, `deletedById`, `deleteReason`, `restoredAt`) plus a daily-purge cleanup job in `cleanup.service.ts`. `ValidationItem` carries the columns but **is not enrolled in the cleanup job**. Per `vision-and-usp.md` §9 anti-feature ("we do not delete cert-relevant artefacts"), the parity is necessary.

**Cited evidence.** `cleanup.service.ts` only knows about `Requirement` and `ExportTemplate`. `ValidationItem` soft-deletes accumulate forever. Operations risk.

**Acceptance.**
- `cleanup.service.ts` extended to soft-delete validation items older than the configured retention window.
- Retention window respects per-project settings if any (today `Requirement` retention is 30 days hardcoded — extract to a config table for both).
- Audit log captures every purge event.

---

## Section D — Out-of-scope, deliberate omissions

Per `vision-and-usp.md` §11 and `gap-summary.md` deliberate-omissions list, the following are NOT in scope for this package and should not be proposed:

1. **Validation variant management.** Branching a validation set per product variant is Codebeamer's Pure-Variants-class story — deferred for 18 months. The current single-snapshot baseline pattern is acceptable.
2. **OSLC linked-data API for validation.** Deferred — only matters for prime-displacement, which is anti-ICP. ReqIF round-trip is the more important interchange (covered in cross-cutting work).
3. **Mobile-optimised DERView.** Per `vision-and-usp.md` §11, mobile is out of scope first 18 months.
4. **AI sign-off mode.** Anti-feature per `vision-and-usp.md` §8.5: "*The product cannot be configured to let AI approve an artefact.*" Do not propose.
5. **Free-text signer role labels indefinitely.** V-N2 closes this. Do not regress.
6. **Per-module audit table for validation.** Validation already uses the central `AuditLog`. Do not propose a `ValidationAuditEvent`.

---

## Section E — Sequencing recommendation

If the team has one sprint:
- **V-Q1, V-N9** (close the baseline-delete defect)
- **V-Q3, V-Q5, V-Q6, V-Q7** (small UX wins)

If the team has one quarter:
- **V-N1, V-N2, V-N3, V-N5** in parallel (Part-11 sign-off path + provenance)
- **V-N4** (objective indexing for DERView)
- **V-N7, V-N8** (DER print + evidence pack bundle)

If the team has multiple quarters:
- **V-L1** (universal signature primitive) — load-bearing
- **V-L2** (universal baseline primitive) — load-bearing
- **V-L3, V-L4, V-L5, V-L6** as capacity permits

V-N1 + V-N3 + V-N5 + V-L1 + V-L2 are the certification-credibility critical path. Every other ticket sequences after, behind, or in parallel with them.
