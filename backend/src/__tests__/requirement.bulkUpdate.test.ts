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
    // NX-4 (#447): bulk-update now writes per-row AuditLog rows — clear them
    // first or the project FK delete is blocked.
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
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

/**
 * NX-4 (#447) — the hardened `/bulk-update` convention.
 *
 * Covers the REQ-M3 acceptance criteria the pre-NX-4 endpoint failed:
 *   - N requirements update atomically; one batch
 *   - N AuditLog rows share one `batchId` in `detailsJson`
 *   - a locked row -> skippedDueToLock
 *   - a stale optimisticVersion -> skippedDueToConflict
 *   - transaction rollback on a forced failure (zero rows changed)
 *   - 401 without auth
 *   - a non-whitelisted `updates` key is silently dropped
 *   - privileged-field (lifecycleId/statusId) RBAC: non-owner -> 403, nothing written
 *   - the standard `{ success, data: { batchId, updated, skippedDueToLock, skippedDueToConflict } }` shape
 *   - the 500-row batch cap
 */
describe('Requirement bulk-update — NX-4 hardened convention (#447)', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'
  let ownerId: string
  let ownerToken: string
  let memberId: string
  let memberToken: string
  let projectId: string
  let reqIds: string[] = []
  let lockedReqId: string

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { email: `nx4-bu-owner-${stamp}@example.com`, password: 'hashed', name: 'NX4 Owner' },
    })
    ownerId = owner.id
    ownerToken = jwt.sign({ userId: ownerId }, secret)

    const member = await prisma.user.create({
      data: { email: `nx4-bu-member-${stamp}@example.com`, password: 'hashed', name: 'NX4 Member' },
    })
    memberId = member.id
    memberToken = jwt.sign({ userId: memberId }, secret)

    const slug = `nx4-bu-${stamp}`
    const project = await prisma.project.create({
      data: { name: `NX4 Bulk Project ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: ownerId, role: 'owner', status: 'accepted' },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member', status: 'accepted' },
    })

    // 6 unlocked requirements + 1 locked one.
    for (let i = 0; i < 6; i++) {
      const r = await prisma.requirement.create({
        data: {
          projectId,
          title: `NX4 Req ${i}`,
          description: '',
          status: 'draft',
          priority: 'medium',
          stage: '',
          requirementId: `NX4-${stamp}-${i}`,
        },
      })
      reqIds.push(r.id)
    }
    const locker = await prisma.user.create({
      data: { email: `nx4-bu-locker-${stamp}@example.com`, password: 'hashed', name: 'NX4 Locker' },
    })
    const locked = await prisma.requirement.create({
      data: {
        projectId,
        title: 'NX4 Locked',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `NX4-${stamp}-LOCKED`,
        isLocked: true,
        lockedByUserId: locker.id,
      },
    })
    lockedReqId = locked.id
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    const ids = (
      await prisma.requirement
        .findMany({ where: { projectId }, select: { id: true } })
        .catch(() => [])
    ).map((r) => r.id)
    if (ids.length > 0) {
      await prisma.requirementVersion
        .deleteMany({ where: { requirementId: { in: ids } } })
        .catch(() => {})
    }
    await prisma.requirement
      .updateMany({ where: { projectId }, data: { isLocked: false, lockedByUserId: null } })
      .catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { email: { contains: `nx4-bu-` } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .send({ requirementIds: reqIds, updates: { priority: 'high' } })
    expect(res.status).toBe(401)
  })

  it('updates N requirements atomically and returns the standard data shape', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: reqIds, updates: { priority: 'high', category: 'safety' } })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.updated).toBe(6)
    expect(res.body.data.skippedDueToLock).toBe(0)
    expect(res.body.data.skippedDueToConflict).toBe(0)
    expect(typeof res.body.data.batchId).toBe('string')
    expect(res.body.data.batchId.length).toBeGreaterThan(0)

    const reloaded = await prisma.requirement.findMany({ where: { id: { in: reqIds } } })
    expect(reloaded.every((r) => r.priority === 'high')).toBe(true)
    expect(reloaded.every((r) => r.category === 'safety')).toBe(true)
  })

  it('writes one AuditLog row per touched requirement, all sharing one batchId', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: reqIds, updates: { source: 'audit-batch-check' } })
    expect(res.status).toBe(200)
    const batchId = res.body.data.batchId as string

    const auditRows = await prisma.auditLog.findMany({
      where: { projectId, action: 'requirements:bulk-update' },
    })
    const forBatch = auditRows.filter(
      (row) =>
        row.detailsJson != null &&
        typeof row.detailsJson === 'object' &&
        (row.detailsJson as Record<string, unknown>).batchId === batchId,
    )
    expect(forBatch.length).toBe(6)
    // every row shares the one batchId and names its own entity
    const entityIds = new Set(
      forBatch.map((r) => (r.detailsJson as Record<string, unknown>).entityId),
    )
    expect(entityIds.size).toBe(6)
  })

  it('silently drops a non-whitelisted field but applies the whitelisted ones', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[0]],
        // `title` is NOT in BULK_EDITABLE_FIELDS — dropped, not a 400.
        updates: { title: 'HACKED', priority: 'low' },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(1)
    const reloaded = await prisma.requirement.findUnique({ where: { id: reqIds[0] } })
    expect(reloaded?.priority).toBe('low')
    expect(reloaded?.title).not.toBe('HACKED') // whitelist held
  })

  it('rejects a request whose only fields are non-whitelisted (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: [reqIds[0]], updates: { title: 'x', description: 'y' } })
    expect(res.status).toBe(400)
  })

  it('skips a locked requirement (skippedDueToLock)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: [reqIds[1], lockedReqId], updates: { stage: 'design' } })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(1)
    expect(res.body.data.skippedDueToLock).toBe(1)
    const lockedAfter = await prisma.requirement.findUnique({ where: { id: lockedReqId } })
    expect(lockedAfter?.stage).not.toBe('design')
  })

  it('skips a row whose optimisticVersion is stale (skippedDueToConflict)', async () => {
    const fresh = await prisma.requirement.findUnique({ where: { id: reqIds[2] } })
    const staleVersion = (fresh?.version ?? 0) - 1
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[2]],
        updates: { source: 'conflict-check' },
        optimisticVersions: { [reqIds[2]]: staleVersion },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(0)
    expect(res.body.data.skippedDueToConflict).toBe(1)
    const after = await prisma.requirement.findUnique({ where: { id: reqIds[2] } })
    expect(after?.source).not.toBe('conflict-check')
  })

  it('accepts a row whose optimisticVersion matches', async () => {
    const fresh = await prisma.requirement.findUnique({ where: { id: reqIds[3] } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[3]],
        updates: { source: 'match-check' },
        optimisticVersions: { [reqIds[3]]: fresh?.version ?? 0 },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(1)
    expect(res.body.data.skippedDueToConflict).toBe(0)
    const after = await prisma.requirement.findUnique({ where: { id: reqIds[3] } })
    expect(after?.source).toBe('match-check')
    // version bumped on the accepted update
    expect((after?.version ?? 0)).toBe((fresh?.version ?? 0) + 1)
  })

  it('rejects a privileged-field bulk edit by a non-owner member (403, nothing written)', async () => {
    const before = await prisma.requirement.findUnique({ where: { id: reqIds[4] } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requirementIds: [reqIds[4]], updates: { statusId: 'some-status-id' } })
    expect(res.status).toBe(403)
    const after = await prisma.requirement.findUnique({ where: { id: reqIds[4] } })
    expect(after?.statusId).toBe(before?.statusId) // unchanged — nothing written
  })

  it('rolls the whole batch back when an update inside the transaction fails', async () => {
    // Force a mid-batch failure: a value that violates a column constraint.
    // `category` is a String column — pass a non-string so Prisma throws.
    const before = await prisma.requirement.findMany({
      where: { id: { in: [reqIds[0], reqIds[1]] } },
    })
    // F-5 (#447): capture the audit-row count BEFORE the failing request so
    // the post-failure assertion is real — the failed batch must write ZERO
    // AuditLog rows (the `applyBulkAudit` writes run inside the same
    // $transaction and roll back with the update).
    const auditCountBefore = await prisma.auditLog.count({
      where: { projectId, action: 'requirements:bulk-update' },
    })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[0], reqIds[1]],
        // an object is not assignable to the String `category` column —
        // Prisma rejects the update, the $transaction rolls back.
        updates: { category: { not: 'a string' } },
      })
    expect(res.status).toBe(500)
    // zero rows changed — the transaction rolled back atomically
    const after = await prisma.requirement.findMany({
      where: { id: { in: [reqIds[0], reqIds[1]] } },
    })
    const beforeById = new Map(before.map((r) => [r.id, r]))
    for (const row of after) {
      expect(row.category).toBe(beforeById.get(row.id)?.category ?? null)
      expect(row.version).toBe(beforeById.get(row.id)?.version)
    }
    // The failed batch wrote ZERO audit rows — the count is unchanged from
    // before the request. (A vacuous `typeof === 'number'` check could never
    // fail; this asserts the actual rollback of the audit writes.)
    const auditCountAfter = await prisma.auditLog.count({
      where: { projectId, action: 'requirements:bulk-update' },
    })
    expect(auditCountAfter).toBe(auditCountBefore)
  })

  it('rejects a batch larger than the 500-row cap (400)', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => `id-${i}`)
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: tooMany, updates: { priority: 'high' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/batch too large/i)
  })

  // F-7 (#447) — optimisticVersions runtime shape guard.
  it('rejects a malformed optimisticVersions (array) with 400, nothing written', async () => {
    const before = await prisma.requirement.findUnique({ where: { id: reqIds[5] } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[5]],
        updates: { source: 'guard-check' },
        optimisticVersions: [1, 2, 3], // an array is not an id->number map
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/optimisticversions/i)
    const after = await prisma.requirement.findUnique({ where: { id: reqIds[5] } })
    expect(after?.source).toBe(before?.source ?? null) // nothing written
  })

  it('rejects a malformed optimisticVersions (string) with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[5]],
        updates: { source: 'guard-check-2' },
        optimisticVersions: 'not-an-object',
      })
    expect(res.status).toBe(400)
  })

  it('ignores a non-numeric per-id optimisticVersion value (treated as no conflict check)', async () => {
    const fresh = await prisma.requirement.findUnique({ where: { id: reqIds[5] } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requirementIds: [reqIds[5]],
        updates: { source: 'non-numeric-version' },
        // a non-numeric value for this id is dropped — the row simply gets no
        // conflict check, so the update still applies.
        optimisticVersions: { [reqIds[5]]: 'oops' as unknown as number },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(1)
    const after = await prisma.requirement.findUnique({ where: { id: reqIds[5] } })
    expect(after?.source).toBe('non-numeric-version')
    expect(fresh).toBeDefined()
  })

  // F-8 (#447) — the privileged-field 403 writes a denial AuditLog row.
  it('writes a requirements:bulk-update-denied AuditLog row on the privileged-field 403', async () => {
    const deniedBefore = await prisma.auditLog.count({
      where: { projectId, action: 'requirements:bulk-update-denied' },
    })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requirementIds: [reqIds[0]], updates: { lifecycleId: 'some-lifecycle-id' } })
    expect(res.status).toBe(403)

    // Exactly one new denial row was written.
    const deniedRows = await prisma.auditLog.findMany({
      where: { projectId, action: 'requirements:bulk-update-denied' },
      orderBy: { createdAt: 'desc' },
    })
    expect(deniedRows.length).toBe(deniedBefore + 1)

    // The row for THIS request — found by its privilegedFields content, not
    // by array position (findMany row order is not insertion order).
    const lifecycleDenial = deniedRows.find((row) => {
      const detail = row.detailsJson as Record<string, unknown> | null
      const fields = detail?.privilegedFields
      return Array.isArray(fields) && fields.includes('lifecycleId')
    })
    expect(lifecycleDenial).toBeDefined()
    expect(lifecycleDenial?.userId).toBe(memberId)
    const detail = lifecycleDenial?.detailsJson as Record<string, unknown> | null
    expect(detail?.reason).toBe('privileged-field-without-owner-or-admin')
    expect(detail?.requirementCount).toBe(1)
  })

  // F-2 (#447) — write-path parity: a bulk statusId change sets
  // statusChangedAt / statusChangedBy, exactly as the single-row path does.
  it('sets statusChangedAt/statusChangedBy on a bulk statusId change (single-row parity)', async () => {
    const target = reqIds[5]
    const before = await prisma.requirement.findUnique({ where: { id: target } })
    expect(before?.statusId ?? null).toBeNull()
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: [target], updates: { statusId: 'nx4-status-x' } })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBe(1)
    const after = await prisma.requirement.findUnique({ where: { id: target } })
    expect(after?.statusId).toBe('nx4-status-x')
    // the status-change provenance fields were stamped — parity with updateRequirement
    expect(after?.statusChangedAt).not.toBeNull()
    expect(after?.statusChangedBy).toBe(ownerId)
  })

  it('does not stamp statusChangedAt on a bulk edit that does not touch statusId', async () => {
    const target = reqIds[4]
    const before = await prisma.requirement.findUnique({ where: { id: target } })
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/bulk-update`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requirementIds: [target], updates: { priority: 'low' } })
    expect(res.status).toBe(200)
    const after = await prisma.requirement.findUnique({ where: { id: target } })
    // unchanged — a non-status bulk edit must not touch the status-change fields
    expect(after?.statusChangedAt ?? null).toEqual(before?.statusChangedAt ?? null)
    expect(after?.statusChangedBy ?? null).toEqual(before?.statusChangedBy ?? null)
  })
})
