/**
 * Tests for POST /api/v1/feedback — anonymous + authenticated feedback
 * submission. The controller looks up the caller's name+email when the
 * Authorization header decodes to a valid user, but never blocks the
 * request when SMTP is missing — the email failure is logged and the
 * caller still gets `success: true`.
 *
 * The route as currently written only supports POST. We exercise:
 *   - happy path with auth
 *   - 401 without auth (the route uses authenticateToken)
 *   - file attachment plumbing parses base64 cleanly
 *   - non-base64 fileData is silently skipped (no attachment)
 *   - non-POST methods are not registered
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Feedback — POST /api/v1/feedback', () => {
  const stamp = Date.now()
  let userId: string
  let token: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `fbk-${stamp}@example.test`, password: 'x', name: `FBKUser-${stamp}` },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, secret)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token (route is gated by authenticateToken)', async () => {
    const res = await request(app).post('/api/v1/feedback').send({ message: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 200 with success=true for an authenticated submission, even when SMTP is missing', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: `feedback message ${stamp}` })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/feedback sent successfully/i)
  })

  it('parses a base64 data URL attachment without throwing', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZqIewAAAABJRU5ErkJggg=='
    const res = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'screenshot included', fileData: png, fileName: `fbk-${stamp}.png` })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('skips attachment when fileData has no base64 segment', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'no attachment', fileData: 'not-a-data-url', fileName: 'whatever.txt' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /feedback is not registered (404 / Not Found)', async () => {
    const res = await request(app).get('/api/v1/feedback').set('Authorization', `Bearer ${token}`)
    // Express will fall through to the 404 emitted by the catch-all
    // (or simply return 404 because the route does not handle GET).
    expect([404, 405]).toContain(res.status)
  })

  it('PUT /feedback is not registered', async () => {
    const res = await request(app)
      .put('/api/v1/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'ignored' })
    expect([404, 405]).toContain(res.status)
  })
})
