# Verification — Backend Review

Scope: `backend/src/routes/verification.routes.ts` (338 lines, 131 endpoints, 18 imported controllers + 1 v2 controller, 4 imported services for inline handlers), 28 `Ver*` Prisma models (`backend/prisma/schema.prisma` lines 2488-3186).

## 1. The 131-endpoint problem

`verification.routes.ts` is the largest single route file in the codebase — **131 endpoints, 19 imports, all flat in one Router**. Endpoint count per controller:

| Sub-area | Controller | Endpoints | Inline / mixed |
|---|---|---:|---|
| MoC (system-wide) | `moc.controller` | 4 | requires admin |
| Methods | `method.controller` | 6 | |
| Setups | `setup.controller` | 9 | including manual upload + diagram export |
| Custom options | `customOption.controller` | 3 | |
| Test cases | `testCase.controller` | 13 | + cross-ref to `runIngestionController.getRunResultsForTestCase` |
| Test-case custom sections | `customSection.controller` | 7 | |
| Test plans | `testPlan.controller` | 18 | incl. revisions, reorder, link/unlink case+setup, link-verification-element |
| Audit | `audit.controller` | 2 | |
| Evidence | `evidence.controller` | 5 | |
| Coverage | `coverage.controller` | 2 | |
| Traceability matrix | inline handlers calling `traceabilityMatrixService` | 2 | **inline**, not in a controller |
| Reviews | `review.controller` | 7 | |
| Nonconformities | `nonconformity.controller` | 7 | |
| Baselines | `baseline.controller` | 4 | |
| Settings | `settings.controller` | 3 | |
| Overview | `overview.controller` | 1 | |
| Templates | `template.controller` | 8 | |
| Test results | `testResult.controller` | 8 | |
| Test runs | `testRun.controller` + `runIngestionController` | 14 | runs split across two controllers — see §2 |
| Reports | inline handlers calling `reportService` | 6 | **inline** |
| Export-with-template | inline handler calling `exportTemplateService` | 1 | **inline** |

The internal architecture is already **well-decomposed by controller and service**. The cohesion problem is in the route file alone — every sub-domain hangs off the same `Router()`. Three concrete consequences:

- **Code review surface.** A pull request touching one sub-area diffs against a 338-line file. Reviewers cannot mentally hold the whole verification surface; risk of accidental cross-area regressions.
- **Path-permission rules** (e.g. only admins mutate MoC) are visible only inline (`requireAdmin` on lines 38/39/40/41). When a 132nd endpoint lands, the chance of forgetting the gate climbs.
- **Inline handlers** for `/traceability-matrix/*`, `/reports/*`, `/export-with-template/*` (lines 128, 145, 225–292) are inconsistent with the controller pattern enforced everywhere else. Mixed style invites copy-paste anti-patterns.

## 2. Proposed split

Mount sub-routers under `/api/v1/verification/...` from a single `verification.routes.ts` index. One file per sub-area maps 1:1 to controllers we already have:

```
backend/src/routes/verification/
├── index.ts                    # mounts everything below
├── moc.routes.ts               # 4 endpoints (admin-only)
├── methods.routes.ts           # 6 endpoints
├── setups.routes.ts            # 9 endpoints (incl. multer upload paths)
├── customOptions.routes.ts     # 3 endpoints
├── testCases.routes.ts         # 13 endpoints + custom-section sub-routes
├── customSections.routes.ts    # 7 endpoints (sub-router on test cases)
├── testPlans.routes.ts         # 18 endpoints
├── testRuns.routes.ts          # 14 endpoints (consolidate the split — see §3)
├── testResults.routes.ts       # 8 endpoints
├── evidence.routes.ts          # 5 endpoints
├── reviews.routes.ts           # 7 endpoints
├── nonconformities.routes.ts   # 7 endpoints
├── baselines.routes.ts         # 4 endpoints
├── settings.routes.ts          # 3 endpoints
├── overview.routes.ts          # 1 endpoint
├── templates.routes.ts         # 8 endpoints
├── coverage.routes.ts          # 2 endpoints
├── traceabilityMatrix.routes.ts# 2 endpoints (extract from inline)
├── reports.routes.ts           # 6 endpoints (extract from inline)
├── exportTemplate.routes.ts    # 1 endpoint (extract from inline)
└── audit.routes.ts             # 2 endpoints
```

No endpoint URLs change — purely a re-organisation. Each new file averages ~15 lines. Pre-conditions: extract the inline handlers to controllers (`traceabilityMatrix.controller`, `report.controller`, `exportTemplate.controller`). Ticket in `tickets.md`.

## 3. Test runs split across two controllers — refactor or unify

```
210: router.get   ('/test-runs/:projectId',           runIngestionController.getTestRuns)
211: router.get   ('/test-runs/:projectId/:runId',    runIngestionController.getTestRun)
212: router.post  ('/test-runs/:projectId',           testRunController.createTestRun)
213: router.patch ('/test-runs/:projectId/:runId',    testRunController.updateTestRun)
...
222: router.delete('/test-runs/:projectId/:id',       runIngestionController.deleteTestRun)
```

`testRun.controller` and `verificationV2/runIngestion.controller` split the same noun. Two controllers, two services, one URL pattern. `runIngestionController` was clearly added to introduce automated ingestion without rewriting the manual-run path — pragmatic, but the line between them is now blurry. **Decision needed:** either merge to `testRun.controller` and isolate the ingestion endpoint behind `/test-runs/.../ingest` (current `/runs/ingest/:projectId` is also irregular), or formalise the v2 path and migrate manual runs into it.

## 4. The xUnit / JUnit / NUnit / pytest / Robot gap (gap #4 in `gap-summary.md`)

The headline finding: **an ingestion endpoint exists** (`POST /api/v1/verification/runs/ingest/:projectId` → `runIngestionController.ingestAutomatedResult`). It accepts a JSON body of:

```json
{
  "testPlanKey": "TP-UAV-001",
  "runName": "...",
  "environment": { "name", "hardwareVersion", "softwareBuild", "hilBenchConfig" },
  "results": [{ "testCaseKey": "TC-UAV-001", "status": "PASS|FAIL|...", "actualResults": {...}, "executedAt": "..." }]
}
```

This is our DSL, not anyone's CI output. Competitor parity requires accepting at minimum:

| Format | Tool ecosystem | Spec |
|---|---|---|
| **xUnit XML** | .NET, Polarion default | `<assemblies><assembly><collection><test name pass/fail traits/>...` |
| **JUnit XML** | Java / Maven / Gradle / Jenkins / GitLab CI | `<testsuites><testsuite name tests failures><testcase classname name/>` |
| **NUnit XML** | .NET | NUnit 2 + NUnit 3 schemas — different |
| **pytest JSON** (`pytest --json-report`) | Python | `report.tests[].outcome` |
| **Robot Framework output.xml** | Aerospace (HIL) — RF is the bread-and-butter aerospace test framework | `<robot><suite><test><status status="PASS" starttime endtime>` |
| **TAP** | language-agnostic | `ok 1 - desc / not ok 2 - desc` |
| **SARIF** | static analysis | `runs[].results[].ruleId/locations` (for analysis MoC) |
| **LCOV / Cobertura** | coverage | required for DO-178C structural coverage objectives |
| **IEEE 829 Test Documentation** | aerospace deep cuts | optional |

Implementation pattern: a `verification/ingestion/` sub-service with one parser file per format, all converging on a canonical `IngestedTestRun { metadata, results[] }` shape and then invoking the existing `ingestAutomatedResult` path. Endpoint stays one (or adds `?format=junit-xml` query param + `Content-Type` sniff). **Effort 1-2 weeks** per `gap-summary.md` scoring.

Without this gap closed, the "CI POSTs a JUnit XML and the requirement coverage updates within seconds" demo cannot run. Every named competitor has it natively (Polarion: xUnit out-of-box; Codebeamer: dedicated Jenkins xUnit + Coverage Publisher plugins; Jama: REST + samples; DOORS+ETM: Selenium/Jenkins; Xray: native plugins).

## 5. Authentication / authorisation audit

- `router.use(authenticateToken)` applied at line 31 — every endpoint authenticated. Good.
- `router.param('projectId', projectIdParam)` resolves project membership. Good.
- `requireAdmin` applied to MoC mutations only (lines 38, 39, 40, 41). Other mutations rely on project-membership.
- **Missing role gating:** no endpoint here enforces `requireVerificationEngineer` or similar. Approval endpoints (`/methods/.../approve`, `/setups/.../approve`, `/test-cases/.../approve`, `/test-plans/.../approve`, `/reviews/.../close`, `/nonconformities/.../mark-reverified`) silently let any project member sign. Per `kb/configuration-management.md` we need `VerificationEngineer`, `SafetyEngineer`, `Auditor` admin-role templates. Audit-grade signature primitive (gap #1 in `gap-summary.md`) ties to this — currently any user with project access can approve.
- **Missing reauthentication for approvals.** Approve endpoints take no `password` reauth or fresh-token. Cannot pass CFR 21 Part 11 today. Cross-cutting append covers it.

## 6. Schema review — 28 `Ver*` models

Strengths:

- `VerTestRunResult.testCaseVersionSnapshot Json` — captures the immutable state of the test case at execution. **Best-in-class auditability primitive.**
- `VerTestRunResult.setupVersionSnapshot Json` — same for setup. Polarion + Jama do not capture this.
- `VerEvidenceLink` polymorphic across 7 entity types — flexible, idiomatic, matches `kb/backend-patterns.md`.
- `VerTestRun.deletedAt` — soft-delete present and indexed (line 2779, 2795).
- `VerTestRunResultStatusHistory` — purpose-built audit log per result, complementary to `VerAuditEvent`.

Issues:

| # | Issue | Severity |
|---|---|---|
| 6.1 | **No provenance lattice on `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerEvidence`, `VerMoc`.** Only `isSuspect` + `ownerUserId`. Once AI drafts a test case (Codebeamer AI 1.0 parity), there is no schema field to record `authorType / authorAiModel / authorAiPromptId / classification / reviewStatus`. | **Critical** |
| 6.2 | **`VerTestCase.version` is `String @default("1.0")` — in-row counter, no `VerTestCaseVersion` table.** Diff view between versions is impossible. Restoring an older version is impossible. Compare to `RequirementVersion` (full table). | High |
| 6.3 | **`VerBaseline.snapshot Json` is a black-box snapshot.** No cryptographic signature, no signer reauth event, no immutability invariant enforced at write time. Anyone with project access can mutate. Compare to `gap-summary.md` #1. | **Critical** for buyer-visible audit story |
| 6.4 | **Polymorphic FKs (`VerEvidenceLink.linkedEntityType`, `VerTestResultLink.linkedEntityType`, `VerReviewItem.entityType`, `VerNonconformity.*EntityType`) are tagged strings.** Matches the codebase convention (`kb/inventory.md` notes 11 polymorphic-string tables), but auditors will flag the lack of FK integrity. Documented in `inventory.md`. | Medium — accepted convention |
| 6.5 | **`VerEvidence` has no parsed-content fields.** Per `ai-ready-vision.md` §6.4 evidence is supposed to carry per-field confidence, extraction provenance, and classification proposal status. Schema today is metadata-only (`evidenceType`, `title`, `storageRef`, `checksum`). | **Critical** for AI-readiness claim |
| 6.6 | **`VerificationPlan` (line 631) is a separate legacy model.** Used by `requirements.routes` for the older verification flow — coexists with `VerTestPlan` (line 2660). Either rename or migrate / archive. Confusion risk for new contributors. | Low |
| 6.7 | **No `VerObjectiveLink` or join between `VerTestCase` and `CertObjective`.** Today the chain `VerTestCase → CertObjective` is implicit via `Requirement → CertObjective`. For DO-178C objective satisfaction we need explicit "this test case satisfies objective A-5.5" so the audit-package export can write proof per objective. | High |
| 6.8 | **`VerMoc` is project-agnostic** (no `projectId`). System-wide is correct (codes 0-8 are regulator-defined). MoC **rules per criticality** live in `VerSettings.mocRulesByCriticality Json` — the data model is right, the UI is not (see `frontend.md` §3.2). | None |
| 6.9 | **`VerTestRunResult.actualResults Json`** — opaque. Cannot query "all results where measured voltage > 5V". For DAL-A audit, structured assertions are required. Future work — flag, not block. | Low |

## 7. Inline handlers in the route file (lines 128–292)

Three sub-areas violate the controller/service convention enforced everywhere else in the codebase per `kb/backend-patterns.md`:

```ts
router.get('/traceability-matrix/:projectId', async (req, res) => { ... })
router.get('/traceability-matrix/:projectId/gaps', async (req, res) => { ... })
router.get('/reports/test-case/:projectId/:id', async (req, res) => { ... })
router.get('/reports/test-plan/:projectId/:id', async (req, res) => { ... })
...
router.post('/export-with-template/:projectId', async (req, res) => { ... })
```

Each inline handler calls a service (`traceabilityMatrixService`, `reportService`, `exportTemplateService`). Extracting them to thin controllers takes ~30 minutes per handler and brings the file in line with the rest of the codebase. Ticket in `tickets.md`.

## 8. No OpenAPI annotation (cross-cutting)

131 endpoints, zero OpenAPI emission. Buyers asking "where are the API docs?" today get nothing. Gap #10 in `gap-summary.md` is project-wide, but the Verification surface is the right place to **start** because:

- It is the largest single route file.
- It is the one most likely to be invoked by CI/CD agents (ingestion endpoint).
- It contains the most polymorphic / non-obvious shapes that benefit from a generated spec.

If `zod-openapi` is adopted (`gap-summary.md` recommends TypeScript-first option), the verification route file is a credible pilot — once it compiles to a spec, the rest of the codebase follows the same template.

## 9. Summary of asks

1. **Wire xUnit / JUnit / NUnit / pytest / Robot / SARIF / LCOV parsers** (gap #4 — closes the deepest competitive moat).
2. **Split the 131-endpoint route file** into `routes/verification/` sub-files.
3. **Extract inline handlers** for traceability-matrix, reports, export-with-template.
4. **Decide on `testRun` vs `runIngestion` controller split** — unify or formalise.
5. **Add provenance lattice to `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerEvidence`, `VerMoc`** (cross-cutting).
6. **Add `VerBaseline` signature event** primitive — cryptographic hash of the snapshot + signer-reauth event (cross-cutting).
7. **Add `VerObjectiveLink`** so test cases can satisfy `CertObjective` directly (not only via requirement).
8. **Add `VerTestCaseVersion` table** to back diff view + version chain.
9. **Wire `VerSettings.mocRulesByCriticality` / `namingRules` / `allowedMocCodes`** to UI editors.
10. **Migrate / archive `VerificationPlan` legacy model** to remove confusion.
11. **Add role gating** to all approve / close / sign-off endpoints + reauth for signatures.
12. **Pilot OpenAPI annotation** here first.
