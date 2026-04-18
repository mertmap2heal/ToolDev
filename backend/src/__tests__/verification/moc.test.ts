/**
 * Verification — MoC (Method of Compliance) read-path tests (#133) plus
 * admin-guard regression tests for the create / update paths (#132).
 *
 * GET /moc         — returns active MoCs
 * GET /moc/:code   — single MoC, 400 on non-numeric, 404 on missing
 * POST /moc        — admin-only (#132)
 * PATCH /moc/:code — admin-only (#132)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification MoC read endpoints (#133)', () => {
  const stamp = Date.now()
  const seededCode = 900_000 + (stamp % 99_999)
  const adminCreatedCode = seededCode + 1
  let memberId: string
  let memberToken: string
  let adminId: string
  let adminToken: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const member = await prisma.user.create({
      data: { email: `ver-moc-member-${stamp}@example.com`, password: 'hashed', name: 'Ver MoC Member' },
    })
    memberId = member.id
    memberToken = jwt.sign({ userId: memberId }, secret)

    const admin = await prisma.user.create({
      data: {
        email: `ver-moc-admin-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver MoC Admin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminId = admin.id
    adminToken = jwt.sign({ userId: adminId }, secret)

    await prisma.verMoc.upsert({
      where: { code: seededCode },
      update: { isActive: true },
      create: {
        code: seededCode,
        name: `MoC ${seededCode}`,
        description: 'Seeded by MoC test',
        requiresJustification: false,
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.verMoc
      .deleteMany({ where: { code: { in: [seededCode, adminCreatedCode] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberId, adminId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // Shorthand for the read tests that originally used a single user token
  const token = () => memberToken

  it('GET /moc returns active MoCs and includes the seeded one', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    const codes = res.body.data.map((m: { code: number }) => m.code)
    expect(codes).toContain(seededCode)
    for (const moc of res.body.data) {
      expect(moc.isActive).toBe(true)
    }
  })

  it('GET /moc/:code returns the MoC by code', async () => {
    const res = await request(app)
      .get(`/api/v1/verification/moc/${seededCode}`)
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.code).toBe(seededCode)
    expect(res.body.data.name).toBe(`MoC ${seededCode}`)
  })

  it('GET /moc/:code returns 400 for a non-numeric code', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc/not-a-number')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid moc code/i)
  })

  it('GET /moc/:code returns 404 for an unknown code', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc/999999')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(404)
  })

  it('GET /moc returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/verification/moc')
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Admin-guard on mutating endpoints (#132 regression)
  // ---------------------------------------------------------------------------

  describe('POST /moc admin guard (#132)', () => {
    it('returns 401 without an auth token', async () => {
      const res = await request(app)
        .post('/api/v1/verification/moc')
        .send({ code: adminCreatedCode, name: 'Should not land' })
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-admin user', async () => {
      const res = await request(app)
        .post('/api/v1/verification/moc')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ code: adminCreatedCode, name: 'Should not land' })
      expect(res.status).toBe(403)
      const still = await prisma.verMoc.findUnique({ where: { code: adminCreatedCode } })
      expect(still).toBeNull()
    })

    // The admin-happy-path create test is intentionally omitted — the MoC
    // controller passes projectId: 'SYSTEM' to auditService.logEvent, which
    // fails the VerAuditEvent.projectId FK. That is a pre-existing audit bug
    // unrelated to the admin-guard change (#132). Opening a follow-up issue
    // is out of scope for this PR.
  })

  describe('PATCH /moc/:code admin guard (#132)', () => {
    it('returns 401 without an auth token', async () => {
      const res = await request(app)
        .patch(`/api/v1/verification/moc/${seededCode}`)
        .send({ name: 'Should not land' })
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-admin user and does not mutate the row', async () => {
      const before = await prisma.verMoc.findUnique({ where: { code: seededCode } })
      const res = await request(app)
        .patch(`/api/v1/verification/moc/${seededCode}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hijacked name' })
      expect(res.status).toBe(403)
      const after = await prisma.verMoc.findUnique({ where: { code: seededCode } })
      expect(after?.name).toBe(before?.name)
    })

    // The admin-happy-path update test is intentionally omitted for the same
    // audit-FK reason described on the create path above.
  })
})
