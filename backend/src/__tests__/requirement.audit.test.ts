/**
 * Requirement audit endpoints (#Batch8).
 *
 * Covers:
 *   GET /requirements/:projectId/audit?entityType=&entityId=
 *   GET /requirements/:projectId/audit/project
 *
 * Asserts:
 *   - 401 without auth
 *   - 400 when entityType/entityId missing on /audit
 *   - returns events for the (entityType, entityId) pair
 *   - project-wide audit returns paginated items with `total`
 *   - category filter narrows by action prefix
 *   - actor filter resolves to userIds (zero matches => empty page)
 *   - search filter matches entityId/entityType/action substrings
 *   - invalid `from` date returns 400
 *   - link-payload audit rows enrich source/target with displayId
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement audit endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let requirementDbId: string
  let canonicalReqId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-audit-${stamp}@example.com`,
        password: 'hashed',
        name: 'Audit User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-audit-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Audit Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    canonicalReqId = `AUD-${stamp}-001`
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Audited requirement',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: canonicalReqId,
      },
    })
    requirementDbId = req.id

    // Seed several VerAuditEvent rows of differing actions
    await prisma.verAuditEvent.createMany({
      data: [
        {
          projectId,
          entityType: 'REQUIREMENT',
          entityId: requirementDbId,
          action: 'REQUIREMENT_CREATED',
          performedByUserId: userId,
          newValue: { title: 'Audited requirement' },
        },
        {
          projectId,
          entityType: 'REQUIREMENT',
          entityId: requirementDbId,
          action: 'REQUIREMENT_UPDATED',
          performedByUserId: userId,
          oldValue: { title: 'old' },
          newValue: { title: 'new' },
        },
        {
          projectId,
          entityType: 'REQUIREMENT',
          entityId: requirementDbId,
          action: 'REQUIREMENT_COMMENT_ADDED',
          performedByUserId: userId,
          newValue: { commentId: 'fake', preview: 'a comment' },
        },
        {
          projectId,
          entityType: 'TRACE_LINK',
          entityId: 'trace-fake-id',
          action: 'LINK_CREATED',
          performedByUserId: userId,
          newValue: {
            sourceType: 'requirement',
            sourceId: requirementDbId,
            targetType: 'requirement',
            targetId: requirementDbId,
            linkType: 'derives',
          },
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.verAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  // ---------- GET /audit ----------

  it('GET /audit returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/audit?entityType=REQUIREMENT&entityId=${requirementDbId}`
    )
    expect(res.status).toBe(401)
  })

  it('GET /audit without entityType/entityId returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/entityType/i)
  })

  it('GET /audit returns the seeded events for the requirement', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/audit?entityType=REQUIREMENT&entityId=${requirementDbId}`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    // 3 REQUIREMENT entityType events for the seeded requirement
    expect(res.body.data.length).toBe(3)
    expect(res.body.data[0].performedBy).toMatchObject({ id: userId })
  })

  // ---------- GET /audit/project ----------

  it('GET /audit/project returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/audit/project`
    )
    expect(res.status).toBe(401)
  })

  it('GET /audit/project returns paginated items + total', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit/project?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.total).toBeGreaterThanOrEqual(4)
    expect(res.body.data.page).toBe(1)
    expect(res.body.data.pageSize).toBe(2)
    expect(res.body.data.items.length).toBe(2)
  })

  it('GET /audit/project filtered by category=comments returns only comment actions', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/audit/project?categories=comments&page=1&pageSize=50`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const actions = res.body.data.items.map((i: any) => i.action)
    for (const a of actions) {
      expect(String(a).startsWith('REQUIREMENT_COMMENT_')).toBe(true)
    }
  })

  it('GET /audit/project filtered by category=links includes the LINK_CREATED event', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/audit/project?categories=links&page=1&pageSize=50`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const actions = res.body.data.items.map((i: any) => i.action)
    expect(actions).toContain('LINK_CREATED')
  })

  it('GET /audit/project enriches link-like payloads with displayId/label', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/audit/project?categories=links&page=1&pageSize=10`
      )
      .set('Authorization', `Bearer ${token}`)
    const link = res.body.data.items.find((i: any) => i.action === 'LINK_CREATED')
    expect(link).toBeDefined()
    // The newValue should be enriched
    expect(link.newValue.sourceDisplayId).toBeDefined()
    expect(link.newValue.targetDisplayId).toBeDefined()
  })

  it('GET /audit/project with invalid `from` returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit/project?from=not-a-date`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('GET /audit/project actor=unknown returns empty page', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit/project?actor=ZZZ-no-such-user`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(0)
    expect(res.body.data.items).toEqual([])
  })

  it('GET /audit/project search by entityType narrows results', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/audit/project?search=TRACE_LINK&page=1&pageSize=50`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // At least one event has entityType=TRACE_LINK
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
  })
})
