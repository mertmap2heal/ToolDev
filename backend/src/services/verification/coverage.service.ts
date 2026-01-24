import { PrismaClient } from '@prisma/client'
import {
  CoverageSummary,
  PlanCoverage,
} from '../../types/verification.types'

const prisma = new PrismaClient()

/**
 * Coverage calculation service
 * Computes verification coverage metrics
 */
export const coverageService = {
  /**
   * Get MoC coverage summary for a project
   */
  async getMocSummary(projectId: string): Promise<CoverageSummary> {
    // Get all test cases with their MoC codes and verification status
    const testCases = await prisma.verTestCase.findMany({
      where: { projectId },
      include: {
        runResults: {
          where: {
            testRun: {
              projectId,
            },
          },
        },
      },
    })

    // Count by MoC
    const byMoc: Record<number, { total: number; verified: number }> = {}
    let totalRequirements = 0
    let verified = 0
    let notVerified = 0
    let failed = 0

    for (const testCase of testCases) {
      const mocCode = testCase.linkedMocCode
      if (mocCode === null || mocCode === undefined) continue

      if (!byMoc[mocCode]) {
        byMoc[mocCode] = { total: 0, verified: 0 }
      }

      byMoc[mocCode].total++
      totalRequirements++

      // Check if verified (has at least one PASS result)
      const hasPass = testCase.runResults.some((r) => r.resultStatus === 'PASS')
      const hasFail = testCase.runResults.some((r) => r.resultStatus === 'FAIL')

      if (hasPass && !hasFail) {
        verified++
        byMoc[mocCode].verified++
      } else if (hasFail) {
        failed++
      } else {
        notVerified++
      }
    }

    // Calculate percentages
    const verifiedPercentage =
      totalRequirements > 0 ? Math.round((verified / totalRequirements) * 100) : 0

    const byMocWithPercentage: Record<
      number,
      { total: number; verified: number; percentage: number }
    > = {}

    for (const [code, data] of Object.entries(byMoc)) {
      byMocWithPercentage[Number(code)] = {
        ...data,
        percentage: data.total > 0 ? Math.round((data.verified / data.total) * 100) : 0,
      }
    }

    return {
      totalRequirements,
      verified,
      notVerified,
      failed,
      verifiedPercentage,
      byMoc: byMocWithPercentage,
    }
  },

  /**
   * Get coverage for a test plan
   */
  async getPlanCoverage(planId: string): Promise<PlanCoverage | null> {
    const plan = await prisma.verTestPlan.findUnique({
      where: { id: planId },
      include: {
        planCases: {
          include: {
            testCase: {
              include: {
                runResults: true,
              },
            },
          },
        },
      },
    })

    if (!plan) return null

    let executed = 0
    let passed = 0
    let failed = 0
    let blocked = 0
    let skipped = 0

    for (const planCase of plan.planCases) {
      const results = planCase.testCase.runResults
      if (results.length > 0) {
        executed++
        const latestResult = results[results.length - 1]
        switch (latestResult.resultStatus) {
          case 'PASS':
            passed++
            break
          case 'FAIL':
            failed++
            break
          case 'BLOCKED':
            blocked++
            break
          case 'SKIPPED':
            skipped++
            break
        }
      }
    }

    const totalCases = plan.planCases.length
    const coveragePercentage =
      totalCases > 0 ? Math.round((executed / totalCases) * 100) : 0

    return {
      planId: plan.id,
      planName: plan.name,
      totalCases,
      executed,
      passed,
      failed,
      blocked,
      skipped,
      coveragePercentage,
    }
  },
}
