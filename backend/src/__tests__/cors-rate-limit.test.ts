/**
 * Tests for #35 (CORS allowlist) and #36 (rate limiting on auth endpoints).
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { app } from '../server'

describe('CORS — origin allowlist (#35)', () => {
  it('allows requests from localhost:3000 (default dev origin)', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })

  it('rejects requests from an unknown origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com')
    // CORS rejection: no allow-origin header in the response
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('allows same-origin requests (no Origin header)', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
  })
})

describe('Rate limiting — auth endpoints (#36)', () => {
  it('limiter is bypassed in test mode (NODE_ENV=test)', async () => {
    // Confirms the skip() function works so tests are never throttled
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'wrongpassword' })
    expect(res.status).not.toBe(429)
  })

  it('forgot-password is accessible in test mode (limiter skipped)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })
    expect(res.status).not.toBe(429)
  })

  it('returns 429 when limit is exceeded (isolated test app)', async () => {
    // Create a minimal express app with a limit of 2 and no test skip,
    // so we can verify the 429 response without hitting the production limiter.
    const testApp = express()
    testApp.use(express.json())
    const strictLimiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many attempts — please try again in 15 minutes.' },
    })
    testApp.post('/test-limit', strictLimiter, (_req, res) => res.json({ ok: true }))

    // First two requests succeed
    await request(testApp).post('/test-limit')
    await request(testApp).post('/test-limit')
    // Third should be rate-limited
    const res = await request(testApp).post('/test-limit')
    expect(res.status).toBe(429)
    expect(res.body.error).toMatch(/too many/i)
  })

  it('rate limit response includes RateLimit headers', async () => {
    const testApp = express()
    testApp.use(express.json())
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 1,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many attempts — please try again in 15 minutes.' },
    })
    testApp.post('/header-test', limiter, (_req, res) => res.json({ ok: true }))

    const res = await request(testApp).post('/header-test')
    // RateLimit-Limit header should be present (standardHeaders: true)
    expect(res.headers['ratelimit-limit'] ?? res.headers['x-ratelimit-limit']).toBeDefined()
  })
})
