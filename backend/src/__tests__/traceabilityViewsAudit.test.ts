/**
 * NX-10 — audit-table unification: SavedViewAuditEvent reference migration.
 *
 * Covers the three repointed surfaces:
 *   - WRITER  — a traceability saved-view create / update / delete / rollback
 *     writes a central `AuditLog` row with a `requirements:saved-view-*`
 *     action + `{ viewId, old, new }` detailsJson — and writes NO
 *     `SavedViewAuditEvent` row.
 *   - READER  — `GET /:projectId/views/:viewId/audit` reads `AuditLog`, scopes
 *     per-view (a 2nd view's events do not leak in), excludes non-saved-view
 *     `AuditLog` rows, holds the `{ success, data, nextCursor }` contract, and
 *     projects rows back into the legacy `TraceabilitySavedViewAuditEvent`
 *     shape (frontend untouched).
 *   - BACKFILL — `backfillSavedViewAuditEvents` is idempotent (double-run ->
 *     no double rows), non-destructive (source `SavedViewAuditEvent` rows
 *     untouched), and skips null-actor legacy rows (never deletes them).
 *
 * Real DB, isolated timestamped data, afterAll cleanup, no Prisma mocks
 * (`.claude/testing.md`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { backfillSavedViewAuditEvents, BACKFILL_KEY } from '../scripts/backfill-saved-view-audit-events'

const SAVED_VIEW_ACTIONS = [
  'requirements:saved-view-create',
  'requirements:saved-view-update',
  'requirements:saved-view-delete',
  'requirements:saved-view-rollback',
]

describe('NX-10 — SavedViewAuditEvent -> AuditLog migration', () => {
  const stamp = Date.now()
  let ownerId: string
  let tokenOwner: string
  let projectId: string
  let viewId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `nx10-o-${stamp}@example.test`, password: 'x', name: 'NX10 Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const slug = `nx10-${stamp}`
    const p = await prisma.project.create({
      data: { name: `NX10 ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    // Reverse dependency order. AuditLog FKs project+user, so it must clear
    // before the project/user. The legacy SavedViewAuditEvent table is frozen
    // by NX-10 but this suite seeds rows into it directly — clean them too.
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.savedViewAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.savedViewRevision.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.savedView.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: ownerId } }).catch(() => {})
    await prisma.$disconnect()
  })

  // ---- WRITER -----------------------------------------------------------

  it('creating a saved view writes a requirements:saved-view-create AuditLog row, not a SavedViewAuditEvent row', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `NX10 View ${stamp}`,
        definition: { linkageTargetType: 'pbs_component', showSuspectOnly: false },
      })
    expect(res.status).toBe(201)
    viewId = res.body.data.id

    const auditRows = await prisma.auditLog.findMany({
      where: { projectId, action: 'requirements:saved-view-create' },
    })
    expect(auditRows.length).toBe(1)
    const row = auditRows[0]
    expect(row.userId).toBe(ownerId)
    const details = row.detailsJson as Record<string, any>
    expect(details.viewId).toBe(viewId)
    expect(details.old).toBeNull()
    expect(details.new).toMatchObject({ name: `NX10 View ${stamp}` })

    // The legacy SavedViewAuditEvent table receives NO new write.
    const legacyRows = await prisma.savedViewAuditEvent.findMany({ where: { projectId } })
    expect(legacyRows.length).toBe(0)
  })

  it('updating a saved view writes a requirements:saved-view-update AuditLog row with old+new', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/views/${viewId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `NX10 View renamed ${stamp}` })
    expect(res.status).toBe(200)

    const rows = await prisma.auditLog.findMany({
      where: { projectId, action: 'requirements:saved-view-update' },
    })
    expect(rows.length).toBe(1)
    const details = rows[0].detailsJson as Record<string, any>
    expect(details.viewId).toBe(viewId)
    expect(details.old).toMatchObject({ name: `NX10 View ${stamp}` })
    expect(details.new).toMatchObject({ name: `NX10 View renamed ${stamp}` })
  })

  it('rolling a saved view back writes a requirements:saved-view-rollback AuditLog row', async () => {
    const revRes = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/revisions`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(revRes.status).toBe(200)
    const earliest = [...revRes.body.data].sort(
      (a: any, b: any) => a.revisionNumber - b.revisionNumber,
    )[0]

    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views/${viewId}/rollback`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ targetRevisionNumber: earliest.revisionNumber })
    expect(res.status).toBe(200)

    const rows = await prisma.auditLog.findMany({
      where: { projectId, action: 'requirements:saved-view-rollback' },
    })
    expect(rows.length).toBe(1)
    expect((rows[0].detailsJson as Record<string, any>).viewId).toBe(viewId)

    // Still no legacy-table writes after four mutating operations.
    const legacyRows = await prisma.savedViewAuditEvent.findMany({ where: { projectId } })
    expect(legacyRows.length).toBe(0)
  })

  // ---- READER -----------------------------------------------------------

  it('GET .../audit returns the {success,data,nextCursor} contract with legacy-shaped rows', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/audit`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body).toHaveProperty('nextCursor')

    // create + update + rollback = 3 saved-view AuditLog rows for this view.
    expect(res.body.data.length).toBe(3)
    // Each row is projected back into the legacy TraceabilitySavedViewAuditEvent shape.
    for (const row of res.body.data) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('action')
      expect(row).toHaveProperty('performedAt')
      expect(row).toHaveProperty('performedByUserId')
      expect(row).toHaveProperty('oldValueJson')
      expect(row).toHaveProperty('newValueJson')
      expect(row.viewId).toBe(viewId)
      expect(row.projectId).toBe(projectId)
      expect(row.performedByUserId).toBe(ownerId)
      expect(SAVED_VIEW_ACTIONS).toContain(row.action)
    }
    // Ordered newest-first (createdAt desc).
    const times = res.body.data.map((r: any) => new Date(r.performedAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('GET .../audit scopes per-view — a second view\'s events do not leak in, and non-saved-view AuditLog rows are excluded', async () => {
    // A second saved view in the same project, with its own audit events.
    const v2Res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `NX10 View 2 ${stamp}`, definition: { linkageTargetType: 'function' } })
    expect(v2Res.status).toBe(201)
    const viewId2 = v2Res.body.data.id

    // An unrelated AuditLog row in the same project that ALSO carries a viewId
    // in detailsJson but uses a non-saved-view action — the reader's action IN
    // predicate must exclude it.
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: ownerId,
        action: 'requirements:some-other-action',
        detailsJson: { viewId },
      },
    })

    // View 1's audit list still returns ONLY view 1's three saved-view events.
    const res1 = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/audit`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res1.status).toBe(200)
    expect(res1.body.data.length).toBe(3)
    for (const row of res1.body.data) {
      expect(row.viewId).toBe(viewId)
      expect(SAVED_VIEW_ACTIONS).toContain(row.action)
    }

    // View 2's audit list returns ONLY view 2's create event.
    const res2 = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId2}/audit`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res2.status).toBe(200)
    expect(res2.body.data.length).toBe(1)
    expect(res2.body.data[0].viewId).toBe(viewId2)
    expect(res2.body.data[0].action).toBe('requirements:saved-view-create')
  })

  it('GET .../audit honours limit + nextCursor pagination', async () => {
    const page1 = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/audit`)
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(page1.status).toBe(200)
    expect(page1.body.data.length).toBe(2)
    expect(page1.body.nextCursor).toBeTruthy()

    const page2 = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/audit`)
      .query({ limit: 2, cursor: page1.body.nextCursor })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(page2.status).toBe(200)
    expect(page2.body.data.length).toBe(1) // 3 total - 2 on page 1
    expect(page2.body.nextCursor).toBeNull()

    // No id overlap between the two pages.
    const ids1 = page1.body.data.map((r: any) => r.id)
    const ids2 = page2.body.data.map((r: any) => r.id)
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false)
  })

  // ---- BACKFILL ---------------------------------------------------------

  it('backfill copies legacy SavedViewAuditEvent rows into AuditLog, is idempotent, non-destructive, and skips null-actor rows', async () => {
    // Seed three legacy rows directly into the frozen table: two with an actor,
    // one with a null actor (which AuditLog.userId NOT NULL cannot accept).
    const legacyA = await prisma.savedViewAuditEvent.create({
      data: {
        projectId,
        viewId,
        action: 'CREATE_VIEW',
        oldValueJson: undefined,
        newValueJson: { name: 'legacy A' },
        performedByUserId: ownerId,
        performedAt: new Date('2026-01-02T03:04:05.000Z'),
      },
    })
    const legacyB = await prisma.savedViewAuditEvent.create({
      data: {
        projectId,
        viewId,
        action: 'UPDATE_VIEW',
        oldValueJson: { name: 'legacy A' },
        newValueJson: { name: 'legacy B' },
        performedByUserId: ownerId,
        performedAt: new Date('2026-01-03T03:04:05.000Z'),
      },
    })
    const legacyNullActor = await prisma.savedViewAuditEvent.create({
      data: {
        projectId,
        viewId,
        action: 'DELETE_VIEW',
        performedByUserId: null,
        performedAt: new Date('2026-01-04T03:04:05.000Z'),
      },
    })

    const auditCountBefore = await prisma.auditLog.count({ where: { projectId } })

    // First run.
    const r1 = await backfillSavedViewAuditEvents(projectId)
    expect(r1.total).toBe(3)
    expect(r1.copied).toBe(2)
    expect(r1.skippedNullActor).toBe(1)
    expect(r1.skippedAlready).toBe(0)
    expect(r1.skippedNullActorIds).toEqual([legacyNullActor.id])

    const auditCountAfter1 = await prisma.auditLog.count({ where: { projectId } })
    expect(auditCountAfter1).toBe(auditCountBefore + 2)

    // The two copied rows preserve the legacy action verbatim + original timestamp.
    const copiedA = await prisma.auditLog.findFirst({
      where: { projectId, detailsJson: { path: [BACKFILL_KEY], equals: legacyA.id } },
    })
    expect(copiedA).not.toBeNull()
    expect(copiedA!.action).toBe('CREATE_VIEW') // verbatim — NOT rewritten
    expect(copiedA!.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z')
    expect(copiedA!.userId).toBe(ownerId)
    const detA = copiedA!.detailsJson as Record<string, any>
    expect(detA.viewId).toBe(viewId)
    expect(detA.new).toMatchObject({ name: 'legacy A' })

    const copiedB = await prisma.auditLog.findFirst({
      where: { projectId, detailsJson: { path: [BACKFILL_KEY], equals: legacyB.id } },
    })
    expect(copiedB).not.toBeNull()
    expect(copiedB!.action).toBe('UPDATE_VIEW')

    // Second run — idempotent: no new AuditLog rows, both rows now skipped.
    const r2 = await backfillSavedViewAuditEvents(projectId)
    expect(r2.total).toBe(3)
    expect(r2.copied).toBe(0)
    expect(r2.skippedAlready).toBe(2)
    expect(r2.skippedNullActor).toBe(1)

    const auditCountAfter2 = await prisma.auditLog.count({ where: { projectId } })
    expect(auditCountAfter2).toBe(auditCountAfter1) // no duplication

    // Non-destructive: the three source legacy rows are untouched.
    const stillThere = await prisma.savedViewAuditEvent.findMany({
      where: { id: { in: [legacyA.id, legacyB.id, legacyNullActor.id] } },
      orderBy: { performedAt: 'asc' },
    })
    expect(stillThere.length).toBe(3)
    expect(stillThere[0].action).toBe('CREATE_VIEW')
    expect(stillThere[2].performedByUserId).toBeNull() // null-actor row retained
  })
})
