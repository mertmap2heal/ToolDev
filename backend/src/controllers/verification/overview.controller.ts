import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { coverageService } from '../../services/verification/coverage.service'

const prisma = new PrismaClient()

export const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const [testPlans, testCases, nonconformities, mocSummary] = await Promise.all([
      prisma.verTestPlan.findMany({ where: { projectId }, select: { status: true } }),
      prisma.verTestCase.findMany({ where: { projectId }, select: { status: true } }),
      prisma.verNonconformity.findMany({
        where: { projectId },
        select: { severity: true, status: true },
      }),
      coverageService.getMocSummary(projectId),
    ])
    // Count by status
    const plansByStatus: Record<string, number> = {}
    testPlans.forEach((p) => {
      plansByStatus[p.status] = (plansByStatus[p.status] || 0) + 1
    })
    const casesByStatus: Record<string, number> = {}
    testCases.forEach((c) => {
      casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1
    })
    const ncsBySeverity: Record<string, number> = {}
    let openNCs = 0
    nonconformities.forEach((nc) => {
      ncsBySeverity[nc.severity] = (ncsBySeverity[nc.severity] || 0) + 1
      if (nc.status === 'OPEN' || nc.status === 'INVESTIGATING') {
        openNCs++
      }
    })
    const overview = {
      testPlans: {
        total: testPlans.length,
        byStatus: plansByStatus,
      },
      testCases: {
        total: testCases.length,
        byStatus: casesByStatus,
      },
      coverage: {
        byMoc: mocSummary.byMoc,
        overall: mocSummary.verifiedPercentage,
      },
      nonconformities: {
        total: nonconformities.length,
        bySeverity: ncsBySeverity,
        open: openNCs,
      },
    }
    res.json({ success: true, data: overview })
  } catch (error: any) {
    console.error('Get overview error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
