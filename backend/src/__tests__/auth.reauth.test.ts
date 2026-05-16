/**
 * Reauthentication primitive tests (R-2, issue #392).
 *
 * Covers the universal CFR 21 Part 11 §11.200(a)(1) reauth primitive:
 *   - POST /api/v1/auth/reauth — validates the caller's password and mints
 *     a 60s purpose-scoped JWT.
 *   - the requireReauth middleware in auth.middleware.ts.
 *   - the authenticateToken hardening that rejects purpose:'reauth' tokens.
 *
 * Real DB, no mocks (.claude/testing.md). Isolated data with unique
 * timestamps; full afterAll cleanup.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { requireReauth, type AuthRequest } from '../middleware/auth.middleware'

const stamp = Date.now()
const suiteTag = `reauth-${stamp}`
const createdUserIds: string[] = []

function uniqueEmail(prefix: string): string {
  return `${suiteTag}-${prefix}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

/** Invoke requireReauth directly with crafted req/res/next; resolve the result. */
function runRequireReauth(opts: {
  reauthToken?: string
  sessionUserId?: string
}): Promise<{ status: number; body: unknown; nextCalled: boolean }> {
  return new Promise((resolve) => {
    let nextCalled = false
    const req = {
      headers: opts.reauthToken ? { 'x-reauth-token': opts.reauthToken } : {},
      userId: opts.sessionUserId,
      user: opts.sessionUserId
        ? { id: opts.sessionUserId, userId: opts.sessionUserId }
        : undefined,
    } as unknown as AuthRequest
    let statusCode = 200
    const res = {
      status(code: number) {
        statusCode = code
        return res
      },
      json(payload: unknown) {
        resolve({ status: statusCode, body: payload, nextCalled })
        return res
      },
    } as unknown as Response
    const next = () => {
      nextCalled = true
      resolve({ status: 200, body: null, nextCalled })
    }
    requireReauth(req, res, next)
  })
}

describe('POST /api/v1/auth/reauth — reauthentication primitive', () => {
  const password = 'reauth-pw-correct-12345'
  let email: string
  let userId: string
  let sessionToken: string

  beforeAll(async () => {
    email = uniqueEmail('user')
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name: 'Reauth User' },
    })
    userId = user.id
    createdUserIds.push(userId)
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
    sessionToken = login.body.data.token
  })

  it('returns 200 with reauthToken + expiresAt on the correct password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reauthToken).toBeTruthy()
    expect(typeof res.body.data.expiresAt).toBe('string')
    // expiresAt is ISO-8601 and ~60s in the future.
    const expiresMs = new Date(res.body.data.expiresAt).getTime()
    expect(Number.isNaN(expiresMs)).toBe(false)
    const deltaSeconds = (expiresMs - Date.now()) / 1000
    expect(deltaSeconds).toBeGreaterThan(45)
    expect(deltaSeconds).toBeLessThanOrEqual(61)
    // The minted token carries purpose:'reauth' and the caller's userId.
    const decoded = jwt.verify(
      res.body.data.reauthToken,
      process.env.JWT_SECRET as string,
      { algorithms: ['HS256'] },
    ) as jwt.JwtPayload
    expect(decoded.purpose).toBe('reauth')
    expect(decoded.userId).toBe(userId)
  })

  it('writes an auth:reauth-success AuditLog row on the correct password', async () => {
    const before = new Date()
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password })
    expect(res.status).toBe(200)
    const row = await prisma.auditLog.findFirst({
      where: { userId, action: 'auth:reauth-success', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
  })

  it('returns 401 and writes an auth:reauth-fail row on a wrong password', async () => {
    const before = new Date()
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password: 'definitely-not-the-password' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/incorrect/i)
    const row = await prisma.auditLog.findFirst({
      where: { userId, action: 'auth:reauth-fail', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
  })

  it('returns 401 when no session token is supplied', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .send({ password })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when the password body field is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/password/i)
  })

  it('returns 400 when the password body field is empty', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password: '' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('requireReauth middleware', () => {
  const password = 'mw-pw-correct-67890'
  let userAId: string
  let userBId: string
  let userASessionToken: string

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    const userA = await prisma.user.create({
      data: { email: uniqueEmail('mw-a'), password: hash, name: 'MW User A' },
    })
    userAId = userA.id
    createdUserIds.push(userAId)
    const userB = await prisma.user.create({
      data: { email: uniqueEmail('mw-b'), password: hash, name: 'MW User B' },
    })
    userBId = userB.id
    createdUserIds.push(userBId)
    const loginA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password })
    userASessionToken = loginA.body.data.token
  })

  it('passes a token freshly minted by POST /auth/reauth', async () => {
    const reauthRes = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${userASessionToken}`)
      .send({ password })
    expect(reauthRes.status).toBe(200)
    const result = await runRequireReauth({
      reauthToken: reauthRes.body.data.reauthToken,
      sessionUserId: userAId,
    })
    expect(result.nextCalled).toBe(true)
  })

  it('rejects a missing X-Reauth-Token header with 401', async () => {
    const result = await runRequireReauth({ sessionUserId: userAId })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { error: string }).error).toMatch(/reauthentication required/i)
  })

  it('rejects a malformed / bad-signature token with 401', async () => {
    const result = await runRequireReauth({
      reauthToken: jwt.sign({ userId: userAId, purpose: 'reauth' }, 'a-different-secret'),
      sessionUserId: userAId,
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { error: string }).error).toMatch(/invalid reauth token/i)
  })

  it('rejects an expired reauth token with 401', async () => {
    const expired = jwt.sign(
      { userId: userAId, purpose: 'reauth' },
      process.env.JWT_SECRET as string,
      { expiresIn: -10 },
    )
    const result = await runRequireReauth({
      reauthToken: expired,
      sessionUserId: userAId,
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { error: string }).error).toMatch(/expired/i)
  })

  it('rejects a token without purpose:reauth with 401', async () => {
    const wrongPurpose = jwt.sign(
      { userId: userAId },
      process.env.JWT_SECRET as string,
      { expiresIn: '60s' },
    )
    const result = await runRequireReauth({
      reauthToken: wrongPurpose,
      sessionUserId: userAId,
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { error: string }).error).toMatch(/not a reauth token/i)
  })

  it('rejects user A reauth token presented with user B session with 401', async () => {
    const reauthRes = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${userASessionToken}`)
      .send({ password })
    expect(reauthRes.status).toBe(200)
    const result = await runRequireReauth({
      reauthToken: reauthRes.body.data.reauthToken,
      sessionUserId: userBId,
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { error: string }).error).toMatch(/does not match/i)
  })
})

describe('authenticateToken hardening — reauth token is not a session token', () => {
  const password = 'harden-pw-correct-13579'
  let email: string
  let userId: string
  let sessionToken: string

  beforeAll(async () => {
    email = uniqueEmail('harden')
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name: 'Harden User' },
    })
    userId = user.id
    createdUserIds.push(userId)
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
    sessionToken = login.body.data.token
  })

  it('rejects a reauth token sent as Authorization: Bearer to an authenticateToken route', async () => {
    const reauthRes = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password })
    expect(reauthRes.status).toBe(200)
    const reauthToken = reauthRes.body.data.reauthToken

    // GET /api/v1/auth/me is guarded by authenticateToken. A reauth token
    // must not authenticate it.
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reauthToken}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)

    // Sanity: the genuine session token still works on the same route.
    const ok = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data.id).toBe(userId)
  })
})

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.auditLog
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => {})
  }
  await prisma.$disconnect()
})
