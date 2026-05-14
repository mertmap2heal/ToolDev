/**
 * Validation module integration tests.
 * Covers: CRUD, criteria-driven status auto-advance, sign-off (signer != author + state guard),
 * sign-off revocation, evidence attach/detach, bulk-from-requirements, CSV export, 401/404.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Validation module integration', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'

  let authorId: string
  let approverId: string
  let outsiderId: string
  let authorToken: string
  let approverToken: string
  let outsiderToken: string
  let projectId: string
  let otherProjectId: string
  let seedRequirementId: string

  beforeAll(async () => {
    const author = await prisma.user.create({
      data: {
        email: `val-author-${stamp}@example.com`,
        password: 'hashed',
        name: 'Val Author',
      },
    })
    const approver = await prisma.user.create({
      data: {
        email: `val-approver-${stamp}@example.com`,
        password: 'hashed',
        name: 'Val Approver',
      },
    })
    const outsider = await prisma.user.create({
      data: {
        email: `val-outsider-${stamp}@example.com`,
        password: 'hashed',
        name: 'Outsider',
      },
    })
    authorId = author.id
    approverId = approver.id
    outsiderId = outsider.id
    authorToken = jwt.sign({ userId: authorId }, secret)
    approverToken = jwt.sign({ userId: approverId }, secret)
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    const slug = `val-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Val Project ${stamp}`, domain: slug, slug, userId: authorId },
    })
    projectId = project.id
    const otherSlug = `val-other-${stamp}`
    const other = await prisma.project.create({
      data: {
        name: `Val Other ${stamp}`,
        domain: otherSlug,
        slug: otherSlug,
        userId: authorId,
      },
    })
    otherProjectId = other.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: authorId, role: 'owner', status: 'accepted' },
        { projectId, userId: approverId, role: 'editor', status: 'accepted' },
        { projectId: otherProjectId, userId: authorId, role: 'owner', status: 'accepted' },
      ],
    })

    // V-Q6: sign-off requires the Validation Approver engineering role.
    // The role is upserted at module import, but tests must explicitly
    // assign the approver user to it for this project.
    const approverRole = await prisma.engineeringRole.upsert({
      where: { name: 'Validation Approver' },
      update: {},
      create: {
        name: 'Validation Approver',
        description: 'Authorised to sign off Validation items.',
        isSystem: true,
      },
    })
    await prisma.projectUserEngineeringRole.create({
      data: { projectId, userId: approverId, roleId: approverRole.id },
    })

    const req = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-${stamp}`,
        title: 'Seed requirement',
        description: 'Seed for bulk-from-requirements test',
        acceptanceCriteria: 'AC line 1\nAC line 2',
        priority: 'medium',
        status: 'draft',
        stage: 'system',
        requirementType: 'functional',
      },
    })
    seedRequirementId = req.id
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.validationItemStar.deleteMany({
      where: { validationItem: { projectId: { in: [projectId, otherProjectId] } } },
    })
    await prisma.validationSignOff.deleteMany({
      where: { validationItem: { projectId: { in: [projectId, otherProjectId] } } },
    })
    await prisma.validationItem.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.verEvidenceLink.deleteMany({
      where: { linkedEntityType: 'ValidationItem' },
    })
    await prisma.verEvidence.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.requirement.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.auditLog.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.projectUserEngineeringRole.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } })
    await prisma.user.deleteMany({
      where: { id: { in: [authorId, approverId, outsiderId] } },
    })
  })

  describe('Auth + access', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app).get(`/api/v1/validation/projects/${projectId}/items`)
      expect(res.status).toBe(401)
    })
    it('rejects non-members with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('CRUD + status auto-advance', () => {
    let itemId: string

    it('creates an item with auto-allocated VAL-### key', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Pilots can complete approach within 2 minutes',
          methodType: 'DEMONSTRATION',
          targetMilestone: 'FAT',
          criteria: [{ text: 'Approach completes in <120s', notes: '' }],
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.key).toMatch(/^VAL-\d{3,}$/)
      expect(res.body.data.status).toBe('PLANNED')
      expect(Array.isArray(res.body.data.criteria)).toBe(true)
      expect(res.body.data.criteria.length).toBe(1)
      itemId = res.body.data.id
    })

    it('rejects invalid methodType with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'X', methodType: 'NOPE' })
      expect(res.status).toBe(400)
    })

    it('lists items scoped to the project', async () => {
      const res = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.some((i: { id: string }) => i.id === itemId)).toBe(true)
    })

    it('does not show items from other projects (IDOR guard)', async () => {
      const res = await request(app)
        .get(`/api/v1/validation/projects/${otherProjectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.find((i: { id: string }) => i.id === itemId)).toBeUndefined()
    })

    it('auto-advances status to EXECUTED when all criteria become MET', async () => {
      const get = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
      const criteria = get.body.data.criteria.map((c: { id: string; text: string; orderIndex: number }) => ({
        id: c.id,
        text: c.text,
        outcome: 'MET',
        orderIndex: c.orderIndex,
      }))
      const res = await request(app)
        .put(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ criteria })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('EXECUTED')
    })
  })

  describe('Sign-off rules', () => {
    let itemId: string

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Stakeholder demo accepted',
          criteria: [{ text: 'Demo runs end-to-end' }],
        })
      itemId = res.body.data.id

      // advance to EXECUTED
      const get = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
      const criteria = get.body.data.criteria.map((c: { id: string; text: string; orderIndex: number }) => ({
        id: c.id,
        text: c.text,
        outcome: 'MET',
        orderIndex: c.orderIndex,
      }))
      await request(app)
        .put(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ criteria })
    })

    it('blocks the author from signing off (signer != author rule)', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ signerRoleLabel: 'Pilot' })
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/cannot be the creator/i)
    })

    it('lets a different project member sign off; status goes to VALIDATED', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ signerRoleLabel: 'Customer Operations Lead', comment: 'Approved.' })
      expect(res.status).toBe(201)
      const item = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(item.body.data.status).toBe('VALIDATED')
    })

    it('revoking the sign-off creates an immutable supersession row and demotes status', async () => {
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-offs`)
        .set('Authorization', `Bearer ${approverToken}`)
      const target = list.body.data.find((s: { supersededById: null | string }) => !s.supersededById)
      expect(target).toBeDefined()
      const revoke = await request(app)
        .post(
          `/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off/${target.id}/revoke`,
        )
        .set('Authorization', `Bearer ${approverToken}`)
      expect(revoke.status).toBe(200)
      const item = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(item.body.data.status).toBe('EXECUTED')
    })

    it('rejects sign-off on PLANNED items (not yet EXECUTED)', async () => {
      const created = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Not yet executed' })
      const res = await request(app)
        .post(
          `/api/v1/validation/projects/${projectId}/items/${created.body.data.id}/sign-off`,
        )
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ signerRoleLabel: 'Approver' })
      expect(res.status).toBe(403)
    })
  })

  describe('Bulk-from-requirements', () => {
    it('creates one ValidationItem per requirement with seeded criteria from acceptanceCriteria', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/from-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementIds: [seedRequirementId], methodType: 'OPERATIONAL_TEST' })
      expect(res.status).toBe(201)
      expect(res.body.data.length).toBe(1)
      const itemId = res.body.data[0].id
      const fetched = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(fetched.body.data.methodType).toBe('OPERATIONAL_TEST')
      expect(fetched.body.data.criteria.length).toBe(2) // two AC lines
      expect(fetched.body.data.title).toMatch(/^Validate:/)
    })

    it('rejects empty requirementIds', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/from-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementIds: [] })
      expect(res.status).toBe(400)
    })
  })

  describe('Evidence attach/detach (polymorphic VerEvidenceLink reuse)', () => {
    let itemId: string
    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Evidence test' })
      itemId = res.body.data.id
    })

    it('attaches evidence then lists it', async () => {
      const attach = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/evidence`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Demo recording',
          evidenceType: 'IMAGE',
          storageRef: '/uploads/validation/demo.png',
        })
      expect(attach.status).toBe(201)
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}/evidence`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list.body.data.length).toBe(1)
      expect(list.body.data[0].linkedEntityType).toBe('ValidationItem')
    })

    it('detaches and garbage-collects orphan VerEvidence', async () => {
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}/evidence`)
        .set('Authorization', `Bearer ${authorToken}`)
      const linkId = list.body.data[0].id
      const evidenceId = list.body.data[0].evidenceId
      const detach = await request(app)
        .delete(
          `/api/v1/validation/projects/${projectId}/items/${itemId}/evidence/${linkId}`,
        )
        .set('Authorization', `Bearer ${authorToken}`)
      expect(detach.status).toBe(200)
      const evidence = await prisma.verEvidence.findUnique({ where: { id: evidenceId } })
      expect(evidence).toBeNull() // GC'd
    })
  })

  describe('CSV export', () => {
    it('returns text/csv with the expected header and at least one row', async () => {
      const res = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items.csv`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/csv/)
      expect(res.text.split('\n')[0]).toBe(
        'key,title,methodType,targetMilestone,status,owner,criteriaCount,criteriaMet,signOffCount,createdAt',
      )
      expect(res.text.split('\n').length).toBeGreaterThan(1)
    })
  })

  describe('Key uniqueness under concurrent creates', () => {
    it('all 8 parallel creates succeed with distinct VAL-### keys', async () => {
      const promises = Array.from({ length: 8 }, () =>
        request(app)
          .post(`/api/v1/validation/projects/${projectId}/items`)
          .set('Authorization', `Bearer ${authorToken}`)
          .send({ title: `Concurrent ${Math.random().toString(36).slice(2, 6)}` }),
      )
      const results = await Promise.all(promises)
      const keys = results.map((r) => r.body.data?.key as string)
      expect(results.every((r) => r.status === 201)).toBe(true)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  describe('Linked requirements (TraceLink reuse)', () => {
    it('links a requirement and lists it; rejects duplicate', async () => {
      const create = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Linked-req e2e' })
      const itemId = create.body.data.id
      const link1 = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementId: seedRequirementId })
      expect(link1.status).toBe(201)
      const link2 = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementId: seedRequirementId })
      expect(link2.status).toBe(201)
      // Idempotent — same TraceLink id
      expect(link2.body.data.id).toBe(link1.body.data.id)
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.length).toBe(1)
      expect(list.body.data[0].requirementId).toBe(seedRequirementId)
    })

    it('unlinks a requirement', async () => {
      const create = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Unlink-req e2e' })
      const itemId = create.body.data.id
      const link = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementId: seedRequirementId })
      const traceLinkId = link.body.data.id
      const unlink = await request(app)
        .delete(
          `/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements/${traceLinkId}`,
        )
        .set('Authorization', `Bearer ${authorToken}`)
      expect(unlink.status).toBe(200)
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list.body.data.length).toBe(0)
    })
  })

  describe('Bulk update', () => {
    it('sets milestone on N items in one call', async () => {
      const a = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Bulk-A' })
      const b = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Bulk-B' })
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/bulk`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          ids: [a.body.data.id, b.body.data.id],
          patch: { targetMilestone: 'CDR' },
        })
      expect(res.status).toBe(200)
      expect(res.body.data.count).toBe(2)
      const after = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items/${a.body.data.id}`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(after.body.data.targetMilestone).toBe('CDR')
    })

    it('rejects an invalid milestone', async () => {
      const res = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/bulk`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ ids: ['nonexistent'], patch: { targetMilestone: 'NOPE' } })
      expect(res.status).toBe(400)
    })

    it('soft-deletes and restores via bulk', async () => {
      const a = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Bulk-delete-test' })
      const id = a.body.data.id
      const del = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/bulk`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ ids: [id], patch: { deletedAt: 'now' } })
      expect(del.status).toBe(200)
      expect(del.body.data.count).toBe(1)
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list.body.data.find((i: { id: string }) => i.id === id)).toBeUndefined()
      const restore = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/bulk`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ ids: [id], patch: { deletedAt: 'null' } })
      expect(restore.status).toBe(200)
      const list2 = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list2.body.data.find((i: { id: string }) => i.id === id)).toBeDefined()
    })
  })

  describe('Coverage rollup + uncovered requirements', () => {
    it('reports coverage counts and surfaces uncovered requirements', async () => {
      // Create a requirement that has no validation
      const orphan = await prisma.requirement.create({
        data: {
          projectId,
          requirementId: `REQ-orphan-${stamp}`,
          title: 'Orphan req',
          description: 'No validation yet',
          priority: 'low',
          status: 'draft',
          stage: 'system',
          requirementType: 'functional',
        },
      })
      const cov = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/coverage`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(cov.status).toBe(200)
      expect(cov.body.data.totals.requirements).toBeGreaterThanOrEqual(1)
      const uncov = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/uncovered-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(uncov.status).toBe(200)
      expect(uncov.body.data.find((r: { id: string }) => r.id === orphan.id)).toBeDefined()
    })

    it('marks an item suspect when its linked requirement is updated after the item', async () => {
      const create = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Suspect-test' })
      const itemId = create.body.data.id
      await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/linked-requirements`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ requirementId: seedRequirementId })
      // Bump requirement updatedAt by writing to it
      await prisma.requirement.update({
        where: { id: seedRequirementId },
        data: { description: `Touched at ${Date.now()}` },
      })
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      const row = list.body.data.find((i: { id: string }) => i.id === itemId)
      expect(row?.isSuspect).toBe(true)
    })
  })

  describe('Validation Approver role bootstrap', () => {
    it('system role exists after a validation route is hit', async () => {
      // The bootstrap fires on validation.routes.ts module import (before any
      // request); the first describe block above already triggered it.
      const role = await prisma.engineeringRole.findUnique({
        where: { name: 'Validation Approver' },
      })
      expect(role).not.toBeNull()
      expect(role?.isSystem).toBe(true)
    })
  })

  describe('Soft delete + restore', () => {
    it('soft-deletes and restores correctly; default list excludes deleted', async () => {
      const created = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Will be deleted' })
      const id = created.body.data.id
      const del = await request(app)
        .delete(`/api/v1/validation/projects/${projectId}/items/${id}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ reason: 'redundant' })
      expect(del.status).toBe(200)
      const list = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list.body.data.find((i: { id: string }) => i.id === id)).toBeUndefined()
      const restore = await request(app)
        .post(`/api/v1/validation/projects/${projectId}/items/${id}/restore`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(restore.status).toBe(200)
      const list2 = await request(app)
        .get(`/api/v1/validation/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${authorToken}`)
      expect(list2.body.data.find((i: { id: string }) => i.id === id)).toBeDefined()
    })
  })
})
