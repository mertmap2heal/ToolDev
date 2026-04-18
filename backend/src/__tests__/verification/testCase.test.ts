/**
 * Verification — test case CRUD + state-transition tests (#133).
 *
 * Exercises the HTTP boundary (authenticateToken + projectIdParam + handler)
 * for the core test-case endpoints under /api/v1/verification/test-cases/:
 *   GET /:projectId                 — list
 *   POST /:projectId                — create (auto key allocation, 409 on dup)
 *   GET /:projectId/:id             — single + 404 + cross-project IDOR
 *   PATCH /:projectId/:id           — update + state transition validation
 *   POST /:projectId/:id/review     — DRAFT -> REVIEWED
 *   POST /:projectId/:id/approve    — REVIEWED -> APPROVED
 *   DELETE /:projectId/:id          — atomic cascade (#136)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification test-case endpoints (#133)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let seedCaseA: string
  let seedCaseB: string
  const createdCaseIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-tc-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver TC User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-tc-a-${stamp}`
    const slugB = `ver-tc-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver TC A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver TC B ${stamp}`, domain: slugB, slug: slugB, userId },
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
        key: `TC-SEED-A-${stamp}`,
        title: 'Seed TC A',
        status: 'DRAFT',
        version: '1.0',
      },
    })
    seedCaseA = tcA.id
    createdCaseIds.push(seedCaseA)

    const tcB = await prisma.verTestCase.create({
      data: {
        projectId: projectB,
        key: `TC-SEED-B-${stamp}`,
        title: 'Seed TC B',
        status: 'DRAFT',
        version: '1.0',
      },
    })
    seedCaseB = tcB.id
    createdCaseIds.push(seedCaseB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verTestResultLink
      .deleteMany({ where: { linkedEntityType: 'TEST_CASE', linkedEntityId: { in: createdCaseIds } } })
      .catch(() => {})
    await prisma.traceLink
      .deleteMany({ where: { projectId: { in: projectIds }, sourceType: 'test_case' } })
      .catch(() => {})
    await prisma.verTestCase.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /api/v1/verification/test-cases/:projectId', () => {
    it('creates a test case with auto-allocated key, DRAFT status, version 1.0', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Auto-Key TC' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.key).toMatch(/^TC-/)
      expect(res.body.data.status).toBe('DRAFT')
      expect(res.body.data.version).toBe('1.0')
      createdCaseIds.push(res.body.data.id)
    })

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/title/i)
    })

    it('accepts an explicit key and returns 409 on duplicate', async () => {
      const explicitKey = `TC-EXPLICIT-${stamp}`
      const res1 = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Explicit Key TC', key: explicitKey })
      expect(res1.status).toBe(201)
      expect(res1.body.data.key).toBe(explicitKey)
      createdCaseIds.push(res1.body.data.id)

      const res2 = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Another With Same Key', key: explicitKey })
      expect(res2.status).toBe(409)
    })
  })

  describe('GET /api/v1/verification/test-cases/:projectId', () => {
    it('returns only test cases for the requested project', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-cases/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      for (const tc of res.body.data) {
        expect(tc.projectId).toBe(projectA)
      }
      const ids = res.body.data.map((tc: { id: string }) => tc.id)
      expect(ids).not.toContain(seedCaseB)
    })
  })

  describe('GET /api/v1/verification/test-cases/:projectId/:id', () => {
    it('returns a single test case', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-cases/${projectA}/${seedCaseA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(seedCaseA)
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-cases/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 404 when the test case lives in another project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-cases/${projectA}/${seedCaseB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/verification/test-cases/:projectId/:id', () => {
    it('updates the title', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-cases/${projectA}/${seedCaseA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Seed TC A — renamed' })
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('Seed TC A — renamed')
    })

    it('rejects an invalid status transition (DRAFT -> APPROVED)', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-BAD-TRANS-${stamp}`,
          title: 'Bad Transition TC',
          status: 'DRAFT',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      const res = await request(app)
        .patch(`/api/v1/verification/test-cases/${projectA}/${tc.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'APPROVED' })
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/invalid status transition/i)
    })

    it('accepts a valid status transition (DRAFT -> REVIEWED)', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-GOOD-TRANS-${stamp}`,
          title: 'Good Transition TC',
          status: 'DRAFT',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      const res = await request(app)
        .patch(`/api/v1/verification/test-cases/${projectA}/${tc.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'REVIEWED' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('REVIEWED')
    })

    it('returns 404 for a non-existent test case', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-cases/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Ghost' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:projectId/:id/review and /approve', () => {
    it('POST /review transitions a DRAFT test case to REVIEWED', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-REVIEW-${stamp}`,
          title: 'Review flow TC',
          status: 'DRAFT',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}/${tc.id}/review`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('REVIEWED')
    })

    it('POST /approve transitions a REVIEWED test case to APPROVED', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-APPROVE-${stamp}`,
          title: 'Approve flow TC',
          status: 'REVIEWED',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}/${tc.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('APPROVED')
    })

    it('POST /approve throws when the test case is not in REVIEWED state', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-APPROVE-BAD-${stamp}`,
          title: 'Approve from DRAFT TC',
          status: 'DRAFT',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-cases/${projectA}/${tc.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/invalid status transition/i)
    })
  })

  describe('DELETE /api/v1/verification/test-cases/:projectId/:id', () => {
    it('returns 404 for a test case in another project (IDOR)', async () => {
      const res = await request(app)
        .delete(`/api/v1/verification/test-cases/${projectA}/${seedCaseB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      const still = await prisma.verTestCase.findUnique({ where: { id: seedCaseB } })
      expect(still).not.toBeNull()
    })

    it('removes the test case and cascades related link rows', async () => {
      const tc = await prisma.verTestCase.create({
        data: {
          projectId: projectA,
          key: `TC-DEL-${stamp}`,
          title: 'Delete me',
          status: 'DRAFT',
          version: '1.0',
        },
      })
      createdCaseIds.push(tc.id)
      await prisma.traceLink.create({
        data: {
          projectId: projectA,
          sourceType: 'test_case',
          sourceId: tc.id,
          targetType: 'requirement',
          targetId: 'ghost',
          linkType: 'verifies',
        },
      })

      const res = await request(app)
        .delete(`/api/v1/verification/test-cases/${projectA}/${tc.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const gone = await prisma.verTestCase.findUnique({ where: { id: tc.id } })
      expect(gone).toBeNull()
      const traceLinksLeft = await prisma.traceLink.count({
        where: { projectId: projectA, sourceType: 'test_case', sourceId: tc.id },
      })
      expect(traceLinksLeft).toBe(0)
    })
  })
})
