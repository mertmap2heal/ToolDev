/**
 * Inventory — UOM service integration tests (Batch 7).
 *
 * Routes mounted at /api/v1/inventory/uoms (see backend/src/routes/uoms.routes.ts):
 *   GET  /                — list all UOMs
 *   GET  /:id             — single UOM (404 when missing)
 *   POST /                — create (400 on missing fields, 400 on duplicate code)
 *
 * Auth chain: authenticateToken -> requireAdmin (SUPERIOR_ADMIN role).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

// SUNSET (#384): the Inventory module is unmounted from the product surface.
// The /api/v1/inventory/* routes are no longer registered in routes/index.ts,
// so these HTTP tests would 404. The route files / controllers / services and
// the 33 Prisma models are kept on disk pending the CM LotTraceability rework.
// Skipped rather than deleted so this suite revives if the routes are remounted.
describe.skip('Inventory UOM service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-uom-admin-${stamp}@example.com`
  const userEmail = `inv-uom-user-${stamp}@example.com`
  const password = 'inv-uom-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string
  const createdUomIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'UOM Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'UOM User', password: hash },
    })
    userId = user.id

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
    expect(adminLogin.status).toBe(200)
    adminToken = adminLogin.body?.data?.token
    expect(adminToken).toBeTruthy()

    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password })
    expect(userLogin.status).toBe(200)
    userToken = userLogin.body?.data?.token
  })

  afterAll(async () => {
    if (createdUomIds.length > 0) {
      await prisma.uom.deleteMany({ where: { id: { in: createdUomIds } } }).catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/uoms')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/inventory/uoms', () => {
    it('creates a new UOM', async () => {
      const code = `UM_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'Each', description: 'Single piece' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.code).toBe(code)
      expect(res.body.data.name).toBe('Each')
      createdUomIds.push(res.body.data.id)
    })

    it('returns 400 when code or name missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no code' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('returns 400 when creating duplicate code', async () => {
      const code = `UM_DUP_${stamp}`
      const first = await request(app)
        .post('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'Original' })
      expect(first.status).toBe(201)
      createdUomIds.push(first.body.data.id)

      const dup = await request(app)
        .post('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'Duplicate' })
      expect(dup.status).toBe(400)
      expect(dup.body.error).toMatch(/already exists/i)
    })
  })

  describe('GET /api/v1/inventory/uoms', () => {
    it('lists UOMs ordered by code', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/uoms')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // Newly-created UOMs should appear in the list
      const ids: string[] = res.body.data.map((u: { id: string }) => u.id)
      for (const id of createdUomIds) {
        expect(ids).toContain(id)
      }
    })
  })

  describe('GET /api/v1/inventory/uoms/:id', () => {
    it('returns single UOM by id', async () => {
      const code = `UM_GET_${stamp}`
      const created = await prisma.uom.create({ data: { code, name: 'GetMe' } })
      createdUomIds.push(created.id)

      const res = await request(app)
        .get(`/api/v1/inventory/uoms/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(created.id)
      expect(res.body.data.code).toBe(code)
    })

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/uoms/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })
  })
})
