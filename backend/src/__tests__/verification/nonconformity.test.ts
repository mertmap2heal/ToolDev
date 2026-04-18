/**
 * Verification — nonconformity integration tests (#238, sub-task of #133).
 *
 * Exercises the HTTP boundary for /api/v1/verification/nonconformities/:projectId:
 *   GET    /:projectId                                                — list (project scoped)
 *   POST   /:projectId                                                — create (OPEN)
 *   GET    /:projectId/:id                                            — single + 404 cross-project
 *   PATCH  /:projectId/:id                                            — status transitions
 *   POST   /:projectId/from-failed-run-result/:runResultId            — create from failed run
 *   POST   /:projectId/:id/create-reverify-task                       — task created in expected project
 *   POST   /:projectId/:id/mark-reverified                            — flag flips, audit row written
 *   401   on every route without a token
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification nonconformity endpoints (#238)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let testCaseA: string
  let testPlanA: string
  let runIdA: string
  let runResultIdA: string
  let ncInB: string
  const createdNcIds: string[] = []
  const createdRunIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-nc-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver NC User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-nc-a-${stamp}`
    const slugB = `ver-nc-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver NC A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver NC B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const tc = await prisma.verTestCase.create({
      data: {
        projectId: projectA,
        key: `TC-NC-A-${stamp}`,
        title: 'NC Seed TC A',
        status: 'DRAFT',
        version: '1.0',
      },
    })
    testCaseA = tc.id

    const tp = await prisma.verTestPlan.create({
      data: {
        projectId: projectA,
        key: `TP-NC-A-${stamp}`,
        name: 'NC Seed TP A',
        status: 'DRAFT',
      },
    })
    testPlanA = tp.id

    const run = await prisma.verTestRun.create({
      data: {
        projectId: projectA,
        testPlanId: testPlanA,
        runName: `NC Seed Run ${stamp}`,
        status: 'IN_PROGRESS',
      },
    })
    runIdA = run.id
    createdRunIds.push(runIdA)

    const runResult = await prisma.verTestRunResult.create({
      data: {
        testRunId: runIdA,
        testCaseId: testCaseA,
        testCaseVersionSnapshot: { version: '1.0', title: 'NC Seed TC A' },
        parentTestCaseVersionAtExecution: '1.0',
        resultStatus: 'FAIL',
        executedAt: new Date(),
        actualResults: { failConditions: 'Voltage exceeded 5V threshold' },
      },
    })
    runResultIdA = runResult.id

    const ncB = await prisma.verNonconformity.create({
      data: {
        projectId: projectB,
        title: `IDOR Target NC ${stamp}`,
        severity: 'MEDIUM',
        status: 'OPEN',
      },
    })
    ncInB = ncB.id
    createdNcIds.push(ncInB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verReverifyTask
      .deleteMany({ where: { nonconformityId: { in: createdNcIds } } })
      .catch(() => {})
    await prisma.verNonconformity
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.verTestRunResultStatusHistory.deleteMany({}).catch(() => {})
    await prisma.verTestRunResult
      .deleteMany({ where: { testRunId: { in: createdRunIds } } })
      .catch(() => {})
    await prisma.verTestRun
      .deleteMany({ where: { projectId: { in: projectIds } } })
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

  describe('CRUD happy path', () => {
    it('POST /nonconformities/:projectId creates an OPEN nonconformity', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `NC happy ${stamp}`, severity: 'HIGH', description: 'something broke' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('OPEN')
      expect(res.body.data.severity).toBe('HIGH')
      expect(res.body.data.createdByUserId).toBe(userId)
      createdNcIds.push(res.body.data.id)
    })

    it('returns 400 when title or severity missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'no severity' })
      expect(res.status).toBe(400)
    })

    it('GET /nonconformities/:projectId lists only project A rows', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/nonconformities/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const ids = res.body.data.map((n: { id: string }) => n.id)
      expect(ids).not.toContain(ncInB)
    })

    it('GET /:projectId/:id returns 404 for cross-project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/nonconformities/${projectA}/${ncInB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get(`/api/v1/verification/nonconformities/${projectA}`)
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH status transitions', () => {
    it('OPEN -> INVESTIGATING is allowed', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC trans ${stamp}`, severity: 'LOW', status: 'OPEN' },
      })
      createdNcIds.push(nc.id)
      const res = await request(app)
        .patch(`/api/v1/verification/nonconformities/${projectA}/${nc.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVESTIGATING' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('INVESTIGATING')
    })

    it('OPEN -> CLOSED is rejected (invalid transition)', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC bad ${stamp}`, severity: 'LOW', status: 'OPEN' },
      })
      createdNcIds.push(nc.id)
      const res = await request(app)
        .patch(`/api/v1/verification/nonconformities/${projectA}/${nc.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CLOSED' })
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/transition/i)
    })

    it('INVESTIGATING -> FIXED is allowed', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC fix ${stamp}`, severity: 'LOW', status: 'INVESTIGATING' },
      })
      createdNcIds.push(nc.id)
      const res = await request(app)
        .patch(`/api/v1/verification/nonconformities/${projectA}/${nc.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'FIXED' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('FIXED')
    })

    it('PATCH on cross-project NC returns 404 (IDOR)', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/nonconformities/${projectA}/${ncInB}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVESTIGATING' })
      expect(res.status).toBe(404)
      const intact = await prisma.verNonconformity.findUnique({ where: { id: ncInB } })
      expect(intact?.status).toBe('OPEN')
    })
  })

  describe('POST /:projectId/from-failed-run-result/:runResultId', () => {
    it('creates a nonconformity sourced from a FAIL run result', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/from-failed-run-result/${runResultIdA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.sourceTestRunResultId).toBe(runResultIdA)
      expect(res.body.data.status).toBe('OPEN')
      expect(res.body.data.description).toMatch(/Voltage exceeded/i)
      createdNcIds.push(res.body.data.id)
    })

    it('returns 404 when the run result is not under this project', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectB}/from-failed-run-result/${runResultIdA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:id/create-reverify-task', () => {
    it('creates a reverify task in the expected project', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC reverify ${stamp}`, severity: 'HIGH', status: 'OPEN' },
      })
      createdNcIds.push(nc.id)

      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/${nc.id}/create-reverify-task`)
        .set('Authorization', `Bearer ${token}`)
        .send({ testCaseId: testCaseA })
      expect(res.status).toBe(201)
      expect(res.body.data.nonconformityId).toBe(nc.id)
      expect(res.body.data.testCaseId).toBe(testCaseA)
      expect(res.body.data.status).toBe('PENDING')

      const stored = await prisma.verReverifyTask.findUnique({ where: { id: res.body.data.id } })
      expect(stored?.nonconformityId).toBe(nc.id)
    })

    it('returns 404 when the test case is not in the project', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC reverify err ${stamp}`, severity: 'LOW', status: 'OPEN' },
      })
      createdNcIds.push(nc.id)
      const tcInB = await prisma.verTestCase.create({
        data: { projectId: projectB, key: `TC-NC-B-${stamp}`, title: 'TC in B', status: 'DRAFT', version: '1.0' },
      })
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/${nc.id}/create-reverify-task`)
        .set('Authorization', `Bearer ${token}`)
        .send({ testCaseId: tcInB.id })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:id/mark-reverified', () => {
    it('flips status to CLOSED and writes an audit row', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC mark ${stamp}`, severity: 'LOW', status: 'FIXED' },
      })
      createdNcIds.push(nc.id)
      const auditBefore = await prisma.verAuditEvent.count({
        where: { entityType: 'NONCONFORMITY', entityId: nc.id, action: 'CLOSE' },
      })

      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/${nc.id}/mark-reverified`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CLOSED')

      const auditAfter = await prisma.verAuditEvent.count({
        where: { entityType: 'NONCONFORMITY', entityId: nc.id, action: 'CLOSE' },
      })
      expect(auditAfter).toBe(auditBefore + 1)
    })

    it('returns 500 when transition is invalid (OPEN -> CLOSED)', async () => {
      const nc = await prisma.verNonconformity.create({
        data: { projectId: projectA, title: `NC mark err ${stamp}`, severity: 'LOW', status: 'OPEN' },
      })
      createdNcIds.push(nc.id)
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/${nc.id}/mark-reverified`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/transition/i)
    })

    it('returns 404 for cross-project (IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/nonconformities/${projectA}/${ncInB}/mark-reverified`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })
})
