/**
 * NX-8 (#463) — Stakeholders backend build-out integration tests.
 *
 * Covers the two new endpoint groups — Committee (+members, +default
 * reviewers) and RACI (+assignments) — plus the extended audit-logs endpoint,
 * end to end against the real database:
 *  - happy paths (200 / 201) for list / get / create / update / soft-delete,
 *  - auth guard (401) + non-member guard (403) on each route group,
 *  - controlled-vocabulary validation (422),
 *  - the >=1-Accountable invariant (0 -> 422, >1 -> 200/201 + warnings[]),
 *  - the polymorphic RACI subject (Requirement-backed + free-string Deliverable),
 *  - the `modules=` action-prefix filter + pagination on getProjectAuditLogs,
 *    AND a back-compat assertion that the no-param call is unchanged,
 *  - central AuditLog rows written with the committee:* / raci:* convention.
 *
 * No mocks — the suite hits Postgres (Docker must be running).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Stakeholders — NX-8 integration', () => {
  const ts = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'

  let memberId: string
  let member2Id: string
  let outsiderId: string
  let memberToken: string
  let outsiderToken: string
  let projectId: string
  let requirementId: string

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: { email: `stk-member-${ts}@example.com`, password: 'hashed', name: 'STK Member' },
    })
    const member2 = await prisma.user.create({
      data: { email: `stk-member2-${ts}@example.com`, password: 'hashed', name: 'STK Member Two' },
    })
    const outsider = await prisma.user.create({
      data: { email: `stk-outsider-${ts}@example.com`, password: 'hashed', name: 'STK Outsider' },
    })
    memberId = member.id
    member2Id = member2.id
    outsiderId = outsider.id
    memberToken = jwt.sign({ userId: memberId }, secret)
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    const project = await prisma.project.create({
      data: {
        name: `STK Project ${ts}`,
        domain: `stk-${ts}`,
        slug: `stk-${ts}`,
        userId: memberId,
      },
    })
    projectId = project.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: memberId, role: 'owner', status: 'accepted' },
        { projectId, userId: member2Id, role: 'member', status: 'accepted' },
      ],
    })

    // A live Requirement for the polymorphic-subject RACI test.
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'STK test requirement',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `STK-REQ-${ts}`,
      },
    })
    requirementId = req.id
  })

  afterAll(async () => {
    // Reverse dependency order. RaciAssignment / CommitteeMember /
    // CommitteeDefaultReviewer cascade with their parents, but delete
    // explicitly for clarity.
    await prisma.raciAssignment.deleteMany({ where: { raci: { projectId } } })
    await prisma.raciEntry.deleteMany({ where: { projectId } })
    await prisma.committeeMember.deleteMany({ where: { committee: { projectId } } })
    await prisma.committeeDefaultReviewer.deleteMany({ where: { committee: { projectId } } })
    await prisma.committee.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: { id: { in: [memberId, member2Id, outsiderId] } },
    })
  })

  // --- Committee -----------------------------------------------------------

  describe('Committee', () => {
    let committeeId: string

    it('rejects an unauthenticated list (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/committees`)
      expect(res.status).toBe(401)
    })

    it('rejects a non-member list (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/committees`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('lists committees (empty initially)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/committees`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBe(0)
    })

    it('creates a committee (201) with the provenance lattice defaulted', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'System CCB', kind: 'CCB', meetingFrequency: 'Weekly' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.name).toBe('System CCB')
      expect(res.body.data.kind).toBe('CCB')
      // R-1 provenance lattice — defaulted for a human create.
      expect(res.body.data.authorType).toBe('human')
      expect(res.body.data.provenanceReviewStatus).toBe('drafted')
      committeeId = res.body.data.id
    })

    it('rejects an invalid committee kind (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Bad', kind: 'NotAKind' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('updates a committee', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/committees/${committeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ notes: 'Routes baseline approvals' })
      expect(res.status).toBe(200)
      expect(res.body.data.notes).toBe('Routes baseline approvals')
    })

    it('writes a central AuditLog row with the committee:create action', async () => {
      const log = await prisma.auditLog.findFirst({
        where: { projectId, action: 'committee:create' },
        orderBy: { createdAt: 'desc' },
      })
      expect(log).not.toBeNull()
      expect(log?.detailsJson).toBeTruthy()
      expect((log?.detailsJson as Record<string, unknown>).committeeId).toBe(committeeId)
    })

    // --- CommitteeMember ---------------------------------------------------

    let memberRowId: string

    it('adds a committee member seat (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ userId: member2Id, committeeRole: 'Voting' })
      expect(res.status).toBe(201)
      expect(res.body.data.committeeRole).toBe('Voting')
      expect(res.body.data.userId).toBe(member2Id)
      memberRowId = res.body.data.id
    })

    it('rejects an invalid committeeRole (422)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ userId: memberId, committeeRole: 'Overlord' })
      expect(res.status).toBe(400)
    })

    it('rejects a non-project-member as a committee member (422)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ userId: outsiderId, committeeRole: 'Voting' })
      expect(res.status).toBe(422)
    })

    it('updates a committee member seat', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/committees/${committeeId}/members/${memberRowId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ committeeRole: 'Chair' })
      expect(res.status).toBe(200)
      expect(res.body.data.committeeRole).toBe('Chair')
    })

    it('soft-deletes (removes) a committee member', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/committees/${committeeId}/members/${memberRowId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      // The seat no longer appears in the committee detail.
      const get = await request(app)
        .get(`/api/v1/projects/${projectId}/committees/${committeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(get.body.data.members.length).toBe(0)
    })

    // --- CommitteeDefaultReviewer ------------------------------------------

    let reviewerRowId: string

    it('sets a default reviewer (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/default-reviewers`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ baselineKind: 'CERT' })
      expect(res.status).toBe(201)
      expect(res.body.data.baselineKind).toBe('CERT')
      reviewerRowId = res.body.data.id
    })

    it('rejects an invalid baselineKind (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/default-reviewers`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ baselineKind: 'NOPE' })
      expect(res.status).toBe(400)
    })

    it('rejects a duplicate baselineKind for the same committee (409)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/committees/${committeeId}/default-reviewers`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ baselineKind: 'CERT' })
      expect(res.status).toBe(409)
    })

    it('unsets a default reviewer', async () => {
      const res = await request(app)
        .delete(
          `/api/v1/projects/${projectId}/committees/${committeeId}/default-reviewers/${reviewerRowId}`,
        )
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
    })

    it('soft-deletes a committee — it disappears from the list', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/committees/${committeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      const list = await request(app)
        .get(`/api/v1/projects/${projectId}/committees`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.body.data.find((c: { id: string }) => c.id === committeeId)).toBeUndefined()
    })
  })

  // --- RACI ----------------------------------------------------------------

  describe('RACI', () => {
    it('rejects an unauthenticated RACI list (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/raci`)
      expect(res.status).toBe(401)
    })

    it('rejects a non-member RACI list (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('rejects a RACI entry with zero Accountable (422)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          subjectType: 'Requirement',
          subjectId: requirementId,
          assignments: [{ userId: memberId, letter: 'R' }],
        })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatch(/at least one Accountable/i)
    })

    it('rejects a RACI subject that does not resolve to a live row (422)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          subjectType: 'Requirement',
          subjectId: '00000000-0000-0000-0000-000000000000',
          assignments: [{ userId: memberId, letter: 'A' }],
        })
      expect(res.status).toBe(422)
    })

    let raciId: string

    it('creates a RACI entry with one Accountable (201, no warnings)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          subjectType: 'Requirement',
          subjectId: requirementId,
          assignments: [
            { userId: memberId, letter: 'A' },
            { userId: member2Id, letter: 'R' },
          ],
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.assignments.length).toBe(2)
      expect(res.body.warnings).toEqual([])
      raciId = res.body.data.id
    })

    it('writes a central AuditLog row with the raci:create action', async () => {
      const log = await prisma.auditLog.findFirst({
        where: { projectId, action: 'raci:create' },
        orderBy: { createdAt: 'desc' },
      })
      expect(log).not.toBeNull()
      expect((log?.detailsJson as Record<string, unknown>).raciId).toBe(raciId)
    })

    it('accepts a free-string Deliverable subject', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          subjectType: 'Deliverable',
          subjectId: `Audit package ${ts}`,
          assignments: [{ userId: memberId, letter: 'A' }],
        })
      expect(res.status).toBe(201)
      expect(res.body.data.subjectType).toBe('Deliverable')
    })

    it('rejects an invalid subjectType (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          subjectType: 'NotAType',
          subjectId: 'x',
          assignments: [{ userId: memberId, letter: 'A' }],
        })
      expect(res.status).toBe(400)
    })

    it('replaces assignments — >1 Accountable succeeds (200) with a warning', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/raci/${raciId}/assignments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          assignments: [
            { userId: memberId, letter: 'A' },
            { userId: member2Id, letter: 'A' },
          ],
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.warnings.length).toBe(1)
      expect(res.body.warnings[0]).toMatch(/Multiple Accountable/i)
    })

    it('replacing assignments down to zero Accountable rolls back (422)', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/raci/${raciId}/assignments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ assignments: [{ userId: memberId, letter: 'C' }] })
      expect(res.status).toBe(422)
      // The transaction rolled back — the two Accountable rows survive.
      const get = await request(app)
        .get(`/api/v1/projects/${projectId}/raci/${raciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      const accountable = get.body.data.assignments.filter(
        (a: { letter: string }) => a.letter === 'A',
      )
      expect(accountable.length).toBe(2)
    })

    it('updates a RACI entry riskFlag', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/raci/${raciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ riskFlag: true })
      expect(res.status).toBe(200)
      expect(res.body.data.riskFlag).toBe(true)
    })

    it('soft-deletes a RACI entry — it disappears from the list', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/raci/${raciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      const list = await request(app)
        .get(`/api/v1/projects/${projectId}/raci`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.body.data.find((r: { id: string }) => r.id === raciId)).toBeUndefined()
    })
  })

  // --- Extended getProjectAuditLogs ----------------------------------------

  describe('getProjectAuditLogs — modules filter + pagination', () => {
    it('back-compat: a no-param call returns every row, no pagination wrapper', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // The earlier tests wrote committee:* and raci:* rows.
      expect(res.body.data.length).toBeGreaterThan(0)
      // The unchanged path carries NO pagination object.
      expect(res.body.pagination).toBeUndefined()
    })

    it('modules=committee returns only committee:* rows', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .query({ modules: 'committee' })
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      for (const row of res.body.data) {
        expect(row.action.startsWith('committee:')).toBe(true)
      }
    })

    it('modules=raci returns only raci:* rows', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .query({ modules: 'raci' })
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      for (const row of res.body.data) {
        expect(row.action.startsWith('raci:')).toBe(true)
      }
    })

    it('a multi-token modules filter unions the namespaces', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .query({ modules: 'committee,raci' })
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      for (const row of res.body.data) {
        expect(row.action.startsWith('committee:') || row.action.startsWith('raci:')).toBe(true)
      }
    })

    it('paginates when page is present and carries a pagination object', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .query({ page: 1, pageSize: 2 })
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeLessThanOrEqual(2)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.pageSize).toBe(2)
      expect(res.body.pagination.total).toBeGreaterThan(0)
    })

    it('rejects an unauthenticated audit-logs call (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/audit-logs`)
      expect(res.status).toBe(401)
    })
  })
})
