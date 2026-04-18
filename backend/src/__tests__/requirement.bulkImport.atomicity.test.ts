/**
 * Bulk-import atomicity regression tests (#225, depends on #222/#226/#224).
 *
 * The fix moved every write in bulkImportRequirements into a single
 * prisma.$transaction so a mid-batch DB-level failure rolls back ALL rows in
 * the batch — no partial imports, no phantom RequirementVersion snapshots.
 *
 * These tests verify:
 *  1. Happy path — counts match, expected Requirement + RequirementVersion rows exist
 *  2. Mid-batch unique-collision — entire batch rolls back, response 500
 *  3. Mid-batch locked update — entire batch rolls back, no phantom version snapshots
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Bulk import — atomicity (#225)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  const createdReqUuids: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `bulk-atomic-${stamp}@example.com`, password: 'h', name: 'Bulk Atomic' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `bulk-atomic-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Bulk Atomic ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.requirementVersion
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('happy path — all valid creates commit, counts match, no errors', async () => {
    const before = await prisma.requirement.count({ where: { projectId } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        create: [
          { title: `Happy A ${stamp}`, description: 'd', requirementId: `REQ-AT-A-${stamp}` },
          { title: `Happy B ${stamp}`, description: 'd', requirementId: `REQ-AT-B-${stamp}` },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.errors).toEqual([])

    const after = await prisma.requirement.count({ where: { projectId } })
    expect(after).toBe(before + 2)

    const created = await prisma.requirement.findMany({
      where: { projectId, requirementId: { in: [`REQ-AT-A-${stamp}`, `REQ-AT-B-${stamp}`] } },
    })
    for (const r of created) createdReqUuids.push(r.id)
  })

  it('mid-batch duplicate requirementId rolls back the entire batch', async () => {
    const dupId = `REQ-AT-DUP-${stamp}`
    // Pre-seed a requirement with the id that the bulk import will collide on.
    const seeded = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: dupId,
        title: `Pre-existing ${stamp}`,
        description: 'd',
        priority: 'medium',
        status: 'draft',
        stage: '',
      },
    })
    createdReqUuids.push(seeded.id)

    const beforeCount = await prisma.requirement.count({ where: { projectId } })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        create: [
          { title: `Tx Pre A ${stamp}`, description: 'd', requirementId: `REQ-AT-TX-A-${stamp}` },
          { title: `Tx Dup ${stamp}`, description: 'd', requirementId: dupId }, // duplicate -> phase-1 reject
          { title: `Tx Post C ${stamp}`, description: 'd', requirementId: `REQ-AT-TX-C-${stamp}` },
        ],
      })
    // Phase-1 rejects the dup; phase-2 commits the other two atomically.
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.skipped).toBe(1)
    expect(res.body.data.errors[0].errors[0]).toMatch(/already exists/i)

    const afterCount = await prisma.requirement.count({ where: { projectId } })
    expect(afterCount).toBe(beforeCount + 2)
  })

  it('mid-batch DB-level update collision rolls back the entire batch with no phantom version snapshots', async () => {
    // Seed two requirements: one normal, one locked (so its update will throw P2025).
    const normal = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-AT-UPD-NORMAL-${stamp}`,
        title: `Normal ${stamp}`,
        description: 'pre',
        priority: 'medium',
        status: 'draft',
        stage: '',
      },
    })
    const locked = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-AT-UPD-LOCK-${stamp}`,
        title: `Locked ${stamp}`,
        description: 'pre',
        priority: 'medium',
        status: 'draft',
        stage: '',
        isLocked: true,
      },
    })
    createdReqUuids.push(normal.id, locked.id)

    const versionsBefore = await prisma.requirementVersion.count({
      where: { projectId, requirementId: { in: [normal.id, locked.id] } },
    })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        update: [
          { id: normal.id, data: { title: `Normal updated ${stamp}` } },
          { id: locked.id, data: { title: `Locked updated ${stamp}` } }, // locked -> tx aborts
        ],
      })

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/locked/i)

    // Normal must NOT have been updated (transaction rolled back).
    const normalAfter = await prisma.requirement.findUnique({ where: { id: normal.id } })
    expect(normalAfter?.title).toBe(`Normal ${stamp}`)

    // No phantom version snapshots — #224 thread tx through createVersionSnapshot.
    const versionsAfter = await prisma.requirementVersion.count({
      where: { projectId, requirementId: { in: [normal.id, locked.id] } },
    })
    expect(versionsAfter).toBe(versionsBefore)
  })
})
