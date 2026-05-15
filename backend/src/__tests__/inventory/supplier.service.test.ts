/**
 * Inventory — Supplier service integration tests (Batch 7).
 *
 * Routes mounted at /api/v1/inventory/suppliers (see purchasing.routes.ts):
 *   GET    /                — list active suppliers
 *   GET    /:id             — single supplier (404 when missing)
 *   POST   /                — create (400 on missing fields, 400 on duplicate code)
 *   PATCH  /:id             — update (404 when missing)
 *   DELETE /:id             — soft delete (sets isActive=false; rejects when active POs)
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
describe.skip('Inventory Supplier service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-sup-admin-${stamp}@example.com`
  const userEmail = `inv-sup-user-${stamp}@example.com`
  const password = 'inv-sup-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string
  const createdSupplierIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'Sup Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'Sup User', password: hash },
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
    if (createdSupplierIds.length > 0) {
      await prisma.supplier
        .deleteMany({ where: { id: { in: createdSupplierIds } } })
        .catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/suppliers')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/inventory/suppliers', () => {
    it('creates a new supplier', async () => {
      const code = `SUP_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: 'Globex',
          contactName: 'John Smith',
          email: 'john@globex.example.com',
          country: 'USA',
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.code).toBe(code)
      expect(res.body.data.name).toBe('Globex')
      createdSupplierIds.push(res.body.data.id)
    })

    it('returns 400 when code or name missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no code' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('returns 400 when creating duplicate code', async () => {
      const code = `SUP_DUP_${stamp}`
      const first = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'First' })
      expect(first.status).toBe(201)
      createdSupplierIds.push(first.body.data.id)

      const dup = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'Duplicate' })
      expect(dup.status).toBe(400)
      expect(dup.body.error).toMatch(/already exists/i)
    })
  })

  describe('GET /api/v1/inventory/suppliers', () => {
    it('lists only active suppliers', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // All returned suppliers must be active
      for (const s of res.body.data as Array<{ isActive: boolean }>) {
        expect(s.isActive).toBe(true)
      }
    })
  })

  describe('GET /:id, PATCH /:id, DELETE /:id', () => {
    it('GET returns single supplier with empty purchaseOrders array', async () => {
      const code = `SUP_GET_${stamp}`
      const s = await prisma.supplier.create({ data: { code, name: 'GetSupplier' } })
      createdSupplierIds.push(s.id)

      const res = await request(app)
        .get(`/api/v1/inventory/suppliers/${s.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(s.id)
      expect(Array.isArray(res.body.data.purchaseOrders)).toBe(true)
    })

    it('GET returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/suppliers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })

    it('PATCH updates supplier fields', async () => {
      const code = `SUP_PATCH_${stamp}`
      const s = await prisma.supplier.create({ data: { code, name: 'Before' } })
      createdSupplierIds.push(s.id)

      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${s.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'After', city: 'Boston' })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('After')
      expect(res.body.data.city).toBe('Boston')
    })

    it('PATCH returns 400 for unknown id', async () => {
      const res = await request(app)
        .patch('/api/v1/inventory/suppliers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('DELETE soft-deletes supplier (isActive=false)', async () => {
      const code = `SUP_DEL_${stamp}`
      const s = await prisma.supplier.create({ data: { code, name: 'DeleteMe' } })
      createdSupplierIds.push(s.id)

      const res = await request(app)
        .delete(`/api/v1/inventory/suppliers/${s.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const after = await prisma.supplier.findUnique({ where: { id: s.id } })
      expect(after?.isActive).toBe(false)
    })

    it('DELETE returns 400 for unknown id', async () => {
      const res = await request(app)
        .delete('/api/v1/inventory/suppliers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })
  })
})
