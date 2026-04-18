/**
 * Regression tests for #165 — inventory module had no user/company scoping.
 *
 * Before the fix, every authenticated user could read and mutate inventory
 * (items, warehouses, purchase orders, sales orders, suppliers, customers,
 * UOMs) across all companies. The schema has no company field on these
 * entities, so proper multi-tenant scoping needs a migration. Until that
 * lands, the module is gated behind requireAdmin so only platform/company
 * admins can access it — the module is also not shipped in any subscription
 * tier (see frontend/src/config/packages/*.json).
 *
 * This suite asserts a plain user gets 403 on every representative endpoint
 * while an admin does not. It is intentionally light on positive side
 * effects (no record creation) because the stop-gap is about denying
 * non-admins, not validating the inventory controllers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Inventory module admin gate (#165)', () => {
  const stamp = Date.now()
  const adminEmail = `inv-admin-${stamp}@example.com`
  const normalEmail = `inv-normal-${stamp}@example.com`
  const password = 'inv-gate-pw'

  let adminUserId: string
  let normalUserId: string
  let adminToken: string
  let normalToken: string

  const endpoints: Array<{ name: string; method: 'get' | 'post'; url: string }> = [
    { name: 'GET /inventory/items', method: 'get', url: '/api/v1/inventory/items' },
    { name: 'GET /inventory/warehouses', method: 'get', url: '/api/v1/inventory/warehouses' },
    { name: 'GET /inventory/suppliers', method: 'get', url: '/api/v1/inventory/suppliers' },
    { name: 'GET /inventory/purchase-orders', method: 'get', url: '/api/v1/inventory/purchase-orders' },
    { name: 'GET /inventory/receipts', method: 'get', url: '/api/v1/inventory/receipts' },
    { name: 'GET /inventory/customers', method: 'get', url: '/api/v1/inventory/customers' },
    { name: 'GET /inventory/sales-orders', method: 'get', url: '/api/v1/inventory/sales-orders' },
    { name: 'GET /inventory/shipments', method: 'get', url: '/api/v1/inventory/shipments' },
    { name: 'GET /inventory/uoms', method: 'get', url: '/api/v1/inventory/uoms' },
  ]

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'Inventory Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    const normal = await prisma.user.create({
      data: { email: normalEmail, name: 'Inventory User', password: hash },
    })
    normalUserId = normal.id

    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password })
    expect(adminLogin.status).toBe(200)
    adminToken = adminLogin.body?.data?.token
    expect(adminToken).toBeTruthy()

    const normalLogin = await request(app).post('/api/v1/auth/login').send({ email: normalEmail, password })
    expect(normalLogin.status).toBe(200)
    normalToken = normalLogin.body?.data?.token
    expect(normalToken).toBeTruthy()
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, normalUserId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('non-admin blocked with 403', () => {
    for (const ep of endpoints) {
      it(`${ep.name} returns 403 for a plain user`, async () => {
        const res = await request(app)[ep.method](ep.url).set('Authorization', `Bearer ${normalToken}`)
        expect(res.status).toBe(403)
      })
    }
  })

  describe('admin passes the gate', () => {
    for (const ep of endpoints) {
      it(`${ep.name} does not return 403/401 for admin`, async () => {
        const res = await request(app)[ep.method](ep.url).set('Authorization', `Bearer ${adminToken}`)
        expect(res.status).not.toBe(403)
        expect(res.status).not.toBe(401)
      })
    }
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/inventory/items')
    expect(res.status).toBe(401)
  })
})
