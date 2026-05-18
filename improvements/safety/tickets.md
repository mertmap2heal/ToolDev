# Safety Analysis — Tickets

All tickets sized at one engineer-week granularity. Prefixes:
- `SAFE-S-NNN` — schema migration
- `SAFE-B-NNN` — backend (routes, controllers, services, solvers)
- `SAFE-F-NNN` — frontend (services, pages, components)
- `SAFE-X-NNN` — cross-cutting (involves modules outside Safety)

Sequence assumes a one full-stack engineer plus one frontend specialist working in parallel. Total elapsed time: ~12 weeks for v1 (no AI features; no ARP4754A / ARP4761A workshop training in scope).

---

## SAFE-S-001 — Hazard schema migration

**Status:** Shipped — NX-9 / Issue #466. The 5 Hazard + FMEA models (`Hazard`, `FailureCondition`, `Fmea`, `FmeaRow`, `FmeaHazardLink`) shipped in the NX-9 foundational Safety slice; the FTA / Markov / CCA models remain in SAFE-S-002. The new `Project` safety-domain column is `safetyDomain` (additive, defaulted `"aerospace"`) — NOT a reuse of the pre-existing required free-text `Project.domain` (see the #466 Architecture comment). No `asil` column in this slice (aerospace-only at v1).

**Goal:** Add `Hazard`, `FailureCondition` Prisma models per `backend.md` §2.1 + §2.2.

**Steps:**
1. Edit `backend/prisma/schema.prisma` adding the two models and the required indices (`@@unique([projectId, identifier])`, `@@index([projectId, severity])`, `@@index([projectId, asil])`, `@@index([projectId, deletedAt])`).
2. Run `npx prisma generate` then `npx prisma db push --skip-generate` per `kb/backend-patterns.md`.
3. Per `kb/learnings.md` Prisma `generate before db push` rule.
4. Add `Project.domain String @default("aerospace")` column on `Project` model (or `ProjectDomain` enum if Prisma 5 enum support is configured).

**Acceptance:**
- `npx prisma db push` succeeds against the dev DB.
- Prisma client types include `prisma.hazard.*` and `prisma.failureCondition.*`.
- Existing data unaffected; `Project.domain` defaults to `"aerospace"` for existing rows.

**Effort:** ~3 days.

---

## SAFE-S-002 — FMEA / FTA / Markov / CCA schema migration

**Status:** Partially bundled. The `Fmea` / `FmeaRow` / `FmeaHazardLink` models are pulled forward into SAFE-S-001 under Issue #466 (NX-9 foundational slice). The remaining models — `Fta` / `FtaNode` / `FtaEdge` / `FtaHazardLink` (NX-9-followup-A), `MarkovChain` / `MarkovState` / `MarkovTransition` / `MarkovHazardLink` (NX-9-followup-B), `Cca` / `CcaHazardLink` (NX-9-followup-C) — stay here, to be split across the three NX-9 follow-on tickets.

**Goal:** Add `Fmea`, `FmeaRow`, `FmeaHazardLink`, `Fta`, `FtaNode`, `FtaEdge`, `FtaHazardLink`, `MarkovChain`, `MarkovState`, `MarkovTransition`, `MarkovHazardLink`, `Cca`, `CcaHazardLink` per `backend.md` §§2.3–2.6.

**Steps:**
1. Edit `backend/prisma/schema.prisma` adding the 12 models with relations + indices.
2. Run `npx prisma generate` then `npx prisma db push --skip-generate`.

**Acceptance:**
- Schema sync to dev DB succeeds.
- Prisma client types include all 12 new models.
- Cycle test: try creating a `FtaEdge` row in the DB referencing missing source/target — should fail at the Prisma level (no FK constraint violation).

**Effort:** ~4 days.

---

## SAFE-B-001 — Hazard CRUD routes

**Status:** Shipped — NX-9 / Issue #466. `safety.{routes,controller,service}.ts` trio mounted at `/api/v1/safety-analysis`; Hazard CRUD project-scoped (`authenticateToken` -> `projectIdParam` -> `requireProjectMember`), zod request schemas, soft-delete on DELETE, `?severity=`/`?status=` filters, server-derived `dal`. Routes 4-7's missing-link filters deferred (no backend link data this slice — NX-9-followup-D).

**Goal:** `GET / POST / PATCH / DELETE /projects/:projectId/safety-analysis/hazards[/:id]` per `kb/backend-patterns.md`.

**Steps:**
1. Create `backend/src/routes/safety.routes.ts` and register in `backend/src/routes/index.ts`.
2. Create `backend/src/controllers/safety.controller.ts` — thin handlers with `try/catch` + `{ success, data }` response shape.
3. Create `backend/src/services/safety.service.ts` — listHazards, getHazard, createHazard, updateHazard, softDeleteHazard.
4. All routes gated by `authenticateToken`.
5. Soft-delete: `deletedAt: null` filter in every list/get unless `?includeDeleted=true`.
6. List filters: `?severity=`, `?status=`, `?missingReqs=true`, `?missingVer=true`, `?missingIface=true`.
7. Validation: Zod schema rejecting `dal` on payload (server-derived); rejecting `asil` on aerospace projects, rejecting `severity` on automotive.

**Acceptance:**
- `curl POST /api/v1/projects/:id/safety-analysis/hazards` with `{title, description, severity: "Major"}` returns 201 + body with `dal: "C"`.
- `PATCH .../hazards/:id` with `{severity: "Catastrophic"}` returns 200 + body with `dal: "A"`.
- Soft-delete sets `deletedAt`; list without `?includeDeleted=true` excludes the row.
- Vitest tests: happy path, 401 missing auth, 400 invalid severity, 404 not found, 400 client-supplied `dal`. Hit real DB per `kb/backend-patterns.md`.

**Effort:** ~1 week.

---

## SAFE-B-002 — FailureCondition CRUD routes

**Status:** Shipped — NX-9 / Issue #466. FailureCondition CRUD scoped under `/hazards/:hazardId/failure-conditions`; `level` zod-validated to `AFHA` / `SFHA`; soft-delete on DELETE.

**Goal:** Same shape, scoped under `/hazards/:hazardId/failure-conditions`. Supports AFHA vs SFHA `level` differentiation per `kb/safety-standards.md`.

**Effort:** ~3 days.

---

## SAFE-B-003 — FMEA routes + RPN server-compute

**Status:** Shipped — NX-9 / Issue #466. FMEA CRUD + per-row CRUD; `rpn = severity*occurrence*detection` computed server-side after zod validation (`severity`/`occurrence`/`detection` each int 1-10); a client-supplied `rpn` -> 400; `rpn` recomputed on every row create/PATCH.

**Goal:** FMEA CRUD + per-row CRUD; RPN computed server-side and rejecting client-supplied values per `kb/safety-standards.md`.

**Steps:**
1. Routes: `GET / POST / PATCH / DELETE /safety-analysis/fmea[/:id]`, `/safety-analysis/fmea/:id/rows[/:rowId]`.
2. Service: `createFmeaRow({ severity, occurrence, detection, ... })` computes `rpn = severity * occurrence * detection` after Zod validation (each field 1..10).
3. Reject payloads with `rpn` field — return 400 "`rpn is server-computed`".
4. Tests: happy create, RPN computed correctly, client-supplied RPN rejected, Zod validation 400s.

**Acceptance:**
- A row with severity=7, occurrence=4, detection=3 returns `rpn: 84`.
- A row with severity=11 returns 400 (Zod max=10).
- A row payload `{severity, occurrence, detection, rpn: 1}` returns 400.

**Effort:** ~1 week.

---

## SAFE-B-004 — FTA CRUD routes

**Status:** Deferred to NX-9-followup-A (FTA + MOCUS solver) — not in the NX-9 foundational slice (Issue #466).

**Goal:** FTA + nodes + edges CRUD. TOP-singleton + cycle-detection validation.

**Steps:**
1. Routes per `backend.md` §3.
2. Validator (in service before save): reject if there are ≥2 `type: "TOP"` nodes; reject if DFS on edges returns true (cycle).
3. Gate fan-in validator: AND / OR gates with < 2 input edges return 400 "`gate requires at least 2 inputs`".

**Acceptance:**
- POST to add a second TOP node returns 400.
- POST to add an edge causing a cycle returns 400.
- POST to leave an AND gate with 1 child returns 400 on save (`fta/:id/validate` endpoint or implicit on PATCH).

**Effort:** ~1 week.

---

## SAFE-B-005 — Markov + CCA CRUD routes

**Status:** Deferred — not in the NX-9 foundational slice (Issue #466). The Markov CRUD goes to NX-9-followup-B (Markov + Gauss-Seidel solver); the CCA CRUD goes to NX-9-followup-C (CCA).

**Goal:** Markov state-machine + CCA CRUD per `backend.md` §§2.5–2.6.

**Steps:**
1. Routes per `backend.md` §3.
2. Markov rate validator: `rate >= 0`.
3. CCA `kind` validator: must be one of `zonal | particular_risks | common_mode`.

**Effort:** ~1 week.

---

## SAFE-B-006 — FTA MOCUS minimal cut-sets solver

**Status:** Deferred to NX-9-followup-A (FTA + MOCUS solver) — not in the NX-9 foundational slice (Issue #466). No new npm dependency (MOCUS is a graph algorithm, not a library).

**Goal:** Compute minimal cut-sets via MOCUS algorithm per `kb/safety-standards.md`. Endpoint `POST /safety-analysis/fta/:id/solve`.

**Algorithm:**
1. Load FTA graph: nodes (typed) + edges (parent → child).
2. Initialize working set `cuts = [[TOP_id]]`.
3. While any cut contains a non-BASIC node:
   - Pick a cut with a gate `g`.
   - Get `g`'s children from edges.
   - **AND gate:** replace `g` in this cut with all children (cut grows; size = old size + children − 1).
   - **OR gate:** for each child, create a copy of the cut with `g` replaced by that child (cuts split; total cuts = old × children count).
   - **INHIBIT gate:** treat as AND for v1 (proper conditional probability semantics out of scope; document the deviation in code comments).
4. After expansion: cuts contain only BASIC node IDs.
5. Remove duplicates and dominated cuts (any cut that is a strict superset of another).
6. Sort by size ascending.
7. Cache in `Fta.cutSets` JSON column.
8. Return as `{ cutSets: [[basicId, basicId, ...], ...], computedAt: ISO }`.

**Cap:** reject trees with > 100 basic events (return 400). Document in code comment per `kb/safety-standards.md` reference.

**Tests:**
- Single TOP → AND(b1, b2): cut-sets `[[b1, b2]]`.
- Single TOP → OR(b1, b2): cut-sets `[[b1], [b2]]`.
- Nested: TOP → AND(OR(b1,b2), b3): cut-sets `[[b1, b3], [b2, b3]]`.
- Dominated removal: cuts `[[b1], [b1, b2]]` reduce to `[[b1]]`.
- Performance: 50 basic events solves in < 1 s.

**Effort:** ~2 weeks (algorithm + comprehensive tests).

---

## SAFE-B-007 — Markov Gauss-Seidel steady-state solver

**Status:** Deferred to NX-9-followup-B (Markov + Gauss-Seidel solver) — not in the NX-9 foundational slice (Issue #466). **This follow-on carries the `mathjs` npm-dependency permission request** (`.claude/rules.md` §2) — the Gauss-Seidel solve needs `math.lusolve`.

**Goal:** Solve `π · Q = 0`, `Σπ = 1` per `kb/safety-standards.md`. Endpoint `POST /safety-analysis/markov/:id/solve`.

**Algorithm:**
1. Load chain: states + transitions.
2. Build generator matrix `Q` (NxN, N = state count). `Q[i][j]` = rate from `i` to `j` for `i ≠ j`; `Q[i][i]` = −Σ(off-diagonal row).
3. Replace last column of `Q^T` with column of 1s; replace last entry of zero-vector with 1.
4. Solve `Q^T · π = b` via `math.lusolve(Q.T, b)` (use `mathjs` per `kb/safety-standards.md`).
5. Result: `π = { stateId: probability, ... }`.
6. Compute `availability = 1 − Σ(probability for states with tag === 'failed')`.
7. Cache `MarkovChain.steadyState` JSON column + `availability` Float column.
8. Compare against linked-hazard `failureRateTargetPerHr`; flag failure if computed rate > target.

**Tests:**
- 2-state safe ↔ failed with rates λ (fail) and μ (repair): steady-state probability of safe = μ/(λ+μ), failed = λ/(λ+μ). Verify within 1e-9.
- Unreachable state (no incoming transitions): probability 0.
- 3-state chain: hand-computed expected output matches solver to 1e-9.
- Performance: 20-state chain solves in < 100 ms.

**Effort:** ~1.5 weeks (solver + tests + mathjs integration verification).

---

## SAFE-B-008 — FMEA xUnit-style import parser

**Status:** Deferred to NX-9-followup-D (remaining mock Safety pages + export/import) — not in the NX-9 foundational slice (Issue #466).

**Goal:** Some teams maintain FMEAs in xUnit-style XML exports from Excel-add-in tools. Provide an import endpoint `POST /safety-analysis/fmea/import` that accepts XML (or CSV) and creates an FMEA + rows.

**Steps:**
1. Multer file-upload endpoint per `kb/backend-patterns.md` (50 MB body limit).
2. Parser dispatches on content-type or filename extension (`.xml` → xml2js, `.csv` → papaparse, `.xlsx` → exceljs).
3. Map xUnit-style `<testsuite><testcase>...` to FMEA rows; map CSV columns to row fields with a header-row contract documented in the API.
4. Server computes RPN on each row.
5. Return `{ success, data: { fmeaId, rowCount }, message }`.

**Tests:**
- Sample XML in `backend/src/__tests__/fmea-fixtures/`.
- Sample CSV with 50 rows.
- Sample XLSX with 100 rows.
- 401 missing auth; 400 missing file; 400 malformed XML; 400 row with severity=11.

**Effort:** ~1 week.

---

## SAFE-B-009 — ICD-style export endpoint (FTA tree as DOCX)

**Status:** Deferred to NX-9-followup-D (remaining mock Safety pages + export/import) — not in the NX-9 foundational slice (Issue #466). Depends on the FTA models from NX-9-followup-A.

**Goal:** Reuse the `corporateDocxTemplates` pipeline (per `kb/documentation-model.md`) to export an FTA tree as DOCX with the cut-sets table. Endpoint `GET /safety-analysis/fta/:id/icd?format=json|csv|docx`.

**Steps:**
1. JSON format: returns the FTA payload + cut-sets directly.
2. CSV format: cut-sets as rows with comma-separated basic-event IDs and labels.
3. DOCX format: merges into a corporate template via the existing `exportJobs` pipeline. New template tag `fta_cut_sets` resolves to a table at render time.

**Acceptance:**
- `?format=json` returns the JSON payload.
- `?format=csv` returns text/csv with proper escaping.
- `?format=docx` returns binary DOCX, file extension correct, downloaded file opens in Word and shows the cut-sets table.

**Effort:** ~1 week.

---

## SAFE-B-010 — Severity → DAL propagation

**Status:** Partially shipped — NX-9 / Issue #466. The **per-hazard `severity` → `dal` derivation** (the `hazard.dal` column computed server-side and persisted on every Hazard create/update via the frozen `kb/safety-standards.md` map) shipped in the NX-9 foundational slice. The **cross-module propagation transaction** — the `TraceLink` walk re-deriving DAL on every traced Requirement / function / component, the `RequirementVersion` writes, the Socket.IO `safety:dal-propagated` event, the CCB-review notice on downgrade — stays here and is deferred to NX-9-followup-A's sibling cross-module work.

**Goal:** The cross-cutting wire that makes the certification-native pitch demonstrable. When a hazard's severity changes, recompute DAL on every traced requirement / function / interface / component.

**Steps:**
1. In `safety.service.ts → updateHazard`, after the hazard write:
   a. Query `TraceLink` for all targets where `sourceKind === 'hazard' && sourceId === hazardId` (and the inverse direction).
   b. For each traced artefact, fetch the artefact + ALL its other linked hazards.
   c. Compute artefact's new DAL = `max(linkedHazard.dal)` over all linked hazards (DAL ordering: A > B > C > D > E).
   d. If new DAL > current DAL: write artefact change as a new version row (`RequirementVersion` etc.), update artefact, notify subscribers.
   e. If new DAL < current DAL: log a notice, do NOT auto-downgrade per `kb/configuration-management.md`. Emit an `AdminTask` for CCB review.
2. Wrap the entire flow in `prisma.$transaction` per `kb/backend-patterns.md` — any failure rolls the hazard severity change back.
3. Emit a Socket.IO event `safety:dal-propagated` with `{ hazardId, affectedCount, affectedKinds }` per `kb/backend-patterns.md` real-time pattern.

**Tests:**
- Create hazard "Catastrophic" → traced to req X. Verify `req.dal === 'A'`.
- Change to "Major" → verify req DAL **unchanged** + audit log entry "downgrade pending CCB".
- Create second hazard "Hazardous" traced to same req X. Verify `req.dal === 'B'`.
- Soft-delete the Catastrophic hazard. Verify req DAL remains B (from the Hazardous hazard).
- Soft-delete all linked hazards. Verify req DAL becomes null + audit log entry "no linked hazards remaining".

**Effort:** ~2 weeks. **This is the highest-value backend ticket in Safety.**

---

## SAFE-B-011 — Audit log integration

**Status:** Shipped — NX-9 / Issue #466. Every Safety service write records one row to the central `AuditLog` (no `SafetyAuditLog` table) via a module-private `writeAudit` helper, action strings on the `safety:<kebab-verb>` convention (`safety:hazard-create`, `safety:fmea-row-update`, …), `detailsJson` a structured object. Safety joins Validation + Stakeholders as a from-day-one consumer of the central table.

**Goal:** Writes through the universal audit table (per `inventory.md` gap #11). Do not introduce a `SafetyAuditLog` table.

**Steps:**
1. Every safety service write calls the existing `auditLog.service.ts → logAction()` helper (or whatever the universal write path becomes when gap #11 lands).
2. Include the actor, the entity ID, the before/after JSON, and the action verb.
3. The Safety Audit Log page reads from the universal table filtered by `entityKind LIKE 'safety:%'`.

**Effort:** ~3 days.

---

## SAFE-F-001 — Replace mock imports with services

**Status:** Partially shipped — NX-9 / Issue #466. `frontend/src/services/safety.service.ts` created; `HazardsPage` reads `useQuery(['hazards', projectId], …)` (no `MOCK_HAZARDS` import), and the `FmeaForm` worksheet persists rows to the real FMEA-row backend rendering the server `rpn`. Wiring the remaining ~15 mock Safety pages (Overview, Analyses landing/list/wizard, Traceability matrix, Impact, Libraries, Reviews, Audit Log, Exports, Settings) is deferred to NX-9-followup-D.

**Follow-up — orphan `Fmea` on an abandoned wizard (deferred to NX-9-followup-D).** `WizardFmeaWorksheet` (`frontend/src/components/safety/FmeaForm.tsx`) lazily creates a real persisted `Fmea` row on first mount of wizard step 5, because the wizard's analysis entity is itself still mock (no stored analysis row to anchor a `Fmea` to). A user who opens the FMEA wizard step and abandons the wizard leaves an orphan (soft-deletable) `Fmea`. A correct fix needs real wizard-lifecycle rework — a draft-until-first-save promotion state machine plus a create-trigger wired to the wizard's Next action across `CreateAnalysisWizardPage` / `EditAnalysisWizardPage` — which is out of the NX-9 foundational slice's scope (`.claude/rules.md` §10). NX-9-followup-D lands the real analysis entity, which removes the lazy-create hack entirely; fix this there.

**Goal:** Wire `frontend/src/services/safety.service.ts` to the new backend, replace all 18 `MOCK_*` imports with React Query hooks.

**Steps:**
1. Create `frontend/src/services/safety.service.ts` per `kb/react-typescript.md`.
2. Replace `import { MOCK_HAZARDS } from '../../data/mockSafety'` etc. in each of the 17 pages with `useQuery({ queryKey: ['hazards', projectId], queryFn: () => listHazards(projectId) })`.
3. Maintain `mockSafety.ts` for the e2e fixture path (e2e tests seed via the API, not via mock imports) but delete the production imports.
4. Loading + error states via the standard `<LoadingSpinner>` / `<ErrorMessage>` per `kb/react-typescript.md`.

**Effort:** ~4 weeks (17 pages × ~1.5 days each).

---

## SAFE-F-002 — Real Hazard Create modal

**Status:** Shipped — NX-9 / Issue #466 — the aerospace severity path. The placeholder "UI stub only" modal is replaced with a real Title / Description / Severity create form calling `createHazard()`; on success it invalidates `['hazards', projectId]` and closes. No DAL input — DAL is server-derived and shown read-only as a mono badge in the list. The automotive S/E/C step is deferred (the `Project.safetyDomain` column is added by NX-9 for forward-compatibility; the automotive branch is NX-9-followup work).

**Goal:** Replace the "Create Hazard will be implemented later. UI stub only." placeholder with a real create form per `design-review.md` §5 and `design-system.md` §2.2.

**Steps:**
1. Replace `HazardsPage` create modal with a multi-step modal: Title + Description → Severity (with AC 25.1309-1A reference inline per `design-system.md` §2.3) → Link Requirements / Verifications / Interfaces / Change Requests.
2. Submit calls `createHazard()` from `safety.service.ts`.
3. On success: invalidate `['hazards', projectId]`, close modal, scroll to new row.
4. On automotive project: replace Severity step with S/E/C dropdowns.

**Effort:** ~1.5 weeks.

---

## SAFE-F-003 — Wizard wired to backend mutations

**Goal:** Replace `alert(...)` stubs in `CreateAnalysisWizardPage` Save Draft / Submit for Review buttons with real mutations.

**Steps:**
1. Per-method service functions: `createFha`, `createPssa`, `createSsa`, `createFmea`, `createCca`, `createFta` (no inputs at create time, opens canvas), `createMarkov` (same).
2. Save Draft → `status: "Draft"` mutation; navigate to edit view.
3. Submit for Review → `status: "InReview"` mutation; navigate to reviews inbox.
4. Step 5 for FTA / Markov: embed `<FtaCanvas>` / `<MarkovEditor>` inline with `analysisId` as scope prop. Replace current redirect-to-other-page UX per `design-review.md` §2.4.

**Effort:** ~2 weeks.

---

## SAFE-F-004 — FTA canvas validators + cut-set panel

**Goal:** Wire FTA canvas to the new backend; show the computed minimal cut-sets in a side panel; enforce TOP-singleton + cycle-detection client-side as a UX nicety (server is the source of truth).

**Steps:**
1. Toolbar Add-TOP button: disable when a TOP node exists in canvas state.
2. On Save: call `POST /safety-analysis/fta/:id/solve`; display cut-sets in a right-side panel.
3. Cut-set panel: list of cuts sorted by size, each cut as a comma-list of basic-event labels.
4. If a basic event has `probability`, compute cut probability (product of basic probabilities) and sort by descending importance.
5. Client-side cycle detection on edge add: refuse the connect with a toast.

**Effort:** ~1.5 weeks.

---

## SAFE-F-005 — Markov solver wiring + Results card real numbers

**Goal:** Replace em-dashes in the Results card with real solver output.

**Steps:**
1. On Save: call `POST /safety-analysis/markov/:id/solve`.
2. Results card reads `availability`, `steadyState`, and the linked-hazard `failureRateTargetPerHr` per `design-review.md` §3.3.
3. Per the AC 25.1309 threshold compare: show numeric result + amber flag if computed > target.
4. Transition rate input becomes `<input type="number" step="any">` with a unit toggle (/hr, /flight-hr, /cycle) — backend stores canonical per-hour.

**Effort:** ~1 week.

---

## SAFE-F-006 — Traceability matrix wiring + coverage export

**Goal:** Real backend reads + coverage CSV / DOCX export.

**Steps:**
1. Each of the 5 views calls a service: `getTraceabilityMatrix(view, projectId)`.
2. Column virtualization (use `@tanstack/react-virtual` — verify dependency already declared in `package.json`; if not, add per `kb/learnings.md` undeclared-imports rule).
3. Coverage header strip with per-row aggregates.
4. Export button → `corporateDocxTemplates` pipeline.

**Effort:** ~2 weeks.

---

## SAFE-X-001 — TraceLink polymorphic sourceKind / targetKind extension

**Goal:** Per `backend.md` §2.7, extend the polymorphic TraceLink to support `hazard` and `failure_condition` source/target kinds.

**Steps:**
1. No schema change (TraceLink is already `String` sourceKind / targetKind).
2. Update `frontend/src/linkage/` adapters: add `hazardAdapter.ts` and `failureConditionAdapter.ts` per `kb/react-typescript.md`.
3. Update `buildDeepLink.ts` switch statement.
4. Wire `frontend/src/services/traceability.service.ts` to expose hazard and failureCondition cases.

**Effort:** ~3 days. **Touches Requirements (`linkage/` shared file) — coordinate with Requirements team.**

---

## SAFE-X-002 — Requirement.dal field derivation

**Goal:** When the severity → DAL propagation runs (SAFE-B-010), the target update must use the `Requirement` table. If `Requirement.dal` does not exist, add it.

**Steps:**
1. Check `Requirement` model in `schema.prisma` for `dal` column. (Per `inventory.md` it has `requirementType` and many other fields; verify whether `dal` is already present.)
2. If absent: add `dal String?` and `dalDerivedFromHazardIds Json?` (audit trail of which hazards drove the DAL).
3. Migration + Prisma generate.
4. Update Requirements service to expose `dal` in the API.
5. Update `RequirementsPage` to display DAL pill on every row.

**Effort:** ~1 week. **Touches Requirements module substantially — coordinate.**

---

## SAFE-X-003 — Project.domain switch + UI conditional

**Goal:** Per `design-review.md` §6 and `kb/safety-standards.md`, the hazard form switches between aerospace severity and automotive S/E/C based on `project.domain`.

**Steps:**
1. `Project.domain` column already added in SAFE-S-001.
2. Project Settings page gains a "Domain" field — read-only after first hazard exists (rationale: switching domain mid-project would invalidate every hazard's classification).
3. `HazardsPage` reads `useProject(projectId).domain` and renders the appropriate form.
4. Feature flag `safety-asil-mode` per `kb/feature-flags.md` — hide the automotive form behind the flag at v1.

**Effort:** ~1 week. **Touches Projects module — coordinate.**

---

## SAFE-X-004 — Safety demo banner gating

**Goal:** Replace the unconditional demo banner in `SafetyLayoutPage` with a feature-flag gate per `kb/feature-flags.md`.

**Steps:**
1. Wrap the banner JSX in `{!isEnabled('safety-persistence') && <Banner />}`.
2. Add the feature flag to `frontend/src/config/packages/*.json` — `safety-persistence` enabled only on `complete`.
3. Once SAFE-B-001..011 ship, set the flag on dev `complete` and on staging `complete`. Production demo decides per-customer.

**Effort:** ~1 day.

---

## SAFE-X-005 — Universal provenance migration on Hazard

**Status:** Shipped — NX-9 / Issue #466. The R-1 8-field AI-provenance lattice (`authorType` default `"human"`, `authorAiModel`/`Version`/`PromptId`/`ContextHash`, `provenanceReviewStatus` default `"drafted"`, `reviewerUserId`, `reviewTimestamp`) is applied verbatim to `Hazard`, `Fmea`, and `FmeaRow`. `FailureCondition` and `FmeaHazardLink` opt out (a child detail row / a pure join — R-1's own opt-out precedent). The canonical review-state field is `provenanceReviewStatus`.

**Goal:** Apply the universal-provenance lattice per `cross-cutting.md` to the `Hazard` model. This is the cross-cutting refactor #1 in `gap-summary.md` §1.

**Steps:**
1. The `Hazard` schema in SAFE-S-001 already includes `authorType`, `authorAiModel`, `authorAiPromptId`, `classification`, `reviewStatus` per the universal-provenance lattice. Verify the schema in SAFE-S-001 includes these — yes, see `backend.md` §2.1.
2. When the universal-provenance migration mixin lands (a separate ticket outside Safety scope per `gap-summary.md` §1), Hazard is already conforming.

**Effort:** ~0 (preventive — included in SAFE-S-001).

---

## Sequencing summary

```
Week 1-2:    SAFE-S-001, SAFE-S-002, SAFE-B-001        [schema + Hazard CRUD]
Week 3-4:    SAFE-B-002, SAFE-B-003, SAFE-B-004        [FC, FMEA, FTA routes]
Week 5-6:    SAFE-B-005, SAFE-B-006 begins             [Markov/CCA routes, MOCUS solver]
Week 7-8:    SAFE-B-006 ends, SAFE-B-007, SAFE-B-008   [MOCUS + Gauss-Seidel + parser]
Week 9-10:   SAFE-B-009, SAFE-B-010, SAFE-B-011        [ICD export, DAL propagation, audit]

In parallel (frontend specialist):
Week 1-4:    SAFE-F-001 (17 pages wiring)
Week 5-6:    SAFE-F-002 (Hazard create modal)
Week 7-8:    SAFE-F-003 (wizard mutations)
Week 9:      SAFE-F-004 (FTA canvas)
Week 10:     SAFE-F-005 (Markov solver UI)
Week 11-12:  SAFE-F-006 (traceability matrix + coverage export)

Cross-cutting interleaved:
Week 3-4:    SAFE-X-001 (TraceLink kinds)
Week 5-6:    SAFE-X-002 (Requirement.dal)
Week 7:      SAFE-X-003 (Project.domain)
Week 10:     SAFE-X-004 (banner gating)
```

Total: ~12 weeks elapsed, ~22 engineer-weeks of effort. One quarter to ship Safety v1.

---

## Cross-cutting findings (append to `cross-cutting.md`)

The following two findings cross-cut the Requirements module and must be raised in the Requirements review packages:

### CC-SAFE-A — Severity → DAL propagation cross-cuts Requirements

The DAL field on `Requirement` becomes a derived column populated by the safety service's propagation function (SAFE-B-010). When a hazard severity changes, every traced requirement's DAL recomputes as `max(linked-hazard DALs)`. The Requirements module must (a) display the DAL pill, (b) refuse manual DAL edits (it is derived), (c) show the propagation history in the requirement detail drawer, (d) enforce DAL-based verification-method filters (per `design-system.md` §2.3 and `vision-and-usp.md` §10). Coordinate with Requirements team; ticket SAFE-X-002.

### CC-SAFE-B — Severity classification is project-domain-aware

Aerospace projects map severity → DAL. Automotive projects use S/E/C → ASIL per `kb/safety-standards.md`. The `Project.domain` field gates the classification logic across Hazard, Requirement, Verification, and Component tables — any module that surfaces DAL or ASIL must read `project.domain`. The reverse mapping (DAL → ASIL) is **not** defined in `kb/safety-standards.md` and should never be inferred — a project is one or the other, switching domain mid-project is forbidden. Ticket SAFE-X-003.
