/**
 * Verification ingestion core (N-2.4).
 *
 * `ingestNormalisedRun` is the shared service that creates the
 * VerTestEnvironment + VerTestRun + per-result VerTestRunResult + VerTestLog
 * rows and applies the DO-178C entry-criteria check on the linked test plan.
 *
 * Both ingestion endpoints call it with one zero-duplication path:
 *   - POST /runs/ingest/:projectId        — the existing JSON endpoint
 *     (the request body already carries a normalised `results` array).
 *   - POST /runs/ingest/:projectId/file   — the new file endpoint
 *     (a raw CI-tool file is parsed into `results` first).
 *
 * This service was extracted verbatim from runIngestion.controller.ts
 * `ingestAutomatedResult`; the JSON endpoint's observable behaviour is
 * unchanged (issue #431 acceptance criterion 5).
 */
import { prisma } from '../../lib/prisma'
import type { NormalisedResult } from '../testResultParsers'

/** Thrown when the linked test plan does not exist. The route maps it to 404. */
export class TestPlanNotFoundError extends Error {
  constructor(testPlanKey: string) {
    super(`Test Plan ${testPlanKey} not found`)
    this.name = 'TestPlanNotFoundError'
  }
}

/**
 * Thrown when the linked test plan fails the DO-178C entry-criteria check
 * (a DRAFT or CLOSED plan cannot receive an automated run). The route maps
 * it to 400.
 */
export class EntryCriteriaError extends Error {
  constructor(status: string) {
    super(`Cannot ingest run for Test Plan in ${status} status`)
    this.name = 'EntryCriteriaError'
  }
}

/** The environment descriptor accepted from the caller. */
export interface IngestEnvironmentInput {
  name?: string
  hardwareVersion?: string
  softwareBuild?: string
  hilBenchConfig?: Record<string, unknown>
}

/** The input to `ingestNormalisedRun`. */
export interface IngestNormalisedRunInput {
  testPlanKey?: string
  runName?: string
  environment?: IngestEnvironmentInput
  results: NormalisedResult[]
}

/** The summary returned to the caller after an ingest. */
export interface IngestRunSummary {
  /** Normalised results presented for ingestion. */
  totalResults: number
  /** Results that matched a VerTestCase and produced a VerTestRunResult. */
  matched: number
  /** Results whose testCaseKey matched no VerTestCase (skipped). */
  skipped: number
  pass: number
  fail: number
  skippedStatus: number
  passedWithErrors: number
}

/** The full result of `ingestNormalisedRun`. */
export interface IngestNormalisedRunResult {
  testRunId: string
  environmentId: string
  testPlanId: string | null
  summary: IngestRunSummary
}

/** Severity rank for de-duplicating two results that hit the same test case. */
const STATUS_RANK: Record<string, number> = {
  FAIL: 4,
  PASSED_WITH_ERRORS: 3,
  SKIPPED: 2,
  PASS: 1,
  NOT_RUN: 0,
}

/**
 * Create the environment + run + results + log for a normalised result set.
 *
 * @param projectId The canonical project id (already membership-scoped by the route).
 * @param userId    The executing user, from `req.user` — never the request body.
 * @throws TestPlanNotFoundError | EntryCriteriaError
 */
export async function ingestNormalisedRun(
  projectId: string,
  userId: string | undefined,
  input: IngestNormalisedRunInput,
): Promise<IngestNormalisedRunResult> {
  const { testPlanKey, runName, environment, results } = input
  const normalised = Array.isArray(results) ? results : []

  // 1. Resolve the test plan (if a key was given) and run the DO-178C
  //    entry-criteria check.
  let testPlanId: string | null = null
  if (testPlanKey) {
    const plan = await prisma.verTestPlan.findUnique({
      where: { projectId_key: { projectId, key: testPlanKey } },
    })
    if (!plan) {
      throw new TestPlanNotFoundError(testPlanKey)
    }
    testPlanId = plan.id
    // A DRAFT or CLOSED plan is not a valid target for an automated run.
    if (plan.status === 'DRAFT' || plan.status === 'CLOSED') {
      throw new EntryCriteriaError(plan.status)
    }
  }

  // 2. Create the test environment.
  const testEnv = await prisma.verTestEnvironment.create({
    data: {
      projectId,
      name: environment?.name || 'Automated CI/CD Environment',
      hardwareVersion: environment?.hardwareVersion,
      softwareBuild: environment?.softwareBuild,
      hilBenchConfig: (environment?.hilBenchConfig as object | undefined) || {},
    },
  })

  // 3. Create the test run — immutable, COMPLETED on creation.
  const testRun = await prisma.verTestRun.create({
    data: {
      projectId,
      testPlanId,
      environmentId: testEnv.id,
      runName: runName || `Automated Run ${new Date().toISOString()}`,
      status: 'COMPLETED',
      executedByUserId: userId,
      startedAt: new Date(),
      endedAt: new Date(),
    },
  })

  // 4. Process each normalised result. Match it to a VerTestCase by key.
  //    VerTestRunResult is @@unique([testRunId, testCaseId]) — so when two
  //    normalised results resolve to the same test case (e.g. a parametrised
  //    test reported per parameter) we keep the single most-severe outcome
  //    rather than throwing on a duplicate insert.
  const summary: IngestRunSummary = {
    totalResults: normalised.length,
    matched: 0,
    skipped: 0,
    pass: 0,
    fail: 0,
    skippedStatus: 0,
    passedWithErrors: 0,
  }

  // testCaseId -> the chosen (most-severe) normalised result
  const chosen = new Map<
    string,
    { testCase: { id: string; version: string; title: string }; result: NormalisedResult }
  >()

  for (const result of normalised) {
    const key = (result.testCaseKey || '').trim()
    if (!key) {
      summary.skipped += 1
      continue
    }
    const testCase = await prisma.verTestCase.findUnique({
      where: { projectId_key: { projectId, key } },
    })
    if (!testCase) {
      summary.skipped += 1
      continue
    }
    const existing = chosen.get(testCase.id)
    if (!existing) {
      chosen.set(testCase.id, { testCase, result })
    } else {
      const incomingRank = STATUS_RANK[result.status] ?? 0
      const existingRank = STATUS_RANK[existing.result.status] ?? 0
      if (incomingRank > existingRank) {
        chosen.set(testCase.id, { testCase, result })
      }
    }
  }

  for (const { testCase, result } of chosen.values()) {
    await prisma.verTestRunResult.create({
      data: {
        testRunId: testRun.id,
        testCaseId: testCase.id,
        testCaseVersionSnapshot: { version: testCase.version, title: testCase.title },
        parentTestCaseVersionAtExecution: testCase.version,
        resultStatus: result.status,
        actualResults: (result.actualResults as object | undefined) || {},
        executedAt: result.executedAt ? new Date(result.executedAt) : new Date(),
        isSuspect: false, // a freshly ingested run is verified
      },
    })
    summary.matched += 1
    switch (result.status) {
      case 'PASS':
        summary.pass += 1
        break
      case 'FAIL':
        summary.fail += 1
        break
      case 'SKIPPED':
        summary.skippedStatus += 1
        break
      case 'PASSED_WITH_ERRORS':
        summary.passedWithErrors += 1
        break
      default:
        break
    }
  }

  // 5. Create the centralised test log holding the raw normalised payload.
  await prisma.verTestLog.create({
    data: {
      testRunId: testRun.id,
      projectId,
      stdoutText: 'Batch automated test completion log.',
      jsonResult: (normalised as unknown as object) || [],
    },
  })

  return {
    testRunId: testRun.id,
    environmentId: testEnv.id,
    testPlanId,
    summary,
  }
}
