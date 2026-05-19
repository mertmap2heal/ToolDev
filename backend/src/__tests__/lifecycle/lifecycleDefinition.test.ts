import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { seedLifecyclePhases } from '../../scripts/seed-lifecycle-phases'

/**
 * NX-11 (#474) — lifecycle definition persistence.
 *
 * Covers:
 *  - the 3 read endpoints (library / applicable / transitions) return real
 *    model-backed data;
 *  - 401 without a bearer token; 403 for a non-member;
 *  - the write endpoints CRUD a project-custom lifecycle;
 *  - 403 when a caller tries to update / delete a shared catalogue lifecycle;
 *  - the standard-catalogue seed is idempotent;
 *  - the Control Tower readiness reads Project.currentPhaseId.
 *
 * Real DB, no mocks; isolated data with unique timestamped names; afterAll
 * cleans up in reverse-FK order. LifecyclePhase / LifecycleTransition carry no
 * append-only guard, so ordinary deleteMany is used.
 */
describe('NX-11 — lifecycle definition persistence (#474)', () => {
  const ts = Date.now()
  let memberUserId = ''
  let outsiderUserId = ''
  let memberToken = ''
  let outsiderToken = ''
  let projectId = ''
  const base = () => `/api/v1/lifecycle/${projectId}`

  beforeAll(async () => {
    // The standard catalogue must exist for the read endpoints to return it.
    // The seed is idempotent and writes only shared (projectId=null) rows.
    await seedLifecyclePhases()

    const member = await prisma.user.create({
      data: { email: `lc-def-member-${ts}@example.com`, password: 'hashed', name: 'LC Def Member' },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: memberUserId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: { email: `lc-def-outsider-${ts}@example.com`, password: 'hashed', name: 'LC Def Outsider' },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, process.env.JWT_SECRET || 'secret')

    const slug = `lc-def-project-${ts}`
    const project = await prisma.project.create({
      data: { name: `LC Def Project ${ts}`, domain: slug, slug, userId: memberUserId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })
    // outsider is intentionally NOT a member.
  })

  afterAll(async () => {
    // Project-scoped lifecycle rows for this test's project (catalogue rows,
    // projectId=null, are shared and left intact).
    await prisma.lifecycleTransition.deleteMany({ where: { projectId } })
    await prisma.lifecyclePhase.deleteMany({ where: { projectId } })
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: memberUserId } })
    await prisma.user.delete({ where: { id: outsiderUserId } })
    await prisma.$disconnect()
  })

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  describe('GET /lifecycle/:projectId/library', () => {
    it('returns the seeded standard catalogue as real model-backed data', async () => {
      const res = await request(app)
        .get(`${base()}/library`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // The stubs returned [] - real data has the 6 seeded standard lifecycles.
      expect(res.body.data.length).toBeGreaterThanOrEqual(6)
      const do178c = res.body.data.find((l: { id: string }) => l.id === 'std-do178c')
      expect(do178c).toBeDefined()
      expect(do178c.isCatalog).toBe(true)
      expect(do178c.scope).toBe('standard')
      expect(do178c.phases.length).toBeGreaterThan(0)
      expect(do178c.phases.some((p: { isInitial: boolean }) => p.isInitial)).toBe(true)
    })

    it('filters by itemType', async () => {
      const res = await request(app)
        .get(`${base()}/library?itemType=Change%20Request`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      for (const lc of res.body.data) {
        expect(
          lc.applicableItemTypes.some((t: string) => t.toLowerCase() === 'change request')
        ).toBe(true)
      }
    })

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get(`${base()}/library`)
      expect(res.status).toBe(401)
    })

    it('returns 403 for an authenticated non-member', async () => {
      const res = await request(app)
        .get(`${base()}/library`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /lifecycle/:projectId/applicable', () => {
    it('resolves the applicable lifecycle for an item type', async () => {
      const res = await request(app)
        .get(`${base()}/applicable?itemType=Requirement`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).not.toBeNull()
      expect(res.body.data.lifecycleId).toBeTruthy()
      expect(res.body.data.defaultStatusId).toBeTruthy()
    })

    it('returns 400 without itemType', async () => {
      const res = await request(app)
        .get(`${base()}/applicable`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get(`${base()}/applicable?itemType=Requirement`)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /lifecycle/:projectId/transitions', () => {
    it('returns allowed transitions out of a status', async () => {
      // std-do178c initial phase status is "planning".
      const res = await request(app)
        .get(`${base()}/transitions?lifecycleId=std-do178c&fromStatusId=planning`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data.transitions)).toBe(true)
      expect(res.body.data.transitions.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.transitions[0].toStatusId).toBeTruthy()
    })

    it('returns 400 without the required query params', async () => {
      const res = await request(app)
        .get(`${base()}/transitions?lifecycleId=std-do178c`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get(
        `${base()}/transitions?lifecycleId=std-do178c&fromStatusId=planning`
      )
      expect(res.status).toBe(401)
    })
  })

  // -------------------------------------------------------------------------
  // Writes — project-custom lifecycle CRUD
  // -------------------------------------------------------------------------
  describe('write endpoints — project-custom lifecycle CRUD', () => {
    let createdLifecycleId = ''

    it('POST /definitions creates a project-custom lifecycle', async () => {
      const res = await request(app)
        .post(`${base()}/definitions`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: `Custom LC ${ts}`,
          description: 'a project-custom lifecycle',
          version: '1.0',
          applicableItemTypes: ['Requirement'],
          phases: [
            { statusId: 'draft', name: 'Draft', isInitial: true },
            { statusId: 'approved', name: 'Approved' },
          ],
          transitions: [{ fromPhaseIndex: 0, toPhaseIndex: 1, allowedEngineeringRoleIds: [] }],
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.isCatalog).toBe(false)
      expect(res.body.data.scope).toBe('project')
      expect(res.body.data.projectId).toBe(projectId)
      expect(res.body.data.phases.length).toBe(2)
      createdLifecycleId = res.body.data.id
    })

    it('the created lifecycle appears in the library', async () => {
      const res = await request(app)
        .get(`${base()}/library`)
        .set('Authorization', `Bearer ${memberToken}`)
      const found = res.body.data.find((l: { id: string }) => l.id === createdLifecycleId)
      expect(found).toBeDefined()
      expect(found.isCatalog).toBe(false)
    })

    it('an audit row is written for the create', async () => {
      const row = await prisma.auditLog.findFirst({
        where: { projectId, action: 'lifecycle:definition-create' },
      })
      expect(row).not.toBeNull()
    })

    it('PUT /definitions/:id updates the project-custom lifecycle', async () => {
      const res = await request(app)
        .put(`${base()}/definitions/${createdLifecycleId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: `Custom LC Renamed ${ts}`,
          version: '2.0',
          applicableItemTypes: ['Requirement'],
          phases: [
            { statusId: 'draft', name: 'Draft', isInitial: true },
            { statusId: 'in-review', name: 'In Review' },
            { statusId: 'approved', name: 'Approved' },
          ],
          transitions: [
            { fromPhaseIndex: 0, toPhaseIndex: 1 },
            { fromPhaseIndex: 1, toPhaseIndex: 2 },
          ],
        })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe(`Custom LC Renamed ${ts}`)
      expect(res.body.data.phases.length).toBe(3)
      expect(res.body.data.version).toBe('2.0')
    })

    it('DELETE /definitions/:id deletes the project-custom lifecycle', async () => {
      const res = await request(app)
        .delete(`${base()}/definitions/${createdLifecycleId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      // It is gone from the library.
      const lib = await request(app)
        .get(`${base()}/library`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(lib.body.data.find((l: { id: string }) => l.id === createdLifecycleId)).toBeUndefined()
    })

    it('POST /definitions returns 401 without a bearer token', async () => {
      const res = await request(app)
        .post(`${base()}/definitions`)
        .send({ name: 'x', phases: [{ statusId: 'draft', name: 'Draft' }] })
      expect(res.status).toBe(401)
    })

    it('POST /definitions returns 403 for a non-member', async () => {
      const res = await request(app)
        .post(`${base()}/definitions`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ name: 'x', phases: [{ statusId: 'draft', name: 'Draft' }] })
      expect(res.status).toBe(403)
    })
  })

  // -------------------------------------------------------------------------
  // Catalogue lifecycles are read-only
  // -------------------------------------------------------------------------
  describe('catalogue lifecycles are read-only', () => {
    it('PUT on a standard catalogue lifecycle returns 403', async () => {
      const res = await request(app)
        .put(`${base()}/definitions/std-do178c`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'hijacked catalogue lifecycle',
          phases: [{ statusId: 'draft', name: 'Draft' }],
        })
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/read-only/i)
    })

    it('DELETE on a standard catalogue lifecycle returns 403', async () => {
      const res = await request(app)
        .delete(`${base()}/definitions/std-arp4754a`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/read-only/i)
    })

    it('the catalogue lifecycle is untouched after the rejected writes', async () => {
      const res = await request(app)
        .get(`${base()}/library`)
        .set('Authorization', `Bearer ${memberToken}`)
      const do178c = res.body.data.find((l: { id: string }) => l.id === 'std-do178c')
      expect(do178c).toBeDefined()
      expect(do178c.name).toBe('DO-178C Software Development')
    })

    it('PUT / DELETE on a non-existent lifecycle returns 404', async () => {
      const put = await request(app)
        .put(`${base()}/definitions/lc-does-not-exist-${ts}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'x', phases: [{ statusId: 'draft', name: 'Draft' }] })
      expect(put.status).toBe(404)
      const del = await request(app)
        .delete(`${base()}/definitions/lc-does-not-exist-${ts}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // Seed idempotency
  // -------------------------------------------------------------------------
  describe('standard catalogue seed', () => {
    it('is idempotent — a re-run creates nothing and changes the row count by 0', async () => {
      const before = await prisma.lifecyclePhase.count({ where: { lifecycleScope: 'standard' } })
      const result = await seedLifecyclePhases()
      const after = await prisma.lifecyclePhase.count({ where: { lifecycleScope: 'standard' } })
      expect(after).toBe(before)
      expect(result.phasesCreated).toBe(0)
      expect(result.transitionsCreated).toBe(0)
      expect(result.phasesExisting).toBeGreaterThanOrEqual(6)
    })
  })

  // -------------------------------------------------------------------------
  // Control Tower light reconcile — reads Project.currentPhaseId
  // -------------------------------------------------------------------------
  describe('Control Tower readiness reads Project.currentPhaseId', () => {
    it('returns currentPhase null when no phase is set', async () => {
      const res = await request(app)
        .get(`/api/v1/lifecycle/control-tower/${projectId}/readiness`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('currentPhaseId')
      expect(res.body.data.currentPhaseId).toBeNull()
      expect(res.body.data.currentPhase).toBeNull()
    })

    it('reflects the real currentPhaseId once the project has one set', async () => {
      // Pick a real catalogue phase and point the project at it.
      const phase = await prisma.lifecyclePhase.findFirst({
        where: { lifecycleScope: 'standard', seedKey: 'std-do178c::Planning' },
      })
      expect(phase).not.toBeNull()
      await prisma.project.update({
        where: { id: projectId },
        data: { currentPhaseId: phase!.id, phaseEnteredAt: new Date() },
      })
      const res = await request(app)
        .get(`/api/v1/lifecycle/control-tower/${projectId}/readiness`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.currentPhaseId).toBe(phase!.id)
      expect(res.body.data.currentPhase).toBe('Planning')
      expect(res.body.data.currentLifecycle).toBe('DO-178C Software Development')
      expect(res.body.data.phaseEnteredAt).toBeTruthy()
      // Reset so afterAll's project delete is not blocked by the SetNull FK.
      await prisma.project.update({
        where: { id: projectId },
        data: { currentPhaseId: null, phaseEnteredAt: null },
      })
    })
  })
})
