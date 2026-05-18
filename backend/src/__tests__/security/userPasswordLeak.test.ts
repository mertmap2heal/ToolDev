/**
 * Regression guard — User.password (bcrypt hash) must never reach an API
 * response.
 *
 * The `User` Prisma model stores the bcrypt hash in `password`. Several
 * endpoints serialised a full `User` row into their response via a bare
 * `include: { user: true }` (audit logs) or `include: { owner: true,
 * createdBy: true }` (validation items). Any authenticated client hitting
 * those endpoints received password hashes over the wire. The NX-8 security
 * review flagged it on `getProjectAuditLogs`.
 *
 * The fix replaces every API-facing bare `User` include with an explicit
 * `select` of the shared `SAFE_USER_SELECT` field set (`backend/src/lib/
 * safeUserSelect.ts`) — `{ id, name, email, role }`, never `password`.
 *
 * This test hits the fixed endpoints with real HTTP requests and asserts
 * that no object anywhere in the response carries a `password` (or
 * `passwordHash`) key. It deep-walks the response so a hash nested inside
 * `data[].user`, `data.owner`, `data.createdBy`, etc. is caught.
 *
 * It also asserts the expected non-sensitive fields ARE present, so a future
 * over-correction (dropping the `user` relation entirely) is caught too.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Recursively walk any JSON value and collect the dotted paths of every
 * `password` / `passwordHash` key found. An empty array means no leak.
 */
function findSensitiveKeyPaths(value: unknown, path = '$'): string[] {
  const hits: string[] = []
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findSensitiveKeyPaths(item, `${path}[${i}]`)))
    return hits
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'password' || key === 'passwordHash') {
        hits.push(`${path}.${key}`)
      }
      hits.push(...findSensitiveKeyPaths(child, `${path}.${key}`))
    }
  }
  return hits
}

describe('security — User.password must not leak into API responses', () => {
  let ownerUserId: string
  let ownerToken: string
  let projectId: string

  beforeAll(async () => {
    const ts = Date.now()

    const owner = await prisma.user.create({
      data: {
        email: `pw-leak-owner-${ts}@example.com`,
        // Plaintext literal is deliberate — the test asserts the `password`
        // KEY is absent from responses, regardless of its value.
        password: 'plaintext-test-secret-do-not-leak',
        name: 'PW Leak Owner',
      },
    })
    ownerUserId = owner.id
    ownerToken = jwt.sign({ userId: ownerUserId }, process.env.JWT_SECRET || 'secret')

    const slug = `pw-leak-test-${ts}`
    const project = await prisma.project.create({
      data: { name: `PW Leak Test ${ts}`, domain: slug, slug, description: '', userId: ownerUserId },
    })
    projectId = project.id

    // Seed one AuditLog row with a userId so the endpoint's `include` on the
    // `user` relation actually populates a User object in the response.
    await prisma.auditLog.create({
      data: { projectId, userId: ownerUserId, action: 'security:pw-leak-test-seed' },
    })
  })

  afterAll(async () => {
    // Reverse dependency order: audit logs + validation items, then project,
    // then user. Deleting the project cascades members; clear the rest first.
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.validationItem.deleteMany({ where: { projectId } })
    await prisma.validationSettings.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: ownerUserId } })
    await prisma.$disconnect()
  })

  it('GET /projects/:id/audit-logs (unpaginated) does not leak User.password', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)

    const leaks = findSensitiveKeyPaths(res.body)
    expect(leaks, `password hash leaked at: ${leaks.join(', ')}`).toEqual([])

    // The seeded row's user object must still be present and carry the
    // expected non-sensitive fields — guards against an over-correction
    // that drops the `user` relation entirely.
    const seeded = res.body.data.find(
      (r: { action: string }) => r.action === 'security:pw-leak-test-seed',
    )
    expect(seeded).toBeDefined()
    expect(seeded.user).toMatchObject({ id: ownerUserId, name: 'PW Leak Owner' })
    expect(seeded.user.password).toBeUndefined()
  })

  it('GET /projects/:id/audit-logs (paginated) does not leak User.password', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs?page=1&pageSize=50`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.pagination).toBeDefined()

    const leaks = findSensitiveKeyPaths(res.body)
    expect(leaks, `password hash leaked at: ${leaks.join(', ')}`).toEqual([])
  })

  it('POST /validation/projects/:id/items does not leak User.password on owner/createdBy', async () => {
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'PW leak guard validation item', ownerUserId })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    const leaks = findSensitiveKeyPaths(res.body)
    expect(leaks, `password hash leaked at: ${leaks.join(', ')}`).toEqual([])

    // Both `owner` and `createdBy` are User relations — both must be
    // populated (the item was created with ownerUserId set) and neither may
    // carry the hash.
    expect(res.body.data.owner).toMatchObject({ id: ownerUserId })
    expect(res.body.data.owner.password).toBeUndefined()
    expect(res.body.data.createdBy).toMatchObject({ id: ownerUserId })
    expect(res.body.data.createdBy.password).toBeUndefined()
  })
})
