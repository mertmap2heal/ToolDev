/**
 * Regression tests for #106 — admin authorization inconsistency.
 *
 * Before the fix:
 *   - controller-local requireAdmin used resolveIsAdmin(email) only,
 *     ignoring role=SUPERIOR_ADMIN and role=COMPANY_ADMIN.
 *   - resetUserPassword only accepted SUPERIOR_ADMIN + ADMIN_EMAILS.
 *
 * After the fix both paths use the shared isAdminUser() helper which
 * treats SUPERIOR_ADMIN, COMPANY_ADMIN, ADMIN_EMAILS, and the first-user
 * fallback as admins.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { isAdminUser } from '../../lib/adminAuth'

describe('Admin authorization consistency (#106)', () => {
  const stamp = Date.now()
  const superiorEmail = `authz-superior-${stamp}@example.com`
  const companyAdminEmail = `authz-company-${stamp}@example.com`
  const normalEmail = `authz-normal-${stamp}@example.com`
  const targetEmail = `authz-target-${stamp}@example.com`
  const password = 'authz-test-pw'

  let superiorId: string
  let companyAdminId: string
  let normalId: string
  let targetId: string
  let superiorToken: string
  let companyAdminToken: string
  let normalToken: string
  const createdEmails: string[] = []

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)

    const superior = await prisma.user.create({
      data: { email: superiorEmail, name: 'Superior', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    superiorId = superior.id

    const companyAdmin = await prisma.user.create({
      data: { email: companyAdminEmail, name: 'Company Admin', password: hash, role: 'COMPANY_ADMIN' },
    })
    companyAdminId = companyAdmin.id

    const normal = await prisma.user.create({
      data: { email: normalEmail, name: 'Normal', password: hash },
    })
    normalId = normal.id

    const target = await prisma.user.create({
      data: { email: targetEmail, name: 'Target', password: hash },
    })
    targetId = target.id

    for (const [email, token] of [
      [superiorEmail, 'superior'],
      [companyAdminEmail, 'companyAdmin'],
      [normalEmail, 'normal'],
    ] as const) {
      const res = await request(app).post('/api/v1/auth/login').send({ email, password })
      expect(res.status).toBe(200)
      const t = res.body?.data?.token
      expect(t).toBeTruthy()
      if (token === 'superior') superiorToken = t
      if (token === 'companyAdmin') companyAdminToken = t
      if (token === 'normal') normalToken = t
    }
  })

  afterAll(async () => {
    const ids = [superiorId, companyAdminId, normalId, targetId]
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  describe('isAdminUser() helper', () => {
    it('returns admin object for SUPERIOR_ADMIN role', async () => {
      const admin = await isAdminUser(superiorId)
      expect(admin).not.toBeNull()
      expect(admin?.role).toBe('SUPERIOR_ADMIN')
    })

    it('returns admin object for COMPANY_ADMIN role', async () => {
      const admin = await isAdminUser(companyAdminId)
      expect(admin).not.toBeNull()
      expect(admin?.role).toBe('COMPANY_ADMIN')
    })

    it('returns null for non-admin user', async () => {
      const admin = await isAdminUser(normalId)
      expect(admin).toBeNull()
    })

    it('returns null for unknown user id', async () => {
      const admin = await isAdminUser('00000000-0000-0000-0000-000000000000')
      expect(admin).toBeNull()
    })
  })

  describe('PUT /api/v1/auth/users/:userId/password — resetUserPassword', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .put(`/api/v1/auth/users/${targetId}/password`)
        .send({ newPassword: 'newPassword123' })
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/v1/auth/users/${targetId}/password`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ newPassword: 'newPassword123' })
      expect(res.status).toBe(403)
    })

    it('SUPERIOR_ADMIN can reset password', async () => {
      const res = await request(app)
        .put(`/api/v1/auth/users/${targetId}/password`)
        .set('Authorization', `Bearer ${superiorToken}`)
        .send({ newPassword: 'newPasswordSup123' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('COMPANY_ADMIN can reset password (regression for #106)', async () => {
      const res = await request(app)
        .put(`/api/v1/auth/users/${targetId}/password`)
        .set('Authorization', `Bearer ${companyAdminToken}`)
        .send({ newPassword: 'newPasswordCompany123' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('POST /api/v1/auth/users — createAdminUser (controller-local requireAdmin)', () => {
    it('returns 403 for non-admin user', async () => {
      const email = `authz-created-nope-${stamp}@example.com`
      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ email, name: 'Denied' })
      expect(res.status).toBe(403)
    })

    it('SUPERIOR_ADMIN can create user', async () => {
      const email = `authz-created-sup-${stamp}@example.com`
      createdEmails.push(email)
      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${superiorToken}`)
        .send({ email, name: 'By Sup' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
    })

    it('COMPANY_ADMIN can create user (regression for #106)', async () => {
      const email = `authz-created-company-${stamp}@example.com`
      createdEmails.push(email)
      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${companyAdminToken}`)
        .send({ email, name: 'By Company' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
    })
  })

  describe('login/register isAdmin flag reflects role', () => {
    it('login returns isAdmin=true for COMPANY_ADMIN (regression for #106)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: companyAdminEmail, password })
      expect(res.status).toBe(200)
      expect(res.body.data?.user?.isAdmin).toBe(true)
      expect(res.body.data?.user?.role).toBe('COMPANY_ADMIN')
    })

    it('login returns isAdmin=true for SUPERIOR_ADMIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: superiorEmail, password })
      expect(res.status).toBe(200)
      expect(res.body.data?.user?.isAdmin).toBe(true)
      expect(res.body.data?.user?.isSuperiorAdmin).toBe(true)
    })

    it('login returns isAdmin=false for a normal user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: normalEmail, password })
      expect(res.status).toBe(200)
      expect(res.body.data?.user?.isAdmin).toBe(false)
    })
  })
})
