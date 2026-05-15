/**
 * Inventory — Item service integration tests (Batch 7).
 *
 * Routes mounted at /api/v1/inventory/items (see items.routes.ts):
 *   GET    /                              — list items + filter (sku, name, isActive, page, limit)
 *   GET    /:id                           — single item with relations (404 when missing)
 *   GET    /:id/stock                     — stock per location
 *   GET    /:id/ledger                    — inventory ledger entries
 *   POST   /                              — create (400 missing, 400 duplicate sku)
 *   PATCH  /:id                           — update
 *   DELETE /:id                           — delete (rejects when on-hand inventory > 0)
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
describe.skip('Inventory Item service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-it-admin-${stamp}@example.com`
  const userEmail = `inv-it-user-${stamp}@example.com`
  const password = 'inv-it-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string
  let uomId: string
  const createdItemIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'It Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'It User', password: hash },
    })
    userId = user.id

    // Items require a uomId — create one fixture UOM for this suite.
    const uom = await prisma.uom.create({ data: { code: `U_IT_${stamp}`, name: 'Each' } })
    uomId = uom.id

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
    if (createdItemIds.length > 0) {
      await prisma.item.deleteMany({ where: { id: { in: createdItemIds } } }).catch(() => {})
    }
    if (uomId) {
      await prisma.uom.delete({ where: { id: uomId } }).catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/items')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/inventory/items', () => {
    it('creates an item with default trackingPolicy NONE', async () => {
      const sku = `SKU_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku, name: 'Widget', uomId })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.sku).toBe(sku)
      expect(res.body.data.trackingPolicy).toBe('NONE')
      expect(res.body.data.uom?.id).toBe(uomId)
      createdItemIds.push(res.body.data.id)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no sku or uom' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing required fields/i)
    })

    it('returns 400 when creating duplicate sku', async () => {
      const sku = `SKU_DUP_${stamp}`
      const first = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku, name: 'First', uomId })
      expect(first.status).toBe(201)
      createdItemIds.push(first.body.data.id)

      const dup = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sku, name: 'Duplicate', uomId })
      expect(dup.status).toBe(400)
      expect(dup.body.error).toMatch(/already exists/i)
    })
  })

  describe('GET /api/v1/inventory/items (list + filter)', () => {
    it('lists items with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data.items)).toBe(true)
      expect(typeof res.body.data.total).toBe('number')
      expect(res.body.data.page).toBe(1)
      expect(res.body.data.limit).toBe(50)
    })

    it('filters by sku substring (case-insensitive)', async () => {
      const sku = `SKU_FIL_${stamp}`
      const created = await prisma.item.create({
        data: { sku, name: 'Filterable', uomId, trackingPolicy: 'NONE' },
      })
      createdItemIds.push(created.id)

      const res = await request(app)
        .get(`/api/v1/inventory/items?sku=fil_${stamp}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      const ids = (res.body.data.items as Array<{ id: string }>).map((i) => i.id)
      expect(ids).toContain(created.id)
    })
  })

  describe('GET /:id, PATCH /:id, DELETE /:id', () => {
    it('GET single item returns relations', async () => {
      const sku = `SKU_GET_${stamp}`
      const item = await prisma.item.create({
        data: { sku, name: 'GetItem', uomId, trackingPolicy: 'NONE' },
      })
      createdItemIds.push(item.id)
      const res = await request(app)
        .get(`/api/v1/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(item.id)
      expect(res.body.data.uom).toBeDefined()
      expect(Array.isArray(res.body.data.barcodes)).toBe(true)
    })

    it('GET returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })

    it('PATCH updates name + isActive', async () => {
      const sku = `SKU_P_${stamp}`
      const item = await prisma.item.create({
        data: { sku, name: 'Before', uomId, trackingPolicy: 'NONE' },
      })
      createdItemIds.push(item.id)

      const res = await request(app)
        .patch(`/api/v1/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'After', isActive: false })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('After')
      expect(res.body.data.isActive).toBe(false)
    })

    it('DELETE removes item with no on-hand inventory', async () => {
      const sku = `SKU_D_${stamp}`
      const item = await prisma.item.create({
        data: { sku, name: 'DeleteMe', uomId, trackingPolicy: 'NONE' },
      })
      // Don't push onto createdItemIds — delete cleans it up.
      const res = await request(app)
        .delete(`/api/v1/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      const gone = await prisma.item.findUnique({ where: { id: item.id } })
      expect(gone).toBeNull()
    })

    it('DELETE returns 400 for unknown id', async () => {
      const res = await request(app)
        .delete('/api/v1/inventory/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/i)
    })
  })

  describe('GET /:id/stock and /:id/ledger', () => {
    it('GET /:id/stock returns empty array when no balances', async () => {
      const sku = `SKU_S_${stamp}`
      const item = await prisma.item.create({
        data: { sku, name: 'StockItem', uomId, trackingPolicy: 'NONE' },
      })
      createdItemIds.push(item.id)

      const res = await request(app)
        .get(`/api/v1/inventory/items/${item.id}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBe(0)
    })

    it('GET /:id/ledger returns 200 with empty ledger (lot include removed)', async () => {
      const sku = `SKU_L_${stamp}`
      const item = await prisma.item.create({
        data: { sku, name: 'LedgerItem', uomId, trackingPolicy: 'NONE' },
      })
      createdItemIds.push(item.id)

      const res = await request(app)
        .get(`/api/v1/inventory/items/${item.id}/ledger?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
