/**
 * Verification — coverage service / coverage HTTP integration (Batch 10).
 *
 * Routes (verification.routes.ts):
 *   GET /coverage/:projectId/moc-summary
 *   GET /coverage/:projectId/plan/:planId
 *
 * Service exercised:
 *   coverageService.getMocSummary(projectId)
 *   coverageService.getPlanCoverage(planId)
 *
 * Auth chain: authenticateToken -> projectIdParam (membership-aware).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { coverageService } from '../../services/verification/coverage.service'

describe('Verification coverage service + HTTP', () => {
  const stamp = Date.now()
  let userId: string
  let outsiderId: string
  let token: string
  let outsiderToken: string
  let projectId: string
  let planId: string
  let tcVerifiedId: string
  let tcFailedId: string
  let tcNotRunId: string
  const seededMocCodes: number[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const u = await prisma.user.create({
      data: { email: `ver-cov-${stamp}@example.com`, password: 'hashed', name: 'Cov User' },
    })
    userId = u.id
    token = jwt.sign({ userId }, secret)

    const outsider = await prisma.user.create({
      data: { email: `ver-cov-out-${stamp}@example.com`, password: 'hashed', name: 'Cov Out' },
    })
    outsiderId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    const slug = `ver-cov-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Ver Cov ${stamp}`, domain: slug, slug, userId },
    })
    projectId = p.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    // Need MoC rows that linkedMocCode can FK to.
    // Use a code with a high random offset to avoid collision.
    const baseCode = 900000 + (stamp % 90000)
    const codeA = baseCode
    const codeB = baseCode + 1
    seededMocCodes.push(codeA, codeB)
    await prisma.verMoc.upsert({
      where: { code: codeA },
      update: { isActive: true },
      create: {
        code: codeA,
        name: `MoC Test ${codeA}`,
        description: 'cov test',
        requiresJustification: false,
        isActive: true,
      },
    })
    await prisma.verMoc.upsert({
      where: { code: codeB },
      update: { isActive: true },
      create: {
        code: codeB,
        name: `MoC Test ${codeB}`,
        description: 'cov test',
        requiresJustification: false,
        isActive: true,
      },
    })

    // Three test cases: one verified (PASS), one failed (FAIL), one without runs.
    const tcv = await prisma.verTestCase.create({
      data: {
        projectId,
        key: `TC-COV-V-${stamp}`,
        title: 'Verified TC',
        status: 'APPROVED',
        version: '1.0',
        linkedMocCode: codeA,
      },
    })
    tcVerifiedId = tcv.id
    const tcf = await prisma.verTestCase.create({
      data: {
        projectId,
        key: `TC-COV-F-${stamp}`,
        title: 'Failed TC',
        status: 'APPROVED',
        version: '1.0',
        linkedMocCode: codeA,
      },
    })
    tcFailedId = tcf.id
    const tcn = await prisma.verTestCase.create({
      data: {
        projectId,
        key: `TC-COV-N-${stamp}`,
        title: 'NotRun TC',
        status: 'APPROVED',
        version: '1.0',
        linkedMocCode: codeB,
      },
    })
    tcNotRunId = tcn.id

    // Test plan with all three test cases.
    const tp = await prisma.verTestPlan.create({
      data: {
        projectId,
        key: `TP-COV-${stamp}`,
        name: 'Cov Plan',
        status: 'APPROVED',
      },
    })
    planId = tp.id
    await prisma.verTestPlanCase.createMany({
      data: [
        { testPlanId: planId, testCaseId: tcVerifiedId, orderIndex: 0 },
        { testPlanId: planId, testCaseId: tcFailedId, orderIndex: 1 },
        { testPlanId: planId, testCaseId: tcNotRunId, orderIndex: 2 },
      ],
    })

    // Test run with two results.
    const run = await prisma.verTestRun.create({
      data: { projectId, runName: 'Cov Run', status: 'COMPLETED', testPlanId: planId },
    })
    await prisma.verTestRunResult.createMany({
      data: [
        {
          testRunId: run.id,
          testCaseId: tcVerifiedId,
          testCaseVersionSnapshot: { version: '1.0' },
          resultStatus: 'PASS',
        },
        {
          testRunId: run.id,
          testCaseId: tcFailedId,
          testCaseVersionSnapshot: { version: '1.0' },
          resultStatus: 'FAIL',
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.verTestRunResult
      .deleteMany({ where: { testCaseId: { in: [tcVerifiedId, tcFailedId, tcNotRunId] } } })
      .catch(() => {})
    await prisma.verTestRun.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestPlanCase.deleteMany({ where: { testPlanId: planId } }).catch(() => {})
    await prisma.verTestPlan.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestCase.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verMoc.deleteMany({ where: { code: { in: seededMocCodes } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get(`/api/v1/verification/coverage/${projectId}/moc-summary`)
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-member', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/coverage/${projectId}/moc-summary`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /coverage/:projectId/moc-summary', () => {
    it('returns aggregated MoC summary with verified/failed/notVerified counts', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/coverage/${projectId}/moc-summary`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const summary = res.body.data
      // We seeded 3 TCs with linkedMocCode -> all counted toward totalRequirements.
      expect(summary.totalRequirements).toBe(3)
      expect(summary.verified).toBe(1)
      expect(summary.failed).toBe(1)
      expect(summary.notVerified).toBe(1)
      // verifiedPercentage = round(1/3 * 100) = 33
      expect(summary.verifiedPercentage).toBe(33)
      expect(summary.byMoc).toBeTruthy()
    })

    it('byMoc breakdown reports per-code totals + percentages', async () => {
      const summary = await coverageService.getMocSummary(projectId)
      const codes = Object.keys(summary.byMoc)
      expect(codes.length).toBeGreaterThanOrEqual(2)
      // codeA had 2 cases (1 PASS, 1 FAIL) -> verified=1 / total=2 -> 50%
      // codeB had 1 case (no runs) -> verified=0 / total=1 -> 0%
      const codeAEntry = Object.values(summary.byMoc).find((x: any) => x.total === 2) as any
      expect(codeAEntry).toBeTruthy()
      expect(codeAEntry.verified).toBe(1)
      expect(codeAEntry.percentage).toBe(50)
    })
  })

  describe('GET /coverage/:projectId/plan/:planId', () => {
    it('returns plan coverage with executed/passed/failed breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/coverage/${projectId}/plan/${planId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const cov = res.body.data
      expect(cov.planId).toBe(planId)
      expect(cov.totalCases).toBe(3)
      // executed counts test cases with at least one run result.
      expect(cov.executed).toBe(2)
      expect(cov.passed).toBe(1)
      expect(cov.failed).toBe(1)
      // coveragePercentage = round(2/3 * 100) = 67
      expect(cov.coveragePercentage).toBe(67)
    })

    it('returns 404 for unknown plan id', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/coverage/${projectId}/plan/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('service-level: getPlanCoverage returns null when planId is unknown', async () => {
      const out = await coverageService.getPlanCoverage('00000000-0000-0000-0000-000000000000')
      expect(out).toBeNull()
    })
  })
})
