/**
 * Tests for /api/v1/diagrams/:projectId — MBSE diagram CRUD.
 *
 * The route file used to register `router.param('projectId', projectIdParam)`
 * BEFORE applying authenticateToken per-route, which made every
 * authenticated request 401 because Express runs param middleware
 * before per-route middleware. Fixed in the bug-fix batch by moving
 * `router.use(authenticateToken)` above `router.param(...)`. These
 * tests pin the fix.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Diagrams — /api/v1/diagrams/:projectId', () => {
  const stamp = Date.now()
  let userId: string
  let outsiderId: string
  let token: string
  let outsiderToken: string
  let projectId: string
  const createdDiagramIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u = await prisma.user.create({
      data: { email: `diag-${stamp}@example.test`, password: 'x', name: 'Diag User' },
    })
    userId = u.id
    token = jwt.sign({ userId: u.id }, secret)
    const o = await prisma.user.create({
      data: { email: `diag-out-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = o.id
    outsiderToken = jwt.sign({ userId: o.id }, secret)

    const slug = `diag-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Diag ${stamp}`, domain: slug, slug, userId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    await prisma.diagram
      .deleteMany({ where: { id: { in: createdDiagramIds } } })
      .catch(() => {})
    await prisma.diagram.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userId, outsiderId] } } })
      .catch(() => {})
  })

  it('GET without token returns 401', async () => {
    const res = await request(app).get(`/api/v1/diagrams/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('GET as a non-member returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/diagrams/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
  })

  it('GET as the project owner returns 200 and an array (proves auth + projectIdParam fire in the right order)', async () => {
    const res = await request(app)
      .get(`/api/v1/diagrams/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST creates a diagram with valid type', async () => {
    const res = await request(app)
      .post(`/api/v1/diagrams/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ diagramType: 'bdd', name: `Diag ${stamp}` })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.diagramType).toBe('bdd')
    createdDiagramIds.push(res.body.data.id)
  })

  it('POST rejects an invalid diagramType with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/diagrams/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ diagramType: 'banana', name: 'Bad' })
    expect(res.status).toBe(400)
  })

  it('POST rejects missing name with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/diagrams/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ diagramType: 'bdd' })
    expect(res.status).toBe(400)
  })

  it('GET /:diagramId fetches a single diagram', async () => {
    const created = createdDiagramIds[0]
    const res = await request(app)
      .get(`/api/v1/diagrams/${projectId}/${created}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(created)
  })

  it('PUT updates name', async () => {
    const created = createdDiagramIds[0]
    const newName = `Diag-Updated-${stamp}`
    const res = await request(app)
      .put(`/api/v1/diagrams/${projectId}/${created}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: newName })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(newName)
  })

  it('DELETE removes the diagram', async () => {
    const created = createdDiagramIds[0]
    const res = await request(app)
      .delete(`/api/v1/diagrams/${projectId}/${created}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const after = await prisma.diagram.findUnique({ where: { id: created } })
    expect(after).toBeNull()
    createdDiagramIds.shift()
  })
})
