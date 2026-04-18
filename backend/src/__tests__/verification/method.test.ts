/**
 * Verification — method (MoC-linked) integration tests (#239, sub-task of #133).
 *
 * Routes under /api/v1/verification/methods/:projectId:
 *   GET    /:projectId           — list (project scoped)
 *   POST   /:projectId           — create (DRAFT)
 *   GET    /:projectId/:id       — single + 404 + 404 cross-project
 *   PATCH  /:projectId/:id       — update + status transition validation
 *   POST   /:projectId/:id/approve    — DRAFT -> APPROVED
 *   POST   /:projectId/:id/deprecate  — APPROVED -> DEPRECATED
 *   401 on every route without a token
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification method endpoints (#239)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let methodInB: string
  const createdMethodIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-mt-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver MT User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-mt-a-${stamp}`
    const slugB = `ver-mt-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver MT A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver MT B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const mB = await prisma.verMethod.create({
      data: {
        projectId: projectB,
        name: `IDOR Target Method ${stamp}`,
        methodType: 'TEST',
        status: 'DRAFT',
      },
    })
    methodInB = mB.id
    createdMethodIds.push(methodInB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verMethod
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /api/v1/verification/methods/:projectId', () => {
    it('creates a DRAFT method with ownerUserId defaulting to the JWT subject', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Method A ${stamp}`, methodType: 'TEST' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('DRAFT')
      expect(res.body.data.methodType).toBe('TEST')
      expect(res.body.data.ownerUserId).toBe(userId)
      createdMethodIds.push(res.body.data.id)
    })

    it('returns 400 when name or methodType missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'no type' })
      expect(res.status).toBe(400)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}`)
        .send({ name: 'no auth', methodType: 'ANALYSIS' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET list / single', () => {
    it('GET /:projectId lists only project A methods', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/methods/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const ids = res.body.data.map((m: { id: string }) => m.id)
      expect(ids).not.toContain(methodInB)
    })

    it('GET /:projectId/:id returns single method', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Get one ${stamp}`, methodType: 'INSPECTION', status: 'DRAFT' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .get(`/api/v1/verification/methods/${projectA}/${m.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(m.id)
    })

    it('GET /:projectId/:id returns 404 for cross-project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/methods/${projectA}/${methodInB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get(`/api/v1/verification/methods/${projectA}`)
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH update + status transitions', () => {
    it('updates name without status change', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Patch ${stamp}`, methodType: 'REVIEW', status: 'DRAFT' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .patch(`/api/v1/verification/methods/${projectA}/${m.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Patched ${stamp}` })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe(`Patched ${stamp}`)
    })

    it('rejects invalid status transition (DRAFT -> DEPRECATED)', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Bad trans ${stamp}`, methodType: 'TEST', status: 'DRAFT' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .patch(`/api/v1/verification/methods/${projectA}/${m.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DEPRECATED' })
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/transition/i)
    })

    it('returns 404 for cross-project PATCH (IDOR)', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/methods/${projectA}/${methodInB}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'should not change' })
      expect(res.status).toBe(404)
      const intact = await prisma.verMethod.findUnique({ where: { id: methodInB } })
      expect(intact?.name).toBe(`IDOR Target Method ${stamp}`)
    })
  })

  describe('POST /:id/approve and /deprecate', () => {
    it('approve transitions DRAFT -> APPROVED', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Approve me ${stamp}`, methodType: 'TEST', status: 'DRAFT' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}/${m.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('APPROVED')

      const audit = await prisma.verAuditEvent.findFirst({
        where: { entityType: 'METHOD', entityId: m.id, action: 'APPROVE' },
      })
      expect(audit).not.toBeNull()
    })

    it('deprecate transitions APPROVED -> DEPRECATED', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Deprecate me ${stamp}`, methodType: 'TEST', status: 'APPROVED' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}/${m.id}/deprecate`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('DEPRECATED')
    })

    it('approve fails when method already DEPRECATED', async () => {
      const m = await prisma.verMethod.create({
        data: { projectId: projectA, name: `Bad approve ${stamp}`, methodType: 'TEST', status: 'DEPRECATED' },
      })
      createdMethodIds.push(m.id)
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}/${m.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/transition/i)
    })

    it('approve cross-project returns 404 (IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/methods/${projectA}/${methodInB}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      const intact = await prisma.verMethod.findUnique({ where: { id: methodInB } })
      expect(intact?.status).toBe('DRAFT')
    })
  })
})
