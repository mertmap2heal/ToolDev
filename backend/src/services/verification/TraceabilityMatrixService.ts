/**
 * Traceability Matrix Service
 * Requirement -> TestCase -> TestRun coverage and gap analysis.
 * Supports both lightweight (legacy) and full-chain responses.
 */
import { prisma } from '../../lib/prisma'

export interface TraceabilityMatrixRow {
  requirementId: string
  requirementKey: string
  requirementTitle: string
  testCases: {
    testCaseId: string
    testCaseKey: string
    testCaseTitle: string
    traceLinkId: string
    testPlanIds: string[]
    testPlanKeys: string[]
    latestRunResult: {
      id: string
      resultStatus: string
      executedAt: string | null
      isOutOfSync: boolean
      testRunId: string
      testRunName: string
    } | null
    recentRunResults: {
      id: string
      resultStatus: string
      executedAt: string | null
      isOutOfSync: boolean
      testRunId: string
      testRunName: string
    }[]
    gapReason: 'NO_RUN' | 'OUT_OF_SYNC' | 'NOT_PASSED' | 'OK'
  }[]
  verified: boolean
}

export interface FullTraceabilitySummary {
  totalRequirements: number
  linkedRequirements: number
  verified: number
  gaps: number
  coveragePercent: number
  totalTestCases: number
  totalTestPlans: number
  totalTestRuns: number
}

export interface TestPlanSummary {
  id: string
  key: string
  name: string
  status: string
  caseCount: number
  verifiedCount: number
}

export interface TestCaseColumn {
  id: string
  key: string
  title: string
  planIds: string[]
  planKeys: string[]
}

export interface UnlinkedRequirement {
  id: string
  key: string
  title: string
}

export interface FullTraceabilityResponse {
  rows: TraceabilityMatrixRow[]
  coverageSummary: FullTraceabilitySummary
  testPlans: TestPlanSummary[]
  testCaseColumns: TestCaseColumn[]
  /** All test cases in the project (for grid cells where user can add/remove links) */
  allTestCaseColumns: TestCaseColumn[]
  /** Map of reqId -> tcId -> traceLinkId (for delete operations) */
  linkMap: Record<string, Record<string, string>>
  unlinkedRequirements: UnlinkedRequirement[]
}

export interface CoverageGap {
  requirementId: string
  requirementKey: string
  testCaseId: string
  testCaseKey: string
  gapReason: string
}

const PASSED_STATUSES = ['PASS', 'PASSED_WITH_ERRORS']
const MAX_RECENT_RESULTS = 5

export const traceabilityMatrixService = {
  /**
   * Full traceability matrix with the complete chain:
   * Requirement -> Test Plans -> Test Cases -> Test Runs -> Results.
   */
  async getFullTraceabilityMatrix(
    projectId: string,
    options?: { considerPassedWithErrors?: boolean }
  ): Promise<FullTraceabilityResponse> {
    const considerPassedWithErrors = options?.considerPassedWithErrors ?? true
    const passedStatusSet = considerPassedWithErrors ? new Set([...PASSED_STATUSES]) : new Set(['PASS'])

    const [
      allRequirements,
      links,
      allPlans,
      planCaseJoins,
      allTestCases,
      allRuns,
    ] = await Promise.all([
      prisma.requirement.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, requirementId: true, title: true },
        orderBy: { requirementId: 'asc' },
      }),
      prisma.traceLink.findMany({
        where: { projectId, sourceType: 'test_case', targetType: 'requirement', linkType: 'verifies' },
      }),
      prisma.verTestPlan.findMany({
        where: { projectId },
        select: { id: true, key: true, name: true, status: true },
        orderBy: { key: 'asc' },
      }),
      prisma.verTestPlanCase.findMany({
        where: { testPlan: { projectId } },
        select: { testPlanId: true, testCaseId: true },
      }),
      prisma.verTestCase.findMany({
        where: { projectId },
        select: { id: true, key: true, title: true },
        orderBy: { key: 'asc' },
      }),
      prisma.verTestRun.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, runName: true, status: true },
      }),
    ])

    const planMap = new Map(allPlans.map((p) => [p.id, p]))
    const tcMap = new Map(allTestCases.map((tc) => [tc.id, tc]))
    const runMap = new Map(allRuns.map((r) => [r.id, r]))

    // TC -> plans mapping
    const tcToPlanIds = new Map<string, string[]>()
    const tcToPlanKeys = new Map<string, string[]>()
    for (const join of planCaseJoins) {
      const ids = tcToPlanIds.get(join.testCaseId) ?? []
      if (!ids.includes(join.testPlanId)) ids.push(join.testPlanId)
      tcToPlanIds.set(join.testCaseId, ids)

      const plan = planMap.get(join.testPlanId)
      if (plan) {
        const keys = tcToPlanKeys.get(join.testCaseId) ?? []
        if (!keys.includes(plan.key)) keys.push(plan.key)
        tcToPlanKeys.set(join.testCaseId, keys)
      }
    }

    // Req -> TCs from trace links, preserving linkId for each pair
    const linkedTcIds = new Set<string>()
    const linkedReqIds = new Set<string>()
    const reqToTcs = new Map<string, string[]>()
    const reqTcToLinkId = new Map<string, string>()
    for (const link of links) {
      linkedReqIds.add(link.targetId)
      linkedTcIds.add(link.sourceId)
      const list = reqToTcs.get(link.targetId) ?? []
      if (!list.includes(link.sourceId)) list.push(link.sourceId)
      reqToTcs.set(link.targetId, list)
      reqTcToLinkId.set(`${link.targetId}:${link.sourceId}`, link.id)
    }

    // Load run results for linked TCs
    const runResults = linkedTcIds.size > 0
      ? await prisma.verTestRunResult.findMany({
          where: { testCaseId: { in: [...linkedTcIds] } },
          include: { testRun: { select: { id: true, runName: true, deletedAt: true } } },
          orderBy: { executedAt: 'desc' },
        })
      : []

    // Bucket results by test case (already sorted desc by executedAt)
    const resultsByCase = new Map<string, typeof runResults>()
    for (const rr of runResults) {
      if (rr.testRun.deletedAt) continue
      const bucket = resultsByCase.get(rr.testCaseId) ?? []
      bucket.push(rr)
      resultsByCase.set(rr.testCaseId, bucket)
    }

    const rows: TraceabilityMatrixRow[] = []
    let verifiedCount = 0
    let gapCount = 0

    // Track per-plan verification counts
    const planVerifiedCases = new Map<string, Set<string>>()
    const planTotalCases = new Map<string, Set<string>>()
    for (const join of planCaseJoins) {
      const s = planTotalCases.get(join.testPlanId) ?? new Set()
      s.add(join.testCaseId)
      planTotalCases.set(join.testPlanId, s)
    }

    for (const req of allRequirements) {
      const tcIdsForReq = reqToTcs.get(req.id) ?? []
      if (tcIdsForReq.length === 0) continue // unlinked handled separately

      const testCasesData: TraceabilityMatrixRow['testCases'] = []
      let verified = true

      for (const tcId of tcIdsForReq) {
        const tc = tcMap.get(tcId)
        if (!tc) continue

        const caseResults = resultsByCase.get(tcId) ?? []
        const latest = caseResults[0] ?? null
        let gapReason: TraceabilityMatrixRow['testCases'][0]['gapReason'] = 'OK'

        if (!latest) {
          gapReason = 'NO_RUN'
          verified = false
          gapCount++
        } else if (latest.isOutOfSync) {
          gapReason = 'OUT_OF_SYNC'
          verified = false
          gapCount++
        } else if (!passedStatusSet.has(latest.resultStatus)) {
          gapReason = 'NOT_PASSED'
          verified = false
          gapCount++
        }

        const formatResult = (rr: typeof runResults[0]) => ({
          id: rr.id,
          resultStatus: rr.resultStatus,
          executedAt: rr.executedAt?.toISOString() ?? null,
          isOutOfSync: rr.isOutOfSync,
          testRunId: rr.testRun.id,
          testRunName: rr.testRun.runName,
        })

        // Track plan-level verification
        if (gapReason === 'OK') {
          const planIds = tcToPlanIds.get(tcId) ?? []
          for (const pid of planIds) {
            const s = planVerifiedCases.get(pid) ?? new Set()
            s.add(tcId)
            planVerifiedCases.set(pid, s)
          }
        }

        testCasesData.push({
          testCaseId: tc.id,
          testCaseKey: tc.key,
          testCaseTitle: tc.title,
          traceLinkId: reqTcToLinkId.get(`${req.id}:${tcId}`) ?? '',
          testPlanIds: tcToPlanIds.get(tcId) ?? [],
          testPlanKeys: tcToPlanKeys.get(tcId) ?? [],
          latestRunResult: latest ? formatResult(latest) : null,
          recentRunResults: caseResults.slice(0, MAX_RECENT_RESULTS).map(formatResult),
          gapReason,
        })
      }

      if (verified) verifiedCount++

      rows.push({
        requirementId: req.id,
        requirementKey: req.requirementId ?? req.id,
        requirementTitle: req.title,
        testCases: testCasesData,
        verified,
      })
    }

    const unlinkedRequirements: UnlinkedRequirement[] = allRequirements
      .filter((r) => !linkedReqIds.has(r.id))
      .map((r) => ({ id: r.id, key: r.requirementId ?? r.id, title: r.title }))

    const testCaseColumns: TestCaseColumn[] = [...linkedTcIds].map((tcId) => {
      const tc = tcMap.get(tcId)
      return {
        id: tcId,
        key: tc?.key ?? tcId,
        title: tc?.title ?? '',
        planIds: tcToPlanIds.get(tcId) ?? [],
        planKeys: tcToPlanKeys.get(tcId) ?? [],
      }
    }).sort((a, b) => a.key.localeCompare(b.key))

    const allTestCaseColumns: TestCaseColumn[] = allTestCases.map((tc) => ({
      id: tc.id,
      key: tc.key,
      title: tc.title,
      planIds: tcToPlanIds.get(tc.id) ?? [],
      planKeys: tcToPlanKeys.get(tc.id) ?? [],
    }))

    const linkMapObj: Record<string, Record<string, string>> = {}
    for (const [compositeKey, linkId] of reqTcToLinkId) {
      const [reqId, tcId] = compositeKey.split(':')
      if (!linkMapObj[reqId]) linkMapObj[reqId] = {}
      linkMapObj[reqId][tcId] = linkId
    }

    const testPlanSummaries: TestPlanSummary[] = allPlans.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      status: p.status,
      caseCount: planTotalCases.get(p.id)?.size ?? 0,
      verifiedCount: planVerifiedCases.get(p.id)?.size ?? 0,
    }))

    const totalReqs = allRequirements.length
    const linkedReqs = rows.length
    const coveragePercent = totalReqs > 0 ? Math.round((verifiedCount / totalReqs) * 100) : 0

    return {
      rows,
      coverageSummary: {
        totalRequirements: totalReqs,
        linkedRequirements: linkedReqs,
        verified: verifiedCount,
        gaps: gapCount,
        coveragePercent,
        totalTestCases: allTestCases.length,
        totalTestPlans: allPlans.length,
        totalTestRuns: allRuns.length,
      },
      testPlans: testPlanSummaries,
      testCaseColumns,
      allTestCaseColumns,
      linkMap: linkMapObj,
      unlinkedRequirements,
    }
  },

  /**
   * Lightweight matrix (legacy shape, backward compatible).
   */
  async getTraceabilityMatrix(
    projectId: string,
    options?: { considerPassedWithErrors?: boolean }
  ): Promise<{ rows: TraceabilityMatrixRow[]; coverageSummary: { total: number; verified: number; gaps: number } }> {
    const full = await this.getFullTraceabilityMatrix(projectId, options)
    return {
      rows: full.rows,
      coverageSummary: {
        total: full.coverageSummary.linkedRequirements,
        verified: full.coverageSummary.verified,
        gaps: full.coverageSummary.gaps,
      },
    }
  },

  /**
   * Get list of coverage gaps for reporting.
   */
  async getCoverageGaps(projectId: string): Promise<CoverageGap[]> {
    const full = await this.getFullTraceabilityMatrix(projectId)
    const gaps: CoverageGap[] = []

    for (const row of full.rows) {
      for (const tc of row.testCases) {
        if (tc.gapReason === 'OK') continue
        gaps.push({
          requirementId: row.requirementId,
          requirementKey: row.requirementKey,
          testCaseId: tc.testCaseId,
          testCaseKey: tc.testCaseKey,
          gapReason: tc.gapReason,
        })
      }
      if (row.testCases.length === 0) {
        gaps.push({
          requirementId: row.requirementId,
          requirementKey: row.requirementKey,
          testCaseId: '',
          testCaseKey: '',
          gapReason: 'NO_LINKED_TEST_CASE',
        })
      }
    }

    for (const req of full.unlinkedRequirements) {
      gaps.push({
        requirementId: req.id,
        requirementKey: req.key,
        testCaseId: '',
        testCaseKey: '',
        gapReason: 'NO_LINKED_TEST_CASE',
      })
    }

    return gaps
  },
}
