import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { resolveIsAdmin } from '../lib/adminAuth'

describe('GET /auth/users — company scoping (#150)', () => {
  const ts = Date.now()
  let companyAId: string
  let companyBId: string
  let platformAdminId: string
  let tokenA = ''
  let tokenB = ''
  let tokenAdmin = ''

  beforeAll(async () => {
    const hash = await bcrypt.hash('test-auth-users-150', 10)
    const a = await prisma.user.create({
      data: { email: `auth-users-a-${ts}@example.com`, name: 'CompanyA User', password: hash, company: `CompanyA-${ts}`, role: 'USER' },
    })
    const b = await prisma.user.create({
      data: { email: `auth-users-b-${ts}@example.com`, name: 'CompanyB User', password: hash, company: `CompanyB-${ts}`, role: 'USER' },
    })
    const admin = await prisma.user.create({
      data: { email: `auth-users-admin-${ts}@example.com`, name: 'Platform Admin', password: hash, company: `CompanyC-${ts}`, role: 'SUPERIOR_ADMIN' },
    })
    companyAId = a.id
    companyBId = b.id
    platformAdminId = admin.id

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: a.email, password: 'test-auth-users-150' })
    tokenA = loginA.body?.data?.token
    const loginB = await request(app).post('/api/v1/auth/login').send({ email: b.email, password: 'test-auth-users-150' })
    tokenB = loginB.body?.data?.token
    const loginAdmin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'test-auth-users-150' })
    tokenAdmin = loginAdmin.body?.data?.token
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [companyAId, companyBId, platformAdminId] } } }).catch(() => {})
  })

  it('401 without auth', async () => {
    const res = await request(app).get('/api/v1/auth/users')
    expect(res.status).toBe(401)
  })

  it('non-admin only sees users from their own company', async () => {
    const res = await request(app).get('/api/v1/auth/users').set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const emails: string[] = res.body.data.map((u: any) => u.email)
    expect(emails).toContain(`auth-users-a-${ts}@example.com`)
    expect(emails).not.toContain(`auth-users-b-${ts}@example.com`)
    expect(emails).not.toContain(`auth-users-admin-${ts}@example.com`)
  })

  it('platform admin sees all users across companies', async () => {
    const res = await request(app).get('/api/v1/auth/users').set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(200)
    const emails: string[] = res.body.data.map((u: any) => u.email)
    expect(emails).toContain(`auth-users-a-${ts}@example.com`)
    expect(emails).toContain(`auth-users-b-${ts}@example.com`)
    expect(emails).toContain(`auth-users-admin-${ts}@example.com`)
  })

  it('company-B user does not see company-A users (cross-company leak)', async () => {
    const res = await request(app).get('/api/v1/auth/users').set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    const emails: string[] = res.body.data.map((u: any) => u.email)
    expect(emails).toContain(`auth-users-b-${ts}@example.com`)
    expect(emails).not.toContain(`auth-users-a-${ts}@example.com`)
  })
})

describe('resolveIsAdmin (#151)', () => {
  const previousEnv = process.env.ADMIN_EMAILS

  afterAll(() => {
    process.env.ADMIN_EMAILS = previousEnv
  })

  it('returns false for null email', async () => {
    expect(await resolveIsAdmin(null)).toBe(false)
  })

  it('returns true for email in ADMIN_EMAILS list', async () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com,other@example.com'
    expect(await resolveIsAdmin('admin@example.com')).toBe(true)
  })

  it('returns false for email not in ADMIN_EMAILS list', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(await resolveIsAdmin('nobody@example.com')).toBe(false)
  })

  it('is exported from a single module (no duplicate definitions in controllers/middleware)', async () => {
    const root = path.join(__dirname, '..')
    const mw = fs.readFileSync(path.join(root, 'middleware', 'auth.middleware.ts'), 'utf-8')
    const ctrl = fs.readFileSync(path.join(root, 'controllers', 'auth.controller.ts'), 'utf-8')
    expect(mw).not.toMatch(/async function resolveIsAdmin/)
    expect(ctrl).not.toMatch(/async function resolveIsAdmin/)
    expect(mw).toMatch(/from '\.\.\/lib\/adminAuth'/)
    expect(ctrl).toMatch(/from '\.\.\/lib\/adminAuth'/)
  })
})

describe('auth.middleware console.log removal (#146)', () => {
  it('auth.middleware.ts does not contain console.log', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'middleware', 'auth.middleware.ts'),
      'utf-8',
    )
    expect(content).not.toMatch(/console\.log/)
  })
})
