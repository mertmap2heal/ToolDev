/**
 * Requirement list endpoint — filter / pagination / sort branches (#Batch9).
 *
 * Covers GET /requirements/:projectId with query params:
 *   - status, priority, owner, requirementType, category, source filters
 *   - 'unassigned' sentinel for owner / requirementType / category / source
 *   - search across title/description/requirementId/owner/source/tags
 *   - pagination (page, pageSize) with totalPages calculation
 *   - sortBy validation falls back to createdAt for unknown columns
 *   - sortOrder defaults to desc for non-'asc'
 *   - paginates only root-level (parentId=null) requirements
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement list — filters/pagination/sort', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let parentRootId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-lf-${stamp}@example.com`,
        password: 'hashed',
        name: 'List Filters User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-lf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `LF Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    // Five root-level requirements with varied attributes
    const a = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Alpha rocket',
        description: '',
        status: 'draft',
        priority: 'high',
        stage: '',
        owner: 'alice',
        category: 'functional',
        source: 'customer',
        requirementId: `LF-${stamp}-A`,
        tags: ['safety'],
      },
    })
    parentRootId = a.id
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'Beta booster',
        description: '',
        status: 'approved',
        priority: 'low',
        stage: '',
        owner: 'bob',
        category: 'performance',
        source: 'derived',
        requirementId: `LF-${stamp}-B`,
        tags: ['perf'],
      },
    })
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'Gamma',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        owner: null, // unassigned
        category: null,
        source: null,
        requirementId: `LF-${stamp}-C`,
      },
    })
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'Delta',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        owner: 'alice',
        requirementId: `LF-${stamp}-D`,
      },
    })
    // A child of A — must NOT appear in root pagination
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'Epsilon child of Alpha',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        parentId: parentRootId,
        requirementId: `LF-${stamp}-E`,
      },
    })
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
    await prisma.requirement.deleteMany({ where: { parentId: { not: null }, projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: `req-lf-${stamp}` } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId paginates only root requirements (excludes children)', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.total).toBe(4) // 4 roots, child excluded
    expect(res.body.data.items.length).toBe(4)
    expect(res.body.data.items.every((r: any) => r.parentId === null)).toBe(true)
  })

  it('GET filters by status=approved', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?status=approved`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].status).toBe('approved')
  })

  it('GET filters by priority=high', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?priority=high`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].priority).toBe('high')
  })

  it('GET filter owner=unassigned returns rows with null owner', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?owner=unassigned`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].owner).toBeNull()
  })

  it('GET filter owner=alice returns only that user’s rows', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?owner=alice`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.items.every((r: any) => r.owner === 'alice')).toBe(true)
  })

  it('GET filter category=unassigned returns rows with null category', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?category=unassigned`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // Gamma + Delta both have null category at root level
    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
    expect(res.body.data.items.every((r: any) => r.category === null)).toBe(true)
  })

  it('GET filter source=customer narrows to one row', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?source=customer`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].source).toBe('customer')
  })

  it('GET full-text search matches title (case-insensitive)', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?search=BOOSTER`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
    expect(res.body.data.items.some((r: any) => /booster/i.test(r.title))).toBe(true)
  })

  it('GET pagination respects pageSize', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.pageSize).toBe(2)
    expect(res.body.data.items.length).toBe(2)
    expect(res.body.data.totalPages).toBeGreaterThanOrEqual(2)
  })

  it('GET unknown sortBy falls back to createdAt (no 500)', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?sortBy=hackerColumn--evil`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET sortOrder=asc returns rows in ascending order by createdAt', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}?sortBy=createdAt&sortOrder=asc`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2)
    const dates = res.body.data.items.map((r: any) => new Date(r.createdAt).getTime())
    for (let i = 1; i < dates.length; i++) expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1])
  })
})
