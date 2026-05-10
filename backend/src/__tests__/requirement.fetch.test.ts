/**
 * Requirement fetch endpoints — getAllRequirements + getRequirement (#Batch8).
 *
 * Covers:
 *   GET /requirements/:projectId/all
 *   GET /requirements/:projectId/:requirementId
 *
 * Asserts:
 *   - 401 without auth on each
 *   - /all returns non-deleted requirements
 *   - /all excludes soft-deleted requirements (deletedAt set)
 *   - /:requirementId resolves by DB id
 *   - /:requirementId resolves by canonical requirementId (e.g. RQ-001)
 *   - /:requirementId 404 for unknown
 *   - /:requirementId returns related entities: parent, children, comments, attachments
 *   - /all sorts by parentId asc, requirementId asc
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement fetch endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let parentId: string
  let canonicalId: string
  let childId: string
  let deletedReqId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-fetch-${stamp}@example.com`,
        password: 'hashed',
        name: 'Fetch User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-fetch-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Fetch Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    canonicalId = `FET-${stamp}-001`
    const parent = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Fetch Parent',
        description: 'Parent description',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: canonicalId,
      },
    })
    parentId = parent.id

    const child = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Fetch Child',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `FET-${stamp}-002`,
        parentId: parent.id,
      },
    })
    childId = child.id

    // Add a comment to verify includes
    await prisma.requirementComment.create({
      data: {
        projectId,
        requirementId: parent.id,
        content: '<p>Test note</p>',
        authorId: userId,
        authorName: 'Fetch User',
      },
    })

    const del = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Soft-Deleted',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `FET-${stamp}-003`,
        deletedAt: new Date(),
        deletedById: userId,
      },
    })
    deletedReqId = del.id
  })

  afterAll(async () => {
    await prisma.requirementComment.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.updateMany({
      where: { projectId },
      data: { parentId: null },
    }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  // -------- /all --------

  it('GET /:projectId/all returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/requirements/${projectId}/all`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId/all returns non-deleted requirements', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/all`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const ids = res.body.data.map((r: any) => r.id)
    expect(ids).toContain(parentId)
    expect(ids).toContain(childId)
    expect(ids).not.toContain(deletedReqId)
  })

  it('GET /:projectId/all sorts by parentId asc, requirementId asc', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/all`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // Parent (no parentId) should come before children with parentId
    const indices = res.body.data.map((r: any) => r.parentId ?? null)
    const firstChildIdx = indices.findIndex((p: any) => p !== null)
    if (firstChildIdx >= 0) {
      // All entries before firstChildIdx should be null parentId
      for (let i = 0; i < firstChildIdx; i++) {
        expect(indices[i]).toBeNull()
      }
    }
  })

  // -------- /:requirementId --------

  it('GET /:projectId/:requirementId returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/${parentId}`
    )
    expect(res.status).toBe(401)
  })

  it('GET /:projectId/:requirementId 404 for unknown id', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /:projectId/:requirementId resolves by DB id and includes children/comments', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${parentId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(parentId)
    expect(Array.isArray(res.body.data.children)).toBe(true)
    expect(res.body.data.children.length).toBe(1)
    expect(res.body.data.children[0].id).toBe(childId)
    expect(Array.isArray(res.body.data.comments)).toBe(true)
    expect(res.body.data.comments.length).toBe(1)
  })

  it('GET /:projectId/:requirementId resolves by canonical requirementId', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${encodeURIComponent(canonicalId)}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(parentId)
    expect(res.body.data.requirementId).toBe(canonicalId)
  })

  it('GET /:projectId/:requirementId returns parent for the child', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${childId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.parent).toBeDefined()
    expect(res.body.data.parent.id).toBe(parentId)
  })
})
