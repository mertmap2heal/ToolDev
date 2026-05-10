/**
 * Requirement bulk-import HTTP layer (#Batch9).
 *
 * Covers the controller surface of POST /requirements/:projectId/bulk-import
 * that's separate from the atomicity-only test (requirement.bulkImport.atomicity.test.ts):
 *   - 401 without auth
 *   - 400 when neither create nor update arrays present
 *   - happy: create-only with valid rows
 *   - happy: update-only on an existing row
 *   - row-level validation surfaces in `errors[]` (skipped count)
 *   - audit events emitted (REQUIREMENTS_IMPORT_STARTED + COMPLETED)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement bulk-import controller', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let existingReqId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-bi-${stamp}@example.com`,
        password: 'hashed',
        name: 'BulkImport User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-bi-${stamp}`
    const project = await prisma.project.create({
      data: { name: `BulkImport Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const r = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Pre-existing',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `BI-${stamp}-EXISTING`,
      },
    })
    existingReqId = r.id
  })

  afterAll(async () => {
    const projectReqIds = (
      await prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      }).catch(() => [])
    ).map((x) => x.id)
    if (projectReqIds.length > 0) {
      await prisma.requirementVersion
        .deleteMany({ where: { requirementId: { in: projectReqIds } } })
        .catch(() => {})
    }
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: `req-bi-${stamp}` } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  it('POST /bulk-import returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .send({ create: [] })
    expect(res.status).toBe(401)
  })

  it('POST /bulk-import returns 400 when neither create nor update is present', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /bulk-import accepts an empty create array (no rows imported)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ create: [], update: [] })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBe(0)
    expect(res.body.data.updated).toBe(0)
    expect(res.body.data.skipped).toBe(0)
    expect(Array.isArray(res.body.data.errors)).toBe(true)
  })

  it('POST /bulk-import creates valid new rows (title+description required)', async () => {
    const newReqId = `BI-${stamp}-NEW1`
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        create: [
          {
            requirementId: newReqId,
            title: 'New imported requirement',
            description: 'Body text',
            priority: 'high',
            status: 'draft',
            stage: '',
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBeGreaterThanOrEqual(1)

    // Confirm row landed in DB
    const inDb = await prisma.requirement.findFirst({
      where: { projectId, requirementId: newReqId },
    })
    expect(inDb).not.toBeNull()
    expect(inDb?.title).toBe('New imported requirement')
  })

  it('POST /bulk-import updates an existing row (UpdateRowInput shape: { id, data })', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        update: [
          {
            id: existingReqId,
            data: {
              title: 'Updated title via bulk-import',
              description: 'updated desc',
            },
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.updated).toBeGreaterThanOrEqual(1)

    const inDb = await prisma.requirement.findUnique({ where: { id: existingReqId } })
    expect(inDb?.title).toBe('Updated title via bulk-import')
  })

  it('POST /bulk-import surfaces row errors as skipped + errors[]', async () => {
    // missing both title and description — fails validateCreateRow
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        create: [
          {
            requirementId: `BI-${stamp}-INVALID`,
            priority: 'medium',
            status: 'draft',
            stage: '',
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.skipped).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.data.errors)).toBe(true)
    expect(res.body.data.errors.length).toBeGreaterThanOrEqual(1)
  })

  it('POST /bulk-import emits audit events for the import', async () => {
    // make a benign call, then check the audit log
    await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ create: [], update: [] })

    const logs = await prisma.verAuditEvent.findMany({
      where: {
        projectId,
        action: { in: ['REQUIREMENTS_IMPORT_STARTED', 'REQUIREMENTS_IMPORT_COMPLETED'] },
      },
    })
    // at least one started event was created across all calls in this suite
    expect(logs.length).toBeGreaterThan(0)
  })
})
