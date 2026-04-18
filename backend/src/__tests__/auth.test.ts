/**
 * Auth endpoint integration tests (#109).
 *
 * Covers register, login, forgot-password, createAdminUser, resetUserPassword,
 * and the authenticateToken middleware. Fills the critical coverage gap
 * identified in issue #109 where no dedicated vitest suite existed for
 * auth.controller.ts (10 endpoints) or auth.middleware.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

const stamp = Date.now()
const suiteTag = `auth-${stamp}`
const createdUserIds: string[] = []

function uniqueEmail(prefix: string): string {
  return `${suiteTag}-${prefix}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with token and user on valid payload', async () => {
    const email = uniqueEmail('register-ok')
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'passw0rd123', name: 'Reg OK' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.user.email).toBe(email)
    expect(res.body.data.user.name).toBe('Reg OK')
    expect(res.body.data.user.id).toBeDefined()
    createdUserIds.push(res.body.data.user.id)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ password: 'passw0rd123', name: 'No Email' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('nopw'), name: 'No Pw' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('noname'), password: 'passw0rd123' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 for duplicate email', async () => {
    const email = uniqueEmail('dup')
    const first = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'passw0rd123', name: 'Dup 1' })
    expect(first.status).toBe(201)
    createdUserIds.push(first.body.data.user.id)

    const second = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'passw0rd123', name: 'Dup 2' })
    expect(second.status).toBe(400)
    expect(second.body.error).toMatch(/exists/i)
  })

  it('never returns plaintext password in response', async () => {
    const password = 'super-secret-987xyz'
    const email = uniqueEmail('noplain')
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'NoPlain' })
    expect(res.status).toBe(201)
    createdUserIds.push(res.body.data.user.id)
    expect(JSON.stringify(res.body)).not.toContain(password)
    expect(res.body.data.user).not.toHaveProperty('password')
  })
})

describe('POST /api/v1/auth/login', () => {
  let email: string
  const password = 'login-pw-12345'
  let userId: string

  beforeAll(async () => {
    email = uniqueEmail('login')
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name: 'Login User' },
    })
    userId = user.id
    createdUserIds.push(userId)
  })

  it('returns 200 with token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.user.email).toBe(email)
    expect(res.body.data.user.mustChangePassword).toBe(false)
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-zzz' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/invalid/i)
  })

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'whatever123' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when email or password missing', async () => {
    const r1 = await request(app).post('/api/v1/auth/login').send({ email })
    expect(r1.status).toBe(400)
    const r2 = await request(app).post('/api/v1/auth/login').send({ password })
    expect(r2.status).toBe(400)
  })

  it('returns mustChangePassword=true for accounts with temp password', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePasswordOnFirstLogin: true },
    })
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
    expect(res.status).toBe(200)
    expect(res.body.data.user.mustChangePassword).toBe(true)
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePasswordOnFirstLogin: false },
    })
  })
})

describe('POST /api/v1/auth/forgot-password', () => {
  let email: string
  let userId: string

  beforeAll(async () => {
    email = uniqueEmail('forgot')
    const hash = await bcrypt.hash('original-pw-123', 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name: 'Forgot User' },
    })
    userId = user.id
    createdUserIds.push(userId)
  })

  it('returns the same generic message whether the user exists or not', async () => {
    const hit = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email })
    const miss = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: uniqueEmail('nobody') })
    expect(hit.status).toBe(200)
    expect(miss.status).toBe(200)
    expect(hit.body.success).toBe(true)
    expect(miss.body.success).toBe(true)
    expect(hit.body.message).toBe(miss.body.message)
  })

  it('returns 200 and generic message when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/temporary password/i)
  })

  it('leaves the user DB row untouched when SMTP delivery fails (#107 regression)', async () => {
    // The test env has no SMTP configured, so sendForgotPasswordEmail throws
    // ECONNREFUSED. After the fix for #107, the handler must return the
    // generic success message but NOT rotate the password — otherwise a
    // transient SMTP outage locks every requester out of their real password.
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        mustChangePasswordOnFirstLogin: true,
      },
    })

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/temporary password/i)

    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        mustChangePasswordOnFirstLogin: true,
      },
    })
    expect(after!.password).toBe(before!.password)
    expect(after!.mustChangePasswordOnFirstLogin).toBe(before!.mustChangePasswordOnFirstLogin)
  })
})

describe('POST /api/v1/auth/users — createAdminUser', () => {
  let adminToken: string
  let memberToken: string
  let adminId: string
  let memberId: string

  beforeAll(async () => {
    const adminEmail = uniqueEmail('cau-admin')
    const memberEmail = uniqueEmail('cau-member')
    const pw = await bcrypt.hash('admin-pw-xyz', 10)
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: pw,
        name: 'CAU Admin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminId = admin.id
    createdUserIds.push(adminId)
    const member = await prisma.user.create({
      data: { email: memberEmail, password: pw, name: 'CAU Member' },
    })
    memberId = member.id
    createdUserIds.push(memberId)

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'admin-pw-xyz' })
    adminToken = adminLogin.body.data.token
    const memberLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password: 'admin-pw-xyz' })
    memberToken = memberLogin.body.data.token
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users')
      .send({ email: uniqueEmail('new-noauth') })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 for a non-admin user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: uniqueEmail('new-bymember') })
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('creates a user and returns a generatedPassword to the admin', async () => {
    const email = uniqueEmail('new-byadmin')
    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, name: 'Made By Admin' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.email).toBe(email)
    expect(res.body.data.generatedPassword).toMatch(/.{14,}/)
    createdUserIds.push(res.body.data.user.id)
  })

  it('sets mustChangePasswordOnFirstLogin=true on new admin-created users', async () => {
    const email = uniqueEmail('new-mustchange')
    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, name: 'Must Change' })
    expect(res.status).toBe(201)
    const created = await prisma.user.findUnique({
      where: { id: res.body.data.user.id },
      select: { mustChangePasswordOnFirstLogin: true },
    })
    expect(created?.mustChangePasswordOnFirstLogin).toBe(true)
    createdUserIds.push(res.body.data.user.id)
  })

  it('returns 400 when the email already exists', async () => {
    const email = uniqueEmail('dup-admin')
    const first = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email })
    expect(first.status).toBe(201)
    createdUserIds.push(first.body.data.user.id)

    const second = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email })
    expect(second.status).toBe(400)
  })
})

describe('PUT /api/v1/auth/users/:userId/password — resetUserPassword', () => {
  let adminToken: string
  let memberToken: string
  let adminId: string
  let memberId: string
  let targetId: string

  beforeAll(async () => {
    const pw = await bcrypt.hash('reset-pw-123', 10)
    const adminEmail = uniqueEmail('reset-admin')
    const memberEmail = uniqueEmail('reset-member')
    const targetEmail = uniqueEmail('reset-target')

    const admin = await prisma.user.create({
      data: { email: adminEmail, password: pw, name: 'Reset Admin', role: 'SUPERIOR_ADMIN' },
    })
    adminId = admin.id
    createdUserIds.push(adminId)
    const member = await prisma.user.create({
      data: { email: memberEmail, password: pw, name: 'Reset Member' },
    })
    memberId = member.id
    createdUserIds.push(memberId)
    const target = await prisma.user.create({
      data: { email: targetEmail, password: pw, name: 'Reset Target' },
    })
    targetId = target.id
    createdUserIds.push(targetId)

    const al = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'reset-pw-123' })
    adminToken = al.body.data.token
    const ml = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password: 'reset-pw-123' })
    memberToken = ml.body.data.token
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .put(`/api/v1/auth/users/${targetId}/password`)
      .send({ newPassword: 'new-secret-123' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin user', async () => {
    const res = await request(app)
      .put(`/api/v1/auth/users/${targetId}/password`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ newPassword: 'new-secret-123' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when the new password is shorter than 8 chars', async () => {
    const res = await request(app)
      .put(`/api/v1/auth/users/${targetId}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8 characters/i)
  })

  it('returns 404 when the target user does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/auth/users/00000000-0000-0000-0000-000000000000/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'new-secret-123' })
    expect(res.status).toBe(404)
  })

  it('returns 200 and actually updates the hash when invoked by an admin', async () => {
    const before = await prisma.user.findUnique({
      where: { id: targetId },
      select: { password: true },
    })
    const res = await request(app)
      .put(`/api/v1/auth/users/${targetId}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'new-secret-123' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const after = await prisma.user.findUnique({
      where: { id: targetId },
      select: { password: true, mustChangePasswordOnFirstLogin: true },
    })
    expect(after!.password).not.toBe(before!.password)
    expect(after!.mustChangePasswordOnFirstLogin).toBe(true)
  })
})

describe('authenticateToken middleware via GET /api/v1/auth/me', () => {
  let userId: string
  let validToken: string

  beforeAll(async () => {
    const email = uniqueEmail('me')
    const hash = await bcrypt.hash('me-pw-123', 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name: 'Me User' },
    })
    userId = user.id
    createdUserIds.push(userId)
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set in test env')
    validToken = jwt.sign({ userId }, secret, { expiresIn: '1h' })
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/no token/i)
  })

  it('returns 403 for an invalid or expired token', async () => {
    const secret = process.env.JWT_SECRET!
    const expired = jwt.sign({ userId }, secret, { expiresIn: -10 })
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/invalid token/i)

    const malformed = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.real.jwt')
    expect(malformed.status).toBe(403)
  })

  it('returns 200 with current user on a valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe(userId)
  })
})

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => {})
  }
  await prisma.$disconnect()
})
