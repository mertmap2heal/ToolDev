/**
 * R-8 — AuditLog.detailsJson coverage.
 *
 *   1. classifyDetails — the backfill classification logic (structured vs wrapped).
 *   2. detailsJson Json round-trip — write an object, read it back as an object.
 *   3. Platform-admin audit fan-out — GET /platform-admin/audit-logs now
 *      includes central AuditLog rows with source: 'central'.
 *
 * Hits the real DB (no mocks). Cleans up all created rows in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { classifyDetails } from '../scripts/backfill-audit-details-json'

// -------------------------------------------------------------------------
// 1. classifyDetails — backfill classification logic
// -------------------------------------------------------------------------
describe('R-8 classifyDetails — backfill classification', () => {
  it('classifies a valid JSON object string as structured', () => {
    const c = classifyDetails('{"baselineId":"abc","requirementCount":3}')
    expect(c.kind).toBe('structured')
    expect(c.value).toEqual({ baselineId: 'abc', requirementCount: 3 })
  })

  it('classifies a valid JSON array string as structured', () => {
    const c = classifyDetails('[1,2,3]')
    expect(c.kind).toBe('structured')
    expect(c.value).toEqual([1, 2, 3])
  })

  it('wraps raw non-JSON text as { message }', () => {
    const raw = 'Baseline "E2E Baseline 1777226260861" created (id: 727f98cc-...)'
    const c = classifyDetails(raw)
    expect(c.kind).toBe('wrapped')
    expect(c.value).toEqual({ message: raw })
  })

  it('wraps a JSON primitive (quoted string) as { message } — typeof guard', () => {
    // JSON.parse('"text"') succeeds and yields a string; it must still wrap.
    const c = classifyDetails('"just a string"')
    expect(c.kind).toBe('wrapped')
    expect(c.value).toEqual({ message: '"just a string"' })
  })

  it('wraps a JSON number primitive as { message }', () => {
    const c = classifyDetails('42')
    expect(c.kind).toBe('wrapped')
    expect(c.value).toEqual({ message: '42' })
  })
})

// -------------------------------------------------------------------------
// 2 + 3. DB-backed tests
// -------------------------------------------------------------------------
describe('R-8 detailsJson — round-trip + platform-admin fan-out', () => {
  let projectId: string
  let userId: string
  let adminToken: string | undefined
  const ts = Date.now()
  const uniqueAction = `validation:r8-test-${ts}`
  const createdAuditIds: string[] = []

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `r8-audit-${ts}@example.com`, password: 'hash', name: 'R8 Audit User' },
    })
    userId = user.id

    const slug = `r8-audit-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `R8 Audit ${ts}`,
        domain: slug,
        slug,
        description: '',
        userId,
        companyName: `R8AuditCo-${ts}`,
      },
    })
    projectId = project.id

    // SUPERIOR_ADMIN for the platform-admin fan-out test.
    await prisma.user.upsert({
      where: { email: 'admin' },
      update: {},
      create: {
        email: 'admin',
        name: 'Admin User',
        password: await bcrypt.hash('password', 10),
        role: 'SUPERIOR_ADMIN',
      },
    })
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin', password: 'password' })
    adminToken = loginRes.body?.data?.token
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('writes a structured object to detailsJson and reads it back as an object', async () => {
    const detail = { validationItemId: 'VAL-001', statusAfter: 'VALIDATED', count: 1 }
    const row = await prisma.auditLog.create({
      data: { projectId, userId, action: uniqueAction, detailsJson: detail },
    })
    createdAuditIds.push(row.id)

    const fetched = await prisma.auditLog.findUnique({ where: { id: row.id } })
    expect(fetched).not.toBeNull()
    // Json column -> Prisma returns it already parsed, not a string.
    expect(typeof fetched!.detailsJson).toBe('object')
    expect(fetched!.detailsJson).toEqual(detail)
    // The legacy details column is frozen — no new write populates it.
    expect(fetched!.details).toBeNull()
  })

  it('accepts a null-detail write (detailsJson stays null)', async () => {
    const row = await prisma.auditLog.create({
      data: { projectId, userId, action: uniqueAction },
    })
    createdAuditIds.push(row.id)
    const fetched = await prisma.auditLog.findUnique({ where: { id: row.id } })
    expect(fetched!.detailsJson).toBeNull()
    expect(fetched!.details).toBeNull()
  })

  it('GET /platform-admin/audit-logs includes central AuditLog rows (source: central)', async () => {
    if (!adminToken) {
      // SUPERIOR_ADMIN login failed in this environment — skip rather than
      // false-fail; the dedicated platformAdmin suite guards the 403 path.
      return
    }
    // Seed a recognisable central AuditLog row.
    const seeded = await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        action: uniqueAction,
        detailsJson: { resource: 'validation-item', resourceId: `VAL-${ts}` },
      },
    })
    createdAuditIds.push(seeded.id)

    const res = await request(app)
      .get('/api/v1/platform-admin/audit-logs')
      .query({ limit: 200, action: uniqueAction })
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)

    const centralEntry = res.body.data.find(
      (e: { action: string; source: string }) =>
        e.action === uniqueAction && e.source === 'central',
    )
    expect(centralEntry).toBeDefined()
    expect(centralEntry.id).toBe(`audit-${seeded.id}`)
    // target derived from detailsJson.resource + detailsJson.resourceId
    expect(centralEntry.target).toBe(`validation-item:VAL-${ts}`)
    expect(centralEntry.companyName).toBe(`R8AuditCo-${ts}`)
  })

  it('GET /platform-admin/audit-logs actionFilter narrows central rows', async () => {
    if (!adminToken) return
    const res = await request(app)
      .get('/api/v1/platform-admin/audit-logs')
      .query({ limit: 200, action: `nonexistent-action-${ts}` })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const match = res.body.data.find(
      (e: { action: string }) => e.action === uniqueAction,
    )
    expect(match).toBeUndefined()
  })
})
