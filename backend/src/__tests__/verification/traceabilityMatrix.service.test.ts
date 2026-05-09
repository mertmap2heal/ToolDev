/**
 * Verification — TraceabilityMatrixService HTTP integration (Batch 10).
 *
 * Routes (verification.routes.ts):
 *   GET /traceability-matrix/:projectId          — light Req->TC->latestRunResult
 *   GET /traceability-matrix/:projectId?full=true — full response with summary, plans, columns
 *   GET /traceability-matrix/:projectId/gaps     — coverage gaps list
 *
 * Service exercised:
 *   traceabilityMatrixService.getTraceabilityMatrix
 *   traceabilityMatrixService.getFullTraceabilityMatrix
 *   traceabilityMatrixService.getCoverageGaps
 *
 * Auth chain: authenticateToken (route does not run projectIdParam — no membership middleware
 * on this particular subroute, so 401 only here).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { traceabilityMatrixService } from '../../services/verification/TraceabilityMatrixService'

describe('Verification traceability matrix service + HTTP', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let reqLinkedId: string
  let reqUnlinkedId: string
  let tcLinkedId: string
  let planId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u = await prisma.user.create({
      data: { email: `ver-tm-${stamp}@example.com`, password: 'hashed', name: 'TM User' },
    })
    userId = u.id
    token = jwt.sign({ userId }, secret)

    const slug = `ver-tm-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Ver TM ${stamp}`, domain: slug, slug, userId },
    })
    projectId = p.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    // 1 linked requirement, 1 unlinked.
    const reqL = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `RQ-TM-L-${stamp}`,
        title: 'Linked Req',
        description: 'verified by TC',
        priority: 'High',
        status: 'Approved',
        stage: 'requirements',
      },
    })
    reqLinkedId = reqL.id
    const reqU = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `RQ-TM-U-${stamp}`,
        title: 'Unlinked Req',
        description: 'no test cases',
        priority: 'Low',
        status: 'Draft',
        stage: 'requirements',
      },
    })
    reqUnlinkedId = reqU.id

    // 1 test case linked to reqL via TraceLink (sourceType:test_case, target:requirement, linkType:verifies)
    const tc = await prisma.verTestCase.create({
      data: {
        projectId,
        key: `TC-TM-${stamp}`,
        title: 'TM TC',
        status: 'APPROVED',
        version: '1.0',
      },
    })
    tcLinkedId = tc.id

    await prisma.traceLink.create({
      data: {
        projectId,
        sourceType: 'test_case',
        sourceId: tcLinkedId,
        targetType: 'requirement',
        targetId: reqLinkedId,
        linkType: 'verifies',
      },
    })

    // 1 plan that contains the linked TC.
    const plan = await prisma.verTestPlan.create({
      data: {
        projectId,
        key: `TP-TM-${stamp}`,
        name: 'TM Plan',
        status: 'APPROVED',
      },
    })
    planId = plan.id
    await prisma.verTestPlanCase.create({
      data: { testPlanId: planId, testCaseId: tcLinkedId, orderIndex: 0 },
    })

    // 1 run with a PASS result -> linked req should be verified.
    const run = await prisma.verTestRun.create({
      data: { projectId, runName: 'TM Run', status: 'COMPLETED', testPlanId: planId },
    })
    await prisma.verTestRunResult.create({
      data: {
        testRunId: run.id,
        testCaseId: tcLinkedId,
        testCaseVersionSnapshot: { version: '1.0' },
        resultStatus: 'PASS',
        executedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await prisma.verTestRunResult
      .deleteMany({ where: { testCaseId: tcLinkedId } })
      .catch(() => {})
    await prisma.verTestRun.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestPlanCase.deleteMany({ where: { testPlanId: planId } }).catch(() => {})
    await prisma.verTestPlan.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestCase.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get(`/api/v1/verification/traceability-matrix/${projectId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /traceability-matrix/:projectId (light)', () => {
    it('returns rows for linked requirements with PASS result', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/traceability-matrix/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      const data = res.body.data
      expect(Array.isArray(data.rows)).toBe(true)
      const linkedRow = data.rows.find((r: any) => r.requirementId === reqLinkedId)
      expect(linkedRow).toBeTruthy()
      expect(linkedRow.verified).toBe(true)
      expect(linkedRow.testCases.length).toBe(1)
      expect(linkedRow.testCases[0].testCaseId).toBe(tcLinkedId)
      expect(linkedRow.testCases[0].latestRunResult?.resultStatus).toBe('PASS')
      expect(linkedRow.testCases[0].gapReason).toBe('OK')
      // Only LINKED requirements are in rows.
      expect(data.rows.find((r: any) => r.requirementId === reqUnlinkedId)).toBeUndefined()
      expect(data.coverageSummary.total).toBeGreaterThanOrEqual(1)
      expect(data.coverageSummary.verified).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /traceability-matrix/:projectId?full=true', () => {
    it('returns full response with testPlans, columns, summary', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/traceability-matrix/${projectId}?full=true`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const data = res.body.data
      expect(Array.isArray(data.testPlans)).toBe(true)
      expect(Array.isArray(data.testCaseColumns)).toBe(true)
      expect(Array.isArray(data.allTestCaseColumns)).toBe(true)
      expect(typeof data.coverageSummary.coveragePercent).toBe('number')
      // The plan we seeded is present.
      expect(data.testPlans.find((p: any) => p.id === planId)).toBeTruthy()
    })
  })

  describe('GET /traceability-matrix/:projectId/gaps', () => {
    it('lists unlinked requirements as NO_LINKED_TEST_CASE gap', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/traceability-matrix/${projectId}/gaps`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const gaps = res.body.data
      expect(Array.isArray(gaps)).toBe(true)
      const unlinkedGap = gaps.find((g: any) => g.requirementId === reqUnlinkedId)
      expect(unlinkedGap).toBeTruthy()
      expect(unlinkedGap.gapReason).toBe('NO_LINKED_TEST_CASE')
      // Linked req is verified PASS -> should NOT be in gaps.
      const linkedGap = gaps.find(
        (g: any) => g.requirementId === reqLinkedId && g.gapReason !== 'NO_LINKED_TEST_CASE'
      )
      expect(linkedGap).toBeUndefined()
    })
  })

  describe('service direct', () => {
    it('getCoverageGaps returns the same gap shape', async () => {
      const gaps = await traceabilityMatrixService.getCoverageGaps(projectId)
      expect(Array.isArray(gaps)).toBe(true)
      expect(gaps.find((g) => g.requirementId === reqUnlinkedId)).toBeTruthy()
    })
  })
})
