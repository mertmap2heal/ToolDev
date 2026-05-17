import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Requirement Pessimistic Locking (#34)', () => {
  let projectId: string
  let userId: string
  let token: string
  let otherUserId: string
  let otherToken: string
  let reqDbId: string
  let req2DbId: string

  beforeAll(async () => {
    const ts = Date.now()

    // Primary user (locks the requirement)
    const user = await prisma.user.create({
      data: {
        email: `test-lock-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Lock Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    // Second user (tests access-control of lock/unlock)
    const other = await prisma.user.create({
      data: {
        email: `test-lock-other-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Lock Test Other',
      },
    })
    otherUserId = other.id
    otherToken = jwt.sign({ userId: otherUserId }, process.env.JWT_SECRET || 'secret')

    const slug = `test-lock-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Lock Test Project ${ts}`,
        domain: slug,
        slug,
        description: 'Project for lock tests',
        userId,
      },
    })
    projectId = project.id

    // Both users must be project members so membership middleware lets them
    // reach lock-conflict / authorship checks (added by #90, #152-154).
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId, role: 'owner' },
        { projectId, userId: otherUserId, role: 'member' },
      ],
    })

    // Requirement 1 — used for lock/unlock/block tests
    const res1 = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Lockable Requirement',
        description: 'Used for lock testing',
        requirementId: `REQ-LOCK-001`,
        priority: 'High',
        status: 'Draft',
        stage: 'Analysis',
      })
    expect(res1.status).toBe(201)
    reqDbId = res1.body.data.id

    // Requirement 2 — used for bulk update test
    const res2 = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Bulk Update Target',
        description: 'Used for bulk update lock test',
        requirementId: `REQ-LOCK-002`,
        priority: 'Medium',
        status: 'Draft',
        stage: 'Analysis',
      })
    expect(res2.status).toBe(201)
    req2DbId = res2.body.data.id
  })

  afterAll(async () => {
    // NX-4 (#447): bulk-update now writes per-row AuditLog rows — clear them
    // before deleting the project or the FK constraint blocks the delete.
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
    await prisma.$disconnect()
  })

  // --- Lock / unlock endpoints ---

  it('POST /lock returns 200 and sets isLocked=true', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${reqDbId}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.isLocked).toBe(true)
    expect(res.body.data.lockedByUserId).toBe(userId)
  })

  it('POST /lock is idempotent when same user re-locks', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${reqDbId}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /lock returns 409 when another user tries to lock an already-locked requirement', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${reqDbId}/lock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send()

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.lockedByUserId).toBe(userId)
  })

  // --- Update blocked when locked ---

  it('PUT (update) returns 423 when requirement is locked', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Be Blocked' })

    expect(res.status).toBe(423)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/locked/i)
  })

  it('DELETE (soft delete) returns 423 when requirement is locked', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Should be blocked' })

    expect(res.status).toBe(423)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/locked/i)
  })

  it('PUT /parent returns 423 when requirement is locked', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}/parent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: null })

    expect(res.status).toBe(423)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/locked/i)
  })

  it('PATCH /component returns 423 when requirement is locked', async () => {
    const res = await request(app)
      .patch(`/api/v1/requirements/${projectId}/${reqDbId}/component`)
      .set('Authorization', `Bearer ${token}`)
      .send({ componentId: null })

    expect(res.status).toBe(423)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/locked/i)
  })

  // --- Different user unlock is blocked ---

  it('POST /unlock returns 403 when a different user tries to unlock', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${reqDbId}/unlock`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send()

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/only the user who locked/i)
  })

  // --- Unlock and verify operations succeed ---

  it('POST /unlock returns 200 and sets isLocked=false', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${reqDbId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.isLocked).toBe(false)
    expect(res.body.data.lockedByUserId).toBeNull()
  })

  it('PUT (update) succeeds after unlock', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated After Unlock' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.title).toBe('Updated After Unlock')
  })

  // --- bulkUpdateRequirements: locked records are skipped and counted ---

  it('POST /bulk-update reports skippedDueToLock when some requirements are locked', async () => {
    // Lock req1 before the bulk update
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: true, lockedByUserId: userId, lockedAt: new Date() },
    })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirementIds: [reqDbId, req2DbId],
        updates: { priority: 'Low' },
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // req1 is locked → skipped; req2 is unlocked → updated
    expect(res.body.count).toBe(1)
    expect(res.body.skippedDueToLock).toBe(1)

    // Verify locked req was NOT changed
    const locked = await prisma.requirement.findUnique({ where: { id: reqDbId }, select: { priority: true } })
    expect(locked?.priority).not.toBe('Low')

    // Cleanup: unlock req1 for subsequent tests
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: false, lockedByUserId: null, lockedAt: null },
    })
  })

  // --- DB-level guard: race-condition defence ---
  // Verifies that Prisma's where: { isLocked: false } rejects a locked record with P2025.
  // This is the underlying mechanism the controller relies on for race-condition protection.

  it('DB-level guard: Prisma throws P2025 when updating a locked record via isLocked:false filter', async () => {
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: true, lockedByUserId: userId, lockedAt: new Date() },
    })

    let threw = false
    try {
      await prisma.requirement.update({
        where: { id: reqDbId, isLocked: false },
        data: { title: 'Race Condition Attempt' },
      })
    } catch (err: any) {
      threw = true
      expect(err.code).toBe('P2025')
    }
    expect(threw).toBe(true)

    // Cleanup
    await prisma.requirement.update({
      where: { id: reqDbId },
      data: { isLocked: false, lockedByUserId: null, lockedAt: null },
    })
  })
})
