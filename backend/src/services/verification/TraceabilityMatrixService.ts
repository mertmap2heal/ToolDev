/**
 * Traceability Matrix Service
 * Requirement -> TestCase -> TestRun coverage and gap analysis.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface TraceabilityMatrixRow {
  requirementId: string
  requirementKey: string
  requirementTitle: string
  testCases: {
    testCaseId: string
    testCaseKey: string
    testCaseTitle: string
    latestRunResult: {
      id: string
      resultStatus: string
      executedAt: string | null
      isOutOfSync: boolean
    } | null
    gapReason: 'NO_RUN' | 'OUT_OF_SYNC' | 'NOT_PASSED' | 'OK'
  }[]
  verified: boolean
}

export interface CoverageGap {
  requirementId: string
  requirementKey: string
  testCaseId: string
  testCaseKey: string
  gapReason: string
}

const PASSED_STATUSES = ['PASS', 'PASSED_WITH_ERRORS']

export const traceabilityMatrixService = {
  /**
   * Get full traceability matrix: requirements with linked test cases and latest run results.
   */
  async getTraceabilityMatrix(
    projectId: string,
    options?: {
      considerPassedWithErrors?: boolean
    }
  ): Promise<{ rows: TraceabilityMatrixRow[]; coverageSummary: { total: number; verified: number; gaps: number } }> {
    const considerPassedWithErrors = options?.considerPassedWithErrors ?? true
    const passedStatusSet = considerPassedWithErrors ? new Set([...PASSED_STATUSES]) : new Set(['PASS'])

    // TestCase (source) --verifies--> Requirement (target)
    const links = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_case',
        targetType: 'requirement',
        linkType: 'verifies',
      },
    })
    // reqToTcs: requirementId -> [testCaseIds that verify it]

    const reqIds = [...new Set(links.map((l) => l.targetId))]
    const tcIds = [...new Set(links.map((l) => l.sourceId))]

    const requirements = await prisma.requirement.findMany({
      where: { id: { in: reqIds }, projectId },
      select: { id: true, requirementId: true, title: true },
    })
    const reqMap = new Map(requirements.map((r) => [r.id, r]))

    const testCases = await prisma.verTestCase.findMany({
      where: { id: { in: tcIds }, projectId },
      select: { id: true, key: true, title: true },
    })
    const tcMap = new Map(testCases.map((tc) => [tc.id, tc]))

    const runResults = await prisma.verTestRunResult.findMany({
      where: { testCaseId: { in: tcIds } },
      include: { testRun: true },
      orderBy: { executedAt: 'desc' },
    })

    const latestByCase = new Map<string, typeof runResults[0]>()
    for (const rr of runResults) {
      if (rr.testRun.deletedAt) continue
      if (!latestByCase.has(rr.testCaseId)) {
        latestByCase.set(rr.testCaseId, rr)
      }
    }

    const reqToTcs = new Map<string, string[]>()
    for (const link of links) {
      const list = reqToTcs.get(link.targetId) ?? []
      if (!list.includes(link.sourceId)) list.push(link.sourceId)
      reqToTcs.set(link.targetId, list)
    }

    const rows: TraceabilityMatrixRow[] = []
    let verifiedCount = 0
    let gapCount = 0

    for (const req of requirements) {
      const tcIdsForReq = reqToTcs.get(req.id) ?? []
      const testCasesData: TraceabilityMatrixRow['testCases'] = []
      let verified = true

      for (const tcId of tcIdsForReq) {
        const tc = tcMap.get(tcId)
        if (!tc) continue

        const latest = latestByCase.get(tcId)
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

        testCasesData.push({
          testCaseId: tc.id,
          testCaseKey: tc.key,
          testCaseTitle: tc.title,
          latestRunResult: latest
            ? {
                id: latest.id,
                resultStatus: latest.resultStatus,
                executedAt: latest.executedAt?.toISOString() ?? null,
                isOutOfSync: latest.isOutOfSync,
              }
            : null,
          gapReason,
        })
      }

      if (testCasesData.length === 0) {
        verified = false
        gapCount++
      } else if (verified) {
        verifiedCount++
      }

      rows.push({
        requirementId: req.id,
        requirementKey: req.requirementId ?? req.id,
        requirementTitle: req.title,
        testCases: testCasesData,
        verified,
      })
    }

    return {
      rows,
      coverageSummary: {
        total: rows.length,
        verified: verifiedCount,
        gaps: gapCount,
      },
    }
  },

  /**
   * Get list of coverage gaps for reporting.
   */
  async getCoverageGaps(projectId: string): Promise<CoverageGap[]> {
    const { rows } = await this.getTraceabilityMatrix(projectId)
    const gaps: CoverageGap[] = []

    for (const row of rows) {
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

    return gaps
  },
}
