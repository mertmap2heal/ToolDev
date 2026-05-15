/**
 * Inventory — Sales (customer + sales order + shipment) integration tests (Batch 10).
 *
 * Routes mounted at /api/v1/inventory (sales.routes.ts):
 *   GET    /customers, /customers/:id, POST/PATCH/DELETE
 *   GET    /sales-orders, /sales-orders/:id, POST, /:id/approve, /:id/allocate
 *   GET    /shipments, /shipments/:id, POST, /:id/post
 *
 * Auth chain: authenticateToken -> requireAdmin (SUPERIOR_ADMIN role).
 *
 * NOTE: We deliberately do not exercise /allocate or /post (which mutate inventory
 * balances + ledger). They depend on inventoryService and warehouse seed data that
 * lives outside this batch's scope. Validation paths (wrong status, missing PK)
 * are still covered.
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
describe.skip('Inventory Sales service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-so-admin-${stamp}@example.com`
  const userEmail = `inv-so-user-${stamp}@example.com`
  const password = 'inv-so-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string

  let customerId: string
  let secondCustomerId: string
  let uomId: string
  let itemId: string

  const createdCustomerIds: string[] = []
  const createdSoIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'SO Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'SO User', password: hash },
    })
    userId = user.id

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
    adminToken = adminLogin.body?.data?.token
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password })
    userToken = userLogin.body?.data?.token

    const customer = await prisma.customer.create({
      data: { code: `CU_SO_${stamp}`, name: 'SO Customer A' },
    })
    customerId = customer.id
    createdCustomerIds.push(customerId)
    const customer2 = await prisma.customer.create({
      data: { code: `CU_SO_${stamp}_B`, name: 'SO Customer B' },
    })
    secondCustomerId = customer2.id
    createdCustomerIds.push(secondCustomerId)

    const uom = await prisma.uom.create({ data: { code: `UOM_SO_${stamp}`, name: 'Each' } })
    uomId = uom.id
    const item = await prisma.item.create({
      data: { sku: `SKU_SO_${stamp}`, name: 'SO Item', uomId },
    })
    itemId = item.id
  })

  afterAll(async () => {
    if (createdSoIds.length > 0) {
      await prisma.salesOrderLine
        .deleteMany({ where: { salesOrderId: { in: createdSoIds } } })
        .catch(() => {})
      await prisma.salesOrder.deleteMany({ where: { id: { in: createdSoIds } } }).catch(() => {})
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customer
        .deleteMany({ where: { id: { in: createdCustomerIds } } })
        .catch(() => {})
    }
    await prisma.item.deleteMany({ where: { id: itemId } }).catch(() => {})
    await prisma.uom.deleteMany({ where: { id: uomId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/sales-orders')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('Customers (PATCH + DELETE)', () => {
    it('PATCH updates customer fields and returns 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contactName: 'Updated Contact', city: 'Berlin' })
      expect(res.status).toBe(200)
      expect(res.body.data.contactName).toBe('Updated Contact')
      expect(res.body.data.city).toBe('Berlin')
    })

    it('PATCH returns 400 for unknown id', async () => {
      const res = await request(app)
        .patch('/api/v1/inventory/customers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contactName: 'Nope' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('DELETE soft-deletes (sets isActive=false)', async () => {
      const target = await prisma.customer.create({
        data: { code: `CU_DEL_${stamp}`, name: 'To Delete' },
      })
      createdCustomerIds.push(target.id)

      const res = await request(app)
        .delete(`/api/v1/inventory/customers/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)

      const reread = await prisma.customer.findUnique({ where: { id: target.id } })
      expect(reread?.isActive).toBe(false)
    })
  })

  describe('Sales orders', () => {
    it('POST creates a sales order with lines', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId,
          notes: 'SO test',
          lines: [{ itemId, qtyOrdered: 4, unitPrice: 9.99, uomId }],
        })
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('Draft')
      expect(res.body.data.customerId).toBe(customerId)
      expect(res.body.data.lines.length).toBe(1)
      expect(Number(res.body.data.lines[0].qtyAllocated)).toBe(0)
      createdSoIds.push(res.body.data.id)
    })

    it('POST returns 400 when customerId missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lines: [{ itemId, qtyOrdered: 1, unitPrice: 1, uomId }] })
      expect(res.status).toBe(400)
    })

    it('POST returns 400 when lines empty', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerId, lines: [] })
      expect(res.status).toBe(400)
    })

    it('GET list filters by customerId', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/sales-orders?customerId=${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      for (const so of res.body.data.orders) {
        expect(so.customerId).toBe(customerId)
      }
    })

    it('GET single returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/sales-orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })

    it('approve transitions Draft -> Approved and rejects re-approval', async () => {
      const create = await request(app)
        .post('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: secondCustomerId,
          lines: [{ itemId, qtyOrdered: 1, unitPrice: 1, uomId }],
        })
      const soId = create.body.data.id
      createdSoIds.push(soId)

      const ok = await request(app)
        .post(`/api/v1/inventory/sales-orders/${soId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(ok.status).toBe(200)
      expect(ok.body.data.status).toBe('Approved')

      const again = await request(app)
        .post(`/api/v1/inventory/sales-orders/${soId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(again.status).toBe(400)
      expect(again.body.error).toMatch(/not in Draft/i)
    })

    it('approve returns 400 for unknown id', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/sales-orders/00000000-0000-0000-0000-000000000000/approve')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('allocate rejects a Draft (must be Approved first)', async () => {
      // Create + DO NOT approve, then try to allocate. Service throws 'must be Approved'.
      const create = await request(app)
        .post('/api/v1/inventory/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId,
          lines: [{ itemId, qtyOrdered: 1, unitPrice: 1, uomId }],
        })
      const soId = create.body.data.id
      createdSoIds.push(soId)

      const res = await request(app)
        .post(`/api/v1/inventory/sales-orders/${soId}/allocate`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Approved/i)
    })
  })

  describe('Shipments — list/get only', () => {
    it('GET shipments list returns paginated shape', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/shipments?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ page: 1, limit: 5 })
      expect(Array.isArray(res.body.data.shipments)).toBe(true)
    })

    it('GET single returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/shipments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })

    it('POST returns 400 when salesOrderId missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/shipments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lines: [] })
      expect(res.status).toBe(400)
    })
  })
})
