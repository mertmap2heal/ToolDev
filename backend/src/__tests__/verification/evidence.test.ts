/**
 * Verification — evidence integration tests (#240, sub-task of #133).
 *
 * Exercises the HTTP boundary for /api/v1/verification/evidence/:projectId:
 *   GET    /:projectId            — list scoped to the project
 *   POST   /:projectId            — create + audit log row
 *   GET    /:projectId/:id        — single, 404 across projects (IDOR)
 *   POST   /:projectId/:id/link   — link to a TEST_CASE
 *   POST   /:projectId/:id/unlink — remove the link row
 *   401 on every route without a Bearer token
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification evidence endpoints (#240)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let testCaseA: string
  let evidenceInB: string
  const createdEvidenceIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-ev-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver EV User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-ev-a-${stamp}`
    const slugB = `ver-ev-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver EV A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver EV B ${stamp}`, domain: slugB, slug: slugB, userId },
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
        key: `TC-EV-A-${stamp}`,
        title: 'EV Seed TC A',
        status: 'DRAFT',
        version: '1.0',
      },
    })
    testCaseA = tc.id

    const evB = await prisma.verEvidence.create({
      data: {
        projectId: projectB,
        evidenceType: 'TEST_REPORT',
        title: `IDOR Target Evidence ${stamp}`,
        storageRef: '/uploads/fake-b.pdf',
      },
    })
    evidenceInB = evB.id
    createdEvidenceIds.push(evidenceInB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verEvidenceLink
      .deleteMany({ where: { evidenceId: { in: createdEvidenceIds } } })
      .catch(() => {})
    await prisma.verEvidence
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

  describe('POST /api/v1/verification/evidence/:projectId', () => {
    it('creates an evidence row with createdByUserId set from the JWT', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          evidenceType: 'TEST_REPORT',
          title: `Created Evidence A ${stamp}`,
          storageRef: '/uploads/created-a.pdf',
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.projectId).toBe(projectA)
      expect(res.body.data.createdByUserId).toBe(userId)
      createdEvidenceIds.push(res.body.data.id)
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'incomplete' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/required/i)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}`)
        .send({ evidenceType: 'TEST_REPORT', title: 'no auth', storageRef: '/uploads/x.pdf' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/verification/evidence/:projectId', () => {
    it('returns only evidence for the requested project', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/evidence/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      for (const ev of res.body.data) {
        expect(ev.projectId).toBe(projectA)
      }
      const ids = res.body.data.map((ev: { id: string }) => ev.id)
      expect(ids).not.toContain(evidenceInB)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get(`/api/v1/verification/evidence/${projectA}`)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/verification/evidence/:projectId/:id', () => {
    it('returns the evidence by id', async () => {
      const ev = await prisma.verEvidence.create({
        data: {
          projectId: projectA,
          evidenceType: 'LOG',
          title: `Single Get Evidence ${stamp}`,
          storageRef: '/uploads/single.log',
        },
      })
      createdEvidenceIds.push(ev.id)
      const res = await request(app)
        .get(`/api/v1/verification/evidence/${projectA}/${ev.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(ev.id)
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/evidence/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 404 when evidence lives in another project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/evidence/${projectA}/${evidenceInB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:projectId/:id/link and /unlink', () => {
    it('links evidence to a TEST_CASE then unlinks it', async () => {
      const ev = await prisma.verEvidence.create({
        data: {
          projectId: projectA,
          evidenceType: 'TEST_REPORT',
          title: `Link Target ${stamp}`,
          storageRef: '/uploads/link.pdf',
        },
      })
      createdEvidenceIds.push(ev.id)

      const linkRes = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}/${ev.id}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          linkedEntityType: 'TEST_CASE',
          linkedEntityId: testCaseA,
          relation: 'PRIMARY',
        })
      expect(linkRes.status).toBe(200)
      expect(linkRes.body.success).toBe(true)

      const links = await prisma.verEvidenceLink.findMany({
        where: { evidenceId: ev.id, linkedEntityType: 'TEST_CASE', linkedEntityId: testCaseA },
      })
      expect(links.length).toBe(1)

      const unlinkRes = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}/${ev.id}/unlink`)
        .set('Authorization', `Bearer ${token}`)
        .send({ linkedEntityType: 'TEST_CASE', linkedEntityId: testCaseA })
      expect(unlinkRes.status).toBe(200)

      const remaining = await prisma.verEvidenceLink.count({
        where: { evidenceId: ev.id, linkedEntityType: 'TEST_CASE', linkedEntityId: testCaseA },
      })
      expect(remaining).toBe(0)
    })

    it('returns 404 when linking against an evidence id from another project (IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}/${evidenceInB}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          linkedEntityType: 'TEST_CASE',
          linkedEntityId: testCaseA,
          relation: 'PRIMARY',
        })
      expect(res.status).toBe(404)
      const leak = await prisma.verEvidenceLink.count({
        where: { evidenceId: evidenceInB, linkedEntityId: testCaseA },
      })
      expect(leak).toBe(0)
    })

    it('unlink without token returns 401', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/evidence/${projectA}/${evidenceInB}/unlink`)
        .send({ linkedEntityType: 'TEST_CASE', linkedEntityId: testCaseA })
      expect(res.status).toBe(401)
    })
  })
})
