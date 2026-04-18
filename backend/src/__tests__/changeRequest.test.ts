/**
 * Change request CRUD integration tests (#121).
 *
 * Covers the CRUD + attachment endpoints not already exercised by the
 * existing specs:
 *   - changeRequest.key.test.ts (#162)     — CR-NNNN allocation
 *   - changeRequest.membership.test.ts (#118) — auth/403 gates
 *   - changeRequest.upload.test.ts (#119)  — MIME allowlist
 *
 * Focus here is happy-path response shape, validation 400s, cross-project
 * 404 isolation (IDOR regression), update field-level semantics, and the
 * attachment cascade on delete.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { app } from '../server'
import { prisma } from '../lib/prisma'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, '../../uploads/change-requests')

describe('Change request CRUD integration (#121)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let seedCrA: string
  let seedCrB: string
  const createdCrIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `cr-crud-${stamp}@example.com`,
        password: 'hashed',
        name: 'CR CRUD User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `cr-crud-a-${stamp}`
    const slugB = `cr-crud-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `CR CRUD A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `CR CRUD B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const crA = await prisma.changeRequest.create({
      data: {
        projectId: projectA,
        crId: `CR-A-${stamp}`,
        title: 'Seed CR A',
        description: 'Seeded in project A',
        sourceType: 'requirement',
        sourceId: 'seed-a',
        priority: 'medium',
        requestedBy: 'seed',
        createdBy: userId,
        updatedBy: userId,
      },
    })
    seedCrA = crA.id
    createdCrIds.push(seedCrA)

    const crB = await prisma.changeRequest.create({
      data: {
        projectId: projectB,
        crId: `CR-B-${stamp}`,
        title: 'Seed CR B',
        description: 'Seeded in project B',
        sourceType: 'requirement',
        sourceId: 'seed-b',
        priority: 'medium',
        requestedBy: 'seed',
        createdBy: userId,
        updatedBy: userId,
      },
    })
    seedCrB = crB.id
    createdCrIds.push(seedCrB)
  })

  afterAll(async () => {
    await prisma.changeRequestAttachment
      .deleteMany({ where: { projectId: { in: [projectA, projectB] } } })
      .catch(() => {})
    await prisma.changeRequest
      .deleteMany({ where: { projectId: { in: [projectA, projectB] } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: [projectA, projectB] } } })
      .catch(() => {})
    await prisma.project
      .deleteMany({ where: { id: { in: [projectA, projectB] } } })
      .catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /:projectId — createChangeRequest', () => {
    it('returns 201 with populated CR on valid payload', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'New CR',
          description: 'Created via test',
          sourceType: 'issue',
          sourceId: `issue-${stamp}`,
          priority: 'high',
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.projectId).toBe(projectA)
      expect(res.body.data.title).toBe('New CR')
      expect(res.body.data.priority).toBe('high')
      expect(res.body.data.crId).toMatch(/^CR-\d+$/)
      createdCrIds.push(res.body.data.id)
    })

    it('auto-populates requestedBy from the authenticated user when not provided', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Auto Req CR',
          description: 'Auto-populate test',
          sourceType: 'issue',
          sourceId: `issue-${stamp}`,
        })
      expect(res.status).toBe(201)
      expect(res.body.data.requestedBy).toBe('CR CRUD User')
      createdCrIds.push(res.body.data.id)
    })

    it('retains explicit requestedBy when supplied', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Explicit Req CR',
          description: 'Explicit requestedBy',
          sourceType: 'issue',
          sourceId: `issue-${stamp}`,
          requestedBy: 'External PM',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.requestedBy).toBe('External PM')
      createdCrIds.push(res.body.data.id)
    })

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'No title',
          sourceType: 'issue',
          sourceId: `issue-${stamp}`,
        })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 400 when description is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'No desc',
          sourceType: 'issue',
          sourceId: `issue-${stamp}`,
        })
      expect(res.status).toBe(400)
    })

    it('returns 400 when sourceType is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'X', description: 'Y', sourceId: `issue-${stamp}` })
      expect(res.status).toBe(400)
    })

    it('returns 400 when sourceId is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'X', description: 'Y', sourceType: 'issue' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when sourceType is not one of the allowed values', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Bad Source',
          description: 'Invalid sourceType',
          sourceType: 'document',
          sourceId: `issue-${stamp}`,
        })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/sourceType/i)
    })
  })

  describe('GET /:projectId — getChangeRequests', () => {
    it('returns only change requests for the requested project', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      for (const cr of res.body.data) {
        expect(cr.projectId).toBe(projectA)
      }
    })

    it('does not leak CRs from another project (cross-project isolation)', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      const ids = res.body.data.map((cr: { id: string }) => cr.id)
      expect(ids).not.toContain(seedCrB)
    })

    it('orders results by createdAt desc', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      const timestamps = res.body.data.map((cr: { createdAt: string }) =>
        new Date(cr.createdAt).getTime(),
      )
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i])
      }
    })
  })

  describe('GET /:projectId/:id — getChangeRequest', () => {
    it('returns the CR by id', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}/${seedCrA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(seedCrA)
      expect(res.body.data.projectId).toBe(projectA)
    })

    it('returns 404 for a non-existent CR id', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 404 for a CR that exists in a different project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}/${seedCrB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })

  describe('PUT /:projectId/:id — updateChangeRequest', () => {
    it('updates title and returns the updated record', async () => {
      const res = await request(app)
        .put(`/api/v1/change-requests/${projectA}/${seedCrA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Renamed Seed CR A' })
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('Renamed Seed CR A')
    })

    it('updates status independently of other fields', async () => {
      const res = await request(app)
        .put(`/api/v1/change-requests/${projectA}/${seedCrA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'in_review' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('in_review')
      expect(res.body.data.title).toBe('Renamed Seed CR A')
    })

    it('returns 404 for a non-existent CR', async () => {
      const res = await request(app)
        .put(`/api/v1/change-requests/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Ghost' })
      expect(res.status).toBe(404)
    })

    it('returns 404 for a CR in another project (IDOR)', async () => {
      const res = await request(app)
        .put(`/api/v1/change-requests/${projectA}/${seedCrB}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hijack via wrong project' })
      expect(res.status).toBe(404)
      const still = await prisma.changeRequest.findUnique({ where: { id: seedCrB } })
      expect(still?.title).toBe('Seed CR B')
    })
  })

  describe('DELETE /:projectId/:id — deleteChangeRequest', () => {
    it('returns 404 for a CR in another project (IDOR)', async () => {
      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectA}/${seedCrB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      const still = await prisma.changeRequest.findUnique({ where: { id: seedCrB } })
      expect(still).not.toBeNull()
    })

    it('returns 404 for a non-existent CR', async () => {
      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectA}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns 200 even when the on-disk file is already missing (#126 ordering)', async () => {
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: projectA,
          crId: `CR-DEL-NOFILE-${stamp}`,
          title: 'To delete (no file on disk)',
          description: 'Attachment row points at a path that was never written',
          sourceType: 'requirement',
          sourceId: 'seed-a',
          priority: 'medium',
          requestedBy: 'seed',
          createdBy: userId,
          updatedBy: userId,
        },
      })
      createdCrIds.push(cr.id)

      // Attachment row whose fileUrl has no matching file on disk.
      await prisma.changeRequestAttachment.create({
        data: {
          changeRequestId: cr.id,
          projectId: projectA,
          fileName: 'ghost.png',
          fileUrl: `/uploads/change-requests/ghost-${stamp}-does-not-exist.png`,
          fileSize: 1,
          mimeType: 'image/png',
        },
      })

      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectA}/${cr.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const gone = await prisma.changeRequest.findUnique({ where: { id: cr.id } })
      expect(gone).toBeNull()
    })

    it('removes the CR and cascades its attachments', async () => {
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: projectA,
          crId: `CR-DEL-${stamp}`,
          title: 'To delete',
          description: 'Has attachment',
          sourceType: 'requirement',
          sourceId: 'seed-a',
          priority: 'medium',
          requestedBy: 'seed',
          createdBy: userId,
          updatedBy: userId,
        },
      })
      createdCrIds.push(cr.id)

      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      const attachFileName = `e2e-cr-del-${stamp}.png`
      const attachPath = path.join(uploadsDir, attachFileName)
      fs.writeFileSync(attachPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      const att = await prisma.changeRequestAttachment.create({
        data: {
          changeRequestId: cr.id,
          projectId: projectA,
          fileName: 'test.png',
          fileUrl: `/uploads/change-requests/${attachFileName}`,
          fileSize: 4,
          mimeType: 'image/png',
        },
      })

      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectA}/${cr.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const gone = await prisma.changeRequest.findUnique({ where: { id: cr.id } })
      expect(gone).toBeNull()
      const attGone = await prisma.changeRequestAttachment.findUnique({ where: { id: att.id } })
      expect(attGone).toBeNull()
      expect(fs.existsSync(attachPath)).toBe(false)
    })
  })

  describe('GET /:projectId/:crId/attachments — getAttachments', () => {
    it('returns an empty array for a CR with no attachments', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}/${seedCrA}/attachments`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data).toHaveLength(0)
    })

    it('returns existing attachments ordered desc by createdAt', async () => {
      await prisma.changeRequestAttachment.create({
        data: {
          changeRequestId: seedCrA,
          projectId: projectA,
          fileName: 'older.png',
          fileUrl: '/uploads/change-requests/older-placeholder.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: new Date(Date.now() - 60_000),
        },
      })
      await prisma.changeRequestAttachment.create({
        data: {
          changeRequestId: seedCrA,
          projectId: projectA,
          fileName: 'newer.png',
          fileUrl: '/uploads/change-requests/newer-placeholder.png',
          fileSize: 1,
          mimeType: 'image/png',
        },
      })

      const res = await request(app)
        .get(`/api/v1/change-requests/${projectA}/${seedCrA}/attachments`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
      expect(res.body.data[0].fileName).toBe('newer.png')
    })
  })

  describe('DELETE /:projectId/:crId/attachments/:id — deleteAttachment', () => {
    it('returns 404 for a non-existent attachment', async () => {
      const res = await request(app)
        .delete(
          `/api/v1/change-requests/${projectA}/${seedCrA}/attachments/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('removes the attachment record and returns 200', async () => {
      const att = await prisma.changeRequestAttachment.create({
        data: {
          changeRequestId: seedCrA,
          projectId: projectA,
          fileName: 'delete-me.png',
          fileUrl: '/uploads/change-requests/delete-me-placeholder.png',
          fileSize: 1,
          mimeType: 'image/png',
        },
      })
      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectA}/${seedCrA}/attachments/${att.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const gone = await prisma.changeRequestAttachment.findUnique({ where: { id: att.id } })
      expect(gone).toBeNull()
    })
  })
})
