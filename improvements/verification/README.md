# Verification — Package Review

## 1. Purpose

The Verification package is the load-bearing module behind every certification promise in `vision-and-usp.md`. It is where requirements meet evidence: test cases bind to requirements via `verifies` trace links, test plans bundle cases, runs execute against environments, results are recorded, evidence is attached, and the closed loop is meant to be: **"requirement DAL ⇒ method-of-compliance constraint ⇒ test case ⇒ test run ⇒ test result ⇒ evidence ⇒ objective satisfaction."** Per §8.2 of `vision-and-usp.md` ("Evidence-at-creation"), the verification plan and the evidence scaffolding must exist from the moment a requirement is born — not bolted on three weeks before a DER review.

## 2. Current state — the deepest module in the codebase

| Dimension | Count | Note |
|---|---:|---|
| Frontend routes (`/verification/*`) | 5 | layout, index, settings, templates landing + editor, report |
| Page components | 8 | adds `VerificationLayoutPage`, `TraceabilityMatrixView`, `VerificationTemplateBuilder` |
| Drawer components | 5 | TestPlan, TestCase, TestSetup, TestResult, TestRun |
| Tabs in main layout | 7+ | overview, plans, cases, setups, runs, results, traceability (per `VERIFICATION_MAIN_TABS`) |
| Backend route file | `verification.routes.ts` — **338 lines, 131 endpoints** | largest single route file |
| Backend controllers | 18 (`backend/src/controllers/verification/*.ts`) + 1 `verificationV2/runIngestion.controller.ts` |
| Backend services | 15 (`backend/src/services/verification/*.ts`) |
| Prisma models | **28 `Ver*` models** (`VerMoc`, `VerMethod`, `VerTestSetup`, `VerTestProcedure`, `VerTestEnvironment`, `VerTestLog`, `VerTestCase`, `VerTestCaseSetup`, `VerTestPlan`, `VerTestPlanRevision`, `VerTestPlanSetup`, `VerTestPlanCase`, `VerTestRun`, `VerTestRunResult`, `VerTestRunResultActualResult`, `VerTestRunExecutionTimer`, `VerTestRunResultStatusHistory`, `VerEvidence`, `VerEvidenceLink`, `VerTestResult`, `VerTestResultLink`, `VerReview`, `VerReviewItem`, `VerNonconformity`, `VerReverifyTask`, `VerBaseline`, `VerSettings`, `VerCustomOption`, `VerTemplate`, `VerTemplateVersion`, `VerAuditEvent`, `VerTestCaseCustomSection`, `VerTestCaseSectionImage`) + the legacy `VerificationPlan` |

The schema is already wider than Codebeamer, Jama, or Xray on Verification surface area. `VerEvidence` exists. `VerEvidenceLink` is polymorphic (`linkedEntityType ∈ {TEST_RUN, TEST_RUN_RESULT, TEST_CASE, TEST_SETUP, METHOD, REVIEW, NONCONFORMITY}`). `VerTestRunResultStatusHistory` already exists for audit. `VerTestRunResult.testCaseVersionSnapshot` is an immutable snapshot of the test case at execution time — exactly the integrity primitive auditors expect. `VerTestPlanRevision` adds revision control. `VerNonconformity` + `VerReverifyTask` already model the "test fails → file NCR → close-out reverify" path. The depth is real.

## 3. Target state — closed-loop evidence-at-creation

Per `vision-and-usp.md` §8.2 and `ai-ready-vision.md` §7.4, the target is the **automated closure of the verification loop with provenance on every step**:

1. Requirement created → has DAL → MoC filter applies → forced selection of method ⇒ `VerMethod`.
2. Test case authored (human or AI T1 draft) → bound to requirement via `TraceLink(verifies)` and to MoC via `linkedMocCode`. Provenance recorded (who/what authored).
3. Test plan groups cases, references setups, has phase (SRR/PDR/CDR/TRR), revision-controlled.
4. Test run executes — automated runs ingest **xUnit / JUnit / NUnit / pytest / Robot / SARIF / Cobertura** files; manual runs use timer-based execution view.
5. Result attaches to run → result attaches evidence file → evidence is parsed (AI T1) → classifications & link proposals presented for human review (DAL-gated auto-accept per §6.4).
6. `VerBaseline` snapshots the verification state, with cryptographic signature (gap #1 in `gap-summary.md`).
7. `CertObjective` satisfaction recomputes — "audit package as a command" exports proof in one click.

## 4. Priority verdict

**Critical-path module — every other claim depends on it shipping correctly.** It is the only module with a full schema-to-backend-to-frontend round trip already wired (parameters is close behind). The 131-endpoint flat route file and missing standard test-result format ingestion are the two biggest gaps; everything else is incremental.

**Most surprising finding:** an "automated result ingest" endpoint already exists (`POST /api/v1/verification/runs/ingest/:projectId` → `runIngestionController.ingestAutomatedResult`), but it accepts only our own custom JSON shape `{testPlanKey, runName, environment, results[]}` — **no xUnit, JUnit, NUnit, pytest, Robot Framework, SARIF, or LCOV parser**. CI pipelines must translate their native output into our DSL before posting, which is a fatal friction for the "CI POSTs a JUnit XML and the requirement coverage updates within seconds" demo we need to win against Codebeamer + Jenkins, Polarion xUnit out-of-box, and Xray's plugin ecosystem. Gap #4 in `gap-summary.md` is closer to "wire the parsers" than "build the endpoint."

## 5. Read this with

- `frontend.md` — page-by-page UX, drawer compliance, competitor mapping.
- `backend.md` — endpoint cohesion, controller split, ingestion gap.
- `design-review.md` — UX critique against Jama Coverage Browser, Polarion Multilevel Traceability widget, Xray test types.
- `tickets.md` — Quick wins / Near-term / Long-term action plan.
- `improvements/_shared/cross-cutting.md` — provenance, signature, unified baseline appends.
