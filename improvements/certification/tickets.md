# Certification — Engineering Tickets

Concrete tickets with acceptance criteria, dependencies, and rough effort. Tickets are numbered for cross-reference (e.g. `tickets.md #006`), not for execution order. The execution order is in §0.

## 0. Recommended execution order

Tickets are sequence-locked from #001 to #008 because each opens the door for the next:

1. **#001 Seed DO-178C / DO-254 / ARP4754A objective catalogues.** Without seed data nothing else demos.
2. **#002 Unified baseline primitive** — see cross-cutting in `_shared/cross-cutting.md` row 2. Required before the matrix can compute against a frozen snapshot.
3. **#003 Unified signature primitive** — cross-cutting row 3. Required before the PSAC export can carry meaning-string signatures.
4. **#004 Replace `CertComplianceMatrixRow` with computed matrix.** Removes the dual-source-of-truth bug.
5. **#005 Objective-completion matrix as default landing.** Frontend build; depends on #001 + #004.
6. **#006 One-command PSAC / SDP / SVP / SAS / SCI / SECI export.** The demo moment. Depends on all of #001 + #002 + #003.
7. **#007 Provenance fields on `CertObjective` and `CertSignOff`.** Cross-cutting row 1. Depends on #003.
8. **#008 Backend test scaffolding for certification.** Should ship alongside #001 to lock the seed behaviour.

After #001–#008, the remaining tickets (#009 onward) can ship in parallel.

---

## #001 — Seed DO-178C, DO-254, and ARP4754A objective catalogues

**Type:** seed data + small schema  
**Effort:** 1 week (mostly documentation extraction, light engineering)  
**Cross-cutting:** Objective catalogue pattern reused for ISO 26262, IEC 62304, EN 50128, IEC 61508 later (per `vision-and-usp.md` §11 expansion roadmap).  
**Priority:** P0 — without this, the certification module is decorative.

### Problem

The certification module ships with 6 demo objectives (CS-25 paragraph references). DO-178C Annex A specifies **71 objectives across Tables A-1 through A-10**. DO-254 Appendix B specifies ~50 (varies by DAL). ARP4754A specifies ~60 (varies by FDAL). None are seeded. The matrix is empty for any real project. Competitors (Codebeamer DO-178C template kit, Jama Airborne Systems with AFuzion checklists) ship these as out-of-the-box catalogues.

### Changes

**Schema additions** (`backend/prisma/schema.prisma`):
- Add `CertObjectiveCatalogue` table — a system-scoped (not project-scoped) catalogue of standard objectives. Columns: `id`, `standard` (enum: `DO-178C | DO-254 | ARP4754A | DO-326A | ARP4761A | MIL-STD-882 | EN9100 | ISO9001`), `tableId` (e.g. "A-5"), `objectiveCode` (e.g. "A-5.1"), `title`, `description`, `applicability: Jsonb` (per-DAL output + independence requirements), `validMocValues: String[]`, `referenceCitations: String[]`.
- Add `dalLevel: String?` to `CertContext` (A | B | C | D | E for software; A through E for hardware; 1 through 5 for ARP4754A FDAL).
- Add `catalogueObjectiveId: String?` to `CertObjective` — when an objective was instantiated from a catalogue entry, this is the FK; the existing free-text `objId` survives for user-authored objectives.

**Seed data** (`backend/src/scripts/seed-cert-catalogues/`):
- One JSON file per standard. `do178c.json` carries 71 objectives, each shaped per the example in `design-review.md` §3.1. `do254.json` carries Appendix B + AMC 20-152A. `arp4754a.json` carries ARP4754A objectives. Three more files reserved for later (ARP4761A, DO-326A, MIL-STD-882) — empty stubs.
- New seed script `seed-cert-catalogues.ts` upserts the catalogue rows on every run.

**Controller changes** (`backend/src/controllers/certification/index.ts`):
- New endpoint `GET /:projectId/catalogues/:standard` — returns the catalogue filtered to the project's selected DAL.
- New endpoint `POST /:projectId/catalogues/:standard/instantiate` — bulk-creates `CertObjective` rows for every catalogue entry applicable at the project's DAL. Idempotent (skips already-instantiated objectives).
- Modify `updateContext` — when `standards` or `dalLevel` change, auto-suggest instantiation (do not auto-execute).

**Frontend changes** (`frontend/src/modules/certification/`):
- New modal on first visit when `CertContext.dalLevel` is null: "Pick your DAL. We'll set up the objective catalogue."
- Modify Settings tab to expose DAL selection + manual catalogue instantiate buttons.

### Acceptance

1. Run `npm run seed:cert-catalogues` — three JSON files import; catalogue table has ~180 rows.
2. Create a new project. Open the certification page. The "Pick your DAL" modal appears once. After picking DAL-A + DO-178C, 71 objectives are visible in the Objectives tab. The compliance matrix shows the matching coverage (0% complete on a fresh project).
3. Re-running the seed script does not duplicate rows.
4. The `validMocValues` on each catalogue row is enforceable: the Objectives detail drawer dropdown is filtered to those values.

### Risks

The DO-178C / DO-254 standards documents are not freely redistributable. Care needed in the JSON content: ship the objective IDs, titles, and applicability metadata (which are factual references), not the full normative text. Cite the spec section for each objective.

---

## #002 — Unified baseline primitive (CertBaseline aligned to the cross-cutting baseline)

**Type:** schema refactor + service consolidation  
**Effort:** 2 weeks  
**Cross-cutting:** `_shared/cross-cutting.md` row 2 (collapse 5 baseline patterns)  
**Priority:** P0 — load-bearing for #005 (matrix against frozen snapshot) and #006 (PSAC bound to baseline).

### Problem

Five baseline patterns disagree (`Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`/`ParameterBaselineItem`, `ValidationBaseline`). Today's `CertBaseline` is a label only — it does not capture the artefact set at the moment of freezing. The "one-click baseline" promise in `design-system.md` §8.3 is incoherent.

### Changes

**Schema:**
- New `ProjectBaseline` table — the unified primitive. Columns: `id`, `projectId`, `displayId` ("BL-2026-04-CDR"), `name`, `phase` ("PDR" | "CDR" | "TRR" | "TC" | custom), `status` ("Draft" | "Frozen" | "Submitted" | "Approved" | "Superseded"), `scope: Jsonb` (which artefact types are captured: requirements, objectives, evidence, sign-offs, parameters), `frozenAt`, `frozenByUserId`, `supersededById`.
- New `ProjectBaselineItem` table — per-artefact snapshot rows. Columns: `id`, `projectBaselineId`, `artefactType` (enum), `artefactId`, `snapshot: Jsonb` (the full row snapshot at freeze time), `version`.
- `CertBaseline` becomes a thin wrapper / view: `id`, `projectBaselineId`, plus the cert-display columns. Migration: existing `CertBaseline` rows get a corresponding `ProjectBaseline` row with `scope = ['cert']`.
- Same wrapping pattern for `Baseline`, `VerBaseline`, `ParameterBaseline`, `ValidationBaseline`.

**Service layer:**
- New `backend/src/services/projectBaseline.service.ts` — `createBaseline(projectId, opts)` snapshots the in-scope artefact types into `ProjectBaselineItem` rows atomically. Same service is called by Requirements, Verification, Certification, Validation modules.

**Controller changes:**
- `POST /:projectId/baselines` in the certification controller calls `projectBaseline.service.createBaseline(projectId, { scope: ['cert'] })` then returns the cert-shaped row.

**Frontend changes:**
- `CertificationPage` context selector reads from `ProjectBaseline` (filtered to certification-scope or "all-scope"). No UI change visible to user.

### Acceptance

1. Create a `CertBaseline` via the existing `POST /:projectId/baselines`. Verify a corresponding `ProjectBaseline` row exists with `scope = ['cert']` and `ProjectBaselineItem` rows snapshot each `CertObjective` + linked `CertSignOff` at freeze time.
2. Modifying a `CertObjective` *after* baseline freeze does not change the baselined snapshot.
3. A new `GET /:projectId/baselines/:baselineId/items` endpoint returns the snapshot rows.
4. Existing seed data continues to work (data migration is additive).
5. The other four baseline patterns are still operable through their existing endpoints — the consolidation is invisible to API consumers in the first pass.

### Risks

Migration of existing `Baseline` / `VerBaseline` / `ParameterBaseline` rows is the largest unit of work. Backup the database before running the migration. Ship behind a feature flag (`projectBaseline.enabled`) and verify on the development project first.

---

## #003 — Unified signature primitive (CertSignOff + ValidationSignOff + RequirementReview)

**Type:** schema refactor + service consolidation  
**Effort:** 2 weeks  
**Cross-cutting:** `_shared/cross-cutting.md` row 3 (three sign-off stories)  
**Priority:** P0 — load-bearing for the "DO-178C-grade signature" marketing claim per `gap-summary.md` #1.

### Problem

Per `backend.md` §5, three sign-off models exist with three different shapes:
- `CertSignOff` — strongest identity (password reauth, server-derived signer ID, IP/UA capture); mutable in place.
- `ValidationSignOff` — strongest immutability (append-only with `supersededById` chain); weakest identity.
- `RequirementReviewer.status` — weakest of all: just a status field on the reviewer row, no reauth, no immutability.

A buyer asking "show me your DO-178C-grade signature" sees three different answers depending on which module they look at.

### Changes

**Schema:**
- New `Signature` table — the unified primitive. Combines best-of:
  ```
  id                    uuid
  artefactType          enum (CertChecklist | ValidationItem | RequirementBaseline | VerBaseline | ProjectBaseline | RequirementReview)
  artefactId            uuid (polymorphic FK)
  signerUserId          uuid (FK User; **always server-derived** from req.user)
  signerRoleLabel       text
  meaningString         text (Part-11 "I approve this artefact as accurate and complete")
  signedAt              timestamp (**always server-stamped** at bcrypt-pass time)
  reauthMethod          enum (password | webauthn | sso_step_up)
  ipAddress             text
  userAgent             text
  supersededById        uuid? (FK Signature for revocation chain)
  provenance            jsonb  // for the ai-ready-vision lattice (#007)
  createdAt             timestamp
  ```
- `CertSignOff` adds `signatureId: String?` — when an existing CertSignOff is reauthenticated via the new path, this is populated. Old rows have `signatureId = null` and are explicitly tagged as "legacy" in queries.
- Same FK addition on `ValidationSignOff` and `RequirementReviewer`.

**Service layer:**
- New `backend/src/services/signature.service.ts` exporting `applySignature(opts: { userId, password, artefactType, artefactId, meaningString, ipAddress, userAgent })`. Returns the new `Signature` row, or throws on bad password / disallowed role.
- New `revokeSignature(signatureId, userId, password)` — creates a new `Signature` row pointing back via `supersededById`, never updates.

**Controller changes:**
- `addSignOff` in certification controller becomes a thin wrapper that calls `signature.service.applySignature` then creates the `CertSignOff` row with the `signatureId` populated.
- New endpoint `POST /api/v1/signatures/apply` — generic surface usable by any module.

**Frontend changes:**
- New `<SignatureDialog>` component in `frontend/src/components/common/`. Reusable across modules. Captures password + optional comment, calls the unified endpoint.
- The CertSignOff and ValidationSignOff and RequirementReview UIs invoke the same dialog.

### Acceptance

1. A user signs a CertChecklist. The audit log shows: `Signature` row (server-derived signer, server-stamped time, IP, UA, meaningString) + `CertSignOff` row (FK to Signature) + immutable provenance.
2. The same user signs a Requirement review using the same dialog. Same `Signature` row shape, different `artefactType`.
3. Revoking a CertSignOff creates a new `Signature` row with `supersededById` pointing at the original. The original row is unchanged.
4. The export pipeline (#006) reads the `Signature` table for the signature chain; no special-casing per module.

### Risks

The `RequirementReviewer.status` field is widely used in the Requirements module. Changing the signing path while preserving the existing review workflow needs care. Recommend shipping behind a feature flag and dual-writing for the first release.

---

## #004 — Replace `CertComplianceMatrixRow` with a computed matrix

**Type:** delete table + replace endpoint  
**Effort:** 3 days  
**Priority:** P1 — depends on #001 (otherwise the matrix is empty).

### Problem

Per `backend.md` §4: the matrix is denormalised. The client writes the aggregates via `PUT /:projectId/compliance-matrix/rows`. The two sources of truth (objectives + matrix rows) drift silently.

### Changes

**Backend:**
- Replace the `getComplianceMatrix` controller body with a service call to `certComplianceMatrix.service.compute(projectId)` that joins `CertObjective` → `CertObjectiveRequirementLink` → `VerEvidence` (by `objective.linkedEvidence` if present) and emits the same response shape (`regRef`, `objectiveCount`, `mocMix`, `statusSummary`, `evidenceCount`, `lastUpdated`).
- Delete the `upsertComplianceMatrixRow` controller and its route.
- Migration: drop the `CertComplianceMatrixRow` Prisma model.

**Frontend:**
- Delete the matrix-row write paths from `frontend/src/modules/certification/store.ts` (HYDRATE keeps reading; PUT calls vanish).
- The Compliance Matrix tab UI is unchanged — it consumes the computed response in the same shape.

### Acceptance

1. After running #001 and adding a single requirement linked to a single objective, the matrix row for that objective's `regRef` reflects the link automatically — without any explicit matrix-write call.
2. Deleting an objective (per a separate ticket) is reflected immediately in the next GET.
3. The Compliance Matrix tab renders identically before vs after the refactor on existing data.
4. Performance: GET `/api/v1/certification/:projectId/compliance-matrix` returns in <100ms for a 71-objective project, <500ms for 500 objectives.

### Risks

Existing seed data writes both objectives and matrix rows. After this ticket, the seed script must stop writing matrix rows. Test by re-running `seed-certification.ts` against a fresh DB.

---

## #005 — Objective-completion matrix as default landing tab

**Type:** new frontend tab  
**Effort:** 2 weeks  
**Priority:** P1 — depends on #001 + #004. The single highest-impact UX win.

### Problem

Per `design-review.md` §1: the default landing is Overview KPI cards. `design-system.md` §8.2 mandates the objective-completion matrix. Today's Objectives & MoC tab pivots wrong.

### Changes

**Frontend:**
- New tab `objective-completion-matrix` in `frontend/src/modules/certification/tabs/ObjectiveCompletionMatrixTab.tsx`.
- Layout per `design-review.md` §1.1 — DO-178C tables A-1 through A-10 as rows, DAL A | B | C | D | E as columns. Cells coloured per coverage state.
- Right-edge drawer drills into the cell — list of objectives in the (table, DAL), each clickable to the existing Objective drawer.
- Reorder `TABS` in `CertificationPage.tsx`: the new matrix is index 0, Overview becomes index 1 (or folds into the matrix header strip).
- The default tab on first load is `objective-completion-matrix`. The `?tab=` URL parameter survives.
- Sticky header row. Virtualised body (react-window or react-virtual; ~71 rows is fine without virtualisation but defensive against future seed expansions).

**Backend:**
- New endpoint `GET /:projectId/objective-completion-matrix?standard=DO-178C` — returns the matrix shape directly: `{ rows: [{ tableId: 'A-5', dalA: { satisfied: 7, total: 9, independenceMet: 4, independenceRequired: 7 }, dalB: { ... } }] }`.
- Computed against current state of `CertObjective` + sign-offs + evidence links.

### Acceptance

1. Default landing tab is the objective completion matrix.
2. A 71-objective DO-178C project shows the matrix immediately, with current coverage state.
3. Clicking cell (A-5, DAL-A) opens a drawer listing the 7 A-5 objectives applicable at DAL-A.
4. Cell colour scheme matches design-review.md §1.1 (green tick / yellow partial / red cross / grey n/a).
5. The matrix is responsive to viewport — table renders correctly on widths down to 1280px.

### Risks

Designing the cell colour scheme for accessibility (4.5:1 contrast) requires care; the four states must be distinguishable to colour-blind users (use shape or icon, not colour alone).

---

## #006 — One-command PSAC / SDP / SVP / SAS / SCI / SECI export

**Type:** new export pipeline  
**Effort:** 3–4 weeks  
**Priority:** P0 — the demo moment per `vision-and-usp.md` §8.3 and `gap-summary.md` #2.

### Problem

The current `generatePackageBundle` produces a ZIP of five PDFs (compliance matrix, evidence index, summary, review log, activity log). None of them are regulator-shaped artefacts. PSAC, SDP, SVP, SAS, SCI, SECI do not exist as outputs.

### Changes

**Shipping content:**
- New folder `backend/src/templates/cert/` with one `.docx` template per artefact × standard combination:
  - `psac-do-178c.docx` — section structure per RTCA DO-178C §11.1.1
  - `sdp-do-178c.docx` — per §11.3
  - `svp-do-178c.docx` — per §11.20
  - `sas-do-178c.docx` — per §11.20
  - `sci-do-178c.docx` — per §11.16
  - `seci-do-178c.docx` — per §11.16
  - (and equivalents for DO-254, ARP4754A in v2)

Templates use the `docx` npm package's merge-field syntax for placeholders.

**Service layer:**
- New `backend/src/services/cert/psacComposer.ts` — composes the PSAC content from `Project → CertContext → CertObjective[] → CertObjectiveRequirementLink[] → Requirement[] → VerTestCase / VerTestPlan / VerTestResult → VerEvidence → Signature` (via #003).
- Equivalent composers for SDP, SVP, SAS, SCI, SECI.
- New `backend/src/services/cert/manifestBuilder.ts` — generates a `manifest.json` per export bundle, with: project ID, baseline ID, generated-at timestamp, generated-by user, list of artefacts with SHA-256 hash, signature chain.

**Controller changes:**
- New endpoint `POST /:projectId/cert/export/psac` — generates PSAC + manifest, streams.
- One endpoint per artefact: `/cert/export/sdp`, `/cert/export/svp`, `/cert/export/sas`, `/cert/export/sci`, `/cert/export/seci`.
- New endpoint `POST /:projectId/cert/export/full-package` — generates all of the above + a top-level manifest in a single ZIP.

**Frontend changes:**
- Rewrite `CertificationPackageTab` per `design-review.md` §6.2 — vertical list of artefact cards, each with status (sections complete, last generated, outstanding gaps), preview, history, generate.
- New `CertExportHistoryDrawer` showing past generations of an artefact, with download + structured diff.

### Acceptance

1. Click **Generate PSAC** on a DO-178C DAL-A project with 71 objectives. Within 30 seconds, a DOCX is generated containing the per-objective narrative + an evidence index per objective + a sign-off chain table referencing the Signature primitive from #003.
2. The DOCX renders the regulator-required Table of Contents (11 sections per DO-178C §11.1.1) — no user configuration needed.
3. The accompanying `manifest.json` contains SHA-256 hashes of every referenced evidence file + the signature IDs.
4. The "Generate Full Package" button produces a ZIP with PSAC + SDP + SVP + SAS + SCI + SECI + manifest, under 50MB for a typical project.
5. The History drawer shows past generations and a structured diff between any two (added objectives / changed sign-offs / new evidence).
6. Exports are persistent — re-running generates a new versioned artefact rather than overwriting.

### Risks

The DO-178C narrative content for each objective must be sourced from the certification literature. The composer should not invent text; it should compose template strings (e.g. "Objective A-5.1 is satisfied through {evidenceCount} verification artefacts, including {topThreeEvidenceTitles}.") interpolating real data. Reviewing the produced output with a real DER before launch is a prerequisite.

---

## #007 — Provenance fields on `CertObjective` and `CertSignOff`

**Type:** schema + middleware  
**Effort:** 1 week  
**Cross-cutting:** `_shared/cross-cutting.md` row 1 (universal provenance)  
**Priority:** P1 — depends on #003. Architectural moat per `vision-and-usp.md` §7.

### Problem

Per `ai-ready-vision.md` §6.1: every cert-relevant write must record `authorType`, `authorAiModel`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`. Today only `Parameter` carries this lattice. `CertObjective` and `CertSignOff` carry partial provenance via `actor` strings in `CertActivityLogEntry`, not bound to the row.

### Changes

**Schema:**
- Add a polymorphic `ProvenanceEvent` table (or inline columns) per the existing `Parameter` provenance pattern:
  - `authorType` (`human | ai_suggestion | ai_accepted | ai_applied`)
  - `authorHumanUserId` (FK User, nullable)
  - `authorAiModel` (text, nullable)
  - `authorAiVersion` (text, nullable)
  - `authorAiPromptId` (text, nullable)
  - `authorAiContextHash` (text, nullable)
  - `authorAiInvocationId` (FK AiInvocation, nullable — joins back to the AI ledger per cross-cutting row 4)
  - `reviewStatus` (`drafted | reviewed | approved | signed_off`)
  - `reviewerUserId` (FK User, nullable)
  - `reviewTimestamp` (nullable)
- Add the lattice as inline columns on `CertObjective` + `CertSignOff` for now (mirror the `Parameter` pattern). The cross-cutting migration to a separate `ProvenanceEvent` table is tracked separately.

**Middleware:**
- New `backend/src/middleware/provenance.middleware.ts` — wraps controllers and stamps `authorType`, `authorHumanUserId`, and `authorAiInvocationId` (if the request originated from an MCP tool call) on every write path.

**Controller changes:**
- All `POST` / `PATCH` controllers on `CertObjective` and `CertSignOff` use the middleware. The controller body does not need to know.

**Frontend:**
- Objective detail drawer renders a small "Authored by Alice K., 2026-04-17, AI-suggested by claude-opus-4-7 (accepted)" badge under the title.

### Acceptance

1. Creating an objective from the Web UI records `authorType = human`, `authorHumanUserId = req.user.userId`.
2. Creating an objective via the MCP `draft_requirement`-equivalent tool records `authorType = ai_suggestion`, with the model + prompt + context hash captured.
3. A human user accepting the AI suggestion updates `reviewStatus = approved`, `reviewerUserId`, `reviewTimestamp`.
4. The Audit Extract export now includes a provenance column per row.

### Risks

The retroactive backfill of existing rows assumes `authorType = human` and leaves `authorHumanUserId` null — acceptable for legacy data, but the migration should mark these rows visibly as "pre-provenance" in the UI to avoid faking compliance claims.

---

## #008 — Backend test scaffolding for certification

**Type:** test infrastructure  
**Effort:** 1 week  
**Priority:** P1 — ship alongside #001 to lock the seed behaviour.

### Problem

Zero tests cover the 54 certification endpoints. Refactor risk is high.

### Changes

**Test files** (`backend/src/__tests__/certification/`):
- `certification-context.test.ts` — GET + PATCH context, including the lazy-create path.
- `certification-objectives.test.ts` — CRUD on objectives, including the new catalogue-instantiate endpoint from #001.
- `certification-baselines.test.ts` — baseline create + immutability after #002 lands.
- `certification-findings.test.ts` — CRUD on findings, including denormalised array-FK consistency.
- `certification-signoffs.test.ts` — the password reauth path, IP/UA capture, duplicate-rejection, admin-vs-author update rules.
- `certification-exports.test.ts` — every export endpoint returns a non-empty buffer for a seeded project.
- `certification-matrix.test.ts` — the computed-matrix test post-#004: adding an objective changes the matrix immediately.
- `certification-package.test.ts` — the PSAC-export test post-#006: generated DOCX contains expected merge-field-resolved content.

**Test fixtures:** a `beforeAll` that seeds a tiny project (1 baseline, 5 objectives, 2 requirements, 2 evidence rows, 1 sign-off) into an isolated test database per `.claude/testing.md` rules.

### Acceptance

1. `npm test` in `backend/` runs the new suite cleanly.
2. Coverage on `backend/src/controllers/certification/index.ts` reaches >70% line coverage.
3. The auth-guard tests verify every endpoint returns 401 without a token.
4. Each happy-path test creates isolated test data with unique timestamps and cleans up in `afterAll`.

---

## #009 — Wire `appendActivity` to backend on every store mutation

**Type:** small bugfix  
**Effort:** 1 day  
**Priority:** P2

### Problem

The reducer pushes synthetic entries to `state.activityLog` on every mutating action but does not always call `POST /:projectId/activity-log`. A page reload silently drops the synthetic entries — the activity feed lies.

### Changes

After each mutating action in the certification store (`SET_BASELINE`, `UPDATE_OBJECTIVE`, `ADD_FINDING`, etc.), call `appendActivity({ projectId, action, details, actor })` from `certification.service.ts`. The reducer continues to push to in-memory state immediately for optimistic UI; the service call writes the persisted entry asynchronously.

### Acceptance

1. Mutate an objective. Reload the page. The activity entry survives.
2. Network failures gracefully retry without losing the in-memory entry.

---

## #010 — Stop hardcoding gate #1 default

**Type:** small bugfix  
**Effort:** 1 hour  
**Priority:** P2

### Problem

`OverviewTab.tsx:36` fallback gate #1 ("Configuration Frozen?") is hardcoded `passed: true` when no gates are seeded. This is a lie — without a signed CertBaseline, configuration is not frozen.

### Changes

In `OverviewTab`, derive gate #1 from the existence of a `CertBaseline` with `status = 'Frozen'` (or, post-#002, a `ProjectBaseline` in scope `['cert']` with status frozen).

### Acceptance

A fresh project shows gate #1 unsatisfied until a baseline is frozen.

---

## #011 — "(simulation — local only)" label on role chooser

**Type:** UI polish  
**Effort:** 30 minutes  
**Priority:** P2

### Problem

The Settings & Roles tab role chooser overrides what the user sees but does not change real RBAC. Naive demo viewers may believe they have admin permissions.

### Changes

Add a small `text-xs text-amber-600` label adjacent to the chooser: "(simulation — local only)". Same pattern as the Stakeholders module per `.claude/project.md`.

### Acceptance

The label is visible and renders correctly in light + dark mode.

---

## #012 — Findings unified with Issues

**Type:** schema bridge + UI unification  
**Effort:** 2 weeks  
**Priority:** P2

### Problem

Per `design-review.md` §5: `CertFinding` duplicates structure with `Issue`. Same finding shows up twice in the audit trail (once in `CertActivityLogEntry`, once in the issue's audit log if the user manually copied).

### Changes

- Add `Issue.kind` enum field (`generic | certification_finding | safety_finding | verification_defect`).
- New schema field `CertFinding.issueId` (FK to Issue).
- Backend: creating a CertFinding also creates a parallel Issue (or, alternately, the CertFinding row becomes a typed view over Issue). Recommend the parallel-row pattern for backward compatibility.
- Frontend: the Findings tab consumes the certification-typed issues directly. The Issues module renders the same issue with a "Cert finding" badge.

### Acceptance

1. Creating a certification finding writes both a `CertFinding` row and an `Issue` row, with FK linkage.
2. The Issues page lists certification-typed findings alongside other issues.
3. Closing the issue in either surface closes both.

---

## #013 — Bulk-instantiate objective catalogue endpoint

**Type:** new endpoint  
**Effort:** 2 days  
**Priority:** P2 — depends on #001

### Problem

Per `backend.md` §2 "Conspicuously missing": no bulk operations. Importing the DO-178C catalogue (71 objectives) requires 71 POSTs from the client.

### Changes

New endpoint `POST /:projectId/objectives/bulk` accepting `{ objectives: [{ objId, regRef, title, moc, ... }] }`. Creates all in a single Prisma `createMany`. Returns the created rows.

The catalogue-instantiate endpoint from #001 (`POST /:projectId/catalogues/:standard/instantiate`) is a specialised use of this.

### Acceptance

A single POST creates 71 objectives. Failure modes: per-row validation errors return a multi-result response (`{ created: [...], failed: [{ index: 3, error: '...' }] }`).

---

## #014 — Server-side role enforcement (RBAC)

**Type:** middleware + backend  
**Effort:** 1 week  
**Priority:** P1

### Problem

Per `backend.md` §8: role permissions live entirely on the client. An Auditor in the UI can still `PATCH` an objective via direct API call. This is a regression-grade gap.

### Changes

- Define a server-side equivalent of `frontend/src/modules/certification/certificationPermissions.ts` as `backend/src/services/certificationRbac.service.ts`.
- The user's `ProjectMember.engineeringRole` is the source of truth.
- Each certification mutating endpoint adds a `requireCertRole(['CertificationManager', 'ComplianceEngineer'])` middleware.
- For sign-offs specifically, the role assertion happens after the password-reauth check (so a wrong password gets a 401, not a 403 — preserves the "did you mistype your password?" feedback).

### Acceptance

1. A user whose `engineeringRole` is `Auditor` attempting `PATCH /:projectId/objectives/:id` gets HTTP 403.
2. The same user attempting `GET /:projectId/objectives` succeeds — reads are not gated.
3. The Auditor role's permissions are exhaustively tested in the new test scaffolding from #008.

---

## #015 — Per-objective MoC vocabulary

**Type:** small schema + UI  
**Effort:** 3 days  
**Priority:** P2 — depends on #001

### Problem

Per `design-review.md` §3: the MoC field is one 6-item union applied uniformly. DO-178C objectives have no MoC concept; DO-254 uses MoC1–MoC8.

### Changes

- Seed catalogue entries declare `validMocValues: String[]` (empty for DO-178C, MoC1–MoC8 for DO-254, etc.).
- `CertObjective` reads the catalogue's `validMocValues` when the row was instantiated from a catalogue entry.
- Frontend: the Objective drawer's MoC dropdown filters to `validMocValues`. When empty, the field is hidden entirely (with a tooltip: "DO-178C objectives use process, not MoC").

### Acceptance

DO-178C objectives show no MoC field. DO-254 objectives show MoC1–MoC8. CS-25 objectives show the existing 6-item union.

---

## #016 — AI-suggestion for objective-to-evidence linking

**Type:** AI integration  
**Effort:** 2 weeks  
**Priority:** P2 — depends on #007 (provenance) + the existing evidence pipeline

### Problem

Per `design-review.md` §4: today, linking evidence to an objective is a manual click-pick action. Per `ai-ready-vision.md` §7.4: the evidence pipeline can propose links with confidence scores; humans confirm.

### Changes

- New service `backend/src/services/cert/aiEvidenceLink.service.ts` that on evidence upload (`VerEvidence` row created):
  1. Computes a context hash from the evidence file's extracted text.
  2. Calls the AI inference layer (`backend/src/services/ai/`) with a prompt template that asks "which of these N objectives does this evidence satisfy?".
  3. Records the proposal as a `CertObjectiveEvidenceLink` row with `status = 'ai_suggested'`, `confidence: Float`, `authorAiInvocationId` populated.
  4. Surfaces the proposal in the Objective drawer with a "Suggested by AI (87% confidence)" badge.
  5. A human accept → `status = 'human_confirmed'`, `reviewerUserId` populated.

- New endpoint `POST /:projectId/objectives/:id/evidence-links/:linkId/accept` — human accepts the AI suggestion.
- New endpoint `POST /:projectId/objectives/:id/evidence-links/:linkId/reject` — human rejects.

### Acceptance

1. Uploading a new evidence file produces zero or more AI-suggested objective links.
2. Each link is visible in the Objective drawer with a confidence badge.
3. Rejecting a link records the rejection in provenance for future model improvement.
4. The audit log shows the AI suggestion + the human acceptance / rejection as a single event chain.

### Risks

The AI suggestion must default to off per project. Per `vision-and-usp.md` §13 risk #1: aerospace buyers are conservative — opt-in. Per `ai-ready-vision.md` §5 tier T1: this is a draft action; human review is mandatory; AI never confirms its own suggestion.

---

## #017 — Webhook surface for certification events

**Type:** new outbound integration  
**Effort:** 1 week  
**Priority:** P3 — depends on the existing webhook infrastructure (verify in roadmap.md Track B1)

### Problem

Per `backend.md` §2: no webhook surface today. CI/CD integration (test results → linked requirement → objective coverage) cannot signal back to certification state.

### Changes

- Define event types: `cert.objective.created`, `cert.objective.satisfied`, `cert.signoff.applied`, `cert.signoff.revoked`, `cert.baseline.frozen`, `cert.package.generated`.
- Plug into the existing Socket.IO / webhook layer (verify via `backend/src/realtime/realtime.ts`).
- Signed delivery, retry policy, deduplication key per event.

### Acceptance

External systems (Jenkins, GitHub Actions, customer-owned agents) can subscribe and receive events with HMAC signatures.

---

## #018 — Audit projectIdParam middleware coverage

**Type:** verification + middleware fix  
**Effort:** 2 days  
**Priority:** P1

### Problem

Per `backend.md` §8: the 50 non-signoff certification endpoints rely on the `projectIdParam` middleware. It is unclear (without auditing) whether this middleware enforces project membership in all cases.

### Changes

Read `backend/src/middleware/resolveProjectParam.middleware.ts`. If it resolves but does not enforce membership, extend it to enforce — or add an explicit `requireProjectMember` middleware to each route.

### Acceptance

A user who is not a `ProjectMember` for project X gets HTTP 403 on every `/api/v1/certification/X/*` endpoint.

---

## #019 — Activity-log unification (certification side)

**Type:** schema bridge  
**Effort:** 1 week  
**Cross-cutting:** seed cross-cutting #6 (eleven audit tables → one)  
**Priority:** P3

### Problem

`CertActivityLogEntry` is one of eleven audit tables. A DER asking "what happened on 2026-04-17?" must union 11 tables.

### Changes

When the cross-cutting refactor lands a canonical `EventStream` table, write a thin adapter that mirrors every `CertActivityLogEntry` write into the canonical stream with `domain: 'certification'`. The dedicated `CertActivityLogEntry` reads continue to work for backward compatibility.

### Acceptance

The canonical EventStream surface shows certification activity alongside other modules.

---

## #020 — DELETE on objectives, findings, review entries

**Type:** schema + controllers  
**Effort:** 3 days  
**Priority:** P2

### Problem

Per `backend.md` §2: no DELETE on objectives, findings, review entries, baselines, releases, correspondence. Wrongly-created data lives forever in the matrix.

### Changes

- Add `deletedAt: DateTime?` to `CertObjective`, `CertFinding`, `CertReviewLogEntry`. Soft-delete pattern matches `Requirement`.
- New endpoints `DELETE /:projectId/objectives/:id`, `DELETE /:projectId/findings/:id`, `DELETE /:projectId/review-log/:id`.
- Default GETs filter `deletedAt = null`.
- The matrix computation (#004) ignores soft-deleted objectives.
- A daily scheduled job (per the existing `cleanup.service.ts` pattern) permanently purges objectives soft-deleted >90 days.

### Acceptance

Deleting an objective removes it from all views immediately; the underlying row survives for 90 days for audit recovery.

---

## #021 — `meaningString` on certification sign-offs

**Type:** small schema + UI  
**Effort:** 1 day  
**Priority:** P3 — depends on #003

### Problem

Per `backend.md` §5.1: today's `CertSignOff` does not capture a meaning string. Part-11 requires it ("I approve this artefact").

### Changes

Already covered in the unified Signature primitive (#003). The certification frontend `SignatureDialog` must surface the meaning string visibly and require the user to acknowledge ("I approve the contents of checklist X as accurate and complete"). Default text is a system setting, non-modifiable per project.

### Acceptance

Every signed CertSignOff row has a non-empty `meaningString` accessible via the audit log and the PSAC export.

---

## #022 — Sticky context selector

**Type:** UI polish  
**Effort:** 30 minutes  
**Priority:** P3

### Problem

Per `design-review.md` §10: `ContextSelectorCard` scrolls out of view on long tabs. The user loses context of which baseline / release they are viewing.

### Changes

Make `ContextSelectorCard` `position: sticky; top: 0` inside the tab content viewport.

### Acceptance

Scrolling within any tab keeps the baseline / release dropdowns visible.

---

## #023 — Relative timestamps in activity feed

**Type:** UI polish  
**Effort:** 1 hour  
**Priority:** P3

### Problem

Per `design-review.md` §10: timestamps are shown in ISO format. Engineers prefer "3 hours ago."

### Changes

Use `date-fns` `formatDistanceToNow` for activity entries less than 7 days old. ISO for older entries (audit traceability).

### Acceptance

Recent activity shows relative times; older entries show absolute.

---

## §End — Effort summary

| Priority | Tickets | Total effort |
|---|---|---|
| P0 | #001, #002, #003, #006 | ~8 weeks (sequenced) |
| P1 | #004, #005, #007, #008, #014, #018 | ~4 weeks (parallelisable) |
| P2 | #009, #010, #011, #012, #013, #015, #016, #020 | ~5 weeks (parallelisable) |
| P3 | #017, #019, #021, #022, #023 | ~1 week |

**Total: ~18 engineer-weeks to fully close this package** — three engineers in parallel post-#001 brings the calendar timeline to under 8 weeks. The first 4 P0 tickets are the critical path; the remaining 18 tickets parallelise across the team.
