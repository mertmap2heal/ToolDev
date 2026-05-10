/**
 * Requirement parent/children tree endpoints (#Batch8).
 *
 * Covers:
 *   GET   /requirements/:projectId/:requirementId/children
 *   PUT   /requirements/:projectId/:requirementId/parent
 *
 * Asserts:
 *   - 401 without auth
 *   - 404 for unknown requirement
 *   - children are returned ordered by requirementId asc
 *   - empty list when no children
 *   - parent assignment stores parentId
 *   - circular reference returns 400
 *   - parent reset to null
 *   - 400 when parent doesn't exist in the project
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement parent/children endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let parentDbId: string
  let childADbId: string
  let childBDbId: string
  let standalone: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-tree-${stamp}@example.com`,
        password: 'hashed',
        name: 'Tree User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-tree-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Tree Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const parent = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Parent Req',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TREE-${stamp}-PARENT`,
      },
    })
    parentDbId = parent.id

    const childA = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Child A',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TREE-${stamp}-CHILD-A`,
        parentId: parentDbId,
      },
    })
    childADbId = childA.id

    const childB = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Child B',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TREE-${stamp}-CHILD-B`,
        parentId: parentDbId,
      },
    })
    childBDbId = childB.id

    const standaloneReq = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Standalone',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TREE-${stamp}-STANDALONE`,
      },
    })
    standalone = standaloneReq.id
  })

  afterAll(async () => {
    // Wipe parentIds first to avoid FK violations during cleanup.
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

  it('GET children returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/${parentDbId}/children`
    )
    expect(res.status).toBe(401)
  })

  it('PUT parent returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${standalone}/parent`)
      .send({ newParentId: parentDbId })
    expect(res.status).toBe(401)
  })

  it('GET children returns 404 for unknown requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/children`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET children returns the two children for the parent, ordered by requirementId', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${parentDbId}/children`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(2)
    const ids = res.body.data.map((r: any) => r.id)
    expect(ids).toContain(childADbId)
    expect(ids).toContain(childBDbId)
    // Sorted ascending by requirementId
    const reqIds = res.body.data.map((r: any) => r.requirementId)
    const sorted = [...reqIds].sort()
    expect(reqIds).toEqual(sorted)
  })

  it('GET children returns empty array for a leaf requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${childADbId}/children`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('PUT parent assigns parentId for a previously-standalone requirement', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${standalone}/parent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: parentDbId })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parentId).toBe(parentDbId)
    // Reset for subsequent tests
    await prisma.requirement.update({
      where: { id: standalone },
      data: { parentId: null },
    })
  })

  it('PUT parent rejects circular reference (parent -> self ancestor) with 400', async () => {
    // Try to set parent to a child of the parent (would create a cycle)
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${parentDbId}/parent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: childADbId })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/circular/i)
  })

  it('PUT parent with null clears the parentId', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${childADbId}/parent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: null })
    expect(res.status).toBe(200)
    expect(res.body.data.parentId).toBeNull()
    // Restore
    await prisma.requirement.update({
      where: { id: childADbId },
      data: { parentId: parentDbId },
    })
  })

  it('PUT parent with non-existent parent returns 400', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${standalone}/parent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(400)
  })

  it('PUT parent returns 404 when target requirement is unknown', async () => {
    const res = await request(app)
      .put(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/parent`
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: parentDbId })
    expect(res.status).toBe(404)
  })
})
