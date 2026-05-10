/**
 * Tests for /api/v1/admin/ai/invocations and /export — admin-only audit
 * trail of every AI/MCP call.
 *
 * Coverage:
 *   - 401 without a token
 *   - 403 for non-admin callers
 *   - happy-path list with pagination + tier filter
 *   - HIGH-3 tenant scoping: COMPANY_ADMIN of company A cannot see
 *     company B rows, even with an explicit projectId query
 *   - SUPERIOR_ADMIN sees rows across tenants
 *   - NDJSON export streams the same scoped rows
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('AI invocation audit — /api/v1/admin/ai/invocations', () => {
  const stamp = Date.now()
  const companyA = `aiinv-a-${stamp}`
  const companyB = `aiinv-b-${stamp}`
  let memberId: string
  let companyAdminAId: string
  let superiorId: string
  let tokenMember: string
  let tokenAdminA: string
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
        email: `aiinv-adm-${stamp}@example.test`,
        password: 'x',
        name: 'AdminA',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    companyAdminAId = adminA.id
    tokenAdminA = jwt.sign({ userId: adminA.id }, secret)

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
      data: { name: `AIINV B ${stamp}`, domain: slugB, slug: slugB, userId: superiorId, companyName: companyB },
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
        userId: superiorId,
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
    await prisma.aiInvocation
      .deleteMany({ where: { id: { in: createdInvocationIds } } })
      .catch(() => {})
    await prisma.aiInvocation
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberId, companyAdminAId, superiorId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

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

  it('GET /ai/invocations as company A admin sees company A rows only (HIGH-3)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    const projectIds = (res.body.data as Array<{ projectId: string }>).map((r) => r.projectId)
    for (const pid of projectIds) {
      expect(pid).not.toBe(projectBId)
    }
    // The two seeded company-A rows should be present (assuming page 1
    // is large enough).
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining([createdInvocationIds[0], createdInvocationIds[1]]))
  })

  it('GET /ai/invocations?tier=T2 narrows the result set', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .query({ tier: 'T2', pageSize: 200 })
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(200)
    const tiers = (res.body.data as Array<{ tier: string }>).map((r) => r.tier)
    for (const t of tiers) expect(t).toBe('T2')
  })

  it('GET /ai/invocations?projectId=<companyB> as company A admin returns 403 (HIGH-3)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .query({ projectId: projectBId })
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(403)
  })

  it('GET /ai/invocations as SUPERIOR_ADMIN sees rows across all tenants', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .query({ pageSize: 200 })
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(createdInvocationIds))
  })

  it('GET /ai/invocations supports pagination metadata', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations')
      .query({ page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(1)
    expect(res.body.pageSize).toBe(1)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.data.length).toBeLessThanOrEqual(1)
  })

  it('GET /ai/invocations/export streams NDJSON with only the caller-tenant rows (HIGH-3)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/invocations/export')
      .set('Authorization', `Bearer ${tokenAdminA}`)
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
    const rows = lines.map((l) => JSON.parse(l) as { projectId: string })
    for (const r of rows) expect(r.projectId).not.toBe(projectBId)
  })

  it('GET /ai/invocations/export without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/ai/invocations/export')
    expect(res.status).toBe(401)
  })
})
