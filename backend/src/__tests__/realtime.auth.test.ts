/**
 * Socket.IO authentication tests (issue #170).
 *
 * Covers:
 *   1. The pure auth helpers in realtimeAuth.ts (extractTokenFromHandshake,
 *      verifySocketToken, isProjectMember).
 *   2. An integration test that starts a Socket.IO server behind the same
 *      http server used in server.ts and asserts the io.use() middleware
 *      rejects an unauthenticated handshake at the engine.io HTTP level.
 *
 * No new runtime dependencies are added. We verify the handshake rejection
 * by hitting the engine.io HTTP polling endpoint directly with Node's
 * built-in http client, which returns a 401-style response when io.use()
 * calls next(new Error(...)).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import {
  extractTokenFromHandshake,
  verifySocketToken,
  isProjectMember,
  getAllowedOrigins,
} from '../realtime/realtimeAuth'
import { setupRealtime } from '../realtime/realtime'

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

function makeHandshake(overrides: Partial<{
  auth: Record<string, unknown>
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}> = {}): any {
  return {
    auth: overrides.auth ?? {},
    headers: overrides.headers ?? {},
    query: overrides.query ?? {},
  }
}

describe('realtimeAuth.extractTokenFromHandshake', () => {
  it('returns auth.token when present (preferred location)', () => {
    const hs = makeHandshake({ auth: { token: 'abc.123' } })
    expect(extractTokenFromHandshake(hs)).toBe('abc.123')
  })

  it('falls back to Authorization: Bearer header', () => {
    const hs = makeHandshake({ headers: { authorization: 'Bearer header.token' } })
    expect(extractTokenFromHandshake(hs)).toBe('header.token')
  })

  it('falls back to query.token', () => {
    const hs = makeHandshake({ query: { token: 'query.token' } })
    expect(extractTokenFromHandshake(hs)).toBe('query.token')
  })

  it('returns null when no token is provided anywhere', () => {
    const hs = makeHandshake()
    expect(extractTokenFromHandshake(hs)).toBeNull()
  })

  it('prefers auth.token over header and query', () => {
    const hs = makeHandshake({
      auth: { token: 'auth' },
      headers: { authorization: 'Bearer header' },
      query: { token: 'query' },
    })
    expect(extractTokenFromHandshake(hs)).toBe('auth')
  })
})

describe('realtimeAuth.verifySocketToken', () => {
  let userId: string
  let userEmail: string
  let otherUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    userEmail = `realtime-auth-user-${ts}@example.com`
    const u = await prisma.user.create({
      data: { email: userEmail, password: 'x', name: 'Realtime Auth User' },
    })
    userId = u.id
    const o = await prisma.user.create({
      data: { email: `realtime-auth-other-${ts}@example.com`, password: 'x', name: 'Other' },
    })
    otherUserId = o.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
  })

  it('rejects when token is missing', async () => {
    const result = await verifySocketToken(null, JWT_SECRET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/required/i)
  })

  it('rejects when JWT secret is missing (server misconfigured)', async () => {
    const token = jwt.sign({ userId }, JWT_SECRET)
    const result = await verifySocketToken(token, undefined)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/jwt_secret/i)
  })

  it('rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign({ userId }, 'different-secret')
    const result = await verifySocketToken(token, JWT_SECRET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid|expired/i)
  })

  it('rejects when the token refers to a user that no longer exists', async () => {
    const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000' }, JWT_SECRET)
    const result = await verifySocketToken(token, JWT_SECRET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/user not found/i)
  })

  it('accepts a valid token and returns the user', async () => {
    const token = jwt.sign({ userId }, JWT_SECRET)
    const result = await verifySocketToken(token, JWT_SECRET)
    expect(result.ok).toBe(true)
    expect(result.user?.userId).toBe(userId)
    expect(result.user?.email).toBe(userEmail)
  })

  it('isAdmin=true when user has role SUPERIOR_ADMIN', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'SUPERIOR_ADMIN' } })
    try {
      const token = jwt.sign({ userId }, JWT_SECRET)
      const result = await verifySocketToken(token, JWT_SECRET, { adminEmails: '' })
      expect(result.ok).toBe(true)
      expect(result.user?.isAdmin).toBe(true)
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { role: null } })
    }
  })

  it('isAdmin=true when email is listed in ADMIN_EMAILS', async () => {
    const token = jwt.sign({ userId }, JWT_SECRET)
    const result = await verifySocketToken(token, JWT_SECRET, {
      adminEmails: `other@example.com, ${userEmail}`,
    })
    expect(result.ok).toBe(true)
    expect(result.user?.isAdmin).toBe(true)
  })

  it('isAdmin=false for a regular user when admin list does not include them', async () => {
    const token = jwt.sign({ userId }, JWT_SECRET)
    const result = await verifySocketToken(token, JWT_SECRET, {
      adminEmails: 'someone-else@example.com',
    })
    expect(result.ok).toBe(true)
    expect(result.user?.isAdmin).toBe(false)
  })
})

describe('realtimeAuth.isProjectMember', () => {
  let memberId: string
  let outsiderId: string
  let projectId: string

  beforeAll(async () => {
    const ts = Date.now()
    const member = await prisma.user.create({
      data: { email: `rt-member-${ts}@example.com`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    const outsider = await prisma.user.create({
      data: { email: `rt-outsider-${ts}@example.com`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    const slug = `rt-membership-${ts}`
    const project = await prisma.project.create({
      data: { name: `Realtime Membership ${ts}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } })
  })

  it('returns true for a user with a ProjectMember row', async () => {
    await expect(isProjectMember(memberId, projectId)).resolves.toBe(true)
  })

  it('returns false for a user without a ProjectMember row', async () => {
    await expect(isProjectMember(outsiderId, projectId)).resolves.toBe(false)
  })
})

describe('realtimeAuth.getAllowedOrigins', () => {
  it('always includes localhost:3000 for dev', () => {
    const origins = getAllowedOrigins()
    expect(origins).toContain('http://localhost:3000')
    // must NOT include wildcard
    expect(origins).not.toContain('*')
  })
})

/**
 * Integration test: spin up a real Socket.IO server (via setupRealtime)
 * behind a throw-away http server and verify that the io.use() middleware
 * rejects unauthenticated connections.
 *
 * Socket.IO v4 runs io.use() when the client sends the namespace OPEN
 * packet ("40...") over the engine.io transport, not during the initial
 * engine.io handshake. We therefore:
 *   1. Perform the engine.io /socket.io/?EIO=4&transport=polling open to
 *      get a session id (sid).
 *   2. POST the namespace connect packet ("40" for default namespace) to
 *      the same sid.
 *   3. GET the next polling message, which contains the server's CONNECT
 *      ERROR packet ("44{...}") carrying the middleware's error string.
 *
 * No new dependencies are added — only Node's built-in http module.
 */
describe('Socket.IO server — middleware rejection (integration)', () => {
  let server: http.Server
  let port: number
  let testUserId: string
  let testUserToken: string

  beforeAll(async () => {
    server = http.createServer()
    setupRealtime(server, prisma as any)
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })
    const addr = server.address()
    if (typeof addr === 'object' && addr && 'port' in addr) {
      port = addr.port
    } else {
      throw new Error('Failed to bind integration test server')
    }
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `rt-integ-${ts}@example.com`, password: 'x', name: 'Integ' },
    })
    testUserId = user.id
    testUserToken = jwt.sign({ userId: testUserId }, JWT_SECRET)
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  function httpRequest(opts: { method: 'GET' | 'POST'; path: string; body?: string }): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method: opts.method,
          path: opts.path,
          headers: opts.body
            ? { 'Content-Type': 'text/plain; charset=UTF-8', 'Content-Length': Buffer.byteLength(opts.body) }
            : {},
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }))
        }
      )
      req.on('error', reject)
      req.setTimeout(5000, () => req.destroy(new Error('request timeout')))
      if (opts.body) req.write(opts.body)
      req.end()
    })
  }

  /**
   * Opens an engine.io polling session and sends a namespace CONNECT packet
   * ("40"). Returns the server's response to the subsequent poll, which
   * contains either a CONNECT packet ("40...") on success or a CONNECT_ERROR
   * packet ("44{...}") on middleware rejection.
   */
  async function attemptSocketIoConnect(opts: { token?: string } = {}): Promise<string> {
    const params = new URLSearchParams({ EIO: '4', transport: 'polling' })
    if (opts.token) params.set('token', opts.token)
    const base = `/socket.io/?${params.toString()}`

    // Step 1: open — get sid.
    const openRes = await httpRequest({ method: 'GET', path: base })
    // body format: "0{json}"
    const payload = openRes.body.startsWith('0') ? openRes.body.slice(1) : openRes.body
    const first = (() => { try { return JSON.parse(payload) as { sid?: string } } catch { return {} } })()
    const sid = first.sid
    if (!sid) return openRes.body

    // Step 2: send namespace connect packet "40".
    await httpRequest({ method: 'POST', path: `${base}&sid=${sid}`, body: '40' })

    // Step 3: poll for server reply (CONNECT or CONNECT_ERROR).
    const pollRes = await httpRequest({ method: 'GET', path: `${base}&sid=${sid}` })
    return pollRes.body
  }

  it('rejects namespace connect when no JWT is supplied', async () => {
    const body = await attemptSocketIoConnect()
    // "44" = CONNECT_ERROR in Socket.IO v4 protocol
    expect(body).toMatch(/^44/)
    expect(body.toLowerCase()).toMatch(/authentication|required|invalid/i)
  })

  it('rejects namespace connect when the JWT is invalid', async () => {
    const body = await attemptSocketIoConnect({ token: 'not-a-real-jwt' })
    expect(body).toMatch(/^44/)
    expect(body.toLowerCase()).toMatch(/invalid|expired|authentication/i)
  })

  it('accepts namespace connect when a valid JWT is supplied', async () => {
    const body = await attemptSocketIoConnect({ token: testUserToken })
    // "40" = CONNECT (with optional payload), never a CONNECT_ERROR "44"
    expect(body).not.toMatch(/^44/)
    expect(body.toLowerCase()).not.toMatch(/authentication required/i)
  })
})
