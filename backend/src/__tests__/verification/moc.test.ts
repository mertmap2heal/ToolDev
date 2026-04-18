/**
 * Verification — MoC (Method of Compliance) read-path tests (#133).
 *
 * Covers the system-wide MoC GET endpoints:
 *   GET /moc         — returns active MoCs
 *   GET /moc/:code   — returns single MoC, 400 on non-numeric, 404 on missing
 *
 * The create/update endpoints are intentionally NOT exercised here — they
 * still have a "TODO: Check admin role" comment (see #132). When #132 lands,
 * the PR that adds the admin guard owns the tests that verify the guard.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Verification MoC read endpoints (#133)', () => {
  const stamp = Date.now()
  const seededCode = 900_000 + (stamp % 99_999)
  let userId: string
  let token: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `ver-moc-${stamp}@example.com`, password: 'hashed', name: 'Ver MoC User' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

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
    await prisma.verMoc.delete({ where: { code: seededCode } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /moc returns active MoCs and includes the seeded one', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc')
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.code).toBe(seededCode)
    expect(res.body.data.name).toBe(`MoC ${seededCode}`)
  })

  it('GET /moc/:code returns 400 for a non-numeric code', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc/not-a-number')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid moc code/i)
  })

  it('GET /moc/:code returns 404 for an unknown code', async () => {
    const res = await request(app)
      .get('/api/v1/verification/moc/999999')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /moc returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/verification/moc')
    expect(res.status).toBe(401)
  })
})
