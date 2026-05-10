/**
 * Requirement bulk-update + component-assignment endpoints (#Batch8).
 *
 * Covers:
 *   POST  /requirements/:projectId/bulk-update
 *   PATCH /requirements/:projectId/:requirementId/component
 *
 * Asserts:
 *   - 401 without auth
 *   - empty requirementIds returns 400
 *   - empty updates returns 400
 *   - allowed fields (status, priority, owner, category, tags) update
 *   - locked rows are silently skipped (skippedDueToLock count)
 *   - component assignment 404 for unknown requirement
 *   - component assignment 400 for unknown componentId
 *   - component assignment success (componentId set, allocated_to TraceLink created)
 *   - component assignment with null clears the link
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement bulkUpdate + component endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let unlockedReqId: string
  let lockedReqId: string
  let componentId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-bu-${stamp}@example.com`,
        password: 'hashed',
        name: 'Bulk User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-bu-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Bulk Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const a = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Open',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `BU-${stamp}-OPEN`,
        tags: ['old'],
      },
    })
    unlockedReqId = a.id

    const otherUserForLock = await prisma.user.create({
      data: {
        email: `req-bu-locker-${stamp}@example.com`,
        password: 'hashed',
        name: 'Locker',
      },
    })

    const b = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Locked',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `BU-${stamp}-LOCKED`,
        isLocked: true,
        lockedByUserId: otherUserForLock.id,
      },
    })
    lockedReqId = b.id

    const component = await prisma.component.create({
      data: {
        projectId,
        name: 'Test Component',
      },
    })
    componentId = component.id
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    const projectReqIds = (
      await prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
      }).catch(() => [])
    ).map((r) => r.id)
    if (projectReqIds.length > 0) {
      await prisma.requirementVersion
        .deleteMany({ where: { requirementId: { in: projectReqIds } } })
        .catch(() => {})
    }
    await prisma.requirement.updateMany({
      where: { projectId },
      data: { isLocked: false, lockedByUserId: null },
    }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.component.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: `req-bu-` } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  // -------- POST /bulk-update --------

  it('POST /bulk-update returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .send({ requirementIds: [unlockedReqId], updates: { status: 'review' } })
    expect(res.status).toBe(401)
  })

  it('POST /bulk-update with empty requirementIds returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requirementIds: [], updates: { status: 'review' } })
    expect(res.status).toBe(400)
  })

  it('POST /bulk-update with no updates returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requirementIds: [unlockedReqId], updates: {} })
    expect(res.status).toBe(400)
  })

  it('POST /bulk-update updates status and tags on the unlocked req', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirementIds: [unlockedReqId],
        updates: { status: 'review', tags: ['new'] },
      })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    const reloaded = await prisma.requirement.findUnique({ where: { id: unlockedReqId } })
    expect(reloaded?.status).toBe('review')
    expect(reloaded?.tags).toEqual(['new'])
  })

  it('POST /bulk-update silently skips locked requirements (count + skippedDueToLock)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirementIds: [unlockedReqId, lockedReqId],
        updates: { priority: 'high' },
      })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.skippedDueToLock).toBe(1)
    const lockedAfter = await prisma.requirement.findUnique({ where: { id: lockedReqId } })
    expect(lockedAfter?.priority).toBe('medium') // unchanged
  })

  // -------- PATCH /:requirementId/component --------

  it('PATCH /component returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/api/v1/requirements/${projectId}/${unlockedReqId}/component`)
      .send({ componentId })
    expect(res.status).toBe(401)
  })

  it('PATCH /component returns 404 for unknown requirement', async () => {
    const res = await request(app)
      .patch(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/component`
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ componentId })
    expect(res.status).toBe(404)
  })

  it('PATCH /component returns 400 for unknown component', async () => {
    const res = await request(app)
      .patch(`/api/v1/requirements/${projectId}/${unlockedReqId}/component`)
      .set('Authorization', `Bearer ${token}`)
      .send({ componentId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/component/i)
  })

  it('PATCH /component sets the componentId and creates allocated_to TraceLink', async () => {
    const res = await request(app)
      .patch(`/api/v1/requirements/${projectId}/${unlockedReqId}/component`)
      .set('Authorization', `Bearer ${token}`)
      .send({ componentId })
    expect(res.status).toBe(200)
    expect(res.body.data.componentId).toBe(componentId)

    const links = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'requirement',
        sourceId: unlockedReqId,
        targetType: 'pbs_component',
        linkType: 'allocated_to',
      },
    })
    expect(links.length).toBe(1)
    expect(links[0].targetId).toBe(componentId)
  })

  it('PATCH /component with null clears componentId and removes the trace link', async () => {
    const res = await request(app)
      .patch(`/api/v1/requirements/${projectId}/${unlockedReqId}/component`)
      .set('Authorization', `Bearer ${token}`)
      .send({ componentId: null })
    expect(res.status).toBe(200)
    expect(res.body.data.componentId).toBeNull()

    const links = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'requirement',
        sourceId: unlockedReqId,
        targetType: 'pbs_component',
        linkType: 'allocated_to',
      },
    })
    expect(links.length).toBe(0)
  })
})
