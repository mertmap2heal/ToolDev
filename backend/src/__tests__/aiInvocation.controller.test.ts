/**
 * Tests for /api/v1/admin/ai/invocations, /export, and /company - admin-only
 * audit trail of every AI/MCP call.
 *
 * SEC-1 (#374): the listing surface was split into a SUPERIOR_ADMIN
 * platform-wide pair (list + export) plus a COMPANY_ADMIN tenant-scoped
 * read. The platform endpoints now reject COMPANY_ADMIN with 403; the
 * /company endpoint admits any admin tier and forces the company filter.
 *
 * Coverage:
 *   - 401 without a token on both surfaces
 *   - 403 for non-admin callers
 *   - 403 for COMPANY_ADMIN on the platform endpoints (post-SEC-1)
 *   - COMPANY_ADMIN A sees only company A rows on /company
 *   - COMPANY_ADMIN B sees only company B rows on /company
 *   - SUPERIOR_ADMIN sees rows across tenants on /list and /export
 *   - 200 NDJSON content-type on /export for SUPERIOR_ADMIN
 *   - Pagination shape preserved
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('AI invocation audit - /api/v1/admin/ai/invocations (SEC-1 tenant scope)', () => {
  const stamp = Date.now()
  const companyA = `aiinv-a-${stamp}`
  const companyB = `aiinv-b-${stamp}`
  let memberId: string
  let companyAdminAId: string
  let companyAdminBId: string
  let superiorId: string
  let tokenMember: string
  let tokenAdminA: string
  let tokenAdminB: string
  let tokenSuperior: string
  let projectAId: string
  let projectBId: string
  const createdInvocationIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: { email: `aiinv-m-${stamp}@example.test`, password: 'x', name: 'Member', company: companyA },
    })
    memberId = member.id
    tokenMember = jwt.sign({ userId: member.id }, secret)

    const adminA = await prisma.user.create({
      data: {
        email: `aiinv-adm-a-${stamp}@example.test`,
        password: 'x',
        name: 'AdminA',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    companyAdminAId = adminA.id
    tokenAdminA = jwt.sign({ userId: adminA.id }, secret)

    const adminB = await prisma.user.create({
      data: {
        email: `aiinv-adm-b-${stamp}@example.test`,
        password: 'x',
        name: 'AdminB',
        role: 'COMPANY_ADMIN',
        company: companyB,
      },
    })
    companyAdminBId = adminB.id
    tokenAdminB = jwt.sign({ userId: adminB.id }, secret)

    const superior = await prisma.user.create({
      data: {
        email: `aiinv-su-${stamp}@example.test`,
        password: 'x',
        name: 'Superior',
        role: 'SUPERIOR_ADMIN',
        company: companyA,
      },
    })
    superiorId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)

    const slugA = `aiinv-pa-${stamp}`
    const slugB = `aiinv-pb-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `AIINV A ${stamp}`, domain: slugA, slug: slugA, userId: companyAdminAId, companyName: companyA },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `AIINV B ${stamp}`, domain: slugB, slug: slugB, userId: companyAdminBId, companyName: companyB },
    })
    projectBId = pB.id

    // Plant one row per project, two tiers in project A so we can test
    // tier filtering.
    const rA1 = await prisma.aiInvocation.create({
      data: {
        projectId: projectAId,
        userId: companyAdminAId,
        toolName: 'rest.ai.draft',
        tier: 'T1',
        inputHash: `hash-a1-${stamp}`,
        success: true,
        durationMs: 12,
      },
    })
    createdInvocationIds.push(rA1.id)
    const rA2 = await prisma.aiInvocation.create({
      data: {
        projectId: projectAId,
        userId: companyAdminAId,
        toolName: 'mcp.list_parameters',
        tier: 'T2',
        inputHash: `hash-a2-${stamp}`,
        success: true,
        durationMs: 7,
      },
    })
    createdInvocationIds.push(rA2.id)
    const rB1 = await prisma.aiInvocation.create({
      data: {
        projectId: projectBId,
        userId: companyAdminBId,
        toolName: 'rest.ai.draft',
        tier: 'T1',
        inputHash: `hash-b1-${stamp}`,
        success: true,
        durationMs: 22,
      },
    })
    createdInvocationIds.push(rB1.id)
  })

  afterAll(async () => {
    // Reverse-dependency cleanup. AuditLog rows are written by the
    // controller as a side effect of every access; remove them first so
    // the project + user delete order succeeds.
    await prisma.auditLog
      .deleteMany({
        where: {
          projectId: { in: [projectAId, projectBId] },
          action: {
            in: [
              'admin:ai-invocations-read',
              'admin:ai-invocations-export',
              'admin:ai-invocations-company-read',
            ],
          },
        },
      })
      .catch(() => {})
    await prisma.aiInvocation
      .deleteMany({ where: { id: { in: createdInvocationIds } } })
      .catch(() => {})
    await prisma.aiInvocation
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberId, companyAdminAId, companyAdminBId, superiorId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // ---- /admin/ai/invocations - platform-wide, SUPERIOR_ADMIN only ----

  it('GET /ai/invocations without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/ai/invocations')
    expect(res.status).toBe(401)
  })

  it('GET /ai/invocations as a non-admin returns 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(403)
  })

  it('GET /ai/invocations as COMPANY_ADMIN of company A returns 403 (SEC-1)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(403)
  })

  it('GET /ai/invocations as SUPERIOR_ADMIN sees rows across all tenants', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(createdInvocationIds))
  })

  it('GET /ai/invocations supports pagination metadata for SUPERIOR_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .query({ page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${tokenSuperior}`)
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(1)
    expect(res.body.pageSize).toBe(1)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.data.length).toBeLessThanOrEqual(1)
  })

  // ---- /admin/ai/invocations/export - platform-wide, SUPERIOR_ADMIN only ----

  it('GET /ai/invocations/export without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/ai/invocations/export')
    expect(res.status).toBe(401)
  })

  it('GET /ai/invocations/export as COMPANY_ADMIN returns 403 (SEC-1)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/export')
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(403)
  })

  it('GET /ai/invocations/export streams NDJSON for SUPERIOR_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/export')
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .buffer(true)
      .parse((rsp, cb) => {
        let body = ''
        rsp.setEncoding('utf8')
        rsp.on('data', (chunk: string) => { body += chunk })
        rsp.on('end', () => cb(null, body as unknown as Buffer))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/x-ndjson/)
    const text = String(res.body || '')
    const lines = text.split('\n').filter((l) => l.trim().length > 0)
    expect(lines.length).toBeGreaterThan(0)
    const rows = lines.map((l) => JSON.parse(l) as { id: string })
    const ids = rows.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(createdInvocationIds))
  })

  // ---- /admin/ai/invocations/company - admin tier, forced tenant filter ----

  it('GET /ai/invocations/company without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/ai/invocations/company')
    expect(res.status).toBe(401)
  })

  it('GET /ai/invocations/company as a non-admin returns 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/company')
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(403)
  })

  it('GET /ai/invocations/company as COMPANY_ADMIN of A sees only company A rows', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/company')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    const data = res.body.data as Array<{ id: string; projectId: string }>
    for (const r of data) expect(r.projectId).not.toBe(projectBId)
    const ids = data.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining([createdInvocationIds[0], createdInvocationIds[1]]))
    expect(ids).not.toContain(createdInvocationIds[2])
  })

  it('GET /ai/invocations/company as COMPANY_ADMIN of B sees only company B rows', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/company')
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    const data = res.body.data as Array<{ id: string; projectId: string }>
    for (const r of data) expect(r.projectId).not.toBe(projectAId)
    const ids = data.map((r) => r.id)
    expect(ids).toContain(createdInvocationIds[2])
    expect(ids).not.toContain(createdInvocationIds[0])
    expect(ids).not.toContain(createdInvocationIds[1])
  })

  it('GET /ai/invocations/company?tier=T2 narrows the COMPANY_ADMIN result set', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/company')
      .query({ tier: 'T2', pageSize: 200 })
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(200)
    const tiers = (res.body.data as Array<{ tier: string }>).map((r) => r.tier)
    for (const t of tiers) expect(t).toBe('T2')
  })

  it('GET /ai/invocations/company as SUPERIOR_ADMIN also scopes to caller company', async () => {
    // SUPERIOR_ADMIN happens to have company === companyA in the fixture.
    // The /company endpoint forces the filter regardless of role, so the
    // superior user only sees company A rows when calling this endpoint.
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/company')
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    const projectIds = (res.body.data as Array<{ projectId: string }>).map((r) => r.projectId)
    for (const pid of projectIds) expect(pid).not.toBe(projectBId)
  })
})
