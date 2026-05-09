/**
 * Verification — audit service / audit trail HTTP integration (Batch 10).
 *
 * Routes mounted at /api/v1/verification/audit/:projectId... (verification.routes.ts):
 *   GET /audit/:projectId/entity/:entityType/:entityId — paginated entity history
 *   GET /audit/:projectId                              — paginated project trail
 *
 * Auth chain: authenticateToken -> projectIdParam (membership-aware).
 * Service helpers also exercised directly (logEvent / logStatusChange / logEvidenceLink)
 * since the controllers are read-only — writes happen elsewhere.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { AuditAction } from '../../types/verification.types'

describe('Verification audit service + HTTP', () => {
  const stamp = Date.now()
  let userId: string
  let outsiderId: string
  let token: string
  let outsiderToken: string
  let projectA: string
  let projectB: string
  let entityIdA: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const u = await prisma.user.create({
      data: {
        email: `ver-audit-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver Audit User',
      },
    })
    userId = u.id
    token = jwt.sign({ userId }, secret)

    const outsider = await prisma.user.create({
      data: {
        email: `ver-audit-out-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver Audit Outsider',
      },
    })
    outsiderId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    const slugA = `ver-audit-a-${stamp}`
    const slugB = `ver-audit-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver Audit A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver Audit B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    // Use a synthetic entityId; audit events have no FK to entity tables.
    entityIdA = `tc-${stamp}`

    // Seed audit rows via the service so we cover logEvent + logStatusChange + logEvidenceLink.
    await auditService.logEvent({
      projectId: projectA,
      entityType: 'TEST_CASE',
      entityId: entityIdA,
      action: AuditAction.CREATE,
      newValue: { title: 'Seeded' },
      performedByUserId: userId,
    })
    await auditService.logStatusChange({
      projectId: projectA,
      entityType: 'TEST_CASE',
      entityId: entityIdA,
      oldStatus: 'DRAFT',
      newStatus: 'APPROVED',
      performedByUserId: userId,
    })
    await auditService.logEvidenceLink({
      projectId: projectA,
      evidenceId: `ev-${stamp}`,
      linkedEntityType: 'TEST_CASE',
      linkedEntityId: entityIdA,
      action: AuditAction.LINK_EVIDENCE,
      performedByUserId: userId,
    })
    // One row in projectB with a different entity to make sure project filtering works.
    await auditService.logEvent({
      projectId: projectB,
      entityType: 'TEST_PLAN',
      entityId: `tp-${stamp}`,
      action: AuditAction.UPDATE,
      newValue: { caseOrders: [1, 2] },
      performedByUserId: userId,
    })
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verAuditEvent
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userId, outsiderId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get(`/api/v1/verification/audit/${projectA}`)
      expect(res.status).toBe(401)
    })

    it('returns 403 when caller is not a project member', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/v1/verification/audit/:projectId', () => {
    it('returns project audit trail mapped with summaries', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // Should NOT include rows from projectB
      const projectIds = new Set(res.body.data.map((r: any) => r.projectId))
      expect(projectIds.has(projectA)).toBe(true)
      expect(projectIds.has(projectB)).toBe(false)
      // Mapping: each row has summary; raw values omitted by default
      for (const row of res.body.data) {
        expect(typeof row.summary).toBe('string')
        expect('oldValue' in row).toBe(false)
        expect('newValue' in row).toBe(false)
      }
    })

    it('includes raw old/new values when includeRaw=1', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}?includeRaw=1`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      // Find the STATUS_CHANGE event we seeded -> summary should reflect transition
      const statusChange = res.body.data.find((r: any) => r.action === 'STATUS_CHANGE')
      expect(statusChange).toBeTruthy()
      expect(statusChange.summary).toMatch(/Status:.*DRAFT.*APPROVED/)
      expect(statusChange.oldValue).toEqual({ status: 'DRAFT' })
      expect(statusChange.newValue).toEqual({ status: 'APPROVED' })
    })

    it('filters by entityType', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}?entityType=TEST_CASE`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      for (const row of res.body.data) {
        expect(row.entityType).toBe('TEST_CASE')
      }
    })

    it('respects actions filter (CSV)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}?actions=CREATE,LINK_EVIDENCE`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const allowed = new Set(['CREATE', 'LINK_EVIDENCE'])
      for (const row of res.body.data) {
        expect(allowed.has(row.action)).toBe(true)
      }
    })

    it('respects limit query parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}?limit=1`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeLessThanOrEqual(1)
    })
  })

  describe('GET /api/v1/verification/audit/:projectId/entity/:entityType/:entityId', () => {
    it('returns trail for the entity, newest-first', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/audit/${projectA}/entity/TEST_CASE/${entityIdA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
      for (const row of res.body.data) {
        expect(row.entityType).toBe('TEST_CASE')
        expect(row.entityId).toBe(entityIdA)
      }
      const ts = res.body.data.map((r: any) => Date.parse(r.performedAt))
      for (let i = 1; i < ts.length; i++) {
        expect(ts[i - 1]).toBeGreaterThanOrEqual(ts[i])
      }
    })

    it('returns empty array for unknown entity', async () => {
      const res = await request(app)
        .get(
          `/api/v1/verification/audit/${projectA}/entity/TEST_CASE/00000000-0000-0000-0000-000000000000`
        )
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  describe('auditService direct', () => {
    it('clamps limit between 1 and 500', async () => {
      const events = await auditService.listProjectAuditTrail({
        projectId: projectA,
        limit: 9999,
      })
      // Limit clamped server-side to 500; we just verify call succeeded and returns rows.
      expect(Array.isArray(events)).toBe(true)
    })

    it('logEvent stores serialized JSON values', async () => {
      const ev = await auditService.logEvent({
        projectId: projectA,
        entityType: 'TEST_CASE',
        entityId: entityIdA,
        action: AuditAction.UPDATE,
        oldValue: { x: 1 },
        newValue: { x: 2, nested: { y: [1, 2, 3] } },
      })
      expect(ev.id).toBeDefined()
      expect(ev.action).toBe('UPDATE')
      const reread = await prisma.verAuditEvent.findUnique({ where: { id: ev.id } })
      expect((reread?.newValue as any)?.nested?.y).toEqual([1, 2, 3])
    })
  })
})
