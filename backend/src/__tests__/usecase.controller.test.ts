/**
 * Tests for /api/v1/usecases/:projectId — UseCase + Actor CRUD.
 *
 * The router declares both `/:projectId/...` (use case CRUD) and
 * `/:projectId/actors[/...]` (actor CRUD).
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 403 outsider
 *   - UseCase: list (empty), create, validate name required, get by db id and
 *     by useCaseId alias, update, duplicate provided id rejected, delete
 *   - Actor: list, create, validate name+type required, duplicate name rejected,
 *     update, delete
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('UseCases & Actors — /api/v1/usecases', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let useCaseDbId: string
  let useCaseHumanId: string
  let actorId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `uc-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `uc-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `uc-${stamp}`
    const p = await prisma.project.create({
      data: { name: `UC ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    await prisma.useCaseActor.deleteMany({ where: { useCase: { projectId } } }).catch(() => {})
    await prisma.useCase.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.actor.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET use cases without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/usecases/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('GET use cases by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET use cases on an empty project returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('POST without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('POST creates a use case with auto-allocated useCaseId', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `Login flow ${stamp}`,
        description: 'User authentication',
        priority: 'high',
        complexity: 'moderate',
        actors: ['User', 'AuthSystem'],
        alternativeFlows: [{ id: 1, steps: ['failed login'] }],
      })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.useCaseId).toBeTruthy()
    useCaseDbId = res.body.data.id
    useCaseHumanId = res.body.data.useCaseId
  })

  it('POST with duplicate provided useCaseId returns 500/error', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        useCaseId: useCaseHumanId,
        name: `Conflict ${stamp}`,
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.success).toBe(false)
  })

  it('GET by db id returns the use case', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}/${useCaseDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(useCaseDbId)
  })

  it('GET by useCaseId (human-readable) also returns the use case', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}/${useCaseHumanId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(useCaseDbId)
  })

  it('GET unknown id returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('PUT updates the use case', async () => {
    const res = await request(app)
      .put(`/api/v1/usecases/${projectId}/${useCaseDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Updated name ${stamp}`, status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(`Updated name ${stamp}`)
    expect(res.body.data.status).toBe('active')
  })

  it('DELETE removes the use case', async () => {
    const res = await request(app)
      .delete(`/api/v1/usecases/${projectId}/${useCaseDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const gone = await prisma.useCase.findUnique({ where: { id: useCaseDbId } })
    expect(gone).toBeNull()
  })

  // ----- Actors -----

  it('POST actor without name+type returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}/actors`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Only name' })
    expect(res.status).toBe(400)
  })

  it('POST creates an actor', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}/actors`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Operator ${stamp}`, type: 'primary', description: 'main user' })
    expect(res.status).toBe(201)
    actorId = res.body.data.id
  })

  it('POST duplicate actor name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/usecases/${projectId}/actors`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Operator ${stamp}`, type: 'secondary' })
    expect(res.status).toBe(400)
  })

  it('GET actors lists the actor (route ordering fixed)', async () => {
    const res = await request(app)
      .get(`/api/v1/usecases/${projectId}/actors`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('PUT actor updates fields', async () => {
    const res = await request(app)
      .put(`/api/v1/usecases/${projectId}/actors/${actorId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'updated desc' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('updated desc')
  })

  it('PUT actor with unknown id returns 404', async () => {
    const res = await request(app)
      .put(`/api/v1/usecases/${projectId}/actors/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'x' })
    expect(res.status).toBe(404)
  })

  it('DELETE actor', async () => {
    const res = await request(app)
      .delete(`/api/v1/usecases/${projectId}/actors/${actorId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
  })

  it('DELETE actor with unknown id returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/usecases/${projectId}/actors/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})
