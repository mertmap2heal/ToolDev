/**
 * Inventory — Purchase Order + Goods Receipt service integration tests (Batch 10).
 *
 * Routes mounted at /api/v1/inventory (purchasing.routes.ts):
 *   GET    /purchase-orders               — list (filter by supplier, status)
 *   GET    /purchase-orders/:id           — single (404 when missing)
 *   POST   /purchase-orders               — create (400 missing fields)
 *   POST   /purchase-orders/:id/approve   — Draft -> Approved (400 wrong status)
 *   GET    /receipts                      — list (filter by PO id, status)
 *   GET    /receipts/:id                  — single (404 when missing)
 *   POST   /receipts                      — create (400 missing fields)
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
describe.skip('Inventory Purchase service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-po-admin-${stamp}@example.com`
  const userEmail = `inv-po-user-${stamp}@example.com`
  const password = 'inv-po-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string

  // Fixtures
  let supplierId: string
  let warehouseId: string
  let locationId: string
  let uomId: string
  let itemId: string

  const createdPoIds: string[] = []
  const createdReceiptIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'PO Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'PO User', password: hash },
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

    const supplier = await prisma.supplier.create({
      data: { code: `SUP_PO_${stamp}`, name: 'PO Supplier' },
    })
    supplierId = supplier.id

    const warehouse = await prisma.warehouse.create({
      data: { code: `WH_PO_${stamp}`, name: 'PO Warehouse' },
    })
    warehouseId = warehouse.id

    const location = await prisma.location.create({
      data: { warehouseId, code: `LOC_PO_${stamp}`, name: 'PO Loc', locationType: 'BIN' },
    })
    locationId = location.id

    const uom = await prisma.uom.create({
      data: { code: `UOM_PO_${stamp}`, name: 'Each' },
    })
    uomId = uom.id

    const item = await prisma.item.create({
      data: { sku: `SKU_PO_${stamp}`, name: 'PO Test Item', uomId },
    })
    itemId = item.id
  })

  afterAll(async () => {
    if (createdReceiptIds.length > 0) {
      await prisma.goodsReceiptLine
        .deleteMany({ where: { goodsReceiptId: { in: createdReceiptIds } } })
        .catch(() => {})
      await prisma.goodsReceipt
        .deleteMany({ where: { id: { in: createdReceiptIds } } })
        .catch(() => {})
    }
    if (createdPoIds.length > 0) {
      await prisma.purchaseOrderLine
        .deleteMany({ where: { purchaseOrderId: { in: createdPoIds } } })
        .catch(() => {})
      await prisma.purchaseOrder
        .deleteMany({ where: { id: { in: createdPoIds } } })
        .catch(() => {})
    }
    await prisma.item.deleteMany({ where: { id: itemId } }).catch(() => {})
    await prisma.uom.deleteMany({ where: { id: uomId } }).catch(() => {})
    await prisma.location.deleteMany({ where: { id: locationId } }).catch(() => {})
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } }).catch(() => {})
    await prisma.supplier.deleteMany({ where: { id: supplierId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token on /purchase-orders', async () => {
      const res = await request(app).get('/api/v1/inventory/purchase-orders')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/purchase-orders')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/inventory/purchase-orders', () => {
    it('creates a purchase order with one line', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId,
          notes: 'created in test',
          lines: [
            {
              itemId,
              qtyOrdered: 5,
              unitPrice: 12.5,
              uomId,
              locationId,
            },
          ],
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('Draft')
      expect(res.body.data.supplierId).toBe(supplierId)
      expect(res.body.data.lines.length).toBe(1)
      expect(Number(res.body.data.lines[0].qtyOrdered)).toBe(5)
      createdPoIds.push(res.body.data.id)
    })

    it('returns 400 when lines missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierId, lines: [] })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('returns 400 when supplierId missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lines: [{ itemId, qtyOrdered: 1, unitPrice: 1, uomId, locationId }] })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/inventory/purchase-orders', () => {
    it('lists purchase orders with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/purchase-orders?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ page: 1, limit: 5 })
      expect(Array.isArray(res.body.data.orders)).toBe(true)
      expect(typeof res.body.data.totalPages).toBe('number')
    })

    it('filters by supplierId', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/purchase-orders?supplierId=${supplierId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      for (const o of res.body.data.orders) {
        expect(o.supplierId).toBe(supplierId)
      }
    })
  })

  describe('GET /api/v1/inventory/purchase-orders/:id', () => {
    it('returns single PO', async () => {
      expect(createdPoIds.length).toBeGreaterThan(0)
      const res = await request(app)
        .get(`/api/v1/inventory/purchase-orders/${createdPoIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(createdPoIds[0])
      expect(Array.isArray(res.body.data.lines)).toBe(true)
    })

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/purchase-orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/inventory/purchase-orders/:id/approve', () => {
    it('approves a Draft PO', async () => {
      // create a fresh PO so we don't move state of one being inspected
      const create = await request(app)
        .post('/api/v1/inventory/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId,
          lines: [{ itemId, qtyOrdered: 2, unitPrice: 1, uomId, locationId }],
        })
      const poId = create.body.data.id
      createdPoIds.push(poId)

      const res = await request(app)
        .post(`/api/v1/inventory/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('Approved')

      // approving again should now fail (not in Draft)
      const second = await request(app)
        .post(`/api/v1/inventory/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(second.status).toBe(400)
      expect(second.body.error).toMatch(/not in Draft/i)
    })

    it('returns 400 for unknown PO id', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/purchase-orders/00000000-0000-0000-0000-000000000000/approve')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })
  })

  describe('Goods receipts', () => {
    it('returns 400 when receipt has no lines', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lines: [] })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('list endpoint returns paginated shape', async () => {
      const list = await request(app)
        .get('/api/v1/inventory/receipts?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(list.status).toBe(200)
      expect(Array.isArray(list.body.data.receipts)).toBe(true)
      expect(list.body.data).toMatchObject({ page: 1, limit: 5 })
    })

    it('returns 404 for unknown receipt id (lot include removed)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/receipts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })
  })
})
