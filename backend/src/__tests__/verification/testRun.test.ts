/**
 * Verification — test run CRUD + timer state-machine tests (#242, sub-task of #133).
 *
 * Exercises the HTTP boundary (authenticateToken + projectIdParam + handler)
 * for the test-run endpoints under /api/v1/verification/test-runs/:
 *   POST   /:projectId                                       — create run (Builder)
 *   PATCH  /:projectId/:runId                                — update notes / actualDurationSeconds
 *   POST   /:projectId/:runId/start                          — timer state -> IN_PROGRESS
 *   POST   /:projectId/:runId/pause                          — timer state -> paused
 *   POST   /:projectId/:runId/resume                         — timer state -> IN_PROGRESS
 *   POST   /:projectId/:runId/stop                           — timer state -> COMPLETED
 *   POST   /:projectId/:runId/complete-and-export            — emits VerTestResult, returns 200
 *   IDOR:   PATCH/start in project A targeting run in project B returns 404
 *   401:   no token returns 401
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification test-run endpoints (#242)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let testCaseA: string
  let testPlanA: string
  let runIdInB: string
  const createdRunIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-tr-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver TR User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-tr-a-${stamp}`
    const slugB = `ver-tr-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver TR A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver TR B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const tcA = await prisma.verTestCase.create({
      data: {
        projectId: projectA,
        key: `TC-TR-A-${stamp}`,
        title: 'TR Seed TC A',
        status: 'DRAFT',
        version: '1.0',
      },
    })
    testCaseA = tcA.id

    const tpA = await prisma.verTestPlan.create({
      data: {
        projectId: projectA,
        key: `TP-TR-A-${stamp}`,
        name: 'TR Seed TP A',
        status: 'DRAFT',
      },
    })
    testPlanA = tpA.id
    await prisma.verTestPlanCase.create({
      data: { testPlanId: testPlanA, testCaseId: testCaseA, orderIndex: 0 },
    })

    const runB = await prisma.verTestRun.create({
      data: {
        projectId: projectB,
        runName: `IDOR Target Run ${stamp}`,
        status: 'PLANNED',
      },
    })
    runIdInB = runB.id
    createdRunIds.push(runIdInB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verTestRunResultStatusHistory
      .deleteMany({})
      .catch(() => {})
    await prisma.verTestRunResultActualResult
      .deleteMany({})
      .catch(() => {})
    await prisma.verTestRunExecutionTimer
      .deleteMany({ where: { testRunId: { in: createdRunIds } } })
      .catch(() => {})
    await prisma.verTestRunResult
      .deleteMany({ where: { testRunId: { in: createdRunIds } } })
      .catch(() => {})
    await prisma.verTestResult
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.verTestRun
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.verTestPlanCase
      .deleteMany({ where: { testPlanId: testPlanA } })
      .catch(() => {})
    await prisma.verTestPlan
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.verTestCase
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /api/v1/verification/test-runs/:projectId', () => {
    it('creates a PLANNED run from a test plan and seeds one VerTestRunResult per plan case', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ testPlanId: testPlanA, runName: `Run via plan ${stamp}` })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.status).toBe('PLANNED')
      expect(res.body.data.testPlanId).toBe(testPlanA)
      expect(res.body.data.results).toBeDefined()
      expect(res.body.data.results.length).toBe(1)
      createdRunIds.push(res.body.data.id)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}`)
        .send({ testPlanId: testPlanA })
      expect(res.status).toBe(401)
    })

    it('returns 500 with descriptive error for an empty plan with no cases', async () => {
      const emptyPlan = await prisma.verTestPlan.create({
        data: {
          projectId: projectA,
          key: `TP-EMPTY-${stamp}`,
          name: 'Empty Plan',
          status: 'DRAFT',
        },
      })
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ testPlanId: emptyPlan.id })
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/no test cases/i)
    })
  })

  describe('PATCH /api/v1/verification/test-runs/:projectId/:runId', () => {
    let runId: string
    beforeAll(async () => {
      const r = await prisma.verTestRun.create({
        data: { projectId: projectA, runName: `Patch Target ${stamp}`, status: 'PLANNED' },
      })
      runId = r.id
      createdRunIds.push(runId)
    })

    it('updates actualDurationSeconds', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-runs/${projectA}/${runId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualDurationSeconds: 4242 })
      expect(res.status).toBe(200)
      expect(res.body.data.actualDurationSeconds).toBe(4242)
    })

    it('returns 404 for a run in another project (IDOR)', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-runs/${projectA}/${runIdInB}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualDurationSeconds: 999 })
      expect(res.status).toBe(404)
      const intact = await prisma.verTestRun.findUnique({ where: { id: runIdInB } })
      expect(intact?.actualDurationSeconds ?? null).toBeNull()
    })

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-runs/${projectA}/${runId}`)
        .send({ actualDurationSeconds: 1 })
      expect(res.status).toBe(401)
    })
  })

  describe('Timer transitions: start / pause / resume / stop', () => {
    let runId: string
    beforeAll(async () => {
      const r = await prisma.verTestRun.create({
        data: { projectId: projectA, runName: `Timer Run ${stamp}`, status: 'PLANNED' },
      })
      runId = r.id
      createdRunIds.push(runId)
    })

    it('POST /start moves status to IN_PROGRESS and creates a timer segment', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runId}/start`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.run.id).toBe(runId)
      expect(res.body.data.segment.id).toBeDefined()

      const run = await prisma.verTestRun.findUnique({ where: { id: runId } })
      expect(run?.status).toBe('IN_PROGRESS')
      expect(run?.startedAt).not.toBeNull()

      const segments = await prisma.verTestRunExecutionTimer.count({ where: { testRunId: runId } })
      expect(segments).toBe(1)
    })

    it('POST /pause sets pausedAt and aggregates totalSeconds', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runId}/pause`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.data.totalSeconds).toBe('number')

      const run = await prisma.verTestRun.findUnique({ where: { id: runId } })
      expect(run?.pausedAt).not.toBeNull()
    })

    it('POST /pause again returns 400 (no active segment)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runId}/pause`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/no active timer/i)
    })

    it('POST /resume clears pausedAt and creates a new segment', async () => {
      const before = await prisma.verTestRunExecutionTimer.count({ where: { testRunId: runId } })
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runId}/resume`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.segment.id).toBeDefined()

      const run = await prisma.verTestRun.findUnique({ where: { id: runId } })
      expect(run?.pausedAt).toBeNull()
      const after = await prisma.verTestRunExecutionTimer.count({ where: { testRunId: runId } })
      expect(after).toBe(before + 1)
    })

    it('POST /stop sets status to COMPLETED, endedAt, and clears pausedAt', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runId}/stop`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.data.totalSeconds).toBe('number')

      const run = await prisma.verTestRun.findUnique({ where: { id: runId } })
      expect(run?.status).toBe('COMPLETED')
      expect(run?.endedAt).not.toBeNull()
      expect(run?.pausedAt).toBeNull()
    })

    it('POST /start cross-project (IDOR) returns 400 with not-found error', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${runIdInB}/start`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
      const intact = await prisma.verTestRun.findUnique({ where: { id: runIdInB } })
      expect(intact?.status).toBe('PLANNED')
    })

    it('POST /start without token returns 401', async () => {
      const res = await request(app).post(
        `/api/v1/verification/test-runs/${projectA}/${runId}/start`
      )
      expect(res.status).toBe(401)
    })
  })

  describe('POST /:projectId/:runId/complete-and-export', () => {
    it('returns 200 and creates a VerTestResult with sourceTestRunId set', async () => {
      const r = await prisma.verTestRun.create({
        data: { projectId: projectA, runName: `Export Run ${stamp}`, status: 'IN_PROGRESS' },
      })
      createdRunIds.push(r.id)
      await prisma.verTestRunResult.create({
        data: {
          testRunId: r.id,
          testCaseId: testCaseA,
          testCaseVersionSnapshot: { version: '1.0' },
          parentTestCaseVersionAtExecution: '1.0',
          resultStatus: 'PASS',
          executedAt: new Date(),
        },
      })

      const res = await request(app)
        .post(`/api/v1/verification/test-runs/${projectA}/${r.id}/complete-and-export`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.testResult.id).toBeDefined()
      expect(res.body.data.testResult.title).toMatch(/Run:/)

      const exported = await prisma.verTestResult.findFirst({
        where: { sourceTestRunId: r.id },
      })
      expect(exported).not.toBeNull()
      expect(exported?.projectId).toBe(projectA)

      const run = await prisma.verTestRun.findUnique({ where: { id: r.id } })
      expect(run?.status).toBe('COMPLETED')
    })
  })
})
