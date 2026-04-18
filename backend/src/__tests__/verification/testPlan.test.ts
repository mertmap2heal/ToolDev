/**
 * Verification — test plan CRUD + state-transition tests (#133).
 *
 * Exercises the HTTP boundary for the core test-plan endpoints:
 *   POST /:projectId                — create + auto key allocation
 *   GET  /:projectId                — list (scoped)
 *   GET  /:projectId/:id            — single + 404 + cross-project 404
 *   PATCH /:projectId/:id           — update + status transition gate
 *   POST /:projectId/:id/approve    — REVIEWED -> APPROVED (rejects from DRAFT)
 *   POST /:projectId/:id/close      — ACTIVE -> CLOSED (rejects from DRAFT)
 *   DELETE /:projectId/:id          — cascade with trace links
 *
 * State machine (from statusTransition.service.ts):
 *   DRAFT -> REVIEWED -> APPROVED -> ACTIVE -> CLOSED
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification test-plan endpoints (#133)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let seedPlanA: string
  let seedPlanB: string
  const createdPlanIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `ver-tp-${stamp}@example.com`, password: 'hashed', name: 'Ver TP User' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-tp-a-${stamp}`
    const slugB = `ver-tp-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver TP A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver TP B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id
    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const tpA = await prisma.verTestPlan.create({
      data: { projectId: projectA, key: `TP-SEED-A-${stamp}`, name: 'Seed TP A', status: 'DRAFT' },
    })
    seedPlanA = tpA.id
    createdPlanIds.push(seedPlanA)
    const tpB = await prisma.verTestPlan.create({
      data: { projectId: projectB, key: `TP-SEED-B-${stamp}`, name: 'Seed TP B', status: 'DRAFT' },
    })
    seedPlanB = tpB.id
    createdPlanIds.push(seedPlanB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verTestPlanCase.deleteMany({ where: { testPlan: { projectId: { in: projectIds } } } }).catch(() => {})
    await prisma.traceLink
      .deleteMany({ where: { projectId: { in: projectIds }, sourceType: 'test_plan' } })
      .catch(() => {})
    await prisma.verTestPlan.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /api/v1/verification/test-plans/:projectId', () => {
    it('creates a test plan with auto-allocated key and DRAFT status', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Plan', description: 'Created via test' })
      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.key).toMatch(/^TP-/)
      expect(res.body.data.status).toBe('DRAFT')
      createdPlanIds.push(res.body.data.id)
    })

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })
  })

  describe('GET list and single', () => {
    it('GET /:projectId returns only plans for the requested project', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-plans/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      const ids = res.body.data.map((p: { id: string }) => p.id)
      expect(ids).toContain(seedPlanA)
      expect(ids).not.toContain(seedPlanB)
    })

    it('GET /:projectId/:id returns a single plan', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-plans/${projectA}/${seedPlanA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(seedPlanA)
    })

    it('GET /:projectId/:id returns 404 when the plan is in another project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-plans/${projectA}/${seedPlanB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('GET /:projectId/:id returns 404 for a non-existent plan', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/test-plans/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/verification/test-plans/:projectId/:id', () => {
    it('updates the name', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-plans/${projectA}/${seedPlanA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Seed TP A — renamed' })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Seed TP A — renamed')
    })

    it('returns 404 for a non-existent plan', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/test-plans/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:projectId/:id/approve state transition', () => {
    it('rejects approval from DRAFT (requires REVIEWED first)', async () => {
      const tp = await prisma.verTestPlan.create({
        data: { projectId: projectA, key: `TP-APPR-BAD-${stamp}`, name: 'Approve-from-draft', status: 'DRAFT' },
      })
      createdPlanIds.push(tp.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}/${tp.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/invalid status transition/i)
    })

    it('transitions REVIEWED -> APPROVED', async () => {
      const tp = await prisma.verTestPlan.create({
        data: { projectId: projectA, key: `TP-APPR-OK-${stamp}`, name: 'Approve-from-reviewed', status: 'REVIEWED' },
      })
      createdPlanIds.push(tp.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}/${tp.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('APPROVED')
    })
  })

  describe('POST /:projectId/:id/close state transition', () => {
    it('rejects close from DRAFT', async () => {
      const tp = await prisma.verTestPlan.create({
        data: { projectId: projectA, key: `TP-CLOSE-BAD-${stamp}`, name: 'Close-from-draft', status: 'DRAFT' },
      })
      createdPlanIds.push(tp.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}/${tp.id}/close`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/invalid status transition/i)
    })

    it('transitions ACTIVE -> CLOSED', async () => {
      const tp = await prisma.verTestPlan.create({
        data: { projectId: projectA, key: `TP-CLOSE-OK-${stamp}`, name: 'Close-from-active', status: 'ACTIVE' },
      })
      createdPlanIds.push(tp.id)
      const res = await request(app)
        .post(`/api/v1/verification/test-plans/${projectA}/${tp.id}/close`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CLOSED')
    })
  })

  describe('DELETE /api/v1/verification/test-plans/:projectId/:id', () => {
    it('returns 404 for a plan in another project (IDOR)', async () => {
      const res = await request(app)
        .delete(`/api/v1/verification/test-plans/${projectA}/${seedPlanB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      const still = await prisma.verTestPlan.findUnique({ where: { id: seedPlanB } })
      expect(still).not.toBeNull()
    })

    it('removes the plan and cascades plan cases', async () => {
      const tp = await prisma.verTestPlan.create({
        data: { projectId: projectA, key: `TP-DEL-${stamp}`, name: 'To delete', status: 'DRAFT' },
      })
      createdPlanIds.push(tp.id)
      const tc = await prisma.verTestCase.create({
        data: { projectId: projectA, key: `TC-DEL-IN-TP-${stamp}`, title: 'Linked TC', status: 'DRAFT', version: '1.0' },
      })
      const planCase = await prisma.verTestPlanCase.create({
        data: { testPlanId: tp.id, testCaseId: tc.id, orderIndex: 1, isMandatory: false },
      })

      const res = await request(app)
        .delete(`/api/v1/verification/test-plans/${projectA}/${tp.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)

      const gone = await prisma.verTestPlan.findUnique({ where: { id: tp.id } })
      expect(gone).toBeNull()
      const caseLinkGone = await prisma.verTestPlanCase.findUnique({ where: { id: planCase.id } })
      expect(caseLinkGone).toBeNull()

      const tcStillThere = await prisma.verTestCase.findUnique({ where: { id: tc.id } })
      expect(tcStillThere).not.toBeNull()
      await prisma.verTestCase.delete({ where: { id: tc.id } }).catch(() => {})
    })
  })
})
