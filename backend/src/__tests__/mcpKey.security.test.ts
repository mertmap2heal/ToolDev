/**
 * Tests for /api/v1/admin/projects/:projectId/mcp-keys.
 *
 * Routes are admin-only (`requireAdmin`) AND tenant-scoped via
 * `projectIdParam` so a COMPANY_ADMIN of company A cannot mint, list, or
 * revoke MCP keys for a project owned by company B (HIGH-2). Plaintext
 * is returned exactly once on create and never again — the row stores
 * only a hash.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('MCP keys — admin-scoped key management', () => {
  const stamp = Date.now()
  const companyA = `mcp-a-${stamp}`
  const companyB = `mcp-b-${stamp}`
  let memberId: string
  let companyAdminAId: string
  let superiorId: string
  let tokenMember: string
  let tokenCompanyAdminA: string
  let tokenSuperior: string
  let projectAId: string
  let projectBId: string
  let createdKeyId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: { email: `mcp-member-${stamp}@example.test`, password: 'x', name: 'Member', company: companyA },
    })
    memberId = member.id
    tokenMember = jwt.sign({ userId: member.id }, secret)

    const adminA = await prisma.user.create({
      data: {
        email: `mcp-admin-a-${stamp}@example.test`,
        password: 'x',
        name: 'Admin A',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    companyAdminAId = adminA.id
    tokenCompanyAdminA = jwt.sign({ userId: adminA.id }, secret)

    const superior = await prisma.user.create({
      data: {
        email: `mcp-superior-${stamp}@example.test`,
        password: 'x',
        name: 'Superior',
        role: 'SUPERIOR_ADMIN',
        company: companyA,
      },
    })
    superiorId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)

    const slugA = `mcp-pa-${stamp}`
    const slugB = `mcp-pb-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `MCP A ${stamp}`, domain: slugA, slug: slugA, userId: companyAdminAId, companyName: companyA },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `MCP B ${stamp}`, domain: slugB, slug: slugB, userId: superiorId, companyName: companyB },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    await prisma.parameterMcpKey
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberId, companyAdminAId, superiorId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/admin/projects/${projectAId}/mcp-keys`)
    expect(res.status).toBe(401)
  })

  it('GET as a non-admin user returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/projects/${projectAId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(403)
  })

  it('POST creates a key and returns plaintext exactly once (issuer = company admin)', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/projects/${projectAId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
      .send({ name: `key-${stamp}`, scopes: ['read'] })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(typeof res.body.data.plaintext).toBe('string')
    expect(res.body.data.plaintext.length).toBeGreaterThan(20)
    createdKeyId = res.body.data.id

    // Stored row carries only the hash, never the plaintext.
    const row = await prisma.parameterMcpKey.findUnique({ where: { id: createdKeyId } })
    expect(row?.projectId).toBe(projectAId)
    expect(row?.keyHash).toBeDefined()
    expect(row?.keyHash).not.toBe(res.body.data.plaintext)
  })

  it('POST without name + scopes[] returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/projects/${projectAId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
      .send({ name: '' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('GET as the company admin returns the stored keys with no plaintext field', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/projects/${projectAId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(createdKeyId)
    // Listed payload must not leak plaintext or hash.
    const blob = JSON.stringify(res.body.data)
    expect(blob).not.toContain('keyHash')
    expect(blob).not.toContain('plaintext')
  })

  it('Cross-tenant LIST: company A admin gets 403 on a company B project (HIGH-2)', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/projects/${projectBId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
    expect(res.status).toBe(403)
  })

  it('Cross-tenant POST: company A admin gets 403 on a company B project (HIGH-2)', async () => {
    const beforeCount = await prisma.parameterMcpKey.count({ where: { projectId: projectBId } })
    const res = await request(app)
      .post(`/api/v1/admin/projects/${projectBId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
      .send({ name: `pwn-${stamp}`, scopes: ['read'] })
    expect(res.status).toBe(403)
    const afterCount = await prisma.parameterMcpKey.count({ where: { projectId: projectBId } })
    expect(afterCount).toBe(beforeCount)
  })

  it('SUPERIOR_ADMIN can mint a key on any tenant project', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/projects/${projectBId}/mcp-keys`)
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .send({ name: `superior-${stamp}`, scopes: ['read'] })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
  })

  it('DELETE revokes the key and subsequent revoke returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/projects/${projectAId}/mcp-keys/${createdKeyId}`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
    expect(res.status).toBe(200)
    expect(res.body.data.revokedAt).toBeDefined()

    const repeat = await request(app)
      .delete(`/api/v1/admin/projects/${projectAId}/mcp-keys/${createdKeyId}`)
      .set('Authorization', `Bearer ${tokenCompanyAdminA}`)
    expect(repeat.status).toBe(404)
  })
})
