# Requirements — Tickets

Ranked by effort grouping. Each ticket carries: title, description, acceptance criteria, effort (S = ≤1 week, M = 2–4 weeks, L = >1 month), and dependencies.

`vision-and-usp.md` §9 lists deliberate omissions: feature-model product-line engineering, generic configurable workflow engine, custom-field anarchy on requirements, mobile UX, OSLC API, mature MBSE round-trip, multi-tenant consulting deployment, AI sign-off mode, sparkles iconography, roadmap weighted by biggest customer. **None of the tickets below propose work on those omissions.** Variant management (gap #11), OSLC (#18), and mobile (#13) are explicitly out of scope.

Total: 14 tickets — 6 Quick wins, 5 Near-term, 3 Long-term.

---

## Quick wins (S) — ≤1 week each

### REQ-S1. Fix reviewer-response auth check

**Status:** Shipped 2026-05-15 - Issue [#376](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/376), PR [#380](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/380), merge commit `47e3cf1`. Resolution: new `verifyActingForSelf` middleware factory; internal reviewers must match `req.user.id`; external reviewers must present a signed `X-Reviewer-Token` JWT bound to `{reviewId, reviewerEmail, requirementReviewerId, purpose}` with `algorithms: ['HS256']` whitelist + 30-day expiry; deny paths write `requirements:reviewer-auth-mismatch-denied` audit rows anchored on requirement projectId; new `htmlEscape` helper applied to user-supplied fields in `sendReviewInviteEmail` HTML body; backfill script `reissueExternalReviewerInvites.ts` with `--throttle-ms` and `--dry-run` flags.

**Description.** `PUT /projects/:projectId/reviews/:reviewId/reviewers/:reviewerId` (`requirementReview.controller.ts:76-115`) accepts a status body without verifying `req.user.id === reviewer.reviewerId`. Any project member can submit any other reviewer's response. This is a Part-11 audit failure plus an authorization bug.

**Acceptance criteria.**
- Endpoint loads the `RequirementReviewer` row before applying the update.
- Comparison: `if (reviewer.reviewerId !== req.user.id) → 403 Forbidden`.
- For external reviewers (no `reviewerId`, only `reviewerEmail`): generate a signed-token approval link in the invite email; verify the token in this endpoint instead of `req.user.id`.
- Vitest case asserts a 403 when User A tries to update User B's reviewer row.
- Audit log records the actor identity from `req.user`, not from request body.

**Effort.** S. **Dependencies.** None. Should ship the next deploy.

---

### REQ-S2. Replace `blue-*` Tailwind classes with brand tokens

**Description.** 136 `blue-*` violations across the package: 83 in `RequirementsPage`, 40 in `RequirementDetailDrawer`, 7 in the dashboard, 6 in `TraceabilityViewsPage`. Per `design-system.md` §3.1 the accent is `#1B4332` deep forest; no `blue-*` is permitted.

**Acceptance criteria.**
- `tailwind.config.js` extends `colors` with the full token map from `design-system.md` §3.1 (`ink`, `surface`, `border`, `accent`, `status` families).
- A find/replace migration per file: `blue-50` → `accent.primary/5`, `blue-100` → `accent.primary/10`, `blue-500/600` → `accent.primary`, `blue-200` → `border.strong`, etc.
- Visual diff review per page; screenshots before/after archived in the PR.
- Lint rule: ESLint or Stylelint plugin blocking `blue-*` / `indigo-*` / `purple-*` in `frontend/src/` (except `status.info` which retains a blue tone per §3.1).

**Effort.** S. **Dependencies.** None — pure refactor.

---

### REQ-S3. Add DAL / MoC / Objective columns to the requirements table

**Description.** Per `design-system.md` §2.3 ("show the standard in context, never as a separate module") the default row must show DAL, MoC code, and the satisfied objective inline. Today none of these are visible without opening the detail drawer.

**Acceptance criteria.**
- `REQUIREMENT_FIELDS` (`config/requirementsFields.ts`) gains three new keys: `dal`, `mocCode`, `objectiveCode`.
- `dal` is derived from `Requirement.requirementType` mapping until a real DAL column exists in the schema; flag for migration.
- `mocCode` is joined from `Requirement.linkedMocCode` → `VerMoc.code` (already a relation).
- `objectiveCode` is joined from `CertObjectiveRequirementLink` → `CertObjective.code`.
- All three columns are `defaultVisible: true`.
- `getRequirements` includes the joins (paginated query stays under 200ms with 10k requirements per project).

**Effort.** S. **Dependencies.** None — schema already supports the joins.

---

### REQ-S4. Inline suspect-link badge on every row + drawer header

**Description.** Today suspect links are only surfaced via the standalone Suspect Links modal (`SuspectLinksReview`). Inline awareness is competitor-standard (Jama, Polarion, DOORS Next).

**Acceptance criteria.**
- `getRequirements` returns a `suspectLinkCount` aggregate per row (one query — `LEFT JOIN TraceLink ... WHERE isSuspect = TRUE GROUP BY sourceId`).
- The row shows an orange triangle (`status.warning` per §3.1) with tooltip "N suspect downstream links" when count > 0.
- Clicking the triangle navigates to the suspect-links modal with the requirement pre-selected.
- Same badge appears in the detail drawer header next to the requirement ID.
- Empty state copy: "No suspect downstream links."

**Effort.** S. **Dependencies.** REQ-S3 (column infrastructure).

---

### REQ-S5. Replace 8 dropdowns with primary action + single "Actions" menu

**Description.** Per `design-system.md` §2.4 ("Progressive disclosure. One decision per screen.") the toolbar exposes eight equally-weighted dropdowns. Reduce to one primary action plus an `Actions ▾` menu.

**Acceptance criteria.**
- New `<RequirementsToolbar>` component owns the dropdown state (one `openMenu: string | null` plus its outside-click effect).
- Primary action: `+ New Requirement` (accent.primary, prominent).
- Secondary toggles: `Filters`, `Density`, `View (table/document)`.
- `Actions ▾` menu groups: Traceability (matrix, suspect links, function-verification coverage), Data (import, export, ReqIF), Analysis (quality panel, baselines, audit log).
- Bulk actions menu only appears when ≥1 row selected.
- Outside-click + ESC closes the active menu. Keyboard navigation works (`↓` to open, arrows to navigate).
- `RequirementsPage` loses the 7 dropdown booleans and 7 refs.

**Effort.** S. **Dependencies.** None.

---

### REQ-S6. Server-persist saved-views folder expansion + cleanup

**Description.** `TraceabilityViewsPage` does not persist folder open/closed state — every reload collapses the tree. The default selected folder is `'unfiled'`, which is empty for new projects. Also: views can share the same name in the same folder (no unique constraint).

**Acceptance criteria.**
- Folder expansion state persisted in `RequirementsViewPreferences` (extend schema with `traceabilityViewFolders: Json`).
- Default selected folder changes to `'all'`.
- Schema migration adds `@@unique([projectId, folderId, name])` on `SavedView` (or `viewKind` if multiple kinds become canonical).
- Test confirms a duplicate-name save returns 400 with a named error: "A view named 'X' already exists in this folder."

**Effort.** S. **Dependencies.** None.

---

## Near-term (M) — 2-4 weeks each

### REQ-M1. Provenance schema rollout on Requirements + TraceLink + RequirementReview

**Description.** Apply the `Parameter` provenance lattice to the core Requirements models. Cross-cutting refactor #1 — gap-summary #5. Foundation for AI tier matrix, signature primitive, and audit-grade export.

**Acceptance criteria.**

Schema additions (one migration, additive only):

```
// On Requirement
authorType           String   @default("human")
authorAiModel        String?
authorAiVersion      String?
authorAiPromptId     String?
authorAiContextHash  String?
reviewerUserId       String?
reviewTimestamp      DateTime?
classification       String   @default("internal")
// (reviewStatus already exists)

// On RequirementVersion — same fields
// On TraceLink — same fields + retain isAuto, isSuspect, confidence
// On RequirementReview — same fields
// On RequirementReviewer — same fields
// On RequirementChangeRequestLink — same fields
// On RequirementAttachment — same fields (priority high — evidence files)
```

Middleware:
- Every write path in `requirement.controller.ts` populates `authorType` from `req.user.authorType` (default `'human'`; AI-driven endpoints set explicitly).
- An `AuthRequest` extension carries `aiContext?: { model, version, promptId, contextHash }` for MCP-driven writes.
- Existing rows backfilled with `authorType = 'human'`, `reviewStatus = 'reviewed'` (matches current state).

Audit queries:
- `GET /api/v1/requirements/:projectId/audit/ai-touched` — every requirement whose `authorType !== 'human'` plus the human reviewer.
- `GET /api/v1/requirements/:projectId/audit/by-author?userId=X` — every requirement edited by a specific user.

UI:
- Detail drawer header shows author identity (human name OR AI model + version).
- Suspect-link tooltip shows AI confidence when `authorType` indicates an AI-suggested link.

Tests:
- Vitest: every write path test asserts the provenance fields are populated.
- Round-trip: a requirement created via MCP carries the AI lattice; reviewed by a human carries the reviewer; signed off carries the signature.

**Effort.** M. **Dependencies.** None — this is the foundation. Appended to `improvements/_shared/cross-cutting.md`.

---

### REQ-M2. INCOSE / EARS write-time enforcement

**Description.** Per `vision-and-usp.md` §10 ("the tool refuses to save a malformed requirement the same way a compiler refuses to compile malformed code") and gap-summary #3. Replace `requirementValidationService`'s 23-warning advisory output with a writer-side gate that refuses save on a configurable set of rules.

**Acceptance criteria.**

Rule library:
- 40+ INCOSE Guide for Writing Requirements rules: shall-language presence, atomicity (one verb / one object / one criterion), ambiguity (`fast`, `user-friendly`, `robust`, `as appropriate`, `etc.`), measurability (numeric threshold + unit), passive voice, conditional clarity, pronouns referencing.
- 6 EARS patterns detected: Ubiquitous, Event-driven (`When ... the system shall ...`), Unwanted behaviour (`If ..., then the system shall ...`), State-driven (`While ..., the system shall ...`), Optional feature (`Where ..., the system shall ...`), Complex (combination).
- Each rule has: id, severity (`block` | `warn` | `info`), message template, suggested-fix template.

Save-time API:
- New endpoint `POST /api/v1/requirements/:projectId/validate-draft` — accepts requirement draft, returns `{ blockingIssues, warnings, suggestions, eARSClassification }`.
- `POST /:projectId` and `PUT /:projectId/:requirementId` invoke the same validation. Default behaviour: `block` rules return 400 with the issue list. Override flag (`overrideQualityGate: true` + reason) allows override with audit-logged justification.

UI:
- Editor (`CreateRequirementModal` + `EditRequirementModal`) shows inline rule hits as the user types (debounced 500ms).
- On save attempt with blocking issues: modal expands a panel listing each issue, with the offending substring highlighted and the suggested replacement clickable.
- Override option requires a reason field; recorded in `RequirementVersion.changeReason` plus a special audit event `REQUIREMENT_QUALITY_OVERRIDE`.

Strict-mode interaction:
- Per-project setting `Project.strictRequirementQuality` (boolean, default true). When false, `block` rules become `warn` (advisory mode for migration projects).

Tests:
- Vitest: each of the 40 INCOSE rules has a positive and negative example.
- Each EARS pattern has a positive sample (correct classification) and a negative (refused).
- Override path has a Vitest case that asserts the audit event.

**Effort.** M. **Dependencies.** REQ-M1 (provenance — needed for audit-logging the override).

---

### REQ-M3. Unified bulk-edit drawer + endpoint

**Description.** Per gap-summary #9 and `competitor-matrix.md` §1 row "Bulk-edit selected items". Today's bulk-update covers 5 of 25 editable fields.

**Acceptance criteria.**

Backend:
- `POST /api/v1/requirements/:projectId/bulk-update` accepts `{ requirementIds: string[], updates: Partial<UpdateRequirementDto>, optimisticVersions?: Record<string, number> }`.
- Permitted-fields whitelist enforced in the controller (some fields like `lifecycleId`, `statusId` require `requireProjectOwnerOrAdmin`).
- Locked requirements are silently skipped; the response carries `skippedDueToLock: number` and `skippedDueToConflict: number`.
- Atomicity: every accepted update runs in one `$transaction`. Any single failure rolls back the batch.
- Per-row audit entries with a shared `batchId` so the audit log can correlate.

Frontend:
- New `<BulkEditDrawer>` component (per `design-system.md` §6.3 canonical wizard).
- Step 1 (implicit): rows selected on the main page.
- Step 2: pick field(s).
- Step 3: enter new value(s).
- Step 4: preview affected rows with conflict warnings (locked, lifecycle gate would fail, validation would fail).
- Step 5: confirm; apply.
- Success toast shows count + "N skipped (locked)" + link to audit log.

Tests:
- Playwright e2e: select 5 requirements, bulk-edit owner + priority, verify all 5 updated; verify locked rows skipped; verify audit log shows the batch.

**Effort.** M. **Dependencies.** REQ-M1.

---

### REQ-M4. Diff view between requirement versions + baselines

**Status: Shipped — feat/NX-2-version-diff-view (PR against dev), Issue #440 (NX-2).**
Field-level + line-level (line-LCS) diff with ZERO new npm dependency — `diff-match-patch`
was NOT added; word-level intra-line highlighting was reshaped to a deferred fast-follow
per the approved #440 Architecture comment. Backend `compareVersions` upgraded in place
(`/diff` alias added) returning `{ fields: [{name, changeType, before, after, lineDiff?}],
addedLinks, removedLinks }`; new `GET /baselines/:projectId/roots/diff` consumes R-4's
`compareBaselineRoots`. Frontend ships the SHR-8 shared `<VersionDiff>` component
(`frontend/src/components/common/VersionDiff.tsx`), wired into RequirementVersionHistory,
ParameterDetailDrawer compare-mode (replacing both bespoke diff tables), and the new
`/projects/:projectId/baselines/:baselineId/diff/:otherBaselineId` page.

**Description.** Per gap-summary #7 and `competitor-matrix.md` §2 row "Baseline diff / compare view".

**Acceptance criteria.**

Backend:
- `GET /api/v1/versions/:projectId/requirements/:requirementId/diff?versionA=N&versionB=M` returns structured field-level diffs.
- Diff implementation uses `diff-match-patch` library (do not roll a custom diff per `gap-summary.md` #7 acceptance).
- Response shape: `{ fields: { [fieldName]: { changeType, before, after, lineDiff: Array<{op: 'eq'|'add'|'del', text: string}> } } }`.
- `GET /api/v1/baselines/:projectId/:baselineA/diff/:baselineB` returns the same shape per requirement, plus added/removed requirement lists.

Frontend:
- New `<RequirementVersionDiff>` component embedded in the detail drawer's Versions tab.
- New `/projects/:projectId/baselines/:baselineId/diff/:otherBaselineId` route showing side-by-side or unified diff (toggleable).
- Diff colours: `status.success` for additions, `status.danger` for deletions, neutral for unchanged.
- Filter chips: "Show only changed" / "Show only added" / "Show only removed".
- Keyboard nav: `j`/`k` for next/previous changed requirement.

Tests:
- Vitest: versions with simple text edits show correct word-level diff.
- Playwright: baseline-diff URL renders; chip filters work.

**Effort.** M. **Dependencies.** None — `RequirementVersion` data already present.

---

### REQ-M5. Signature primitive bound to baseline at review approval

**Description.** Per gap-summary #1 and `competitor-matrix.md` §3 row "CFR 21 Part 11 e-signature". Cross-cutting refactor #3.

**Acceptance criteria.**

Schema additions:
```
model SignatureEvent {
  id                String   @id @default(uuid())
  projectId         String
  signerUserId      String
  signedAt          DateTime @default(now())
  reauthAt          DateTime
  meaningText       String
  // What was signed (polymorphic):
  signedEntityType  String
  signedEntityId    String
  // Optional immutable baseline binding
  baselineId        String?
  // Tamper-evidence
  contentHash       String  // SHA-256 of the signed content snapshot
  signatureDigest   String  // SHA-256 of {signerUserId, signedEntityId, reauthAt, meaningText, contentHash}

  project           Project   @relation(...)
  signer            User      @relation(...)
  baseline          Baseline? @relation(...)

  @@index([projectId, signedEntityType, signedEntityId])
  @@index([baselineId])
}
```

Endpoints:
- `POST /api/v1/auth/reauth` accepts the user's current password, returns a short-lived `reauthToken`.
- `POST /api/v1/projects/:projectId/reviews/:reviewId/sign` accepts `{ reauthToken, meaningText }`, creates a `SignatureEvent` row, marks the review approved + completed, creates a Baseline snapshotting every requirement in the review, links the signature event to the new baseline.

Behaviour:
- Once a `Baseline` has signature events bound to it, edits to any requirement in the baseline are refused with 423 unless the user creates a new draft branch.
- The signature row is append-only — any update attempt is rejected at the controller level.

UI:
- `<SignatureModal>` opens on "Sign off" action. Field 1: password reauth. Field 2: meaning text (pre-filled with default per review type). Confirm button only enabled when both filled.
- Drawer header shows signature events as locked pills with reauthenticated badge.
- Audit log surfaces signature events distinctly.

Tests:
- Vitest: signing without reauth returns 401. Signing twice on the same review returns 409. Editing a frozen requirement returns 423.

**Effort.** M. **Dependencies.** REQ-M1.

---

## Long-term (L) — >1 month each

### REQ-L1. Objective-completion matrix as the default landing

**Description.** Per `design-system.md` §8.2 and gap-summary #2 (one-command audit-package export's UI side). The current dashboard shows requirement counts; the certification-native dashboard shows DO-178C objective satisfaction.

**Acceptance criteria.**

Backend:
- New endpoint `GET /api/v1/projects/:projectId/objective-matrix?standard=DO-178C` returns the full matrix: row per `CertObjective`, with columns for `applicableDal`, `requirementsLinked`, `requirementsApproved`, `verificationsPlanned`, `verificationsPassed`, `evidenceCount`, `signatureChain`, `completionState` (`open` | `partial` | `closed` | `signed`).
- Matrix computation joins `CertObjective × CertObjectiveRequirementLink × Requirement × VerTestCase × VerTestResult × VerEvidence × SignatureEvent`.
- Cache the matrix per `(projectId, baselineId)` for 60 seconds (writes invalidate).

Frontend:
- New page `/projects/:projectId/requirements/dashboard` replaces today's tiles with the matrix as the default view.
- Matrix renders as table: rows = objective code + description, columns = the metric fields above.
- Cell colours: `status.success` for closed, `status.warning` for partial, `status.danger` for open with applicable DAL.
- Click a row → drill-down panel with the linked requirements + verifications + evidence.
- Filter by DAL (A/B/C/D/E). Filter by objective table (A-1 through A-10).
- Export the matrix as: docx (DO-178C Table A-3 template), PDF, JSON, CSV.

Tests:
- Vitest: matrix computation across a seeded project returns the expected values.
- Playwright: dashboard loads, drill-down works, export downloads the file.

**Effort.** L. **Dependencies.** REQ-M1, REQ-M5. This is the demo moment.

---

### REQ-L2. Document-mode spec view (LiveDoc parity)

**Description.** Per `gap-summary.md` honourable-mention #13 and `competitor-matrix.md` §8 row "Document-style spec view". Today's `listViewStyle: 'document'` stacks requirement cards. Build a true scrollable spec where each paragraph is a first-class object, matching Jama Document View / Polarion LiveDocs / Codebeamer Document Mode.

**Acceptance criteria.**

Schema:
```
model SpecDocument {
  id          String   @id @default(uuid())
  projectId   String
  docType     String  // SRS | ICD | VVP | SAS | DDP | CDP
  name        String
  description String?
  status      String   @default("draft")  // draft | in_review | approved | released
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  paragraphs  SpecParagraph[]
  // Versioning + provenance per REQ-M1
}

model SpecParagraph {
  id            String  @id @default(uuid())
  specId        String
  sortOrder     Int
  level         Int     // heading level 1-6, or 0 = body text
  paragraphType String  // heading | text | requirement_ref | table | image | generated_block
  requirementId String? // populated when type = requirement_ref
  textContent   String? // TipTap JSON or plain
  // Versioning + provenance
}
```

Backend:
- CRUD on `SpecDocument` (5 endpoints).
- CRUD on paragraphs within a doc (5 endpoints), plus `POST /reorder` accepting `{ paragraphId, newOrder }[]`.
- `POST /:specId/paragraphs/add-requirement` creates a `Requirement` atomically with the paragraph reference.

Frontend:
- New page `/projects/:projectId/requirements/spec/:specId`.
- Reading-width column (max 80ch) with heading numbering computed client-side (1.1.1 …).
- Each paragraph is inline-editable. Requirements show their full editor inline (Title, Description, DAL, MoC, etc.) — same `RequirementForm` component as the modal.
- Drag-reorder via @dnd-kit (already in package.json).
- Right-hand minimap / outline panel (matches `docOutlineOpen` state).
- Section actions: "Add requirement here", "Add heading", "Add text", "Insert artefact block".
- Print preview: render to docx via existing `CorporateDocxTemplate` pipeline.

Tests:
- Vitest: paragraph reorder maintains stable `sortOrder` indexing.
- Playwright: full create-spec → add-requirements → reorder → export-docx flow.

**Effort.** L (multi-month). **Dependencies.** REQ-M1, REQ-L3 (RequirementForm extraction).

---

### REQ-L3. Extract `RequirementForm` and collapse the three modals

**Description.** `CreateRequirementModal` (2,661 lines) + `EditRequirementModal` (2,523 lines) + `RequirementDetailDrawer` (2,748 lines, partial) share 70% of their UI. Extract a single `<RequirementForm>` component with `mode: 'create' | 'edit' | 'view'`.

**Acceptance criteria.**
- Single `RequirementForm` component renders every requirement field plus the linkage panels (component, function allocation, parameter picker, parent requirement, glossary integration).
- Container components (`CreateRequirementModal`, `EditRequirementModal`, `RequirementDetailDrawer`) shrink to ≤300 lines each, owning modal/drawer chrome and submit logic only.
- All three render paths share validation logic (REQ-M2's INCOSE/EARS engine).
- Visual regression suite (Playwright screenshots) confirms the three surfaces still look correct.

**Effort.** L. **Dependencies.** REQ-M1 (provenance), REQ-M2 (INCOSE/EARS rules — needed for shared validator). Use this as the precondition for the spec view (REQ-L2) so the new spec paragraphs render the same form.

---

### REQ-L4. ReqIF round-trip parity (ROADMAP NX-1)

**Status: Shipped — issue #437 (NX-1).**

**Description.** The ReqIF round-trip fidelity gap (`gap-summary.md` #6, ROADMAP-phase3.md §3 NX-1) had no dedicated ticket — it was recorded only as a known gap in `README.md:39`/`:65` and analysed in `backend.md` §4. Tracked here so it ships through the pipeline. The 149-line `reqifParser.ts` drops ~80% of typical input — `SPEC-HIERARCHY`, `SPECIFICATION`, `SPEC-OBJECT-TYPE` / `SPEC-RELATION-TYPE`, `DATATYPE-DEFINITION-*`, and `xhtml`-embedded payload — so DOORS Next / Polarion / Jama exports import as flat lists of unrelated rows.

**Acceptance criteria.** Canonical AC from `gap-summary.md` #6: a DOORS Next ReqIF export imports without data loss; a re-export from us imports back into DOORS Next with no diff in objects, attributes, or links; same round-trip with Polarion and Jama Universal ReqIF exports. Round-trip tests against those three real exports plus the public ReqIF Academy "Reference Implementation Conformance Test Suite", asserting object count, attribute fidelity, hierarchy fidelity, and link fidelity. The parser is expected to be rebuilt as a visitor over the ReqIF 1.x XSD.

**Effort.** L (4–6 weeks). **Dependencies.** None — no R-Wave dependency; no other ticket. Schema: no new Prisma models (writes existing `Requirement` + `TraceLink`). **Surface.** Backend-only — import/export UI (`ImportWizard.tsx`, `ExportBuilder.tsx`) and service plumbing already exist. **Out of scope.** OSLC (`vision-and-usp.md` §9 omission); unifying the parallel `parameterReqif.service.ts` (Parameters-package follow-up co-ticket once this parser lands).

**Shipped — issue #437 (NX-1).** Built the converged `backend/src/services/reqif/` module — a two-pass, namespace-agnostic, order-preserving ReqIF 1.x parser (`parser.ts`), serializer (`serializer.ts`), typed model (`model.ts`), `Requirement`-tree/`TraceLink` importer (`importer.ts`), `Requirement`/`TraceLink` exporter (`exporter.ts`) and bidirectional link-type map (`linkTypeMap.ts`). The two divergent legacy importers are converged onto it: `reqifParser.ts` deleted, `reqif.service.ts` reduced to a thin facade, and `requirement.controller.ts importReqif` repointed — one importer, not two. Closes the ~80% data-loss gap: `SPEC-HIERARCHY` reconstructs onto `Requirement.parentId`, `SPEC-OBJECT-TYPE` / `DATATYPE-DEFINITION-*` resolve attribute values by type, `SPEC-RELATION` maps to typed `TraceLink.linkType` (lossy mappings surfaced as warnings), and `xhtml` payload (tables, formatting) round-trips as HTML. No schema change, no new npm dependency (uses `fast-xml-parser`). New `reqif.conformance.test.ts` round-trip suite (36 ReqIF tests) over four representative DOORS Next / Polarion / Jama / ReqIF-Academy fixtures asserts structural equality on objects, attributes, hierarchy and link types across import → export → re-import. Follow-up: vendor real licensed-tool corpora + the public ReqIF Academy conformance suite; the Parameters-package co-ticket unifying `parameterReqif.service.ts` onto the new module.

---

## Cross-cutting refactors (cited but not duplicated here)

The following are appended to `improvements/_shared/cross-cutting.md` because they affect multiple packages. They are listed here for context only — they ship as separate workstreams sequenced ahead of this package's M/L tickets:

| ID | Title | Tickets that depend on it |
|---|---|---|
| CC1 | Universal AI-participation provenance schema | REQ-M1 (this package's manifestation) |
| CC2 | Unified `Baseline` primitive (5 patterns → 1) | REQ-M4, REQ-M5 |
| CC3 | Signature event table | REQ-M5 (this package's first user) |
| CC4 | `AiInvocation` ↔ artefact join | REQ-M1, REQ-M2 (override audit) |
| CC5 | `AdminRole` expansion for engineering roles | None in this package |
| CC6 | 11 audit tables → 1 universal provenance log | None in this package — wait until CC1 is in production for 6 months |

---

## Sequencing recommendation

Sprint plan (4 sprints, 2 weeks each):

**Sprint 1.** REQ-S1 (auth fix — ship today), REQ-S2 (brand tokens), REQ-S3 (DAL/MoC/Objective columns). Surface-deep but each ticket independently improves the demo.

**Sprint 2.** REQ-M1 (provenance schema). Foundation; nothing else in M/L tier blocks here until this lands.

**Sprint 3.** REQ-M5 (signature primitive), REQ-S5 (toolbar), REQ-S4 (suspect badge), REQ-S6 (saved-views cleanup).

**Sprint 4.** REQ-M2 (INCOSE/EARS refusal), REQ-M3 (bulk-edit), REQ-M4 (diff view).

**Long-form work after Sprint 4.** REQ-L1 (objective matrix), REQ-L3 (extract `RequirementForm`), then REQ-L2 (document mode) last because it leans on L3.

Total estimated effort: ~5–6 months for one engineer, or ~10–12 weeks for a 2-engineer team given the dependencies. The cross-cutting refactors (CC1 in particular) determine the floor — without provenance, the M/L tier blocks.
