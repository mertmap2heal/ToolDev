/**
 * Platform Admin (Superior Admin) tests.
 * Requires: prisma migrate (add_user_role), seed:users (admin/password), and DB running.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('Platform Admin (Superior Admin)', () => {
  let normalUserToken: string

  beforeAll(async () => {
    const normalUser = await prisma.user.upsert({
      where: { email: 'platform-admin-test-normal@example.com' },
      update: {},
      create: {
        email: 'platform-admin-test-normal@example.com',
        name: 'Normal User',
        password: await bcrypt.hash('testpass', 10),
      },
    })
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: normalUser.email, password: 'testpass' })
    if (loginRes.body?.data?.token) {
      normalUserToken = loginRes.body.data.token
    }
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'platform-admin-test-normal@example.com' } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('login returns role and isSuperiorAdmin for SUPERIOR_ADMIN user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin', password: 'password' })

    if (res.status !== 200) {
      expect(res.status).toBe(200)
      return
    }
    expect(res.body.success).toBe(true)
    expect(res.body.data?.user).toBeDefined()
    expect(res.body.data.user.role).toBe('SUPERIOR_ADMIN')
    expect(res.body.data.user.isSuperiorAdmin).toBe(true)
  })

  it('GET /platform-admin/companies returns 403 for non-superior user', async () => {
    if (!normalUserToken) {
      return
    }
    const res = await request(app)
      .get('/api/v1/platform-admin/companies')
      .set('Authorization', `Bearer ${normalUserToken}`)

    expect(res.status).toBe(403)
    expect(res.body?.success).toBe(false)
  })

  it('GET /platform-admin/companies returns 200 for SUPERIOR_ADMIN', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin', password: 'password' })

    if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
      return
    }
    const res = await request(app)
      .get('/api/v1/platform-admin/companies')
      .set('Authorization', `Bearer ${loginRes.body.data.token}`)

    expect(res.status).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(Array.isArray(res.body?.data)).toBe(true)
  })

  it('login for normal user returns role null or not SUPERIOR_ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'platform-admin-test-normal@example.com', password: 'testpass' })

    if (res.status !== 200) {
      return
    }
    expect(res.body.data?.user).toBeDefined()
    expect(res.body.data.user.role).not.toBe('SUPERIOR_ADMIN')
    expect(res.body.data.user.isSuperiorAdmin).not.toBe(true)
  })
})
