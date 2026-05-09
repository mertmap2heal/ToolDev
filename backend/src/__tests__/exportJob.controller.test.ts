/**
 * Tests for /api/v1/export-jobs/:projectId — background export-job
 * tracker for large requirement exports. The router uses
 * `projectIdParam` so the standard auth → resolve → access-check chain
 * runs first. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - happy path: list (empty → present), create, getOne, patch (status,
 *     progress), delete
 *   - clearCompleted removes done/failed rows
 *   - 404 on unknown id (still scoped to caller's project)
 *
 * Note: createPath also writes a linkageAuditService row; we let it run
 * since the backing tables exist in the test DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Export jobs — /api/v1/export-jobs', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  const createdJobIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `ejob-o-${stamp}@example.test`, password: 'x', name: 'EJobOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `ejob-x-${stamp}@example.test`, password: 'x', name: 'EJobOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `ejob-a-${stamp}`
    const slugB = `ejob-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `EJob A ${stamp}`, domain: slugA, slug: slugA, userId: ownerId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `EJob B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    if (createdJobIds.length > 0) {
      await prisma.exportJob
        .deleteMany({ where: { id: { in: createdJobIds } } })
        .catch(() => {})
    }
    await prisma.exportJob
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    // linkageAuditService writes through prisma.verAuditEvent.
    await prisma.verAuditEvent
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/export-jobs/${projectAId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/export-jobs/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:projectId returns 200 with array body', async () => {
    const res = await request(app)
      .get(`/api/v1/export-jobs/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId creates an export job and returns 201', async () => {
    const res = await request(app)
      .post(`/api/v1/export-jobs/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ format: 'pdf', totalCount: 100, label: `Job ${stamp}` })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.format).toBe('pdf')
    createdJobIds.push(res.body.data.id)
  })

  it('POST /:projectId normalises an unknown format to pdf', async () => {
    const res = await request(app)
      .post(`/api/v1/export-jobs/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ format: 'BOGUS', totalCount: 5 })
    expect(res.status).toBe(201)
    expect(res.body.data.format).toBe('pdf')
    createdJobIds.push(res.body.data.id)
  })

  it('GET /:projectId/:id returns the created job', async () => {
    const id = createdJobIds[0]
    expect(id).toBeDefined()
    const res = await request(app)
      .get(`/api/v1/export-jobs/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
  })

  it('GET /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/export-jobs/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /:projectId/:id updates progress and status', async () => {
    const id = createdJobIds[0]
    const res = await request(app)
      .patch(`/api/v1/export-jobs/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ status: 'done', progress: 100, doneCount: 100 })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('done')
    expect(res.body.data.progress).toBe(100)
  })

  it('PATCH /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/export-jobs/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ status: 'done' })
    expect(res.status).toBe(404)
  })

  it('DELETE /:projectId/completed/clear removes done/failed rows', async () => {
    const res = await request(app)
      .delete(`/api/v1/export-jobs/${projectAId}/completed/clear`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // The first job (status=done) should be gone now.
    const firstId = createdJobIds[0]
    const after = await prisma.exportJob.findUnique({ where: { id: firstId } })
    expect(after).toBeNull()
  })

  it('DELETE /:projectId/:id removes a job', async () => {
    // The second job (still pending) should still exist.
    const id = createdJobIds[1]
    const res = await request(app)
      .delete(`/api/v1/export-jobs/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const after = await prisma.exportJob.findUnique({ where: { id } })
    expect(after).toBeNull()
  })

  it('DELETE /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/export-jobs/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})
