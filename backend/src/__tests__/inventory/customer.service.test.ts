/**
 * Inventory — Customer service integration tests (Batch 7).
 *
 * Routes mounted at /api/v1/inventory/customers (see purchasing.routes.ts):
 *   GET  /                — list active customers
 *   GET  /:id             — single customer (404 when missing)
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
describe.skip('Inventory Customer service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-cust-admin-${stamp}@example.com`
  const userEmail = `inv-cust-user-${stamp}@example.com`
  const password = 'inv-cust-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string
  const createdCustomerIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'Cust Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'Cust User', password: hash },
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
    if (createdCustomerIds.length > 0) {
      await prisma.customer
        .deleteMany({ where: { id: { in: createdCustomerIds } } })
        .catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/customers')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/inventory/customers', () => {
    it('creates a new customer with full address', async () => {
      const code = `CU_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: 'Acme Industries',
          contactName: 'Jane Doe',
          email: 'jane@acme.example.com',
          phone: '+1-555-0100',
          address: '1 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          country: 'USA',
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.code).toBe(code)
      expect(res.body.data.name).toBe('Acme Industries')
      expect(res.body.data.email).toBe('jane@acme.example.com')
      createdCustomerIds.push(res.body.data.id)
    })

    it('returns 400 when code or name missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no code' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('returns 400 when creating duplicate code', async () => {
      const code = `CU_DUP_${stamp}`
      const first = await request(app)
        .post('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'First' })
      expect(first.status).toBe(201)
      createdCustomerIds.push(first.body.data.id)

      const dup = await request(app)
        .post('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code, name: 'Duplicate' })
      expect(dup.status).toBe(400)
      expect(dup.body.error).toMatch(/already exists/i)
    })
  })

  describe('GET /api/v1/inventory/customers', () => {
    it('lists active customers', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/customers')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      const ids: string[] = res.body.data.map((c: { id: string }) => c.id)
      for (const id of createdCustomerIds) {
        expect(ids).toContain(id)
      }
    })
  })

  describe('GET /api/v1/inventory/customers/:id', () => {
    it('returns single customer with empty salesOrders array', async () => {
      const code = `CU_GET_${stamp}`
      const created = await prisma.customer.create({ data: { code, name: 'GetCustomer' } })
      createdCustomerIds.push(created.id)

      const res = await request(app)
        .get(`/api/v1/inventory/customers/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(created.id)
      expect(Array.isArray(res.body.data.salesOrders)).toBe(true)
      expect(res.body.data.salesOrders.length).toBe(0)
    })

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/customers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })
  })
})
