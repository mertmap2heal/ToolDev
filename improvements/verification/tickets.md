# Verification — Tickets

Grouped by horizon. Effort: S = ≤1 day, M = 2-5 days, L = 1-2 weeks, XL = 2-4 weeks, XXL = >1 month. "Closes gap N" references `improvements/_shared/gap-summary.md`.

---

## Quick wins (S–M)

### V-QW-1 — Extract inline route handlers to controllers
**Effort:** S
**Why:** `verification.routes.ts` lines 128-292 contain 9 inline handlers calling `traceabilityMatrixService`, `reportService`, `exportTemplateService`. Convention enforced everywhere else in `kb/backend-patterns.md` is route → controller → service. Inline handlers violate this and invite copy-paste anti-patterns.
**Tasks:**
- Create `backend/src/controllers/verification/traceabilityMatrix.controller.ts` (2 endpoints).
- Create `backend/src/controllers/verification/report.controller.ts` (6 endpoints).
- Create `backend/src/controllers/verification/exportTemplate.controller.ts` (1 endpoint).
- Update route file to import them.
**Acceptance:** 9 inline async handlers removed from `verification.routes.ts`. All existing tests pass. No endpoint URL change.

### V-QW-2 — Add `test-result` and `test-setup` to `VerificationReportPage` entity map
**Effort:** S
**Why:** Backend endpoints `/reports/test-result/:projectId/:id` and `/reports/test-setup/:projectId/:id` exist (lines 247-269 of `verification.routes.ts`) but `VerificationReportPage` only routes `case/plan/run`. Engineers cannot print a single test-result or single test-setup report.
**Tasks:**
- Extend `ENTITY_TYPE_MAP` in `VerificationReportPage.tsx`.
- Wire `verificationService.getTestSetupReport / getTestResultReport`.
- Extend `VerificationReportView` to render the two new shapes.
**Acceptance:** `/verification/report/setup/:id` and `/verification/report/result/:id` render the printable report.

### V-QW-3 — Per-tab opinionated empty states
**Effort:** M
**Why:** `design-system.md` §2.1 + §2.3. Each tab today shows a generic "No items yet." Each empty state is a missed teaching opportunity (and a missed `design-system.md` north-star moment).
**Tasks:** Author copy + a single-click create CTA per tab (Plans/Cases/Setups/Runs/Results), referencing DO-178C SVP language.
**Acceptance:** Each empty state cites the certification artefact the tab produces.

### V-QW-4 — Shared `<DrawerActionsFooter>` for consistent action order
**Effort:** M
**Why:** All five drawers have a sticky footer but the order and styling of actions varies. `design-review.md` §4.
**Tasks:** New shared component with prop-driven actions; refactor TestPlan / TestCase / TestSetup / TestResult / TestRun drawers to use it.
**Acceptance:** All five drawers render the same action order.

### V-QW-5 — Add role gating to approval endpoints
**Effort:** M
**Why:** `/methods/.../approve`, `/setups/.../approve`, `/test-cases/.../approve`, `/test-plans/.../approve`, `/reviews/.../close`, `/nonconformities/.../mark-reverified` all silently accept any project member's sign-off. Pre-audit risk. Cross-cutting #5.
**Tasks:**
- Add `requireProjectRole('VerificationEngineer')` (new middleware).
- Seed `VerificationEngineer`, `SafetyEngineer`, `Auditor` admin-role templates per `kb/configuration-management.md`.
- Apply to listed endpoints.
**Acceptance:** Non-`VerificationEngineer` project members get 403 on approval endpoints.

### V-QW-6 — Migrate / archive legacy `VerificationPlan` model
**Effort:** M
**Why:** `schema.prisma` line 631 has a `VerificationPlan` model used by older requirements routes, alongside `VerTestPlan` at line 2660. Two test-plan concepts confuse new contributors and bloat the surface.
**Tasks:** Map any remaining consumers to `VerTestPlan`, then drop / rename. Schema migration with explicit user approval.
**Acceptance:** One test-plan model.

---

## Near-term (M–L)

### V-NT-1 — Wire xUnit / JUnit / NUnit / pytest / Robot / SARIF / LCOV parsers
**Effort:** L
**Closes:** Gap #4 in `gap-summary.md`.
**Why:** The headline competitive ask. Every named competitor ingests CI-native output (Polarion: xUnit out-of-box; Codebeamer: dedicated Jenkins plugins; Jama: REST + samples; DOORS+ETM: Selenium/Jenkins; Xray: native plugins). Today our `/runs/ingest/:projectId` endpoint exists but accepts only our custom JSON DSL, not anyone's CI output.
**Tasks:**
- New sub-service `backend/src/services/verification/ingestion/` with one parser per format:
  - `parseJUnitXml(buffer): IngestedTestRun`
  - `parseXUnitXml(buffer): IngestedTestRun` (.NET legacy)
  - `parseNUnit2Xml(buffer): IngestedTestRun` + `parseNUnit3Xml(buffer): IngestedTestRun`
  - `parsePytestJson(buffer): IngestedTestRun`
  - `parseRobotXml(buffer): IngestedTestRun` (Robot Framework `output.xml`)
  - `parseTap(buffer): IngestedTestRun`
  - `parseSarif(buffer): IngestedTestRun` (analysis MoC)
  - `parseLcov(buffer): IngestedCoverage` + `parseCobertura(buffer): IngestedCoverage`
- Common canonical shape: `IngestedTestRun { metadata, results: { testCaseKey, status, duration, evidence?, stdout?, stderr? }[] }`.
- Endpoint accepts `Content-Type: application/xml`, `application/json`, multipart-form for file upload; sniffs format; converges into `ingestAutomatedResult` flow.
- Add `?format=<name>` query override.
- Each parser test-covered with at least one canonical fixture (the Jenkins JUnit sample, the Robot Framework example output, etc.).
**Acceptance:** A `curl -X POST /api/v1/verification/runs/ingest/:projectId --data-binary @junit.xml -H 'Content-Type: application/xml'` creates one `VerTestRun` with one `VerTestRunResult` per `<testcase>`, linked to existing `VerTestCase` by name. Coverage page reflects new pass/fail within an SLA.

### V-NT-2 — Split `verification.routes.ts` into `routes/verification/` sub-files
**Effort:** L
**Why:** 131 endpoints in one 338-line file. See `backend.md` §1-2. Pure re-organisation, zero URL change.
**Tasks:**
- Create `backend/src/routes/verification/` with 21 sub-files (one per controller).
- Move sub-router mounts into a `verification/index.ts` that the existing import-from-`routes/index.ts` consumes.
- Each sub-file is self-contained: imports its controller, declares its sub-router, exports it.
**Acceptance:** No URL change. Largest sub-file ≤30 lines. `verification.routes.ts` reduced to a mounting index.

### V-NT-3 — Replace Overview tab with Objective Satisfaction Matrix
**Effort:** L
**Closes:** `design-system.md` §8.2 promise.
**Why:** Today the Overview tab is a generic metrics card. No competitor ships a `CertObjective × VerMoc × Requirement` matrix — both parity item (we get a coverage matrix) and differentiator (we get the cert-native matrix).
**Tasks:**
- New `OverviewMatrix.tsx` component.
- Backend endpoint `/coverage/:projectId/objective-matrix` aggregating `CertObjective × VerMoc × {requirement count, pass rate, suspect count, missing-evidence count}`.
- Cells coloured by `status.success` / `status.warning` / `status.danger` tokens.
- Click → drilldown panel showing the underlying requirements.
**Acceptance:** Demo: open Overview tab → see DO-178C objectives table A-3 through A-10 with live counts; click a cell with red tint → see the offending requirements.

### V-NT-4 — Bulk action bar on Plans / Cases / Setups / Runs / Results tabs
**Effort:** L
**Closes:** Gap #9 in `gap-summary.md` (in part).
**Why:** Selecting one row at a time does not scale past 50 cases. Every competitor has it.
**Tasks:**
- New `<BulkActionBar>` shared component.
- Per-tab actions:
  - Cases: bulk approve, bulk set MoC, bulk assign owner, bulk archive, bulk duplicate to plan.
  - Plans: bulk approve, bulk archive, bulk run-all-cases.
  - Setups: bulk approve, bulk duplicate, bulk archive.
  - Runs: bulk abort, bulk export.
  - Results: bulk re-link, bulk download, bulk archive.
- Each backend bulk endpoint follows `/bulk/<verb>` convention with batch IDs in audit log.
**Acceptance:** Select 25 cases, click "Approve" → 25 cases approved in one transaction, 25 `VerAuditEvent` rows with one shared `batchId`.

### V-NT-5 — `VerObjectiveLink` table for direct test-case → objective satisfaction
**Effort:** M
**Why:** Today the chain `VerTestCase → CertObjective` is implicit via `Requirement → CertObjective`. For DO-178C objective satisfaction audit-package export we need explicit links so the export can write "objective A-5.5 is satisfied by test cases [TC-...]". Schema gap.
**Tasks:**
- Add `VerObjectiveLink { id, projectId, testCaseId, certObjectiveId, justification }`.
- Endpoint + UI in the test-case drawer to add/remove.
- Surface in the new Objective Satisfaction Matrix.
**Acceptance:** A test case can claim 1..N objectives directly.

### V-NT-6 — `VerTestCaseVersion` table to back diff view
**Effort:** L
**Closes:** Gap #7 in `gap-summary.md` partially.
**Why:** `VerTestCase.version` is in-row String. Diff between versions is impossible. Cannot restore an older version.
**Tasks:**
- Add `VerTestCaseVersion { id, testCaseId, version, snapshotJson, authoredByUserId, authoredAt, ... }`.
- On every `PATCH /test-cases/:id`, create a new version row.
- Diff endpoint + drawer panel.
**Acceptance:** Open a test case → click "Version history" → pick two versions → see field-level diff.

### V-NT-7 — Wire `VerSettings` JSON columns to UI editors
**Effort:** L
**Closes:** `design-system.md` §2.1 opinionated-defaults principle.
**Why:** `VerSettings.allowedMocCodes`, `mocRulesByCriticality`, `lifecycleRules`, `namingRules`, `permissionsMap` are all editable via API but have no UI. Settings page is hollow.
**Tasks:**
- Five new editor components.
- `validateSettings` endpoint (line 183) already exists — wire it.
**Acceptance:** Project admin can configure MoC rules per DAL, naming conventions, lifecycle states, and CCB permissions from `/verification/settings`.

### V-NT-8 — Seeded DO-178C / DO-254 / ARP4754A test-case + test-plan templates
**Effort:** M
**Closes:** `vision-and-usp.md` §8.1 "Zero-rollout" promise.
**Why:** Today `VerTemplate` exists but no seed script populates it. New projects start with an empty template library; aerospace demos look thin.
**Tasks:**
- New seed script `backend/src/scripts/seedVerTemplates.ts`.
- Three DO-178C test-case templates (DAL-A / B / C-D variants), three test-plan templates (Software Verification Plan, HW Verification Plan, System Verification Plan).
- Wire to `start.ps1` initial-data flow.
**Acceptance:** A new project shows 6 published templates immediately, each with seeded sections matching the corresponding regulator artefact.

### V-NT-9 — Templates: scope tiers + fork-on-edit-published
**Effort:** M
**Why:** `VerTemplate.projectId NOT NULL` means no company-wide or personal templates. Editing a Published template silently overwrites instead of forking.
**Tasks:**
- Migrate `projectId` to nullable; add `companyId` + `userId` columns.
- Modify `updateTemplate` controller: if template is `PUBLISHED` and content changes, create a new `Draft` version that supersedes on publish.
**Acceptance:** Template library shows Personal / Project / Company scopes; editing a Published template creates a Draft fork.

### V-NT-10 — Pilot OpenAPI annotation on verification routes
**Effort:** L
**Closes:** Gap #10 in `gap-summary.md`.
**Why:** Largest single route file, ideal pilot for `zod-openapi`. Once verification compiles to a spec, the rest follows.
**Tasks:**
- Adopt `zod-openapi` (cost: one new dev dependency — requires user approval per Rule 2).
- Annotate every verification controller with request/response Zod schemas.
- Serve at `/api/v1/docs/verification`.
**Acceptance:** Swagger UI live with the 131 verification endpoints documented.

---

## Long-term (XL–XXL)

### V-LT-1 — Provenance lattice on every Verification artefact
**Effort:** XL
**Closes:** Gap #5 in `gap-summary.md`. Cross-cutting #1.
**Why:** Today `Parameter` is the only model with the AI-provenance lattice. To claim "AI-native, certification-grade" (per `vision-and-usp.md` §7) we need it on `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerEvidence`, `VerMoc`, `VerNonconformity`, `VerReview` — every cert-relevant Verification artefact.
**Tasks:**
- Extract the Parameter lattice into a reusable mixin (`authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `classification`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`).
- Migrate all 8 listed Ver* tables.
- Update every write path (controllers + middleware) to populate provenance from `req.user` or AI agent identity.
- `AiInvocation` ↔ artefact join (`AiInvocationLink` polymorphic).
- Drawer UI: per-field "Authored by Claude Sonnet 4.6, reviewed by C. Mandle 2026-04-13" attribution.
**Acceptance:** Every Verification write records its author identity. Audit-log query returns the full author chain for any artefact.

### V-LT-2 — `VerBaseline` cryptographic signature primitive
**Effort:** L (component of gap #1)
**Closes:** Gap #1 in `gap-summary.md`. Cross-cutting #3.
**Why:** Today `VerBaseline.snapshot Json` is a black-box, mutable, unsigned. No CFR 21 Part 11-grade signature on the Verification baseline.
**Tasks:**
- New `BaselineSignature { id, baselineId, baselineKind ('VER'|'CERT'|'PARAM'|'VALIDATION'|'CM'), signerUserId, reauthTimestamp, displayMeaning, hashSha256, signedAt }` (universal — see cross-cutting).
- Reauth endpoint: requires fresh password + 2FA-ready hook.
- After signing, `VerBaseline.snapshot` becomes immutable (write-rejected by middleware).
**Acceptance:** User signs a `VerBaseline`, system records reauth + timestamp + hash, baseline is locked thereafter.

### V-LT-3 — AI test-case generator (Codebeamer AI 1.0 / Xray Standard parity)
**Effort:** XL
**Closes:** `competitor-matrix.md` §5 row "AI test-case generation from requirement".
**Why:** Codebeamer AI 1.0 Test Case Assistant, Xray Standard test generator are both shipped. Without this we lag the entire 2026 AI-test-quality wave.
**Tasks:**
- New `aiVerification.controller.ts` + service.
- MCP tool `propose_test_cases_for_requirement(requirementId): VerTestCase[]` — emits T1 drafts.
- Backed by `AiInvocation` ledger + the new provenance lattice (V-LT-1).
- Editor surface inside `TestCaseDetailDrawer`: "Draft from requirement" CTA → opens preview → human accepts / rejects per case.
- Acceptance / rejection logged as audit events.
**Acceptance:** Open a requirement → click "Draft test cases" → see 3-5 T1 proposals → accept one → it appears in the Cases tab with `authorType=AI`, awaiting human review per the DAL-tier guardrail.

### V-LT-4 — Evidence parser per `ai-ready-vision.md` §7.4
**Effort:** XXL (or split per modality)
**Closes:** Gap #5 partly + the AI-readiness moat.
**Why:** Current `VerEvidence` is metadata-only. Per `ai-ready-vision.md` §7.4, upload should classify → extract → propose links → human reviews per-field, per-DAL guardrails.
**Tasks:**
- Add parsed-content columns to `VerEvidence` (`extractedFields Json`, `extractionConfidence Json`, `reviewStatus`, `proposedLinks Json`, `classifierAiModel`).
- Per-modality parser:
  - **PDF** with text + OCR for scans.
  - **DOCX / XLSX** — tables and headers.
  - **Test reports** in JUnit / xUnit / Robot output (reuse V-NT-1 parsers).
  - **SARIF** for static analysis.
  - **LCOV / Cobertura** for coverage.
  - **Images** (thermal, oscilloscope) via vision model — fast-follow.
- Review UI: file on right, extracted fields + proposed links on left, single-keystroke accept/reject per field.
- DAL guardrail: DAL-A/B always T1 (human required); DAL-C/D optional T4 auto-accept above 0.95 confidence.
- MCP tool `ingest_evidence_file(file, projectId): ParsedEvidence`.
**Acceptance:** Upload a test report PDF → see classifier proposal "Type: TEST_REPORT, confidence 0.97" + 14 extracted test results + 12 proposed links → reviewer accepts in 30s. For DAL-A evidence, no auto-accept path exists.

### V-LT-5 — MoC propagation on requirement DAL change
**Effort:** L
**Closes:** `design-system.md` §2.5 "Write once, trace automatically" promise.
**Why:** Today changing a requirement's DAL does not re-validate the linked test case's MoC. Per `vision-and-usp.md` §8.2, the verification method must match the DAL — a manual edit is a chance to miss one.
**Tasks:**
- New service `verifyMocCompliance(requirementId, newDal)`: walks linked `VerTestCase` rows, checks `linkedMocCode` against `VerSettings.mocRulesByCriticality[newDal]`, returns conflict list.
- Trigger on `PATCH /requirements/:id` when DAL field changes.
- UI surfaces conflicts in a banner with "Auto-suggest replacements" CTA.
- AI proposal flow (T2) marks the suspect cases and proposes new MoC + method assignments.
**Acceptance:** Change a requirement from DAL-C to DAL-A → if the linked test case uses an MoC not allowed at DAL-A, the system flags the conflict, marks the case suspect, and proposes valid alternatives.

### V-LT-6 — Coverage report — pluggable + exportable per DO-178C tables
**Effort:** L
**Why:** Demo moment for `vision-and-usp.md` §8.3 ("audit package as a command"). Once the Objective Satisfaction Matrix (V-NT-3) is live, the next step is exporting it as the DO-178C objective table A-3 / A-4 / A-5 ... pre-filled with current state.
**Tasks:**
- Template per DO-178C table.
- Backend: `/coverage/:projectId/export/do-178c-table-A-N` returns the table as DOCX/PDF.
- UI: an Export menu on the Overview matrix.
**Acceptance:** Click "Export DO-178C Table A-5" → DOCX downloads pre-filled with the project's current state.

### V-LT-7 — Test runner as agent — autonomous regression sweep (T2)
**Effort:** XXL
**Why:** Adjacent to `ai-ready-vision.md` §7.3 (test-case generation) but on the execution side. After a code-change CI event, an agent picks the affected test cases (using `TraceLink` + commit diff), runs them, and posts the result. T2 guardrail — human reviews before sign-off.
**Tasks:** Substantial cross-module — keep on the watchlist, not the next sprint.
**Acceptance:** Phase 4 work — listed for completeness.

---

## Out of scope (deliberate omissions)

Per `vision-and-usp.md` §9, the following are not gaps:

- **Manual test-management workflow engine.** Replaced with opinionated lifecycle per certification standard.
- **Custom-field anarchy on test cases / plans.** Same.
- **Variant management (Pure Variants-class) for test plans.** Out of scope first 18 months.
- **Mobile execution UI for test cases.** Out of scope first 18 months.
- **OSLC test-management interchange.** Anti-ICP per `vision-and-usp.md` §5; ReqIF covers exchange where buyers need it.

---

## Sequencing recommendation

Given the rankings, a coherent first sprint candidate:

1. **V-NT-1** (xUnit/JUnit/etc. parsers) — unlocks the headline demo.
2. **V-NT-3** (Objective Satisfaction Matrix) — replaces the underweight Overview.
3. **V-QW-5** (role gating) — pre-audit hygiene.

Second sprint:

4. **V-NT-2** (route file split) — engineering hygiene before scale.
5. **V-NT-4** (bulk action bar) — table-stakes parity.
6. **V-NT-5** + **V-NT-6** (`VerObjectiveLink`, `VerTestCaseVersion`) — schema additions that unblock diff view and audit export.

Third sprint:

7. **V-LT-1** (provenance lattice on Verification artefacts) — the cross-cutting work that unlocks **V-LT-3** (AI test-case generator) and **V-LT-4** (evidence parser).

After that, **V-LT-4 (evidence parser)** is the demo-moment closer for the AI-native pitch.
