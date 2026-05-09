/**
 * Tests for /api/v1/definitions/:projectId — glossary + abbreviation CRUD.
 *
 * The router uses `projectIdParam` so the standard auth → resolve →
 * access-check chain runs first. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - happy path: list (empty → present), create, getOne, update, delete
 *   - validation: missing term, missing definition
 *   - duplicate term within a project returns 409 with code DUPLICATE_TERM
 *   - 404 on unknown id (still scoped to caller's project)
 *   - usage endpoint returns 200 with an array body
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Definition entries — /api/v1/definitions', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  const createdDefIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `def-o-${stamp}@example.test`, password: 'x', name: 'DefOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `def-x-${stamp}@example.test`, password: 'x', name: 'DefOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `def-a-${stamp}`
    const slugB = `def-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Def A ${stamp}`, domain: slugA, slug: slugA, userId: ownerId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `Def B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    if (createdDefIds.length > 0) {
      await prisma.definitionEntry
        .deleteMany({ where: { id: { in: createdDefIds } } })
        .catch(() => {})
    }
    await prisma.definitionEntry
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/definitions/${projectAId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:projectId returns 200 with array body', async () => {
    const res = await request(app)
      .get(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId rejects a missing term with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ definition: 'A definition without a term' })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId rejects a missing definition with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ term: `term-${stamp}` })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId creates a glossary entry and returns 201', async () => {
    const term = `MyTerm-${stamp}`
    const res = await request(app)
      .post(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ type: 'glossary', term, definition: 'A short definition.' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.term).toBe(term)
    expect(res.body.data.type).toBe('glossary')
    createdDefIds.push(res.body.data.id)
  })

  it('GET /:projectId/:id fetches the created entry', async () => {
    const id = createdDefIds[0]
    expect(id).toBeDefined()
    const res = await request(app)
      .get(`/api/v1/definitions/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
  })

  it('POST /:projectId returns 409 with code DUPLICATE_TERM on duplicate', async () => {
    const term = `MyTerm-${stamp}`
    const res = await request(app)
      .post(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ type: 'glossary', term, definition: 'Different text.' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DUPLICATE_TERM')
  })

  it('PUT /:projectId/:id updates definition text', async () => {
    const id = createdDefIds[0]
    const res = await request(app)
      .put(`/api/v1/definitions/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ definition: 'Updated text', notes: 'A note' })
    expect(res.status).toBe(200)
    expect(res.body.data.definition).toBe('Updated text')
    expect(res.body.data.notes).toBe('A note')
  })

  it('PUT /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .put(`/api/v1/definitions/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ definition: 'irrelevant' })
    expect(res.status).toBe(404)
  })

  it('GET /:projectId/:id/usage returns 200 with array', async () => {
    const id = createdDefIds[0]
    const res = await request(app)
      .get(`/api/v1/definitions/${projectAId}/${id}/usage`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /:projectId?type=abbreviation filters by type', async () => {
    // Create an abbreviation entry first.
    const abbr = await request(app)
      .post(`/api/v1/definitions/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ type: 'abbreviation', term: `ABBR-${stamp}`, definition: 'A B Br' })
    expect(abbr.status).toBe(201)
    createdDefIds.push(abbr.body.data.id)

    const res = await request(app)
      .get(`/api/v1/definitions/${projectAId}?type=abbreviation`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const types = (res.body.data as Array<{ type: string }>).map((d) => d.type)
    for (const t of types) expect(t).toBe('abbreviation')
  })

  it('DELETE /:projectId/:id deletes the entry', async () => {
    const id = createdDefIds[0]
    const res = await request(app)
      .delete(`/api/v1/definitions/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const after = await prisma.definitionEntry.findUnique({ where: { id } })
    expect(after).toBeNull()
    createdDefIds.shift()
  })

  it('DELETE /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/definitions/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})
