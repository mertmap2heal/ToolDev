/**
 * Inventory — Warehouse + Location service integration tests (Batch 7).
 *
 * Routes mounted at /api/v1/inventory/warehouses (see warehouses.routes.ts):
 *   GET    /                              — list active warehouses
 *   GET    /:id                           — single warehouse
 *   GET    /:warehouseId/locations        — location tree
 *   POST   /                              — create warehouse
 *   PATCH  /:id                           — update warehouse
 *   DELETE /:id                           — delete warehouse (rejects if locations)
 *   POST   /locations                     — create location
 *   PATCH  /locations/:id                 — update location
 *   DELETE /locations/:id                 — delete location
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
describe.skip('Inventory Warehouse service via HTTP', () => {
  const stamp = Date.now()
  const adminEmail = `inv-wh-admin-${stamp}@example.com`
  const userEmail = `inv-wh-user-${stamp}@example.com`
  const password = 'inv-wh-pw'

  let adminUserId: string
  let userId: string
  let adminToken: string
  let userToken: string
  const createdWarehouseIds: string[] = []
  const createdLocationIds: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'WH Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const user = await prisma.user.create({
      data: { email: userEmail, name: 'WH User', password: hash },
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
    if (createdLocationIds.length > 0) {
      await prisma.location
        .deleteMany({ where: { id: { in: createdLocationIds } } })
        .catch(() => {})
    }
    if (createdWarehouseIds.length > 0) {
      // Cascade will clean up locations on warehouse delete; this catches any
      // orphans plus warehouses that didn't have locations cleaned up above.
      await prisma.location
        .deleteMany({ where: { warehouseId: { in: createdWarehouseIds } } })
        .catch(() => {})
      await prisma.warehouse
        .deleteMany({ where: { id: { in: createdWarehouseIds } } })
        .catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, userId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  describe('auth chain', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/inventory/warehouses')
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST + GET warehouses', () => {
    it('creates a warehouse with default STRICT policy', async () => {
      const code = `WH_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Main DC', code })
      expect(res.status).toBe(201)
      expect(res.body.data.code).toBe(code)
      expect(res.body.data.negativeStockPolicy).toBe('STRICT')
      createdWarehouseIds.push(res.body.data.id)
    })

    it('returns 400 when code or name missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no code' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when creating duplicate code', async () => {
      const code = `WH_DUP_${stamp}`
      const a = await request(app)
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A', code })
      expect(a.status).toBe(201)
      createdWarehouseIds.push(a.body.data.id)

      const b = await request(app)
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'B', code })
      expect(b.status).toBe(400)
      expect(b.body.error).toMatch(/already exists/i)
    })

    it('GET single warehouse returns locations array', async () => {
      const code = `WH_GET_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code, name: 'Get WH' } })
      createdWarehouseIds.push(wh.id)
      const res = await request(app)
        .get(`/api/v1/inventory/warehouses/${wh.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(wh.id)
      expect(Array.isArray(res.body.data.locations)).toBe(true)
    })

    it('GET single warehouse returns 404 for unknown id', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/warehouses/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /:id', () => {
    it('updates warehouse city', async () => {
      const code = `WH_PATCH_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code, name: 'BeforePatch' } })
      createdWarehouseIds.push(wh.id)

      const res = await request(app)
        .patch(`/api/v1/inventory/warehouses/${wh.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ city: 'Chicago', state: 'IL' })
      expect(res.status).toBe(200)
      expect(res.body.data.city).toBe('Chicago')
    })
  })

  describe('Locations CRUD', () => {
    it('creates a location under a warehouse', async () => {
      const whCode = `WH_LOC_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'Loc Host' } })
      createdWarehouseIds.push(wh.id)

      const code = `LOC_${stamp}`
      const res = await request(app)
        .post('/api/v1/inventory/warehouses/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: wh.id, code, name: 'Bin A', locationType: 'BIN' })
      expect(res.status).toBe(201)
      expect(res.body.data.code).toBe(code)
      expect(res.body.data.warehouseId).toBe(wh.id)
      createdLocationIds.push(res.body.data.id)
    })

    it('returns 400 when warehouseId or code missing', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/warehouses/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'no warehouseId' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when creating duplicate (warehouseId,code)', async () => {
      const whCode = `WH_LOC_DUP_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'Dup Host' } })
      createdWarehouseIds.push(wh.id)

      const code = `LOC_DUP_${stamp}`
      const first = await request(app)
        .post('/api/v1/inventory/warehouses/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: wh.id, code, name: 'First' })
      expect(first.status).toBe(201)
      createdLocationIds.push(first.body.data.id)

      const dup = await request(app)
        .post('/api/v1/inventory/warehouses/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: wh.id, code, name: 'Second' })
      expect(dup.status).toBe(400)
      expect(dup.body.error).toMatch(/already exists/i)
    })

    it('GET location tree returns hierarchical structure', async () => {
      const whCode = `WH_TREE_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'Tree Host' } })
      createdWarehouseIds.push(wh.id)

      const root = await prisma.location.create({
        data: { warehouseId: wh.id, code: `R_${stamp}`, name: 'Root', locationType: 'ZONE' },
      })
      createdLocationIds.push(root.id)
      const child = await prisma.location.create({
        data: {
          warehouseId: wh.id,
          code: `C_${stamp}`,
          name: 'Child',
          parentLocationId: root.id,
          locationType: 'BIN',
        },
      })
      createdLocationIds.push(child.id)

      const res = await request(app)
        .get(`/api/v1/inventory/warehouses/${wh.id}/locations`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      const rootNode = (res.body.data as Array<{ id: string; children: unknown[] }>).find(
        (n) => n.id === root.id,
      )
      expect(rootNode).toBeDefined()
      expect(Array.isArray(rootNode?.children)).toBe(true)
      expect(rootNode?.children.length).toBe(1)
    })

    it('PATCH updates location name', async () => {
      const whCode = `WH_PL_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'PL Host' } })
      createdWarehouseIds.push(wh.id)
      const loc = await prisma.location.create({
        data: { warehouseId: wh.id, code: `PL_${stamp}`, name: 'Old' },
      })
      createdLocationIds.push(loc.id)

      const res = await request(app)
        .patch(`/api/v1/inventory/warehouses/locations/${loc.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'NewName', pickingPriority: 5 })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('NewName')
      expect(res.body.data.pickingPriority).toBe(5)
    })

    it('DELETE removes a leaf location', async () => {
      const whCode = `WH_DL_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'DL Host' } })
      createdWarehouseIds.push(wh.id)
      const loc = await prisma.location.create({
        data: { warehouseId: wh.id, code: `DL_${stamp}`, name: 'Leaf' },
      })
      createdLocationIds.push(loc.id)

      const res = await request(app)
        .delete(`/api/v1/inventory/warehouses/locations/${loc.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      const gone = await prisma.location.findUnique({ where: { id: loc.id } })
      expect(gone).toBeNull()
    })
  })

  describe('DELETE warehouse with children', () => {
    it('returns 400 when warehouse has locations', async () => {
      const whCode = `WH_BLOCK_${stamp}`
      const wh = await prisma.warehouse.create({ data: { code: whCode, name: 'Has Locs' } })
      createdWarehouseIds.push(wh.id)
      const loc = await prisma.location.create({
        data: { warehouseId: wh.id, code: `LB_${stamp}`, name: 'Block' },
      })
      createdLocationIds.push(loc.id)

      const res = await request(app)
        .delete(`/api/v1/inventory/warehouses/${wh.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/has \d+ locations/i)
    })
  })
})
