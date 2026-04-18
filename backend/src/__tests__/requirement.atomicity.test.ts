import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Issue #23 — Transaction atomicity for requirement updates.
 *
 * The fix moved createVersionSnapshot() INSIDE the prisma.$transaction() block
 * so that a snapshot is only written if the requirement update itself commits.
 * Previously, the snapshot was written outside/before the transaction, leaving
 * orphaned version entries when the transaction was rolled back.
 *
 * These tests verify:
 *  1. A successful update creates exactly one snapshot capturing the PRE-update state.
 *  2. A rejected update (version conflict) leaves snapshot count unchanged.
 *  3. The snapshot content matches the requirement's state before the update.
 */
describe('Requirement Update — Transaction Atomicity (#23)', () => {
  let projectId: string
  let userId: string
  let token: string
  let reqDbId: string
  let initialTitle: string

  beforeAll(async () => {
    const ts = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `test-atomicity-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Atomicity Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const slug = `test-atomicity-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Atomicity Test Project ${ts}`,
        domain: slug,
        slug,
        description: 'Project for transaction atomicity tests',
        userId,
      },
    })
    projectId = project.id

    initialTitle = `REQ Atomicity ${ts}`
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: initialTitle,
        description: 'Used for atomicity testing',
        requirementId: 'REQ-ATOM-001',
        priority: 'High',
        status: 'Draft',
        stage: 'Analysis',
      })
    expect(res.status).toBe(201)
    reqDbId = res.body.data.id
  })

  afterAll(async () => {
    await prisma.requirementVersion.deleteMany({ where: { requirementId: reqDbId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('successful update creates exactly one new version snapshot', async () => {
    const beforeCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })

    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' })

    expect(res.status).toBe(200)

    const afterCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })
    expect(afterCount).toBe(beforeCount + 1)
  })

  it('version snapshot captures the PRE-update state (title before the change)', async () => {
    // Get the most recent snapshot — it should have the title from BEFORE the last update
    const snapshot = await prisma.requirementVersion.findFirst({
      where: { requirementId: reqDbId },
      orderBy: { version: 'desc' },
    })

    expect(snapshot).not.toBeNull()
    // The snapshot was taken before the update, so it should hold initialTitle
    expect(snapshot?.title).toBe(initialTitle)
  })

  it('rejected update (stale version) does NOT create a version snapshot', async () => {
    // Fetch the current version
    const getRes = await request(app)
      .get(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(getRes.status).toBe(200)
    const currentVersion = getRes.body.data.version

    const beforeCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })

    // Submit with stale version — controller returns 409 before reaching the transaction
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Be Rejected', version: currentVersion - 1 })

    expect(res.status).toBe(409)

    const afterCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })
    // No snapshot must be written for a rejected update
    expect(afterCount).toBe(beforeCount)
  })

  it('rejected update (locked requirement) does NOT create a version snapshot', async () => {
    // Lock the requirement directly to trigger the 423 app-level guard
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: true, lockedByUserId: userId, lockedAt: new Date() },
    })

    const beforeCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })

    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Be Blocked By Lock' })

    expect(res.status).toBe(423)

    const afterCount = await prisma.requirementVersion.count({
      where: { requirementId: reqDbId },
    })
    expect(afterCount).toBe(beforeCount)

    // Cleanup: unlock
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: false, lockedByUserId: null, lockedAt: null },
    })
  })
})
