/**
 * Tests for /api/v1/baselines/:projectId — requirements baselining.
 *
 * The router uses `projectIdParam` as a single chokepoint, so every
 * request gets the standard auth → resolve → access-check chain.
 * Coverage:
 *   - 401 without a token
 *   - 403 when a stranger hits a project that isn't theirs
 *   - 404 on unknown baseline ids (still scoped to caller's project)
 *   - happy paths: list (empty), create, get, lock, lock-conflict
 *   - delete blocked when locked, allowed when active
 *   - compare two baselines returns the LINKAGE_V1 shape
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirements baselines — /api/v1/baselines', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  let requirementId: string
  let activeBaselineId: string | null = null
  let secondBaselineId: string | null = null
  const otherCreatedBaselineIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `bl-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `bl-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `bl-a-${stamp}`
    const slugB = `bl-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `BL A ${stamp}`, domain: slugA, slug: slugA, userId: ownerId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `BL B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id

    const req = await prisma.requirement.create({
      data: {
        projectId: projectAId,
        title: `Baseline target ${stamp}`,
        description: 'For baseline tests',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    requirementId = req.id
  })

  afterAll(async () => {
    const allBaselineIds = [activeBaselineId, secondBaselineId, ...otherCreatedBaselineIds].filter(
      (v): v is string => Boolean(v),
    )
    await prisma.requirementVersion
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    if (allBaselineIds.length > 0) {
      await prisma.baselineItem.deleteMany({ where: { baselineId: { in: allBaselineIds } } }).catch(() => {})
      await prisma.baseline.deleteMany({ where: { id: { in: allBaselineIds } } }).catch(() => {})
    }
    await prisma.baseline
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.requirement
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/baselines/${projectAId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId by an outsider returns 403 (project-membership)', async () => {
    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:projectId on an empty project returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(0)
  })

  it('POST /:projectId without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no name' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /:projectId creates a baseline that snapshots the project requirements', async () => {
    const res = await request(app)
      .post(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Baseline ${stamp}`, description: 'first' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.itemCount).toBeGreaterThanOrEqual(1)
    activeBaselineId = res.body.data.id

    // Items table populated with at least the seeded requirement.
    const items = await prisma.baselineItem.findMany({ where: { baselineId: activeBaselineId! } })
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items.map((i) => i.requirementId)).toContain(requirementId)
  })

  it('GET /:projectId/:baselineId returns the baseline + items', async () => {
    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}/${activeBaselineId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(activeBaselineId)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /:projectId/:baselineId returns 404 for an unknown id', async () => {
    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('PUT /:projectId/:baselineId/lock locks an active baseline; second call rejects', async () => {
    const lockRes = await request(app)
      .put(`/api/v1/baselines/${projectAId}/${activeBaselineId}/lock`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(lockRes.status).toBe(200)
    expect(lockRes.body.data.status).toBe('locked')
    expect(lockRes.body.data.lockedAt).toBeDefined()

    const secondLock = await request(app)
      .put(`/api/v1/baselines/${projectAId}/${activeBaselineId}/lock`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(secondLock.status).toBe(400)
  })

  it('DELETE /:projectId/:baselineId on a locked baseline returns 400 and preserves the row', async () => {
    const res = await request(app)
      .delete(`/api/v1/baselines/${projectAId}/${activeBaselineId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
    const stillThere = await prisma.baseline.findUnique({ where: { id: activeBaselineId! } })
    expect(stillThere).not.toBeNull()
  })

  it('DELETE /:projectId/:baselineId on an active baseline removes it', async () => {
    // Create a fresh, unlocked baseline and delete it.
    const create = await request(app)
      .post(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Disposable ${stamp}` })
    expect(create.status).toBe(201)
    const id = create.body.data.id as string
    otherCreatedBaselineIds.push(id)

    const del = await request(app)
      .delete(`/api/v1/baselines/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(del.status).toBe(200)
    const gone = await prisma.baseline.findUnique({ where: { id } })
    expect(gone).toBeNull()
  })

  it('GET /:projectId/compare returns the diff payload for two baselines', async () => {
    // Create a second baseline so we can compare A vs B.
    const create = await request(app)
      .post(`/api/v1/baselines/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Baseline 2 ${stamp}` })
    expect(create.status).toBe(201)
    secondBaselineId = create.body.data.id

    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}/compare`)
      .query({ baselineAId: activeBaselineId!, baselineBId: secondBaselineId! })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.summary).toBeDefined()
    expect(res.body.data.summary.addedCount).toBeDefined()
    expect(res.body.data.summary.removedCount).toBeDefined()
    expect(res.body.data.summary.modifiedCount).toBeDefined()
  })

  it('GET /:projectId/compare without baselineAId+baselineBId returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/baselines/${projectAId}/compare`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })
})
